#!/bin/bash
# Railway startup script for Black Edge Backend

# Install dependencies if not already installed
if [ ! -d ".venv" ]; then
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

# Start the FastAPI server
echo "Starting Black Edge API server..."
uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
