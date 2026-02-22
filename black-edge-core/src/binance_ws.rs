//! Binance `btcusdt@bookTicker` WebSocket ingestor.
//!
//! Maintains a persistent connection to Binance's individual stream endpoint.
//! On every tick it computes the mid-price and writes it into `HftState`.
//! Reconnects automatically with a 2-second back-off on any error.

use std::time::Duration;

use futures_util::StreamExt;
use serde::Deserialize;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::state::SharedState;

const BINANCE_WS_URL: &str =
    "wss://stream.binance.com:9443/ws/btcusdt@bookTicker";

// ── Wire types ────────────────────────────────────────────────────────────────

/// Binance individual book-ticker message.
/// Documented at https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams#individual-symbol-book-ticker-streams
#[derive(Debug, Deserialize)]
struct BookTicker {
    /// Best bid price (string to avoid f64 precision loss)
    #[serde(rename = "b")]
    bid: String,
    /// Best ask price
    #[serde(rename = "a")]
    ask: String,
}

// ── Public entry point ────────────────────────────────────────────────────────

/// Spawnable async task.  Runs forever, reconnecting on any failure.
pub async fn run(state: SharedState) {
    loop {
        info!("binance_ws: connecting to {BINANCE_WS_URL}");
        match ingest(&state).await {
            Ok(()) => warn!("binance_ws: stream closed cleanly, reconnecting…"),
            Err(e) => error!("binance_ws: error – {e:#}, reconnecting in 2 s"),
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
                    let bid: f64 = ticker.bid.parse().unwrap_or(0.0);
                    let ask: f64 = ticker.ask.parse().unwrap_or(0.0);

                    if bid > 0.0 && ask > 0.0 {
                        let mid = (bid + ask) / 2.0;

                        // Lock scope is intentionally minimal
                        let mut s = state.write().await;
                        s.btc_price = mid;
                    }
                }
            }
            Message::Ping(_) => {
                // tokio-tungstenite handles Pong automatically when using the
                // default `WebSocketConfig`; nothing to do here.
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
