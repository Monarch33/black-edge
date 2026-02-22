/// Binance WebSocket ingestion module.
///
/// Connects to the Binance `btcusdt@bookTicker` stream for real-time
/// best bid/ask updates on BTCUSDT. On every tick:
///   1. Updates HftState with new bid/ask/mid-price and timestamp.
///   2. Recalculates Black-Scholes and Kelly sizing if an active
///      Polymarket market is loaded.
///   3. Estimates Chainlink diffusion latency (Binance→oracle→Polymarket).
///
/// Stream URL: wss://stream.binance.com:9443/ws/btcusdt@bookTicker
///
/// Message format (bookTicker):
/// {
///   "u": 400900217,    // order book updateId
///   "s": "BTCUSDT",
///   "b": "11754.49",  // best bid price
///   "B": "1.35",      // best bid qty
///   "a": "11756.99",  // best ask price
///   "A": "2.1"        // best ask qty
/// }

use std::time::Duration;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::black_scholes::{self, BsInput};
use crate::kelly::{self, KellyInput};
use crate::state::SharedState;

const BINANCE_WS_URL: &str = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker";
/// Default annualized sigma for BTC short-dated options (80% IV).
const DEFAULT_SIGMA: f64 = 0.80;
/// Risk-free rate (5% annualized).
const RISK_FREE_RATE: f64 = 0.05;

#[derive(Debug, Deserialize)]
struct BookTicker {
    /// Best bid price
    #[serde(rename = "b")]
    bid: String,
    /// Best ask price
    #[serde(rename = "a")]
    ask: String,
}

/// Parse a `BookTicker` message and return (bid, ask, mid).
fn parse_book_ticker(text: &str) -> Option<(f64, f64, f64)> {
    let ticker: BookTicker = serde_json::from_str(text).ok()?;
    let bid: f64 = ticker.bid.parse().ok()?;
    let ask: f64 = ticker.ask.parse().ok()?;
    let mid = (bid + ask) / 2.0;
    Some((bid, ask, mid))
}

/// Main Binance ingestion loop. Runs forever with exponential-backoff reconnect.
pub async fn run(state: SharedState, bankroll: f64) {
    let mut backoff_secs = 1u64;

    loop {
        info!("[BINANCE] Connecting to {}", BINANCE_WS_URL);

        match connect_async(BINANCE_WS_URL).await {
            Ok((ws_stream, _)) => {
                info!("[BINANCE] Connected. Streaming BTCUSDT book ticker.");
                backoff_secs = 1; // reset on success
                let (mut _sink, mut stream) = ws_stream.split();

                while let Some(msg) = stream.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            if let Some((bid, ask, mid)) = parse_book_ticker(&text) {
                                process_tick(mid, bid, ask, &state, bankroll).await;
                            }
                        }
                        Ok(Message::Ping(payload)) => {
                            // Respond with Pong (tungstenite auto-handles this,
                            // but we can also do it explicitly)
                            let _ = _sink.send(Message::Pong(payload)).await;
                        }
                        Ok(Message::Close(_)) => {
                            warn!("[BINANCE] Stream closed by server.");
                            break;
                        }
                        Err(e) => {
                            error!("[BINANCE] WebSocket error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }
            }
            Err(e) => {
                error!("[BINANCE] Connection failed: {}. Retrying in {}s.", e, backoff_secs);
            }
        }

        tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
        backoff_secs = (backoff_secs * 2).min(60);
    }
}

/// Update state from a single Binance tick and recalculate derived metrics.
async fn process_tick(mid: f64, bid: f64, ask: f64, state: &SharedState, bankroll: f64) {
    let now_ms = chrono::Utc::now().timestamp_millis();

    // Read current Polymarket data while holding a read lock
    let (poly_price, active_market_clone) = {
        let s = state.read().await;
        (s.polymarket_price, s.active_market.clone())
    };

    // Compute Black-Scholes if we have an active market
    let (bs_result, kelly_result) = if let Some(ref market) = active_market_clone {
        let t = market.time_to_expiry_years.max(0.0);
        let bs_input = BsInput {
            spot: mid,
            strike: market.strike,
            time_to_expiry_years: t,
            risk_free_rate: RISK_FREE_RATE,
            sigma: DEFAULT_SIGMA,
            market_price: poly_price,
        };

        let bs = black_scholes::calculate(&bs_input);
        let kelly = bs.as_ref().map(|b| {
            kelly::calculate(&KellyInput {
                win_prob: b.fair_price,
                market_price: poly_price,
                bankroll,
            })
        });
        (bs, kelly)
    } else {
        (None, None)
    };

    // Estimate Chainlink diffusion latency:
    // We compare our Binance update time vs the last Polymarket price update time.
    // As a proxy we use a fixed estimate of ~300-400ms typical oracle lag.
    // TODO: measure actual delta between Binance tick and Polymarket confirmation.
    let spread_ms = 340i64;

    // Write updated state
    let mut s = state.write().await;
    s.btc_price = mid;
    s.btc_bid = bid;
    s.btc_ask = ask;
    s.last_update_ms = now_ms;
    s.bs_result = bs_result;
    s.kelly_result = kelly_result;
    s.spread_ms = spread_ms;
}
