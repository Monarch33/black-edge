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

# Health check (Railway compatible - uses PORT env var)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request, os; urllib.request.urlopen(f'http://localhost:{os.getenv(\"PORT\", 8000)}/health')"

# Copy and set permissions for start script
COPY start.sh .
RUN chmod +x start.sh

# Run the application via start script (handles PORT variable properly)
CMD ["./start.sh"]
