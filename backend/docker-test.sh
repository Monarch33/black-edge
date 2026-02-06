#!/bin/bash
# Test Docker build locally before deploying to Render

echo "🐳 Building Docker image..."
docker build -t black-edge-backend:test .

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    echo "🚀 Running container on port 8000..."
    echo "   Access at: http://localhost:8000"
    echo "   Health check: http://localhost:8000/health"
    echo "   API docs: http://localhost:8000/docs"
    echo ""
    echo "   Press Ctrl+C to stop"
    echo ""

    docker run -p 8000:8000 \
        -e ENVIRONMENT=development \
        -e POLYGON_RPC_URL="${POLYGON_RPC_URL}" \
        -e STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY}" \
        black-edge-backend:test
else
    echo "❌ Build failed"
    exit 1
fi
