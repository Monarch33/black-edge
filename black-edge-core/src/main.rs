//! Black Edge Core – HFT orchestrator entry point.
//!
//! Spawns six concurrent async tasks:
//! 1. `binance_ws`        – BTC spot mid-price ingestor (Binance bookTicker)
//! 2. `market_discovery`  – Polls Gamma API every 60 s to find the live 5-min market
//! 3. `polymarket_ws`     – YES-token price ingestor (CLOB WS); auto-rotates via watch
//! 4. `quant_loop`        – Recomputes BS fair value + half-Kelly every 100 ms
//! 5. `executor`          – Fires orders when edge ≥ 2 % (cooldown-gated)
//! 6. `server`            – Axum: WS broadcast at 4 Hz + REST endpoints

// ── jemalloc (non-MSVC targets) ───────────────────────────────────────────────
#[cfg(not(target_env = "msvc"))]
use tikv_jemallocator::Jemalloc;

#[cfg(not(target_env = "msvc"))]
#[global_allocator]
static GLOBAL: Jemalloc = Jemalloc;

// ── Modules ───────────────────────────────────────────────────────────────────
mod binance_ws;
mod executor;
mod market_discovery;
mod math;
mod polymarket_ws;
mod server;
mod state;

use std::sync::Arc;

use anyhow::Result;
use tokio::sync::{watch, RwLock};
use tracing::info;
use tracing_subscriber::EnvFilter;

// ── Configuration ─────────────────────────────────────────────────────────────
//
// POLYMARKET_TOKEN_ID is no longer needed – the engine discovers markets
// autonomously via the Gamma API.

struct Config {
    /// Annualised volatility seed (updated dynamically by future IV inference)
    sigma: f64,
    /// Starting bankroll in USDC 6-decimal fixed-point (100_000_000 = $100.00)
    initial_bankroll_usdc: u64,
    /// Axum server bind address
    server_addr: String,
    /// Executor poll cadence (ms)
    executor_poll_ms: u64,
    /// Annualised risk-free rate
    risk_free_rate: f64,
}

impl Config {
    fn from_env() -> Self {
        dotenv::dotenv().ok();
        Self {
            sigma:                 env_f64("SIGMA",            0.80),
            initial_bankroll_usdc: env_u64("BANKROLL_USDC",   100_000_000),
            server_addr:           std::env::var("SERVER_ADDR")
                                       .unwrap_or_else(|_| "0.0.0.0:8090".into()),
            executor_poll_ms:      env_u64("EXECUTOR_POLL_MS", 250),
            risk_free_rate:        env_f64("RISK_FREE_RATE",   0.05),
        }
    }
}

fn env_f64(key: &str, default: f64) -> f64 {
    std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}
fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key).ok().and_then(|v| v.parse().ok()).unwrap_or(default)
}

// ── Quant loop ────────────────────────────────────────────────────────────────

/// Runs at `interval_ms` cadence.  Reads live prices + strike from shared
/// state, recomputes BS fair value and half-Kelly, writes results back.
///
/// Uses the strike stored in `HftState` (updated by `market_discovery` on each
/// market rotation) rather than a static config value.
async fn quant_loop(state: state::SharedState, interval_ms: u64, risk_free_rate: f64) {
    let interval = tokio::time::Duration::from_millis(interval_ms);
    loop {
        tokio::time::sleep(interval).await;

        let (btc_price, yes_price, sigma, t, strike, ob_imbalance) = {
            let s = state.read().await;
            (s.btc_price, s.yes_price, s.sigma, s.time_to_expiry_years, s.strike, s.ob_imbalance)
        };

        if btc_price == 0.0 || yes_price == 0.0 || strike == 0.0 {
            continue; // waiting for first data from discovery + WS ingestors
        }

        // Raw Black-Scholes fair value (risk-neutral probability)
        let bs_fv_raw = math::bs_binary_call(btc_price, strike, risk_free_rate, sigma, t);
        // L2 microstructure adjustment: boost/discount based on orderbook pressure
        let bs_fv  = math::apply_ob_imbalance(bs_fv_raw, ob_imbalance);
        let edge   = math::compute_edge(bs_fv, yes_price);
        let kelly  = math::kelly_fraction(bs_fv, yes_price, 0.02) * 0.5; // half-Kelly

        {
            let mut s = state.write().await;
            s.bs_fair_value  = bs_fv;
            s.edge           = edge;
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
        "Black Edge Core starting  σ={}  bankroll=${}",
        cfg.sigma,
        cfg.initial_bankroll_usdc as f64 / 1_000_000.0,
    );

    // ── Shared state ─────────────────────────────────────────────────────────
    // Strike starts at 0.0 – market_discovery will fill it in within 60 s.
    let shared = Arc::new(RwLock::new(state::HftState::new(
        cfg.initial_bankroll_usdc,
        0.0, // strike: set by market_discovery
    )));
    {
        let mut s = shared.write().await;
        s.sigma = cfg.sigma;
    }

    // ── HTTP client (shared across executor + market_discovery) ──────────────
    let http_client = executor::build_http_client()?;

    // ── Market-rotation watch channel ─────────────────────────────────────────
    // market_discovery sends new YES-token IDs here;
    // polymarket_ws receives and re-subscribes automatically.
    let (token_tx, token_rx) = watch::channel(String::new());

    // ── Clone state handles ───────────────────────────────────────────────────
    let (s1, s2, s3, s4, s5, s6) = (
        Arc::clone(&shared),
        Arc::clone(&shared),
        Arc::clone(&shared),
        Arc::clone(&shared),
        Arc::clone(&shared),
        Arc::clone(&shared),
    );

    let server_addr   = cfg.server_addr.clone();
    let rfr           = cfg.risk_free_rate;
    let poll_ms       = cfg.executor_poll_ms;
    let disc_client   = http_client.clone();

    // ── Run all tasks; exit the process if any one exits unexpectedly ─────────
    tokio::select! {
        r = tokio::spawn(async move {
            binance_ws::run(s1).await
        }) => {
            tracing::error!("binance_ws exited: {r:?}");
        }

        r = tokio::spawn(async move {
            market_discovery::run(s2, token_tx, disc_client).await
        }) => {
            tracing::error!("market_discovery exited: {r:?}");
        }

        r = tokio::spawn(async move {
            polymarket_ws::run(s3, token_rx).await
        }) => {
            tracing::error!("polymarket_ws exited: {r:?}");
        }

        r = tokio::spawn(async move {
            quant_loop(s4, 100, rfr).await
        }) => {
            tracing::error!("quant_loop exited: {r:?}");
        }

        r = tokio::spawn(async move {
            executor::run(s5, http_client, poll_ms).await
        }) => {
            tracing::error!("executor exited: {r:?}");
        }

        r = tokio::spawn(async move {
            if let Err(e) = server::serve(s6, &server_addr).await {
                tracing::error!("server error: {e:#}");
            }
        }) => {
            tracing::error!("server exited: {r:?}");
        }
    }

    Ok(())
}
