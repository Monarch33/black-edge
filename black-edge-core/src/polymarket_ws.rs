/// Polymarket ingestion module.
///
/// Responsibilities:
///   1. At startup (and on each reconnect), queries the Polymarket Gamma REST API
///      to discover the currently active BTC 5-minute market. Parses the strike
///      price from the market question text. No hardcoded strike.
///   2. Subscribes to the Polymarket CLOB WebSocket for real-time YES price ticks.
///   3. Updates HftState.polymarket_price and HftState.active_market on each tick.
///
/// REST endpoint:
///   GET https://gamma-api.polymarket.com/markets?tag=crypto&active=true&limit=50
///
/// CLOB WebSocket:
///   wss://ws-subscriptions-clob.polymarket.com/ws/market
///
/// Subscribe message:
///   {"assets_ids":["<token_id>"],"type":"market"}
///
/// Price update message (example):
///   {"asset_id":"0x...","price":"0.68","side":"BUY","size":"100","timestamp":"..."}

use std::time::Duration;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{error, info, warn};

use crate::state::{ActiveMarket, SharedState};

const GAMMA_API: &str = "https://gamma-api.polymarket.com/markets";
const CLOB_WS: &str = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
/// How many minutes to look ahead for an active BTC 5-min market
const ACTIVE_MARKET_LOOKAHEAD_MIN: i64 = 60;

// ─── REST API types ──────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GammaMarket {
    /// Polymarket condition ID (not the CLOB token ID)
    #[serde(rename = "conditionId")]
    condition_id: Option<String>,
    question: Option<String>,
    #[serde(rename = "endDate")]
    end_date: Option<String>,
    active: Option<bool>,
    tokens: Option<Vec<GammaToken>>,
    tags: Option<Vec<String>>,
    slug: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GammaToken {
    #[serde(rename = "tokenId")]
    token_id: String,
    outcome: String,
}

// ─── CLOB WebSocket types ─────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ClobSubscribeMsg<'a> {
    assets_ids: Vec<&'a str>,
    #[serde(rename = "type")]
    msg_type: &'a str,
}

#[derive(Debug, Deserialize)]
struct ClobPriceTick {
    asset_id: Option<String>,
    price: Option<String>,
    side: Option<String>,
}

// ─── Strike extraction ────────────────────────────────────────────────────────

/// Extract a numeric strike from a Polymarket question string.
///
/// Looks for patterns like:
///   "Will BTC be above $70,000 at ..."
///   "Bitcoin above 72500 at ..."
///   "BTC above $68k at ..."
///
/// Returns `None` if no strike can be parsed.
fn parse_strike_from_question(question: &str) -> Option<f64> {
    let q = question.to_lowercase();

    // Find "above" or "below", then scan for the next dollar/number
    let markers = ["above $", "below $", "above ", "below "];
    for marker in &markers {
        if let Some(pos) = q.find(marker) {
            let after = &question[pos + marker.len()..];
            // Strip commas and gather digits/dots
            let raw: String = after
                .chars()
                .take_while(|c| c.is_ascii_digit() || *c == ',' || *c == '.')
                .filter(|c| *c != ',')
                .collect();
            if let Ok(v) = raw.parse::<f64>() {
                // Handle "k" suffix (e.g. "68k" → 68000)
                let rest = &after[raw.len()..];
                let multiplier = if rest.to_lowercase().starts_with('k') {
                    1_000.0
                } else {
                    1.0
                };
                if v > 0.0 {
                    return Some(v * multiplier);
                }
            }
        }
    }
    None
}

/// Fetch active BTC 5-min markets from Polymarket Gamma API.
/// Returns the best candidate market converted to `ActiveMarket`.
async fn fetch_active_btc_market(client: &reqwest::Client) -> Option<ActiveMarket> {
    let url = format!(
        "{}?tag=crypto&active=true&limit=100&order=volume24hr&ascending=false",
        GAMMA_API
    );

    let resp = client
        .get(&url)
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .ok()?;

    let markets: Vec<GammaMarket> = resp.json().await.ok()?;

    let now_ms = chrono::Utc::now().timestamp_millis();
    let lookahead_ms = ACTIVE_MARKET_LOOKAHEAD_MIN * 60 * 1_000;

    for market in &markets {
        let question = market.question.as_deref().unwrap_or("");
        let q_lower = question.to_lowercase();

        // Must mention BTC/Bitcoin
        if !q_lower.contains("btc") && !q_lower.contains("bitcoin") {
            continue;
        }

        // Must have "above" or "below" — binary direction market
        if !q_lower.contains("above") && !q_lower.contains("below") {
            continue;
        }

        // Must be active
        if !market.active.unwrap_or(false) {
            continue;
        }

        // Must expire within our lookahead window (or already expired markets are skipped)
        let end_ms = if let Some(end) = &market.end_date {
            // Try to parse ISO8601 end date
            chrono::DateTime::parse_from_rfc3339(end)
                .or_else(|_| chrono::DateTime::parse_from_rfc3339(&format!("{}Z", end)))
                .map(|dt| dt.timestamp_millis())
                .unwrap_or(i64::MAX)
        } else {
            continue;
        };

        if end_ms <= now_ms || end_ms > now_ms + lookahead_ms {
            continue;
        }

        let strike = match parse_strike_from_question(question) {
            Some(s) => s,
            None => continue,
        };

        // Find YES token
        let token_id = market
            .tokens
            .as_ref()
            .and_then(|tokens| {
                tokens
                    .iter()
                    .find(|t| t.outcome.to_lowercase() == "yes")
                    .map(|t| t.token_id.clone())
            })
            .unwrap_or_default();

        if token_id.is_empty() {
            continue;
        }

        let time_to_expiry_secs = ((end_ms - now_ms) as f64) / 1_000.0;
        let time_to_expiry_years = time_to_expiry_secs / (365.0 * 24.0 * 3600.0);

        info!(
            "[POLYMARKET] Found active BTC market: \"{}\" | strike=${:.0} | expiry in {:.1}min | token={}",
            question,
            strike,
            time_to_expiry_secs / 60.0,
            &token_id[..token_id.len().min(12)]
        );

        return Some(ActiveMarket {
            token_id,
            question: question.to_string(),
            strike,
            end_time_ms: end_ms,
            time_to_expiry_years,
        });
    }

    warn!("[POLYMARKET] No suitable active BTC 5-min market found.");
    None
}

