//! Binance `btcusdt@bookTicker` WebSocket ingestor.
//!
//! Maintains a persistent connection to Binance's individual stream endpoint.
//! On every tick it computes:
//!   - The BTC/USDC mid-price → `HftState.btc_price`
//!   - The L2 orderbook imbalance → `HftState.ob_imbalance`
//!
//! Orderbook imbalance I = (V_bid − V_ask) / (V_bid + V_ask).
//! Range [-1.0, 1.0]:  +1 = all bid volume (bullish pressure),
//!                      -1 = all ask volume (bearish pressure).
//!
//! Reconnects automatically with 2-second back-off on any error.

use std::time::Duration;

use futures_util::StreamExt;
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::state::SharedState;

const BINANCE_WS_URL: &str = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker";

// ── Wire types ────────────────────────────────────────────────────────────────

/// Binance individual book-ticker message.
/// Ref: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#individual-symbol-book-ticker-streams
#[derive(Debug, Deserialize)]
struct BookTicker {
    /// Best bid price
    #[serde(rename = "b")]
    bid: String,
    /// Best bid quantity
    #[serde(rename = "B")]
    bid_qty: String,
    /// Best ask price
    #[serde(rename = "a")]
    ask: String,
    /// Best ask quantity
    #[serde(rename = "A")]
    ask_qty: String,
}

// ── Public entry point ────────────────────────────────────────────────────────

pub async fn run(state: SharedState) {
    loop {
        info!("binance_ws: connecting to {BINANCE_WS_URL}");
        match ingest(&state).await {
            Ok(())  => warn!("binance_ws: stream closed cleanly, reconnecting…"),
            Err(e)  => error!("binance_ws: error – {e:#}, reconnecting in 2 s"),
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

// ── Internal ──────────────────────────────────────────────────────────────────

async fn ingest(state: &SharedState) -> anyhow::Result<()> {
    let (mut ws, _) = connect_async(BINANCE_WS_URL).await?;
    info!("binance_ws: connected");

    while let Some(msg) = ws.next().await {
        match msg? {
            Message::Text(text) => {
                if let Ok(ticker) = serde_json::from_str::<BookTicker>(&text) {
                    let bid:     f64 = ticker.bid.parse().unwrap_or(0.0);
                    let ask:     f64 = ticker.ask.parse().unwrap_or(0.0);
                    let bid_qty: f64 = ticker.bid_qty.parse().unwrap_or(0.0);
                    let ask_qty: f64 = ticker.ask_qty.parse().unwrap_or(0.0);

                    if bid > 0.0 && ask > 0.0 {
                        let mid = (bid + ask) / 2.0;

                        // Orderbook imbalance: positive → more bid pressure
                        let total_qty = bid_qty + ask_qty;
                        let imbalance = if total_qty > 0.0 {
                            (bid_qty - ask_qty) / total_qty
                        } else {
                            0.0
                        };

                        let mut s = state.write().await;
                        s.btc_price   = mid;
                        s.ob_imbalance = imbalance;
                    }
                }
            }
            Message::Ping(_) => {
                // tokio-tungstenite handles Pong automatically.
            }
            Message::Close(_) => {
                warn!("binance_ws: received Close frame");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}
