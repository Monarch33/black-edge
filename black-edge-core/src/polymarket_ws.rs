//! Polymarket CLOB WebSocket subscription for live YES-token price updates.
//!
//! Connects to the Polymarket subscription server, subscribes to price-change
//! events for a specific asset token, and updates `HftState.yes_price` on
//! every tick.  Reconnects automatically on disconnect.
//!
//! Reference: https://docs.polymarket.com/#websocket-api

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::state::SharedState;

const POLYMARKET_WS_URL: &str =
    "wss://ws-subscriptions-clob.polymarket.com/ws/market";

// ── Wire types ────────────────────────────────────────────────────────────────

/// A single price-level change for one asset.
#[derive(Debug, Deserialize)]
struct PriceChange {
    asset_id: String,
    price: String,
    side: String, // "BUY" or "SELL"
    #[allow(dead_code)]
    size: String,
}

/// Top-level event envelope received from the CLOB WebSocket.
#[derive(Debug, Deserialize)]
#[serde(tag = "event_type", rename_all = "snake_case")]
enum ClobEvent {
    PriceChange { changes: Vec<PriceChange> },
    BookSnapshot { /* ignored for now */ },
    TickSizeChange { /* ignored */ },
    #[serde(other)]
    Unknown,
}

/// Subscription request sent to the CLOB WebSocket on connect.
#[derive(Debug, Serialize)]
struct SubscribeMsg<'a> {
    #[serde(rename = "type")]
    msg_type: &'a str,
    markets: Vec<&'a str>,
}

// ── Public entry point ────────────────────────────────────────────────────────

/// Spawnable async task.  `token_id` is the Polymarket conditional token ID
/// (the asset_id) of the YES token we want to track.
pub async fn run(state: SharedState, token_id: String) {
    loop {
        info!("polymarket_ws: connecting to {POLYMARKET_WS_URL} (token={token_id})");
        match ingest(&state, &token_id).await {
            Ok(()) => warn!("polymarket_ws: stream closed cleanly, reconnecting…"),
            Err(e) => error!("polymarket_ws: error – {e:#}, reconnecting in 2 s"),
        }
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

// ── Internal ──────────────────────────────────────────────────────────────────

async fn ingest(state: &SharedState, token_id: &str) -> anyhow::Result<()> {
    let (mut ws, _) = connect_async(POLYMARKET_WS_URL).await?;
    info!("polymarket_ws: connected");

    // Publish active token into shared state so the executor can find it
    {
        let mut s = state.write().await;
        s.active_token_id = Some(token_id.to_owned());
    }

    // Subscribe to price-change events for our YES token
    let sub = SubscribeMsg {
        msg_type: "Market",
        markets: vec![token_id],
    };
    ws.send(Message::Text(serde_json::to_string(&sub)?))
        .await?;
    info!("polymarket_ws: subscribed to token {token_id}");

    while let Some(msg) = ws.next().await {
        match msg? {
            Message::Text(text) => {
                // The CLOB WS sends arrays of events
                let events: Vec<ClobEvent> =
                    serde_json::from_str(&text).unwrap_or_default();

                for event in events {
                    handle_event(state, token_id, event).await;
                }
            }
            Message::Ping(_) => {}
            Message::Close(_) => {
                warn!("polymarket_ws: received Close frame");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

async fn handle_event(state: &SharedState, token_id: &str, event: ClobEvent) {
    if let ClobEvent::PriceChange { changes } = event {
        // We take the best-bid (BUY side) as our YES price signal.
        // Multiple changes may arrive per message; take the last relevant one.
        let new_price = changes
            .iter()
            .filter(|c| c.asset_id == token_id && c.side == "BUY")
            .filter_map(|c| c.price.parse::<f64>().ok())
            .last();

        if let Some(price) = new_price {
            let mut s = state.write().await;
            s.yes_price = price;
        }
    }
}
