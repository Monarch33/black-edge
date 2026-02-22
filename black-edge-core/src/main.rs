/// BLACK EDGE CORE – Rust HFT Execution Engine
///
/// Orchestrates four concurrent tokio tasks:
///   1. Binance WebSocket  – BTC mid-price → triggers BS + Kelly recalculation
///   2. Polymarket WS      – YES price discovery + market metadata
///   3. Executor loop      – EIP-712 signing + CLOB order submission
///   4. Axum server        – WS fan-out (4 Hz) + credentials REST endpoint
///
/// All tasks share `Arc<RwLock<HftState>>` and `Arc<RwLock<Credentials>>`.
mod binance_ws;
mod executor;
mod math;
mod polymarket_ws;
mod server;
mod state;

use std::time::Duration;

use anyhow::Result;
use tracing::info;
use tracing_subscriber::{fmt, EnvFilter};

use crate::{
    executor::Executor,
    state::new_shared,
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> Result<()> {
    // ---- Initialise structured logging ----
    // Respect RUST_LOG env var; default to INFO for our crates, WARN for deps.
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("black_edge_core=debug,tower_http=warn,hyper=warn,reqwest=warn")
    });

    fmt()
        .with_env_filter(filter)
        .with_target(false)
        .compact()
        .init();

    info!("╔══════════════════════════════════════════╗");
    info!("║      BLACK EDGE CORE  v0.1.0             ║");
    info!("║  Rust HFT Engine – Polymarket BTC Binary ║");
    info!("╚══════════════════════════════════════════╝");

    // ---- Shared state handles ----
    let (hft_state, creds) = new_shared();

    // ---- Spawn tasks ----

    // Task 1: Binance WebSocket (BTC price + math recalc on every tick)
    let hft1 = hft_state.clone();
    let binance_handle = tokio::spawn(async move {
        info!("[main] starting Binance WS task");
        binance_ws::run(hft1).await;
    });

    // Task 2: Polymarket WebSocket (market discovery + YES price)
    let hft2 = hft_state.clone();
    let poly_handle = tokio::spawn(async move {
        info!("[main] starting Polymarket WS task");
        // Brief delay to let Binance WS establish first so state has a valid
        // BTC price before we begin pricing
        tokio::time::sleep(Duration::from_secs(2)).await;
        polymarket_ws::run(hft2).await;
    });

    // Task 3: Executor loop (edge detection + EIP-712 order submission)
    let hft3 = hft_state.clone();
    let creds3 = creds.clone();
    let exec_handle = tokio::spawn(async move {
        info!("[main] starting Executor task");
        // Delay execution start until we have both prices
        tokio::time::sleep(Duration::from_secs(5)).await;
        let executor = Executor::new(hft3, creds3);
        executor.run().await;
    });

    // Task 4: Axum HTTP + WebSocket server (port 9000)
    let hft4 = hft_state.clone();
    let creds4 = creds.clone();
    let server_handle = tokio::spawn(async move {
        info!("[main] starting Axum server on :9000");
        server::serve(hft4, creds4).await;
    });

    // ---- Wait for any task to exit (they should all run forever) ----
    // If one crashes, log and allow the process to exit so a supervisor
    // (Docker restart policy / Railway) can respawn cleanly.
    tokio::select! {
        res = binance_handle => {
            tracing::error!("[main] Binance WS task exited unexpectedly: {res:?}");
        }
        res = poly_handle => {
            tracing::error!("[main] Polymarket WS task exited unexpectedly: {res:?}");
        }
        res = exec_handle => {
            tracing::error!("[main] Executor task exited unexpectedly: {res:?}");
        }
        res = server_handle => {
            tracing::error!("[main] Axum server task exited unexpectedly: {res:?}");
        }
    }

    Ok(())
}
