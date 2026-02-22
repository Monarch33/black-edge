// Structs defined for schema documentation; some fields consumed only at runtime.
#![allow(dead_code)]

/// Polymarket market discovery (REST) + live orderbook streaming (WebSocket).
///
/// Flow:
///   1. REST → Gamma API: find the next active "Will BTC be above $X at HH:MM?"
///      5-minute market → extract token_id + strike + expiry.
///   2. WS  → CLOB WebSocket: subscribe to that token_id and stream YES price.
///   3. Auto-reconnect on both REST failures and WS drops.
use std::time::Duration;

use anyhow::{bail, Result};
use futures_util::{SinkExt, StreamExt};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, warn};

use crate::state::SharedState;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Polymarket Gamma REST API base
const GAMMA_BASE: &str = "https://gamma-api.polymarket.com";

/// Polymarket CLOB WebSocket endpoint
const CLOB_WS_URL: &str = "wss://ws-subscriptions-clob.polymarket.com/ws/market";

/// How long to wait between market-discovery retries
const DISCOVERY_RETRY_SECS: u64 = 10;

// ---------------------------------------------------------------------------
// Gamma API response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct GammaMarket {
    /// The CLOB token ID for the YES side (we always trade YES)
    #[serde(rename = "clobTokenIds")]
    clob_token_ids: Option<Value>,
    /// Human-readable question – we parse strike from here if needed
    question: Option<String>,
    /// Market end time (ISO-8601 string)
    #[serde(rename = "endDate")]
    end_date: Option<String>,
    /// Tags / category to help filter BTC markets
    #[serde(rename = "tags")]
    tags: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// CLOB WebSocket price update
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct ClobPriceUpdate {
    /// "price_change" events carry asset_id + price
    asset_id: Option<String>,
    price: Option<String>,
    event_type: Option<String>,
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

pub async fn run(state: SharedState) {
    let client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .expect("failed to build reqwest client");

    loop {
        // Step 1: discover the active market
        match discover_active_market(&client).await {
            Ok((token_id, strike, expiry_unix)) => {
                info!(
                    "[polymarket_ws] active market: token={token_id}  strike={strike}  expiry={expiry_unix}"
                );

                // Persist market metadata into shared state
                {
                    let mut s = state.write().await;
                    s.active_market_token_id = token_id.clone();
                    s.active_market_strike = strike;
                    s.active_market_expiry = expiry_unix;
                }

                // Step 2: stream the orderbook for this token
                let mut ws_backoff = 1u64;
                loop {
                    match stream_clob(&token_id, state.clone()).await {
                        Ok(_) => {
                            info!("[polymarket_ws] CLOB stream ended cleanly");
                            ws_backoff = 1;
                        }
                        Err(e) => {
                            error!("[polymarket_ws] CLOB error: {e:#} – reconnecting in {ws_backoff}s");
                            sleep(Duration::from_secs(ws_backoff)).await;
                            ws_backoff = (ws_backoff * 2).min(60);
                        }
                    }

                    // Re-check if the market has changed (5-min windows roll fast)
                    let current_expiry = state.read().await.active_market_expiry;
                    let now = chrono::Utc::now().timestamp();
                    if now >= current_expiry {
                        info!("[polymarket_ws] market expired – re-discovering");
                        break; // break inner loop → re-discover
                    }
                }
            }
            Err(e) => {
                error!("[polymarket_ws] market discovery failed: {e:#} – retrying in {DISCOVERY_RETRY_SECS}s");
                sleep(Duration::from_secs(DISCOVERY_RETRY_SECS)).await;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Gamma REST: find the next active BTC 5-min binary market
// ---------------------------------------------------------------------------

async fn discover_active_market(client: &Client) -> Result<(String, f64, i64)> {
    // Query active markets tagged "crypto" with "BTC" in the question, sorted
    // by end_date ascending so we get the soonest-expiring one first.
    let url = format!(
        "{GAMMA_BASE}/markets?active=true&closed=false&tag=crypto&search=BTC&order=end_date_asc&limit=20"
    );

    let resp: Vec<Value> = client.get(&url).send().await?.json().await?;

    for market in resp {
        let question = market
            .get("question")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase();

        // We are only interested in 5-minute binary markets
        if !question.contains("btc") {
            continue;
        }

        // Extract YES token ID  (clobTokenIds is an array: [YES_id, NO_id])
        let token_id = match market.get("clobTokenIds") {
            Some(Value::Array(ids)) if !ids.is_empty() => {
                ids[0].as_str().unwrap_or("").to_string()
            }
            Some(Value::String(s)) => {
                // Sometimes it's a JSON-encoded string of an array
                let parsed: Vec<String> = serde_json::from_str(s).unwrap_or_default();
                parsed.into_iter().next().unwrap_or_default()
            }
            _ => continue,
        };

        if token_id.is_empty() {
            continue;
        }

        // Parse strike from the question (e.g. "Will BTC be above $95,000 at ...")
        let strike = parse_strike_from_question(&question).unwrap_or(0.0);

        // Parse expiry
        let expiry_unix = market
            .get("endDate")
            .and_then(|v| v.as_str())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.timestamp())
            .unwrap_or(0);

        if strike > 0.0 && expiry_unix > chrono::Utc::now().timestamp() {
            return Ok((token_id, strike, expiry_unix));
        }
    }

    bail!("no suitable active BTC 5-min market found in Gamma API response")
}

/// Parse a USD strike from a natural-language question string.
/// Handles formats like "$95,000", "95000", "$95K".
fn parse_strike_from_question(q: &str) -> Option<f64> {
    // Find the first '$' sign followed by digits/commas/K
    let after_dollar = q.split('$').nth(1)?;
    let raw: String = after_dollar
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == ',' || *c == '.' || *c == 'k' || *c == 'K')
        .collect();

    let raw = raw.replace(',', "");
    if raw.to_lowercase().ends_with('k') {
        let num: f64 = raw[..raw.len() - 1].parse().ok()?;
        return Some(num * 1000.0);
    }
    raw.parse().ok()
}

// ---------------------------------------------------------------------------
// CLOB WebSocket: subscribe and stream price updates
// ---------------------------------------------------------------------------

async fn stream_clob(token_id: &str, state: SharedState) -> Result<()> {
    info!("[polymarket_ws] connecting to CLOB WS for token {token_id}");
    let (ws_stream, _) = connect_async(CLOB_WS_URL).await?;
    let (mut write, mut read) = ws_stream.split();

    // Subscribe to the market orderbook channel
    let sub_msg = json!({
        "auth": {},
        "markets": [token_id],
        "type": "subscribe"
    });
    write.send(Message::Text(sub_msg.to_string())).await?;
    info!("[polymarket_ws] subscribed to market {token_id}");

    while let Some(msg) = read.next().await {
        match msg? {
            Message::Text(text) => {
                handle_clob_message(&text, token_id, state.clone()).await;
            }
            Message::Ping(data) => {
                debug!("[polymarket_ws] ping – sending pong");
                write.send(Message::Pong(data)).await?;
            }
            Message::Close(_) => {
                warn!("[polymarket_ws] received close frame");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Parse CLOB messages and update the YES price
// ---------------------------------------------------------------------------

async fn handle_clob_message(raw: &str, expected_token: &str, state: SharedState) {
    // CLOB sends both arrays and single objects – normalise to array
    let messages: Vec<Value> = if raw.trim_start().starts_with('[') {
        serde_json::from_str(raw).unwrap_or_default()
    } else if let Ok(v) = serde_json::from_str::<Value>(raw) {
        vec![v]
    } else {
        return;
    };

    for msg in messages {
        let event_type = msg.get("event_type").and_then(|v| v.as_str()).unwrap_or("");

        // We care about "price_change" and "book" events
        match event_type {
            "price_change" => {
                if let (Some(asset_id), Some(price_str)) = (
                    msg.get("asset_id").and_then(|v| v.as_str()),
                    msg.get("price").and_then(|v| v.as_str()),
                ) {
                    if asset_id != expected_token {
                        continue;
                    }
                    if let Ok(price) = price_str.parse::<f64>() {
                        let mut s = state.write().await;
                        s.polymarket_yes_price = price;
                        s.edge = s.bs_fair_value - price;
                        debug!("[polymarket_ws] YES price={price:.4}  edge={:.4}", s.edge);
                    }
                }
            }
            "book" => {
                // Full orderbook snapshot – derive mid from best bid/ask
                if let Some(asset_id) = msg.get("asset_id").and_then(|v| v.as_str()) {
                    if asset_id != expected_token {
                        continue;
                    }
                }
                if let Some(mid) = extract_midprice_from_book(&msg) {
                    let mut s = state.write().await;
                    s.polymarket_yes_price = mid;
                    s.edge = s.bs_fair_value - mid;
                }
            }
            _ => {}
        }
    }
}

/// Extract the mid-price from a CLOB book snapshot message.
/// The book message has `bids` and `asks` arrays of `[price, size]` pairs.
fn extract_midprice_from_book(msg: &Value) -> Option<f64> {
    let best_bid = msg
        .get("bids")?
        .as_array()?
        .iter()
        .filter_map(|entry| {
            entry
                .get("price")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
        })
        .fold(f64::NEG_INFINITY, f64::max);

    let best_ask = msg
        .get("asks")?
        .as_array()?
        .iter()
        .filter_map(|entry| {
            entry
                .get("price")
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
        })
        .fold(f64::INFINITY, f64::min);

    if best_bid > 0.0 && best_ask < f64::INFINITY && best_bid < best_ask {
        Some((best_bid + best_ask) / 2.0)
    } else {
        None
    }
}
