//! Autonomous 5-minute BTC binary market discovery via the Polymarket Gamma API.
//!
//! Polls every 60 seconds, identifies the currently live BTC 5-min market,
//! and publishes its YES-token ID + strike price through a `watch` channel so
//! the CLOB WebSocket task can automatically re-subscribe when markets rotate.
//!
//! No `.env` configuration required — the bot discovers its own targets.

use std::time::Duration;

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::Deserialize;
use tokio::sync::watch;
use tracing::{info, warn};

use crate::state::SharedState;

// ── Constants ─────────────────────────────────────────────────────────────────

const GAMMA_BASE: &str = "https://gamma-api.polymarket.com";

/// Discovery fires every 60 seconds.
const POLL_INTERVAL_SECS: u64 = 60;

/// Only consider markets closing within the next 10 minutes.
/// This window is wide enough to catch markets that just started yet narrow
/// enough to avoid picking up the wrong 5-min slot.
const LOOKAHEAD_SECS: i64 = 600;

// ── Wire types ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GammaMarket {
    /// Polymarket condition ID (unique per market).
    #[serde(alias = "conditionId", default)]
    condition_id: String,

    /// Human-readable question, e.g. "Will BTC be above $65,000 at 3:05 PM ET?"
    #[serde(default)]
    question: String,

    /// ISO-8601 market close time.
    #[serde(alias = "endDateIso", alias = "end_date_iso")]
    end_date: Option<String>,

    #[serde(default = "bool_true")]
    active: bool,

    #[serde(default)]
    closed: bool,

    #[serde(default)]
    tokens: Vec<GammaToken>,
}

#[derive(Debug, Deserialize)]
struct GammaToken {
    token_id: String,
    /// "Yes" or "No"
    outcome: String,
}

fn bool_true() -> bool { true }

// ── Public entry point ────────────────────────────────────────────────────────

/// Long-running discovery task.  Sends the YES-token ID of the current 5-min
/// BTC market over `token_tx` whenever the active market changes.
pub async fn run(
    state: SharedState,
    token_tx: watch::Sender<String>,
    client: reqwest::Client,
) {
    // Fire immediately on startup, then repeat on the interval.
    loop {
        match find_active_btc_market(&client).await {
            Ok(Some(found)) => {
                let changed = {
                    let s = state.read().await;
                    s.active_token_id.as_deref() != Some(&found.token_id)
                };

                if changed {
                    info!(
                        "market_discovery: NEW MARKET  token={}  strike=${}  id={}",
                        found.token_id, found.strike, found.condition_id
                    );

                    {
                        let mut s = state.write().await;
                        s.active_token_id  = Some(found.token_id.clone());
                        s.active_market_id = Some(found.condition_id.clone());
                        s.strike           = found.strike;
                        // Flush stale yes_price so we don't trade on the old market's data.
                        s.yes_price = 0.0;
                    }

                    // Signal CLOB WS to re-subscribe. If no listeners, that's fine.
                    let _ = token_tx.send(found.token_id);
                } else {
                    info!("market_discovery: same market still active, no rotation needed");
                }
            }
            Ok(None) => {
                warn!("market_discovery: no active BTC 5-min market found – will retry");
            }
            Err(e) => {
                warn!("market_discovery: error – {e:#}");
            }
        }

        tokio::time::sleep(Duration::from_secs(POLL_INTERVAL_SECS)).await;
    }
}

// ── Discovery logic ───────────────────────────────────────────────────────────

struct FoundMarket {
    token_id:     String,
    strike:       f64,
    condition_id: String,
}

async fn find_active_btc_market(client: &reqwest::Client) -> Result<Option<FoundMarket>> {
    // Fetch active, unclosed markets ordered by end-date ascending so that the
    // soonest-expiring (i.e. currently live) 5-min slot is first in the list.
    let url = format!(
        "{GAMMA_BASE}/markets?active=true&closed=false\
         &order=endDate&ascending=true&limit=50"
    );

    let markets: Vec<GammaMarket> = client
        .get(&url)
        .header("Accept", "application/json")
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .context("Gamma API GET failed")?
        .json()
        .await
        .context("Gamma API JSON deserialisation failed")?;

    let now = Utc::now();
    let horizon = now + chrono::Duration::seconds(LOOKAHEAD_SECS);

    for market in &markets {
        if !market.active || market.closed {
            continue;
        }

        // ── Question filter ──────────────────────────────────────────────────
        if !is_btc_5min_question(&market.question) {
            continue;
        }

        // ── Time window filter ───────────────────────────────────────────────
        let end_dt: Option<DateTime<Utc>> = market
            .end_date
            .as_deref()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
            .map(|d| d.with_timezone(&Utc));

        match end_dt {
            Some(dt) if dt > now && dt < horizon => { /* within window */ }
            _ => continue,
        }

        // ── Extract YES token and strike ─────────────────────────────────────
        let yes_token = market
            .tokens
            .iter()
            .find(|t| t.outcome.eq_ignore_ascii_case("yes"))
            .map(|t| t.token_id.clone());

        let strike = parse_strike(&market.question);

        match (yes_token, strike) {
            (Some(token_id), Some(strike)) => {
                return Ok(Some(FoundMarket {
                    token_id,
                    strike,
                    condition_id: market.condition_id.clone(),
                }));
            }
            (None, _) => {
                warn!("market_discovery: no YES token found for market {:?}", market.question);
            }
            (_, None) => {
                warn!("market_discovery: could not parse strike from {:?}", market.question);
            }
        }
    }

    Ok(None)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Returns `true` if the question looks like a BTC price binary.
///
/// Matches: "Will BTC be above $X…", "Bitcoin above $X…", etc.
fn is_btc_5min_question(question: &str) -> bool {
    let q = question.to_ascii_lowercase();
    (q.contains("btc") || q.contains("bitcoin"))
        && (q.contains("above") || q.contains(">"))
        && q.contains('$')
}

/// Extract a dollar strike price from the question string.
///
/// Handles formats like:
/// - "Will BTC be above $65,000 at 3:05 PM?"  → 65000.0
/// - "BTC above $65000?"                       → 65000.0
/// - "BTC > $1,234,567"                        → 1234567.0
fn parse_strike(question: &str) -> Option<f64> {
    // Find the '$' character and parse the number that follows.
    let dollar_pos = question.find('$')?;
    let after = &question[dollar_pos + 1..];

    let num_str: String = after
        .chars()
        .take_while(|c| c.is_ascii_digit() || *c == ',' || *c == '.')
        .filter(|c| *c != ',') // strip thousands separators
        .collect();

    if num_str.is_empty() {
        return None;
    }

    num_str.parse().ok()
}

// ── Unit tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_strike_standard() {
        assert_eq!(parse_strike("Will BTC be above $65,000 at 3:05 PM?"), Some(65_000.0));
    }

    #[test]
    fn test_parse_strike_no_comma() {
        assert_eq!(parse_strike("BTC > $100000 EOD"), Some(100_000.0));
    }

    #[test]
    fn test_parse_strike_millions() {
        assert_eq!(parse_strike("Bitcoin above $1,234,567?"), Some(1_234_567.0));
    }

    #[test]
    fn test_parse_strike_missing() {
        assert_eq!(parse_strike("Will it rain tomorrow?"), None);
    }

    #[test]
    fn test_is_btc_question() {
        assert!(is_btc_5min_question("Will BTC be above $65,000?"));
        assert!(is_btc_5min_question("Bitcoin above $50k?"));
        assert!(!is_btc_5min_question("Will ETH be above $3,000?"));
        assert!(!is_btc_5min_question("Will it rain today?"));
    }
}
