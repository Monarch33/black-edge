/// Axum HTTP + WebSocket broadcast server.
///
/// Endpoints:
///   GET /health    → {"status":"ok","btc_price":..., "uptime_s":...}
///   GET /metrics   → Full HftMetrics JSON snapshot
///   GET /ws        → WebSocket — broadcasts HftMetrics every 250ms
///
/// WebSocket broadcast message format:
/// {
///   "type": "hft_metrics",
///   "timestamp_ms": 1708612345678,
///   "btc_price": 67432.50,
///   "btc_bid": 67430.00,
///   "btc_ask": 67435.00,
///   "bs": { "fair_price": 0.72, "delta": 0.68, "gamma": 0.0023,
///            "theta": -0.0031, "vega": 0.0089, "implied_vol": 0.80,
///            "edge_vs_market": 0.04 },
///   "kelly": { "fraction": 0.08, "dollar_amount": 80.0, "edge": 0.04, "b": 2.57 },
///   "polymarket_price": 0.68,
///   "active_market": { "question": "...", "strike": 70000.0, ... },
///   "spread_ms": 340,
///   "execution_latency_ms": 12.4,
///   "rpc_ping_ms": 8.1,
///   "connected_clients": 2
/// }

use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
    routing::get,
    Json, Router,
};
use serde::Serialize;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use uuid::Uuid;

use crate::{
    black_scholes::BlackScholesResult,
    executor,
    kelly::KellyResult,
    state::SharedState,
};

/// The broadcast interval — 250ms gives 4 Hz refresh for the UI.
const BROADCAST_INTERVAL_MS: u64 = 250;

// ─── API response types ───────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ActiveMarketInfo {
    question: String,
    strike: f64,
    end_time_ms: i64,
    time_to_expiry_min: f64,
}

#[derive(Debug, Serialize)]
pub struct HftMetrics {
    #[serde(rename = "type")]
    msg_type: &'static str,
    timestamp_ms: i64,
    btc_price: f64,
    btc_bid: f64,
    btc_ask: f64,
    bs: Option<BlackScholesResult>,
    kelly: Option<KellyResult>,
    polymarket_price: f64,
    active_market: Option<ActiveMarketInfo>,
    spread_ms: i64,
    execution_latency_ms: f64,
    rpc_ping_ms: f64,
    connected_clients: usize,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: &'static str,
    btc_price: f64,
    uptime_s: u64,
    connected_clients: usize,
}

// ─── App state ────────────────────────────────────────────────────────────────

type ClientMap = Arc<Mutex<HashMap<Uuid, tokio::sync::mpsc::UnboundedSender<String>>>>;

#[derive(Clone)]
struct AppState {
    hft: SharedState,
    clients: ClientMap,
    start_time: Instant,
}

// ─── Metrics snapshot ─────────────────────────────────────────────────────────

async fn snapshot_metrics(app: &AppState) -> HftMetrics {
    let s = app.hft.read().await;

    let active_market = s.active_market.as_ref().map(|m| ActiveMarketInfo {
        question: m.question.clone(),
        strike: m.strike,
        end_time_ms: m.end_time_ms,
        time_to_expiry_min: m.time_to_expiry_years * 365.0 * 24.0 * 60.0,
    });

    let connected_clients = app.clients.lock().unwrap().len();

    HftMetrics {
        msg_type: "hft_metrics",
        timestamp_ms: chrono::Utc::now().timestamp_millis(),
        btc_price: s.btc_price,
        btc_bid: s.btc_bid,
        btc_ask: s.btc_ask,
        bs: s.bs_result.clone(),
        kelly: s.kelly_result.clone(),
        polymarket_price: s.polymarket_price,
        active_market,
        spread_ms: s.spread_ms,
        execution_latency_ms: s.execution_latency_ms,
        rpc_ping_ms: s.rpc_ping_ms,
        connected_clients,
    }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

async fn health(State(app): State<AppState>) -> Json<HealthResponse> {
    let s = app.hft.read().await;
    Json(HealthResponse {
        status: "ok",
        btc_price: s.btc_price,
        uptime_s: app.start_time.elapsed().as_secs(),
        connected_clients: app.clients.lock().unwrap().len(),
    })
}

async fn metrics_snapshot(State(app): State<AppState>) -> Json<HftMetrics> {
    Json(snapshot_metrics(&app).await)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(app): State<AppState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, app))
}

async fn handle_socket(mut socket: WebSocket, app: AppState) {
    let id = Uuid::new_v4();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Register client
    {
        let mut clients = app.clients.lock().unwrap();
        clients.insert(id, tx);
    }
    info!("[SERVER] WS client connected: {}", id);

    // Spawn broadcast ticker for this client
    let app_clone = app.clone();
    let broadcast_task = tokio::spawn(async move {
        let mut interval =
            tokio::time::interval(Duration::from_millis(BROADCAST_INTERVAL_MS));
        loop {
            interval.tick().await;
            let metrics = snapshot_metrics(&app_clone).await;

            // Also check executor signal
            let kelly_snap = {
                let s = app_clone.hft.read().await;
                s.kelly_result.clone()
            };
            if let Some(ref kelly) = kelly_snap {
                let state_snap = app_clone.hft.read().await;
                executor::maybe_execute(kelly, &state_snap).await;
            }

            match serde_json::to_string(&metrics) {
                Ok(json) => {
                    let clients = app_clone.clients.lock().unwrap();
                    if let Some(tx) = clients.get(&id) {
                        let _ = tx.send(json);
                    }
                }
                Err(e) => {
                    tracing::error!("[SERVER] Serialization error: {}", e);
                }
            }
        }
    });

    // Forward outbound messages to WebSocket
    loop {
        tokio::select! {
            msg = rx.recv() => {
                match msg {
                    Some(text) => {
                        if socket.send(Message::Text(text)).await.is_err() {
                            break;
                        }
                    }
                    None => break,
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(Message::Ping(p))) => {
                        let _ = socket.send(Message::Pong(p)).await;
                    }
                    _ => {}
                }
            }
        }
    }

    // Cleanup
    broadcast_task.abort();
    app.clients.lock().unwrap().remove(&id);
    info!("[SERVER] WS client disconnected: {}", id);
}

// ─── Server entry point ───────────────────────────────────────────────────────

pub async fn run(hft_state: SharedState, port: u16) {
    let app_state = AppState {
        hft: hft_state,
        clients: Arc::new(Mutex::new(HashMap::new())),
        start_time: Instant::now(),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics_snapshot))
        .route("/ws", get(ws_handler))
        .with_state(app_state)
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("[SERVER] BLACK EDGE CORE listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
