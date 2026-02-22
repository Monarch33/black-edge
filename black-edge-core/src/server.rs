//! Axum HTTP + WebSocket server.
//!
//! # Endpoints
//! | Method | Path                       | Description                                   |
//! |--------|----------------------------|-----------------------------------------------|
//! | GET    | `/ws`                      | WebSocket – pushes `HftMetrics` at 4 Hz       |
//! | POST   | `/api/engine/credentials`  | Load Vault keys into the running engine       |
//! | GET    | `/api/engine/metrics`      | REST JSON snapshot (fallback for WS clients)  |
//! | GET    | `/health`                  | Liveness probe                                |
//!
//! # WebSocket broadcast design
//! A single background task serialises `HftState` every 250 ms and sends the
//! JSON string to a `tokio::sync::broadcast` channel.  Each WS connection
//! spawns a lightweight task that forwards from the channel to the socket.
//! This decouples the broadcast cadence from per-connection I/O.

use std::sync::Arc;
use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};

use crate::state::{EngineCredentials, HftState, SharedState};

// ── App state (carries both HFT state and WS broadcast channel) ──────────────

#[derive(Clone)]
struct AppState {
    hft: SharedState,
    ws_tx: broadcast::Sender<String>,
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

/// Build and run the Axum server.
///
/// Internally spawns a 4 Hz broadcaster that serialises `HftState` and fans
/// it out to every connected WebSocket client.
pub async fn serve(state: SharedState, addr: &str) -> anyhow::Result<()> {
    // Broadcast channel: capacity 8 frames (~2 s of backlog at 4 Hz).
    // Slow clients are dropped with a `Lagged` error – they will just miss
    // a frame and catch up on the next tick.
    let (ws_tx, _) = broadcast::channel::<String>(8);

    // ── 4 Hz broadcaster task ────────────────────────────────────────────────
    {
        let hft_for_bc = Arc::clone(&state);
        let tx_for_bc  = ws_tx.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(250));
            loop {
                interval.tick().await;
                // Only bother serialising if someone is listening.
                if tx_for_bc.receiver_count() == 0 {
                    continue;
                }
                let payload = {
                    let s = hft_for_bc.read().await;
                    serde_json::to_string(&metrics_snapshot(&s))
                        .unwrap_or_default()
                };
                // Ignore send errors (no receivers is fine).
                let _ = tx_for_bc.send(payload);
            }
        });
    }

    let app_state = AppState {
        hft: Arc::clone(&state),
        ws_tx,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/ws",                        get(ws_upgrade))
        .route("/health",                    get(health))
        .route("/api/engine/credentials",    post(post_credentials))
        .route("/api/engine/metrics",        get(get_metrics))
        .layer(cors)
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| anyhow::anyhow!("bind {addr}: {e}"))?;

    info!("server: listening on http://{addr}  (ws://{addr}/ws)");
    axum::serve(listener, app).await?;
    Ok(())
}

// ── GET /ws  (WebSocket upgrade) ──────────────────────────────────────────────

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    State(app): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| forward_to_ws(socket, app.ws_tx.subscribe()))
}

/// Per-connection task: receive from the broadcast channel, send to socket.
async fn forward_to_ws(mut socket: WebSocket, mut rx: broadcast::Receiver<String>) {
    loop {
        match rx.recv().await {
            Ok(msg) => {
                if socket.send(Message::Text(msg)).await.is_err() {
                    break; // client disconnected
                }
            }
            Err(broadcast::error::RecvError::Lagged(n)) => {
                warn!("ws: client lagged, dropped {n} frames");
                // Continue – client will receive the next available frame.
            }
            Err(broadcast::error::RecvError::Closed) => break,
        }
    }
}

// ── GET /health ───────────────────────────────────────────────────────────────

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

// ── POST /api/engine/credentials ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CredentialsPayload {
    pub polymarket_api_key:    String,
    pub polymarket_secret:     String,
    pub polymarket_passphrase: String,
    pub polygon_private_key:   String,
}

#[derive(Serialize)]
struct CredentialsResponse {
    ok:      bool,
    message: String,
}

async fn post_credentials(
    State(app): State<AppState>,
    Json(payload): Json<CredentialsPayload>,
) -> impl IntoResponse {
    let key_stripped = payload.polygon_private_key.trim_start_matches("0x");
    if key_stripped.len() != 64 {
        return (
            StatusCode::BAD_REQUEST,
            Json(CredentialsResponse {
                ok:      false,
                message: "polygon_private_key must be 64 hex characters".into(),
            }),
        );
    }

    let creds = EngineCredentials {
        polymarket_api_key:    payload.polymarket_api_key,
        polymarket_secret:     payload.polymarket_secret,
        polymarket_passphrase: payload.polymarket_passphrase,
        polygon_private_key:   payload.polygon_private_key,
    };

    {
        let mut s = app.hft.write().await;
        s.credentials = Some(creds);
    }

    info!("server: credentials loaded (held in RAM only, not written to disk)");

    (
        StatusCode::OK,
        Json(CredentialsResponse {
            ok:      true,
            message: "Credentials loaded. Engine armed.".into(),
        }),
    )
}

// ── GET /api/engine/metrics  (REST fallback) ──────────────────────────────────

#[derive(Serialize, Clone)]
pub struct MetricsResponse {
    pub btc_price:               f64,
    pub yes_price:               f64,
    pub bs_fair_value:           f64,
    pub kelly_fraction:          f64,
    pub edge:                    f64,
    pub sigma:                   f64,
    pub strike:                  f64,
    pub bankroll_usdc_dollars:   f64,
    pub active_token_id:         Option<String>,
    pub active_market_id:        Option<String>,
    pub credentials_loaded:      bool,
    pub active_orders_count:     usize,
    // ── Microstructure ────────────────────────────────────────────────────────
    /// Binance L2 orderbook imbalance: (bid_qty − ask_qty) / (bid_qty + ask_qty).
    pub ob_imbalance:            f64,
    // ── Inventory ─────────────────────────────────────────────────────────────
    pub current_position_shares: f64,
    pub average_entry_price:     f64,
    pub unrealized_pnl:          f64,
}

fn metrics_snapshot(s: &HftState) -> MetricsResponse {
    MetricsResponse {
        btc_price:               s.btc_price,
        yes_price:               s.yes_price,
        bs_fair_value:           s.bs_fair_value,
        kelly_fraction:          s.kelly_fraction,
        edge:                    s.edge,
        sigma:                   s.sigma,
        strike:                  s.strike,
        bankroll_usdc_dollars:   s.bankroll_dollars(),
        active_token_id:         s.active_token_id.clone(),
        active_market_id:        s.active_market_id.clone(),
        credentials_loaded:      s.credentials.is_some(),
        active_orders_count:     s.active_orders.len(),
        ob_imbalance:            s.ob_imbalance,
        current_position_shares: s.current_position_shares,
        average_entry_price:     s.average_entry_price,
        unrealized_pnl:          s.unrealized_pnl(),
    }
}

async fn get_metrics(State(app): State<AppState>) -> impl IntoResponse {
    let s = app.hft.read().await;
    (StatusCode::OK, Json(metrics_snapshot(&s)))
}
