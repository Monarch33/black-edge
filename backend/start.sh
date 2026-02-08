#!/bin/bash
set -e

# Use PORT from Railway or default to 8000
PORT=${PORT:-8000}

echo "Starting Uvicorn on port $PORT..."

# Start uvicorn with proper port
exec uvicorn main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 2
