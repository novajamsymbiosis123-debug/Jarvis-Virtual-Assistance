FROM python:3.12-slim AS base

# System dependencies for Whisper + audio processing
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    python3-dev \
    ffmpeg \
    libffi-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Non-root user for security
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Preload Whisper model at build time (optional, speeds up cold start)
# RUN python -c "import whisper; whisper.load_model('base')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
