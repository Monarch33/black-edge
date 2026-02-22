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
    pub polymarket_api_key:    String,
    pub polymarket_secret:     String,
    pub polymarket_passphrase: String,
    /// Polygon EOA private key (hex, with or without 0x prefix).
    pub polygon_private_key:   String,
}

// ── Order tracking ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum OrderStatus {
    InFlight,
    Placed { order_id: String },
    Filled { order_id: String },
    Failed { reason: String },
}

#[derive(Debug, Clone, Serialize)]
pub struct ActiveOrder {
    pub market_id: String,
    pub token_id:  String,
    /// 0 = BUY, 1 = SELL
    pub side: u8,
    /// For BUY: USDC spent (6-decimal).  For SELL: YES shares given (6-decimal).
    pub maker_amount_usdc:   u64,
    /// For BUY: YES shares received (6-decimal).  For SELL: USDC expected (6-decimal).
    pub taker_amount_shares: u64,
    pub price:        f64,
    pub status:       OrderStatus,
    pub submitted_at: u64,
}

// ── Main state struct ─────────────────────────────────────────────────────────

#[derive(Debug)]
pub struct HftState {
    // ── Market data ──────────────────────────────────────────────────────────
    pub btc_price: f64,
    pub yes_price: f64,

    // ── Microstructure ────────────────────────────────────────────────────────
    /// L2 orderbook imbalance from Binance bookTicker: (bid_qty − ask_qty) / (bid_qty + ask_qty).
    /// Range [-1.0, 1.0].  Positive → more bid pressure → price likely to rise.
    pub ob_imbalance: f64,

    // ── Quant signals ────────────────────────────────────────────────────────
    pub bs_fair_value: f64,
    pub sigma:         f64,
    pub kelly_fraction: f64,
    pub edge:          f64,

    // ── Risk / portfolio ─────────────────────────────────────────────────────
    pub bankroll_usdc:      u64,
    pub strike:             f64,
    pub time_to_expiry_years: f64,

    // ── Inventory tracking ────────────────────────────────────────────────────
    /// Total YES shares currently held (real units, not fixed-point).
    pub current_position_shares: f64,
    /// Volume-weighted average entry price for the current position (per share).
    pub average_entry_price: f64,

    // ── Polymarket context ───────────────────────────────────────────────────
    pub active_token_id:  Option<String>,
    pub active_market_id: Option<String>,

    // ── Security ─────────────────────────────────────────────────────────────
    pub credentials: Option<EngineCredentials>,

    // ── Order management ─────────────────────────────────────────────────────
    pub active_orders:  HashMap<Uuid, ActiveOrder>,
    pub last_execution: Option<Instant>,
}

impl Default for HftState {
    fn default() -> Self {
        Self {
            btc_price:               0.0,
            yes_price:               0.0,
            ob_imbalance:            0.0,
            bs_fair_value:           0.0,
            sigma:                   0.80,
            kelly_fraction:          0.0,
            edge:                    0.0,
            bankroll_usdc:           0,
            strike:                  0.0,
            time_to_expiry_years:    5.0 / 525_600.0,
            current_position_shares: 0.0,
            average_entry_price:     0.0,
            active_token_id:         None,
            active_market_id:        None,
            credentials:             None,
            active_orders:           HashMap::new(),
            last_execution:          None,
        }
    }
}

impl HftState {
    pub fn new(initial_bankroll_usdc: u64, strike: f64) -> Self {
        Self { bankroll_usdc: initial_bankroll_usdc, strike, ..Default::default() }
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    pub fn cooldown_elapsed(&self, cooldown_ms: u64) -> bool {
        self.last_execution
            .map(|t| t.elapsed().as_millis() as u64 >= cooldown_ms)
            .unwrap_or(true)
    }

    /// Returns `true` if there is an in-flight BUY order for `token_id`.
    pub fn has_inflight_order(&self, token_id: &str) -> bool {
        self.active_orders.values().any(|o| {
            o.token_id == token_id && o.side == 0 && o.status == OrderStatus::InFlight
        })
    }

    /// Returns `true` if there is an in-flight SELL order for `token_id`.
    pub fn has_inflight_sell(&self, token_id: &str) -> bool {
        self.active_orders.values().any(|o| {
            o.token_id == token_id && o.side == 1 && o.status == OrderStatus::InFlight
        })
    }

    // ── Inventory helpers ────────────────────────────────────────────────────

    /// Unrealised P&L in dollars at current market price.
    pub fn unrealized_pnl(&self) -> f64 {
        if self.current_position_shares <= 0.0 || self.average_entry_price <= 0.0 {
            return 0.0;
        }
        (self.yes_price - self.average_entry_price) * self.current_position_shares
    }

    /// Update inventory after a confirmed BUY fill.
    pub fn add_to_position(&mut self, new_shares: f64, cost_dollars: f64) {
        let total_shares = self.current_position_shares + new_shares;
        let total_cost   = self.current_position_shares * self.average_entry_price + cost_dollars;
        self.average_entry_price     = if total_shares > 0.0 { total_cost / total_shares } else { 0.0 };
        self.current_position_shares = total_shares;
    }

    /// Clear inventory after a confirmed SELL.
    pub fn clear_position(&mut self) {
        self.current_position_shares = 0.0;
        self.average_entry_price     = 0.0;
    }

    // ── Bankroll helpers ──────────────────────────────────────────────────────

    pub fn bankroll_dollars(&self) -> f64 {
        self.bankroll_usdc as f64 / 1_000_000.0
    }

    pub fn apply_pnl(&mut self, delta_usdc: i64) {
        self.bankroll_usdc = (self.bankroll_usdc as i64 + delta_usdc).max(0) as u64;
    }
}

pub type SharedState = Arc<RwLock<HftState>>;