/// Main Polymarket ingestion loop. Runs forever with reconnect.
pub async fn run(state: SharedState) {
    let client = reqwest::Client::new();
    let mut backoff_secs = 2u64;

    loop {
        // Step 1: Discover the active market from the REST API
        let active_market = fetch_active_btc_market(&client).await;

        if let Some(ref market) = active_market {
            let mut s = state.write().await;
            s.active_market = Some(market.clone());
        } else {
            warn!("[POLYMARKET] No active market. Retrying in {}s.", backoff_secs);
            tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
            backoff_secs = (backoff_secs * 2).min(60);
            continue;
        }

        backoff_secs = 2;

        let token_id = active_market.as_ref().unwrap().token_id.clone();

        // Step 2: Connect to CLOB WebSocket and subscribe to this token
        info!("[POLYMARKET] Connecting to CLOB WS for token {}", &token_id[..token_id.len().min(12)]);

        match connect_async(CLOB_WS).await {
            Ok((ws_stream, _)) => {
                info!("[POLYMARKET] CLOB WS connected.");
                let (mut sink, mut stream) = ws_stream.split();

                // Send subscription message
                let sub = ClobSubscribeMsg {
                    assets_ids: vec![&token_id],
                    msg_type: "market",
                };
                let sub_json = serde_json::to_string(&sub).unwrap_or_default();
                if let Err(e) = sink.send(Message::Text(sub_json)).await {
                    error!("[POLYMARKET] Failed to send subscribe: {}", e);
                    tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                    backoff_secs = (backoff_secs * 2).min(60);
                    continue;
                }

                // Listen for price ticks
                while let Some(msg) = stream.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            // Messages can be arrays or single objects
                            process_clob_message(&text, &token_id, &state).await;
                        }
                        Ok(Message::Ping(p)) => {
                            let _ = sink.send(Message::Pong(p)).await;
                        }
                        Ok(Message::Close(_)) => {
                            warn!("[POLYMARKET] CLOB WS closed by server.");
                            break;
                        }
                        Err(e) => {
                            error!("[POLYMARKET] CLOB WS error: {}", e);
                            break;
                        }
                        _ => {}
                    }
                }
            }
            Err(e) => {
                error!("[POLYMARKET] CLOB WS connection failed: {}. Retry in {}s.", e, backoff_secs);
            }
        }

        // Sleep and re-fetch active market on reconnect (strike may have changed)
        tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
        backoff_secs = (backoff_secs * 2).min(60);
    }
}

/// Parse a CLOB message (array or single object) and update polymarket_price.
async fn process_clob_message(text: &str, token_id: &str, state: &SharedState) {
    // Try parsing as array first (CLOB often sends arrays of events)
    if let Ok(ticks) = serde_json::from_str::<Vec<ClobPriceTick>>(text) {
        for tick in &ticks {
            apply_tick(tick, token_id, state).await;
        }
    } else if let Ok(tick) = serde_json::from_str::<ClobPriceTick>(text) {
        apply_tick(&tick, token_id, state).await;
    }
}

async fn apply_tick(tick: &ClobPriceTick, token_id: &str, state: &SharedState) {
    let tick_token = tick.asset_id.as_deref().unwrap_or("");
    if tick_token != token_id {
        return;
    }

    // Only use BUY side prices as YES price proxy (BUY = willing to pay X for YES)
    let side = tick.side.as_deref().unwrap_or("").to_uppercase();
    if side != "BUY" && !side.is_empty() {
        return;
    }

    if let Some(price_str) = &tick.price {
        if let Ok(price) = price_str.parse::<f64>() {
            if price > 0.0 && price < 1.0 {
                let mut s = state.write().await;
                s.polymarket_price = price;

                // Refresh time_to_expiry in active_market
                if let Some(ref mut market) = s.active_market {
                    let now_ms = chrono::Utc::now().timestamp_millis();
                    let secs_left = ((market.end_time_ms - now_ms) as f64 / 1_000.0).max(0.0);
                    market.time_to_expiry_years = secs_left / (365.0 * 24.0 * 3600.0);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_strike_dollar_with_comma() {
        let q = "Will BTC be above $70,000 at 14:25?";
        assert_eq!(parse_strike_from_question(q), Some(70_000.0));
    }

    #[test]
    fn parse_strike_no_comma() {
        let q = "Bitcoin above 68500 by end of day?";
        assert_eq!(parse_strike_from_question(q), Some(68_500.0));
    }

    #[test]
    fn parse_strike_k_suffix() {
        let q = "BTC above $68k at close?";
        assert_eq!(parse_strike_from_question(q), Some(68_000.0));
    }

    #[test]
    fn parse_strike_below() {
        let q = "Will Bitcoin be below $60000?";
        assert_eq!(parse_strike_from_question(q), Some(60_000.0));
    }

    #[test]
    fn parse_strike_not_found() {
        let q = "Will the Fed cut rates in 2025?";
        assert_eq!(parse_strike_from_question(q), None);
    }
}
