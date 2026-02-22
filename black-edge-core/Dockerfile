# ─────────────────────────────────────────────────────────────────────────────
# Black Edge Core – Production Docker Image
#
# Two-stage build:
#   1. builder  – full Rust toolchain, compiles with --release
#   2. runtime  – minimal Debian slim image, no compiler overhead
#
# Build:  docker build -t black-edge-core .
# Run:    docker run -p 8090:8090 --env-file .env black-edge-core
#
# Required runtime environment variables (pass via --env-file or -e):
#   (none are mandatory – sensible defaults are built in, but you MUST
#    POST credentials to /api/engine/credentials before the engine arms)
#
# Optional tuning variables:
#   SERVER_ADDR        Bind address (default: 0.0.0.0:8090)
#   SIGMA              Annualised BTC volatility seed (default: 0.80)
#   BANKROLL_USDC      Starting bankroll, 6-decimal fixed-point (default: 100000000 = $100)
#   EXECUTOR_POLL_MS   Execution polling cadence in ms (default: 250)
#   RISK_FREE_RATE     Annualised risk-free rate (default: 0.05)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM rust:1-slim-bookworm AS builder

# Install C toolchain and OpenSSL headers (required by native-tls in reqwest
# and tokio-tungstenite).
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# ── Dependency caching layer ──────────────────────────────────────────────────
# Copy manifests first so Docker can cache the `cargo fetch` step.
# The real source is copied afterwards; only source changes (not dep changes)
# will invalidate this layer.
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release 2>/dev/null || true \
    && rm -f target/release/deps/black_edge_core* src/main.rs

# ── Full source build ─────────────────────────────────────────────────────────
COPY src/ ./src/
# Touch main.rs so cargo re-links even if only Cargo.toml changed.
RUN touch src/main.rs \
    && cargo build --release \
    && strip target/release/black-edge-core

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM debian:bookworm-slim AS runtime

# ca-certificates: needed for TLS connections to Polymarket + Binance APIs.
# libssl3:         shared library for native-tls at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for defence-in-depth.
RUN useradd -m -u 1001 blackedge
USER blackedge

WORKDIR /app
COPY --from=builder /build/target/release/black-edge-core /app/black-edge-core

# The engine binds on this port by default.
# Override with SERVER_ADDR=0.0.0.0:PORT if you need a different port.
EXPOSE 8090

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/app/black-edge-core"]

CMD ["/app/black-edge-core"]
