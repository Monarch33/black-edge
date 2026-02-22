//! Black Edge Core – HFT orchestrator entry point.
//!
//! Spawns five concurrent async tasks:
//! 1. `binance_ws`   – BTC spot price ingestor (Binance bookTicker)
//! 2. `polymarket_ws`– YES-token price ingestor (Polymarket CLOB)
//! 3. `quant_loop`   – Recomputes BS fair value + Kelly on every tick
//! 4. `executor`     – Fires orders when edge >= 2 %
//! 5. `server`       – Axum REST API (Vault credentials + metrics)

// ── jemalloc (non-MSVC targets) ───────────────────────────────────────────────
// Prevents allocator fragmentation under sustained high-velocity WS ingestion.
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

// ── Modules ───────────────────────────────────────────────────────────────────
mod binance_ws;
mod executor;
mod math;
mod polymarket_ws;
mod server;
mod state;

use std::sync::Arc;

use anyhow::Result;
use tokio::sync::RwLock;
use tracing::info;
use tracing_subscriber::EnvFilter;

// ── Configuration (loaded from environment / .env file) ───────────────────────

struct Config {
    /// BTC strike price for the active binary market (USDC)
    strike: f64,
    /// Annualised volatility seed (overridden dynamically later)
    sigma: f64,
    /// Starting bankroll in USDC 6-decimal fixed-point (100_000_000 = $100)
    initial_bankroll_usdc: u64,
    /// Polymarket YES-token conditional token ID (asset_id)
    token_id: String,
    /// Axum server bind address
    server_addr: String,
    /// Executor poll interval (ms)
    executor_poll_ms: u64,
    /// Annualised risk-free rate
    risk_free_rate: f64,
}

impl Config {
    fn from_env() -> Self {
        dotenv::dotenv().ok();
        Self {
            strike: env_f64("STRIKE_PRICE", 100_000.0),
            sigma: env_f64("SIGMA", 0.80),
            initial_bankroll_usdc: env_u64("BANKROLL_USDC", 100_000_000),
            token_id: std::env::var("POLYMARKET_TOKEN_ID")
                .unwrap_or_else(|_| "REPLACE_WITH_TOKEN_ID".into()),
            server_addr: std::env::var("SERVER_ADDR")
                .unwrap_or_else(|_| "0.0.0.0:8090".into()),
            executor_poll_ms: env_u64("EXECUTOR_POLL_MS", 250),
            risk_free_rate: env_f64("RISK_FREE_RATE", 0.05),
        }
    }
}

fn env_f64(key: &str, default: f64) -> f64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

// ── Quant loop ────────────────────────────────────────────────────────────────

/// Runs every `interval_ms` milliseconds.  Reads current prices from shared
/// state, recomputes the Black-Scholes fair value and Kelly fraction, then
/// writes the results back.  Kept as a lightweight separate task so that the
/// executor can poll at a different (slower) cadence.
async fn quant_loop(
    state: state::SharedState,
    interval_ms: u64,
    strike: f64,
    risk_free_rate: f64,
) {
    let interval = tokio::time::Duration::from_millis(interval_ms);
    loop {
        tokio::time::sleep(interval).await;

        // Read inputs under a short read lock
        let (btc_price, yes_price, sigma, t) = {
            let s = state.read().await;
            (s.btc_price, s.yes_price, s.sigma, s.time_to_expiry_years)
        };

        if btc_price == 0.0 || yes_price == 0.0 {
            continue; // waiting for first data ticks
        }

        let bs_fv = math::bs_binary_call(btc_price, strike, risk_free_rate, sigma, t);
        let edge = math::compute_edge(bs_fv, yes_price);
        // Use half-Kelly for conservative live sizing
        let kelly = math::kelly_fraction(bs_fv, yes_price, 0.02) * 0.5;

        // Write back under a short write lock
        {
            let mut s = state.write().await;
            s.bs_fair_value = bs_fv;
            s.edge = edge;
            s.kelly_fraction = kelly;
        }
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("black_edge_core=info".parse()?),
        )
        .init();

    let cfg = Config::from_env();

    info!(
        "Black Edge Core starting  strike={}  sigma={}  bankroll=${}",
        cfg.strike,
        cfg.sigma,
        cfg.initial_bankroll_usdc as f64 / 1_000_000.0,
    );

    // Shared state – one Arc<RwLock<HftState>> distributed to all tasks
    let shared = Arc::new(RwLock::new(state::HftState::new(
        cfg.initial_bankroll_usdc,
        cfg.strike,
    )));
    {
        let mut s = shared.write().await;
        s.sigma = cfg.sigma;
    }

    // Build connection-pooled HTTP client once; clone the Arc into each task
    let http_client = executor::build_http_client()?;

    // Clone handles for each spawned task
    let (s1, s2, s3, s4, s5) = (
        Arc::clone(&shared),
        Arc::clone(&shared),
        Arc::clone(&shared),
        Arc::clone(&shared),
        Arc::clone(&shared),
    );

    let token_id = cfg.token_id.clone();
    let server_addr = cfg.server_addr.clone();
    let strike = cfg.strike;
    let rfr = cfg.risk_free_rate;
    let poll_ms = cfg.executor_poll_ms;

    // Run all tasks under tokio::select! – if any one exits the process exits
    tokio::select! {
        r = tokio::spawn(async move { binance_ws::run(s1).await }) => {
            tracing::error!("binance_ws exited unexpectedly: {r:?}");
        }
        r = tokio::spawn(async move { polymarket_ws::run(s2, token_id).await }) => {
            tracing::error!("polymarket_ws exited unexpectedly: {r:?}");
        }
        r = tokio::spawn(async move { quant_loop(s3, 100, strike, rfr).await }) => {
            tracing::error!("quant_loop exited unexpectedly: {r:?}");
        }
        r = tokio::spawn(async move { executor::run(s4, http_client, poll_ms).await }) => {
            tracing::error!("executor exited unexpectedly: {r:?}");
        }
        r = tokio::spawn(async move {
            if let Err(e) = server::serve(s5, &server_addr).await {
                tracing::error!("server error: {e:#}");
            }
        }) => {
            tracing::error!("server exited unexpectedly: {r:?}");
        }
    }

    Ok(())
}
