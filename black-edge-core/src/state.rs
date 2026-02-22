use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// HFT Runtime State – updated on every Binance + Polymarket tick
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HftState {
    /// Latest BTC mid-price from Binance bookTicker
    pub btc_price: f64,

    /// Current YES-side price on the active Polymarket BTC binary market (0-1)
    pub polymarket_yes_price: f64,

    /// Token ID of the currently-tracked Polymarket market
    pub active_market_token_id: String,

    /// Strike price fetched from Polymarket Gamma API (not hardcoded)
    pub active_market_strike: f64,

    /// Market expiry as a Unix timestamp (seconds)
    pub active_market_expiry: i64,

    // ---- Black-Scholes outputs ----
    pub bs_fair_value: f64,
    pub bs_delta: f64,
    pub bs_gamma: f64,
    pub bs_theta: f64,
    pub bs_vega: f64,

    // ---- Kelly sizing ----
    /// Raw Kelly fraction (before capping)
    pub kelly_fraction_raw: f64,
    /// Capped Kelly fraction (max 0.25)
    pub kelly_fraction: f64,

    // ---- Edge ----
    /// Edge = bs_fair_value - polymarket_yes_price (positive → we are cheap)
    pub edge: f64,

    // ---- Latency diagnostics ----
    pub spread_ms: i64,
    pub execution_latency_ms: f64,

    // ---- Execution state ----
    /// Map from order_id → status string for in-flight orders
    pub active_orders: HashMap<String, String>,

    /// Epoch ms of last fired order; used for the 2 000 ms cooldown lock
    pub last_execution_ts: i64,

    /// Whether the engine is currently in cooldown
    pub in_cooldown: bool,

    /// Cumulative P&L in USD (placeholder; updated by executor after fill confirmation)
    pub pnl_usd: f64,
}

impl Default for HftState {
    fn default() -> Self {
        Self {
            btc_price: 0.0,
            polymarket_yes_price: 0.0,
            active_market_token_id: String::new(),
            active_market_strike: 0.0,
            active_market_expiry: 0,
            bs_fair_value: 0.0,
            bs_delta: 0.0,
            bs_gamma: 0.0,
            bs_theta: 0.0,
            bs_vega: 0.0,
            kelly_fraction_raw: 0.0,
            kelly_fraction: 0.0,
            edge: 0.0,
            spread_ms: 0,
            execution_latency_ms: 0.0,
            active_orders: HashMap::new(),
            last_execution_ts: 0,
            in_cooldown: false,
            pnl_usd: 0.0,
        }
    }
}

// ---------------------------------------------------------------------------
// Credentials – supplied at runtime via POST /api/engine/credentials
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Credentials {
    pub polymarket_api_key: String,
    pub polymarket_secret: String,
    pub polymarket_passphrase: String,
    /// Raw hex private key for the Polygon wallet (no 0x prefix required)
    pub polygon_private_key: String,
}

// ---------------------------------------------------------------------------
// Thread-safe handle types used everywhere in the codebase
// ---------------------------------------------------------------------------

pub type SharedState = Arc<RwLock<HftState>>;
pub type SharedCreds = Arc<RwLock<Credentials>>;

/// Convenience constructor – creates both handles initialised to defaults.
pub fn new_shared() -> (SharedState, SharedCreds) {
    (
        Arc::new(RwLock::new(HftState::default())),
        Arc::new(RwLock::new(Credentials::default())),
    )
}
