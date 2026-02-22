/// Binance WebSocket feed – streams BTC/USDT best bid/ask (bookTicker).
///
/// On every tick we:
///   1. Parse bid + ask → compute mid-price.
///   2. Write `HftState::btc_price`.
///   3. Recalculate Black-Scholes + Kelly and write results back to state.
///   4. Auto-reconnect on any error with exponential back-off.
use std::time::Duration;

use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

use crate::math::{kelly_size, price_binary_call, tte_from_expiry, BsInput};
use crate::state::SharedState;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_URL: &str = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker";
/// Annualised implied volatility estimate – in a production system this would
/// come from Deribit or be calculated from recent realised vol.
const DEFAULT_IV: f64 = 0.80; // 80 %

// ---------------------------------------------------------------------------
// Wire format from Binance bookTicker
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct BookTicker {
    /// Best bid price
    #[serde(rename = "b")]
    bid: String,
    /// Best ask price
    #[serde(rename = "a")]
    ask: String,
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/// Spawn-and-forget task.  Runs forever, reconnecting on failures.
pub async fn run(state: SharedState) {
    let mut backoff_secs = 1u64;

    loop {
        match connect_and_stream(state.clone()).await {
            Ok(_) => {
                // Stream ended cleanly (server close frame) – reconnect immediately
                info!("[binance_ws] stream closed cleanly – reconnecting");
                backoff_secs = 1;
            }
            Err(e) => {
                error!("[binance_ws] error: {e:#} – reconnecting in {backoff_secs}s");
                sleep(Duration::from_secs(backoff_secs)).await;
                backoff_secs = (backoff_secs * 2).min(60);
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Inner streaming loop
// ---------------------------------------------------------------------------

async fn connect_and_stream(state: SharedState) -> Result<()> {
    info!("[binance_ws] connecting to {WS_URL}");
    let (ws_stream, _) = connect_async(WS_URL).await?;
    let (mut write, mut read) = ws_stream.split();

    info!("[binance_ws] connected – streaming BTC bookTicker");

    while let Some(msg) = read.next().await {
        match msg? {
            Message::Text(text) => {
                handle_tick(&text, state.clone()).await;
            }
            Message::Ping(data) => {
                // Respond to pings so the connection stays alive
                debug!("[binance_ws] ping received – sending pong");
                write.send(Message::Pong(data)).await?;
            }
            Message::Close(_) => {
                warn!("[binance_ws] received close frame");
                break;
            }
            _ => {} // ignore binary frames, etc.
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Per-tick handler
// ---------------------------------------------------------------------------

async fn handle_tick(raw: &str, state: SharedState) {
    let ticker: BookTicker = match serde_json::from_str(raw) {
        Ok(t) => t,
        Err(e) => {
            warn!("[binance_ws] failed to parse tick: {e} – raw={raw}");
            return;
        }
    };

    let bid: f64 = match ticker.bid.parse() {
        Ok(v) => v,
        Err(_) => return,
    };
    let ask: f64 = match ticker.ask.parse() {
        Ok(v) => v,
        Err(_) => return,
    };

    let mid = (bid + ask) / 2.0;

    // Read market parameters from shared state (minimise lock hold time)
    let (strike, expiry, market_price) = {
        let s = state.read().await;
        (s.active_market_strike, s.active_market_expiry, s.polymarket_yes_price)
    };

    // Recalculate math only if we have a valid market loaded
    let (bs_out, kelly_out) = if strike > 0.0 && expiry > 0 {
        let tte = tte_from_expiry(expiry);
        let inp = BsInput {
            spot: mid,
            strike,
            iv: DEFAULT_IV,
            tte_secs: tte,
            risk_free: 0.0,
        };
        let bs = price_binary_call(&inp);
        let kelly = bs.as_ref().map(|b| kelly_size(b.fair_value, market_price));
        (bs, kelly)
    } else {
        (None, None)
    };

    // Write everything in a single lock acquisition
    let mut s = state.write().await;
    s.btc_price = mid;

    if let Some(bs) = bs_out {
        s.bs_fair_value = bs.fair_value;
        s.bs_delta = bs.delta;
        s.bs_gamma = bs.gamma;
        s.bs_theta = bs.theta;
        s.bs_vega = bs.vega;
        s.edge = bs.fair_value - s.polymarket_yes_price;
    }

    if let Some(k) = kelly_out {
        s.kelly_fraction_raw = k.raw_fraction;
        s.kelly_fraction = k.capped_fraction;
    }

    debug!(
        "[binance_ws] BTC mid={:.2}  bs_fv={:.4}  edge={:.4}  kelly={:.4}",
        s.btc_price, s.bs_fair_value, s.edge, s.kelly_fraction
    );
}
