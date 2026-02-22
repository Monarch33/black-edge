//! Axum HTTP server.
//!
//! # Endpoints
//! | Method | Path                       | Description                                |
//! |--------|----------------------------|--------------------------------------------|
//! | POST   | `/api/engine/credentials`  | Load Vault keys into the running engine    |
//! | GET    | `/api/engine/metrics`      | JSON snapshot of current HFT state         |
//! | GET    | `/health`                  | Liveness probe                             |
//!
//! CORS is configured to accept requests from any origin so the local Next.js
//! dev server (`localhost:3000`) and any production frontend domain can POST
//! the Vault payload without preflight failures.

use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::state::{EngineCredentials, SharedState};

// ── Server bootstrap ──────────────────────────────────────────────────────────

/// Build and run the Axum server on `addr` (e.g. `"0.0.0.0:8090"`).
pub async fn serve(state: SharedState, addr: &str) -> anyhow::Result<()> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/engine/credentials", post(post_credentials))
        .route("/api/engine/metrics", get(get_metrics))
        .layer(cors)
        .with_state(Arc::clone(&state));

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| anyhow::anyhow!("bind {addr}: {e}"))?;

    info!("server: listening on http://{addr}");
    axum::serve(listener, app).await?;
    Ok(())
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async fn health() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

// ── POST /api/engine/credentials ──────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CredentialsPayload {
    pub polymarket_api_key: String,
    pub polymarket_secret: String,
    pub polymarket_passphrase: String,
    /// Hex-encoded Polygon EOA private key (with or without 0x prefix).
    pub polygon_private_key: String,
}

#[derive(Serialize)]
struct CredentialsResponse {
    ok: bool,
    message: String,
}

async fn post_credentials(
    State(state): State<SharedState>,
    Json(payload): Json<CredentialsPayload>,
) -> impl IntoResponse {
    // Basic sanity: private key must be 32 bytes (64 hex chars, optional 0x)
    let key_stripped = payload.polygon_private_key.trim_start_matches("0x");
    if key_stripped.len() != 64 {
        return (
            StatusCode::BAD_REQUEST,
            Json(CredentialsResponse {
                ok: false,
                message: "polygon_private_key must be 64 hex characters".into(),
            }),
        );
    }

    let creds = EngineCredentials {
        polymarket_api_key: payload.polymarket_api_key,
        polymarket_secret: payload.polymarket_secret,
        polymarket_passphrase: payload.polymarket_passphrase,
        polygon_private_key: payload.polygon_private_key,
    };

    {
        let mut s = state.write().await;
        s.credentials = Some(creds);
    }

    info!("server: credentials loaded into engine (keys held in memory only)");

    (
        StatusCode::OK,
        Json(CredentialsResponse {
            ok: true,
            message: "Credentials loaded. Engine armed.".into(),
        }),
    )
}

// ── GET /api/engine/metrics ───────────────────────────────────────────────────

#[derive(Serialize)]
struct MetricsResponse {
    btc_price: f64,
    yes_price: f64,
    bs_fair_value: f64,
    kelly_fraction: f64,
    edge: f64,
    sigma: f64,
    bankroll_usdc_dollars: f64,
    active_token_id: Option<String>,
    active_market_id: Option<String>,
    credentials_loaded: bool,
    active_orders_count: usize,
}

async fn get_metrics(State(state): State<SharedState>) -> impl IntoResponse {
    let s = state.read().await;
    let resp = MetricsResponse {
        btc_price: s.btc_price,
        yes_price: s.yes_price,
        bs_fair_value: s.bs_fair_value,
        kelly_fraction: s.kelly_fraction,
        edge: s.edge,
        sigma: s.sigma,
        bankroll_usdc_dollars: s.bankroll_dollars(),
        active_token_id: s.active_token_id.clone(),
        active_market_id: s.active_market_id.clone(),
        credentials_loaded: s.credentials.is_some(),
        active_orders_count: s.active_orders.len(),
    };
    (StatusCode::OK, Json(resp))
}
