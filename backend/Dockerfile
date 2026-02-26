# Black Edge Backend - Production Dockerfile
# Full quantitative features with pre-compiled dependencies

FROM python:3.12-slim

# Install system dependencies for compilation
RUN apt-get update && apt-get install -y \
    build-essential \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first (for layer caching)
COPY requirements.txt .

# Install Python dependencies (this will compile numpy/pandas/scipy)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Health check (Railway sets PORT dynamically)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request, os; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/health')" || exit 1

# 4 Uvicorn workers — optimized for async workloads (1000 concurrent users)
# Note: only 1 worker handles the Background scanner task; WebSocket state is process-local.
# For multi-process WebSocket broadcast, use Redis pub/sub (Phase 2).
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --loop uvloop --http httptools
