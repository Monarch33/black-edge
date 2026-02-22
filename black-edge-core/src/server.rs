/// Axum HTTP + WebSocket server – port 9000.
///
/// Endpoints:
///   GET  /ws                         – WebSocket that fans out HftState JSON at 4 Hz (250 ms)
///   POST /api/engine/credentials     – Receive API keys + Polygon private key from the React frontend
///   GET  /api/engine/status          – One-shot JSON snapshot of HftState (for health checks)
use std::net::SocketAddr;
use std::time::Duration;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::{Method, StatusCode},
    response::{IntoResponse, Json, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn};

use crate::state::{SharedCreds, SharedState};

// ---------------------------------------------------------------------------
// Combined server state (Axum `State` extractor)
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct AppState {
    pub hft: SharedState,
    pub creds: SharedCreds,
}

// ---------------------------------------------------------------------------
// Router construction
// ---------------------------------------------------------------------------

pub fn router(hft: SharedState, creds: SharedCreds) -> Router {
    let app_state = AppState { hft, creds };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        .route("/ws", get(ws_handler))
        .route("/api/engine/status", get(status_handler))
        .route("/api/engine/credentials", post(credentials_handler))
        .layer(cors)
        .with_state(app_state)
}

/// Start the Axum server on `0.0.0.0:9000`.  This function runs forever.
pub async fn serve(hft: SharedState, creds: SharedCreds) {
    let addr = SocketAddr::from(([0, 0, 0, 0], 9000));
    let app = router(hft, creds);

    info!("[server] listening on http://{addr}");
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind port 9000");

    axum::serve(listener, app)
        .await
        .expect("axum server error");
}

// ---------------------------------------------------------------------------
// GET /ws – WebSocket upgrade
// ---------------------------------------------------------------------------

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_ws_connection(socket, state))
}

async fn handle_ws_connection(mut socket: WebSocket, state: AppState) {
    info!("[server/ws] client connected");
    let mut interval = tokio::time::interval(Duration::from_millis(250)); // 4 Hz

    loop {
        interval.tick().await;

        let snapshot = state.hft.read().await.clone();
        let json = match serde_json::to_string(&snapshot) {
            Ok(s) => s,
            Err(e) => {
                warn!("[server/ws] serialisation error: {e}");
                continue;
            }
        };

        if socket.send(Message::Text(json)).await.is_err() {
            // Client disconnected
            break;
        }
    }

    info!("[server/ws] client disconnected");
}

// ---------------------------------------------------------------------------
// GET /api/engine/status – one-shot snapshot
// ---------------------------------------------------------------------------

async fn status_handler(State(state): State<AppState>) -> impl IntoResponse {
    let snapshot = state.hft.read().await.clone();
    Json(snapshot)
}

// ---------------------------------------------------------------------------
// POST /api/engine/credentials
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CredentialsPayload {
    pub polymarket_api_key: String,
    pub polymarket_secret: String,
    pub polymarket_passphrase: String,
    pub polygon_private_key: String,
}

#[derive(Debug, Serialize)]
struct CredentialsResponse {
    ok: bool,
    message: String,
}

async fn credentials_handler(
    State(state): State<AppState>,
    Json(payload): Json<CredentialsPayload>,
) -> impl IntoResponse {
    // Basic validation: private key should be 64 hex chars (without 0x) or 66 with
    let key = payload
        .polygon_private_key
        .trim_start_matches("0x")
        .to_string();

    if key.len() != 64 || hex::decode(&key).is_err() {
        return (
            StatusCode::BAD_REQUEST,
            Json(CredentialsResponse {
                ok: false,
                message: "polygon_private_key must be a valid 32-byte hex string".into(),
            }),
        );
    }

    let mut creds = state.creds.write().await;
    creds.polymarket_api_key = payload.polymarket_api_key;
    creds.polymarket_secret = payload.polymarket_secret;
    creds.polymarket_passphrase = payload.polymarket_passphrase;
    creds.polygon_private_key = key;

    info!("[server] credentials updated");

    (
        StatusCode::OK,
        Json(CredentialsResponse {
            ok: true,
            message: "credentials stored in memory".into(),
        }),
    )
}
