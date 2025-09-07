# Use NVIDIA CUDA base image for GPU support
FROM nvidia/cuda:12.2.0-base-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    python3-venv \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    wget \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic link for python
RUN ln -s /usr/bin/python3 /usr/bin/python

# Set working directory
WORKDIR /app

# Copy requirements files
COPY requirements.txt ./

# Install Python dependencies
# RUN pip install --break-system-packages --no-cache-dir --upgrade pip 
# RUN pip install --no-cache-dir -r requirements.txt
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY run_app.py ./

# Create directory for temporary images
RUN mkdir -p /tmp/images

# Expose port
EXPOSE 8000

# Set environment variables for the application
ENV SERVICE_URL=http://localhost:8000

# Pipeline Configuration
ENV MODEL_PATH=stabilityai/stable-diffusion-xl-base-1.0
ENV ENABLE_IP_ADAPTER=true
ENV ENABLE_LORA=false
ENV IP_ADAPTER="h94/IP-Adapter"
ENV IP_ADAPTER_SUBFOLDER="sdxl_models"
ENV IP_ADAPTER_WEIGHTS="ip-adapter_sdxl.bin"
ENV IP_ADAPTER_SCALE=0.33

# S3 Configuration (set your actual values here)
ENV AWS_REGION=us-east-1
ENV S3_BUCKET_NAME="auto-bio-illustrations"
ENV S3_AVATAR_PREFIX=avatars/
ENV S3_SUBJECT_PREFIX=subjects/
ENV S3_GENERATED_PREFIX=generated/

# Uvicorn Configuration
ENV UVICORN_HOST=0.0.0.0
ENV UVICORN_PORT=8000
ENV UVICORN_RELOAD=false
ENV UVICORN_LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Run the application
CMD ["python", "run_app.py"]
