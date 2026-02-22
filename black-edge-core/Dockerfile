# ─── Stage 1: Build ──────────────────────────────────────────────────────────
# Uses the official Rust slim image. Separates dependency caching from source
# compilation to maximise Docker layer cache hits on rebuilds.
FROM rust:1.76-slim as builder

WORKDIR /app

# Install build deps for native-tls (OpenSSL)
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy manifest and lock file first — cache dependency compilation layer
COPY Cargo.toml Cargo.lock* ./

# Stub main.rs to compile dependencies without our source
RUN mkdir src && echo "fn main(){}" > src/main.rs
RUN cargo build --release 2>&1

# Remove stub and copy real source
RUN rm -rf src
COPY src ./src

# Touch main.rs to force Cargo to recompile our crate (not deps)
RUN touch src/main.rs
RUN cargo build --release 2>&1

# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
# Minimal Debian runtime image — no Rust toolchain in production.
FROM debian:bookworm-slim

# CA certificates required for TLS WebSocket connections to Binance/Polymarket
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/black-edge-core /usr/local/bin/black-edge-core

# Default environment
ENV RUST_LOG=info
ENV RUST_ENGINE_PORT=9000
ENV BANKROLL=1000.0

# Deployment target: AWS eu-west-2 (London)
# Co-locate with Polymarket matching engine for minimal network latency.
LABEL maintainer="black-edge"
LABEL target.region="eu-west-2"
LABEL target.cloud="aws"

EXPOSE 9000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:9000/health || exit 1

CMD ["black-edge-core"]
