use std::sync::Arc;
use tokio::sync::RwLock;

use crate::black_scholes::BlackScholesResult;
use crate::kelly::KellyResult;

/// Active Polymarket BTC 5-min market fetched dynamically at startup.
#[derive(Debug, Clone)]
pub struct ActiveMarket {
    /// Polymarket CLOB token ID for the YES outcome
    pub token_id: String,
    /// Full market question, e.g. "Will BTC be above $70000 at 14:25 UTC?"
    pub question: String,
    /// Strike price parsed from the question (USD)
    pub strike: f64,
    /// Market expiry as epoch milliseconds
    pub end_time_ms: i64,
    /// Time to expiry converted to years (for Black-Scholes)
    pub time_to_expiry_years: f64,
}

/// Shared engine state, updated by Binance and Polymarket tasks.
#[derive(Debug, Clone, Default)]
pub struct HftState {
    /// Latest BTC mid-price from Binance
    pub btc_price: f64,
    /// Binance best bid
    pub btc_bid: f64,
    /// Binance best ask
    pub btc_ask: f64,
    /// Epoch ms of last Binance tick
    pub last_update_ms: i64,

    /// Current active Polymarket BTC 5-min market
    pub active_market: Option<ActiveMarket>,
    /// Last known Polymarket YES price (0.0–1.0)
    pub polymarket_price: f64,

    /// Black-Scholes output (recalculated on every Binance tick)
    pub bs_result: Option<BlackScholesResult>,
    /// Kelly sizing output
    pub kelly_result: Option<KellyResult>,

    /// Estimated Binance→Chainlink→Polymarket diffusion latency (ms)
    pub spread_ms: i64,
    /// Last measured round-trip execution latency (ms)
    pub execution_latency_ms: f64,
    /// Last Polygon RPC ping (ms)
    pub rpc_ping_ms: f64,
    /// Number of frontend WebSocket clients currently connected
    pub connected_clients: usize,
}

pub type SharedState = Arc<RwLock<HftState>>;

pub fn new_shared_state() -> SharedState {
    Arc::new(RwLock::new(HftState::default()))
}
