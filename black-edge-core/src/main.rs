/// BLACK EDGE CORE — HFT Execution Engine
///
/// A deterministic, low-latency Rust binary that:
///   1. Streams BTC/USDT tick data from Binance (sub-ms latency)
///   2. Discovers active Polymarket BTC 5-min markets dynamically
///   3. Calculates Black-Scholes fair value + Greeks on every tick
///   4. Sizes positions using Kelly Criterion
///   5. Broadcasts real-time HFT metrics to the React dashboard over WebSocket
///   6. Logs structured `[WOULD EXECUTE]` signals (future: live order submission)
///
/// Architecture:
///   ┌──────────────────┐    tick     ┌─────────────────────┐
///   │ Binance WS       │──────────→ │ HftState (RwLock)   │
///   │ (bookTicker)     │            │  btc_price, bs, kelly│
///   └──────────────────┘            └─────────┬───────────┘
///                                             │ read every 250ms
///   ┌──────────────────┐    price    │         │
///   │ Polymarket CLOB  │──────────→ │         ▼
///   │ WS (market sub)  │            │ ┌───────────────────┐
///   └──────────────────┘            │ │ Axum Server       │
///                                   │ │ /health /metrics  │
///   ┌──────────────────┐            │ │ /ws → broadcast   │
///   │ Gamma REST API   │──(boot)──→ │ └───────────────────┘
///   │ (market fetch)   │            │
///   └──────────────────┘            │
///                                   └─→ React Dashboard

mod binance;
mod black_scholes;
mod executor;
mod kelly;
mod polymarket_ws;
mod server;
mod state;

use std::env;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    // Initialise structured logging (controlled via RUST_LOG env var)
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    info!("╔══════════════════════════════════════╗");
    info!("║   BLACK EDGE CORE — HFT ENGINE v0.1  ║");
    info!("║   Target: AWS eu-west-2 (London)     ║");
    info!("╚══════════════════════════════════════╝");

    // Configuration from environment
    let port: u16 = env::var("RUST_ENGINE_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(9000);

    let bankroll: f64 = env::var("BANKROLL")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1000.0);

    info!("[CONFIG] Port: {} | Bankroll: ${:.2}", port, bankroll);

    // Shared state
    let hft_state = state::new_shared_state();

    // Spawn Binance WebSocket ingestion (runs forever, reconnects automatically)
    {
        let state_clone = hft_state.clone();
        tokio::spawn(async move {
            binance::run(state_clone, bankroll).await;
        });
    }

    // Spawn Polymarket WebSocket ingestion (discovers active market at boot)
    {
        let state_clone = hft_state.clone();
        tokio::spawn(async move {
            polymarket_ws::run(state_clone).await;
        });
    }

    // Run the Axum HTTP + WebSocket server (blocks until shutdown)
    server::run(hft_state, port).await;
}
