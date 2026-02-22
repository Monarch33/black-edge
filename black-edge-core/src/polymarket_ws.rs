//! Polymarket CLOB WebSocket subscription — with autonomous market rotation.
//!
//! Listens to a `watch::Receiver<String>` for the current YES-token ID, which
//! is published by `market_discovery` every time the active 5-min BTC market
//! rotates.  When a new token ID arrives the current WS connection is dropped
//! and a fresh subscription to the new market is opened immediately.
//!
//! Reference: https://docs.polymarket.com/#websocket-api

use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::watch;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::state::SharedState;

const POLYMARKET_WS_URL: &str =
    "wss://ws-subscriptions-clob.polymarket.com/ws/market";

// ── Wire types ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct PriceChange {
    asset_id: String,
    price: String,
    side: String,
    #[allow(dead_code)]
    size: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "event_type", rename_all = "snake_case")]
enum ClobEvent {
    PriceChange { changes: Vec<PriceChange> },
    BookSnapshot {},
    TickSizeChange {},
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize)]
struct SubscribeMsg<'a> {
    #[serde(rename = "type")]
    msg_type: &'a str,
    markets: Vec<&'a str>,
}

// ── Public entry point ────────────────────────────────────────────────────────

/// Spawnable async task.
///
/// Waits for `token_rx` to produce a non-empty token ID (published by
/// `market_discovery`), then connects to the CLOB WS and streams price
/// updates.  When `token_rx` changes (market rotation), the current
/// connection is torn down and a new subscription is opened immediately.
pub async fn run(state: SharedState, mut token_rx: watch::Receiver<String>) {
    loop {
        // ── Wait for a valid token from market_discovery ──────────────────
        // `borrow_and_update` marks the current value as seen so that a
        // subsequent `changed()` only fires when a *new* value is sent.
        let token_id = loop {
            let t = token_rx.borrow_and_update().clone();
            if !t.is_empty() {
                break t;
            }
            info!("polymarket_ws: waiting for market discovery to find first market…");
            if token_rx.changed().await.is_err() {
                // Sender dropped – discovery task has exited; shut down.
                return;
            }
        };

        info!("polymarket_ws: subscribing to token {token_id}");

        // ── Stream, but bail out early if market rotates ──────────────────
        tokio::select! {
            result = ingest(&state, &token_id) => {
                match result {
                    Ok(()) => warn!("polymarket_ws: stream closed, reconnecting in 2 s…"),
                    Err(e) => error!("polymarket_ws: {e:#}, reconnecting in 2 s"),
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
            changed = token_rx.changed() => {
                if changed.is_err() { return; } // discovery exited
                info!("polymarket_ws: market rotated – switching subscription immediately");
                // No sleep: loop back immediately to pick up the new token.
            }
        }
    }
}

// ── Internal ──────────────────────────────────────────────────────────────────

async fn ingest(state: &SharedState, token_id: &str) -> anyhow::Result<()> {
    let (mut ws, _) = connect_async(POLYMARKET_WS_URL).await?;
    info!("polymarket_ws: connected");

    // Send subscription message
    let sub = SubscribeMsg {
        msg_type: "Market",
        markets: vec![token_id],
    };
    ws.send(Message::Text(serde_json::to_string(&sub)?)).await?;
    info!("polymarket_ws: subscribed to YES token {token_id}");

    while let Some(msg) = ws.next().await {
        match msg? {
            Message::Text(text) => {
                let events: Vec<ClobEvent> =
                    serde_json::from_str(&text).unwrap_or_default();
                for event in events {
                    handle_event(state, token_id, event).await;
                }
            }
            Message::Ping(_) => {}
            Message::Close(_) => {
                warn!("polymarket_ws: server sent Close frame");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

async fn handle_event(state: &SharedState, token_id: &str, event: ClobEvent) {
    if let ClobEvent::PriceChange { changes } = event {
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
