//! Shared HFT engine state, protected behind an async RwLock.
//!
//! All sub-tasks (WS ingestors, executor, HTTP server) clone the `SharedState`
//! Arc and acquire read/write locks as needed.  The lock scope is kept as short
//! as possible – grab values, drop lock, do heavy computation outside.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use uuid::Uuid;

// ── Credentials ──────────────────────────────────────────────────────────────

/// Vault credentials submitted by the React frontend.
/// Never written to disk; lives only in process memory.
#[derive(Debug, Clone, Deserialize)]
pub struct EngineCredentials {
    /// Polymarket CLOB API key (proxy key)
    pub polymarket_api_key: String,
    /// Polymarket CLOB API secret (for HMAC-SHA256 request signing)
    pub polymarket_secret: String,
    /// Polymarket CLOB API passphrase
    pub polymarket_passphrase: String,
    /// Polygon EOA private key (hex, with or without 0x prefix)
    /// Used to generate EIP-712 order signatures.
    pub polygon_private_key: String,
}

// ── Order tracking ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum OrderStatus {
    /// Submitted to the CLOB, waiting for acknowledgement
    InFlight,
    /// CLOB accepted the order; `order_id` is Polymarket's assigned ID
    Placed { order_id: String },
    /// CLOB fully filled the order
    Filled { order_id: String },
    /// Submission or fill failed
    Failed { reason: String },
}

#[derive(Debug, Clone, Serialize)]
pub struct ActiveOrder {
    pub market_id: String,
    pub token_id: String,
    /// 0 = BUY, 1 = SELL
    pub side: u8,
    /// USDC notional size (6-decimal integer, e.g. 1_000_000 = $1.00)
    pub maker_amount_usdc: u64,
    /// YES-token amount (6-decimal integer)
    pub taker_amount_shares: u64,
    /// Limit price (YES token, 0.0–1.0)
    pub price: f64,
    pub status: OrderStatus,
    /// Unix timestamp (seconds) when the order was submitted
    pub submitted_at: u64,
}

// ── Main state struct ─────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct HftState {
    // ── Market data ──────────────────────────────────────────────────────────
    /// Latest BTC spot mid-price from Binance bookTicker (USDC)
    pub btc_price: f64,
    /// Latest YES-token best-bid price from Polymarket CLOB (0.0–1.0)
    pub yes_price: f64,

    // ── Quant signals ────────────────────────────────────────────────────────
    /// Black-Scholes fair value for the binary option (0.0–1.0)
    pub bs_fair_value: f64,
    /// Annualised implied volatility derived from the BS model (e.g. 0.80)
    pub sigma: f64,
    /// Kelly-optimal fraction of bankroll to wager
    pub kelly_fraction: f64,
    /// Edge = bs_fair_value − yes_price  (positive → we have an advantage)
    pub edge: f64,

    // ── Risk / portfolio ─────────────────────────────────────────────────────
    /// Working bankroll in USDC (6-decimal integer: 100_000_000 = $100)
    pub bankroll_usdc: u64,
    /// Strike price (BTC level the binary is contingent on)
    pub strike: f64,
    /// Time to expiration in years (e.g. 5 min = 5.0/525_600.0)
    pub time_to_expiry_years: f64,

    // ── Polymarket context ───────────────────────────────────────────────────
    /// Token ID of the active YES-token we are trading
    pub active_token_id: Option<String>,
    /// Market condition ID (human-readable label)
    pub active_market_id: Option<String>,

    // ── Security ─────────────────────────────────────────────────────────────
    /// Vault credentials; populated via POST /api/engine/credentials
    pub credentials: Option<EngineCredentials>,

    // ── Order management ─────────────────────────────────────────────────────
    /// All known orders, keyed by our internal UUID
    pub active_orders: HashMap<Uuid, ActiveOrder>,
    /// Instant of the most recent execution attempt (for cooldown gating)
    pub last_execution: Option<Instant>,
}

impl Default for HftState {
    fn default() -> Self {
        Self {
            btc_price: 0.0,
            yes_price: 0.0,
            bs_fair_value: 0.0,
            sigma: 0.80, // default: 80% annualised vol
            kelly_fraction: 0.0,
            edge: 0.0,
            bankroll_usdc: 0,
            strike: 0.0,
            time_to_expiry_years: 5.0 / 525_600.0, // 5-min default
            active_token_id: None,
            active_market_id: None,
            credentials: None,
            active_orders: HashMap::new(),
            last_execution: None,
        }
    }
}

impl HftState {
    pub fn new(initial_bankroll_usdc: u64, strike: f64) -> Self {
        Self {
            bankroll_usdc: initial_bankroll_usdc,
            strike,
            ..Default::default()
        }
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    /// Returns `true` if the cooldown window (milliseconds) has fully elapsed.
    pub fn cooldown_elapsed(&self, cooldown_ms: u64) -> bool {
        self.last_execution
            .map(|t| t.elapsed().as_millis() as u64 >= cooldown_ms)
            .unwrap_or(true)
    }

    /// Returns `true` if there is already an in-flight order for `token_id`.
    pub fn has_inflight_order(&self, token_id: &str) -> bool {
        self.active_orders
            .values()
            .any(|o| o.token_id == token_id && o.status == OrderStatus::InFlight)
    }

    // ── Bankroll helpers ──────────────────────────────────────────────────────

    /// Bankroll as a floating-point dollar amount.
    pub fn bankroll_dollars(&self) -> f64 {
        self.bankroll_usdc as f64 / 1_000_000.0
    }

    /// Update bankroll after a confirmed fill.
    /// `delta_usdc` is signed: positive = profit, negative = cost.
    pub fn apply_pnl(&mut self, delta_usdc: i64) {
        self.bankroll_usdc = (self.bankroll_usdc as i64 + delta_usdc).max(0) as u64;
    }
}

/// The canonical shared handle distributed to all async tasks.
pub type SharedState = Arc<RwLock<HftState>>;
