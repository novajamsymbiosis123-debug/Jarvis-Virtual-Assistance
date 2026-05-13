FROM python:3.11-slim

WORKDIR /app

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    python3-dev \
    ffmpeg \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Upgrade packaging tools
RUN pip install --upgrade pip setuptools wheel

# Install setuptools explicitly
RUN pip install setuptools

# Install torch separately
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu

# Install whisper separately
RUN pip install openai-whisper

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
