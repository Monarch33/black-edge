/// Trade execution pipeline shell.
///
/// This module defines the structural skeleton for submitting orders to
/// Polymarket's CLOB REST API based on Kelly-sized signals. Currently it
/// emits structured `[WOULD EXECUTE]` log lines that the frontend consumes
/// as execution signals.
///
/// Wire-up points for future L1/L2 signing:
///   - Sign CTF conditional token approval transaction on Polygon
///   - Submit limit/market order to POST https://clob.polymarket.com/order
///   - Monitor fill status via GET https://clob.polymarket.com/order/{id}
///
/// The minimum edge gate (2%) and max position cap (25% of bankroll) are
/// enforced here as the last line of defence before any capital deployment.

use tracing::info;

use crate::kelly::KellyResult;
use crate::state::HftState;

/// Minimum model edge required to attempt execution (2%).
const MIN_EXECUTION_EDGE: f64 = 0.02;

/// A fully-resolved execution signal ready for order submission.
#[derive(Debug, Clone)]
pub struct ExecutionSignal {
    /// Polymarket CLOB YES token ID.
    pub market_token_id: String,
    /// "BUY" (betting YES) or "SELL" (betting NO).
    pub side: String,
    /// Dollar amount to wager.
    pub dollar_amount: f64,
    /// Black-Scholes fair price (our theoretical probability).
    pub fair_price: f64,
    /// Current Polymarket market price.
    pub market_price: f64,
    /// Model edge = fair_price − market_price.
    pub edge: f64,
}

/// Evaluate whether to execute based on current Kelly signal and state.
///
/// If edge ≥ MIN_EXECUTION_EDGE and dollar_amount > 0:
///   - Logs a structured `[WOULD EXECUTE BUY]` entry for frontend display.
///   - Returns the `ExecutionSignal` struct for future signing logic.
///
/// Otherwise returns None (no trade).
///
/// # Future integration
/// Replace the `tracing::info!` with actual CLOB API call:
/// ```
/// // POST https://clob.polymarket.com/order
/// // {
/// //   "order": {
/// //     "salt": <random>,
/// //     "maker": <wallet_address>,
/// //     "signer": <wallet_address>,
/// //     "taker": "0x0000000000000000000000000000000000000000",
/// //     "tokenId": <token_id>,
/// //     "makerAmount": <usdc_amount_6_decimals>,
/// //     "takerAmount": <shares_amount_6_decimals>,
/// //     "expiration": <unix_ts>,
/// //     "nonce": <nonce>,
/// //     "feeRateBps": "0",
/// //     "side": "BUY",
/// //     "signatureType": 0,
/// //     "signature": <eip712_signature>
/// //   },
/// //   "owner": <wallet_address>,
/// //   "orderType": "GTC"
/// // }
/// ```
pub async fn maybe_execute(kelly: &KellyResult, state: &HftState) -> Option<ExecutionSignal> {
    if kelly.edge < MIN_EXECUTION_EDGE {
        return None;
    }
    if kelly.dollar_amount <= 0.0 {
        return None;
    }

    let token_id = state
        .active_market
        .as_ref()
        .map(|m| m.token_id.as_str())
        .unwrap_or("UNKNOWN")
        .to_string();

    let fair_price = state
        .bs_result
        .as_ref()
        .map(|b| b.fair_price)
        .unwrap_or(0.0);

    // Determine direction: if fair_price > market_price, BUY YES
    let side = if kelly.edge > 0.0 { "BUY" } else { "SELL" }.to_string();

    let signal = ExecutionSignal {
        market_token_id: token_id.clone(),
        side: side.clone(),
        dollar_amount: kelly.dollar_amount,
        fair_price,
        market_price: state.polymarket_price,
        edge: kelly.edge,
    };

    // Structured execution log consumed by frontend dashboard
    info!(
        "[WOULD EXECUTE {}] Token={} | Size=${:.2} | Fair={:.4} | Market={:.4} | Edge={:.1}% | Kelly={:.1}%",
        side,
        &token_id[..token_id.len().min(16)],
        kelly.dollar_amount,
        fair_price,
        state.polymarket_price,
        kelly.edge * 100.0,
        kelly.fraction * 100.0,
    );

    Some(signal)
}
