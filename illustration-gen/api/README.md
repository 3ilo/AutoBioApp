# Illustration Generation API

A production-ready FastAPI service for generating high-quality illustrations using Stable Diffusion XL with IP-Adapter integration, S3 storage, and runtime parameter control.

## 🚀 Current Status: **PRODUCTION READY**

The illustration generation service is fully operational with:
- ✅ **Memory Illustrations**: Generate illustrations using user avatars as IP-Adapter input
- ✅ **Subject Illustrations**: Generate professional portraits from user photos
- ✅ **Runtime Parameter Control**: Adjust inference parameters on-the-fly via API
- ✅ **S3 Integration**: Automatic upload/download of images and models
- ✅ **GPU Optimization**: Memory-efficient pipeline with CUDA support
- ✅ **Docker Deployment**: Containerized with GPU support
- ✅ **Health Monitoring**: Service health checks and monitoring

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐   
│   AutoBio API   │    │  Image Service  │
│   (Existing)    │◄──►│      (EC2)      │
└─────────────────┘    └─────────────────┘   
                              │
                              ▼
                       ┌─────────────────┐
                       │   S3 Storage    │
                       │ (Models/Images) │
                       └─────────────────┘
```

## 📁 Project Structure

```
api/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app instance and configuration
│   │
│   ├── api/                   # API routes
│   │   ├── __init__.py
│   │   └── endpoints/
│   │       ├── __init__.py
│   │       ├── images.py      # Image generation endpoints
│   │       └── health.py      # Health check endpoint
│   │
│   ├── core/                  # Core functionality
│   │   ├── __init__.py
│   │   ├── config.py         # Configuration management
│   │   └── pipeline.py       # ML pipeline management
│   │
│   ├── schemas/               # Pydantic models
│   │   ├── __init__.py
│   │   └── image.py          # Request/response schemas
│   │
│   ├── services/              # Business logic
│   │   ├── __init__.py
│   │   └── illustration_service.py  # Image generation service
│   │
│   └── utils/                 # Utility functions
│       ├── __init__.py
│       ├── image_utils.py    # Image processing utilities
│       └── s3_utils.py       # S3 operations
│
├── scripts/                   # Testing and deployment scripts
│   ├── test-memory-illustration.sh
│   ├── test-subject-illustration.sh
│   └── test-health.sh
│
├── run_app.py                 # Application runner
├── requirements.txt           # Python dependencies
├── env.example               # Environment variables template
├── Dockerfile                # Docker configuration
└── README.md                 # This file
```

## 🎯 Features

### Core Generation Capabilities
- **Memory Illustrations**: Generate illustrations using user avatars as IP-Adapter input
- **Subject Illustrations**: Generate professional portraits from user photos
- **Runtime Parameter Control**: Adjust inference parameters on-the-fly
- **S3 Integration**: Automatic upload/download of images and models
- **GPU Optimization**: Memory-efficient pipeline with CUDA support

### Technical Features
- **Structured FastAPI Application**: Clean separation of concerns
- **Pydantic Validation**: Automatic request/response validation
- **Configuration Management**: Environment-based settings with defaults
- **Health Checks**: Service monitoring endpoint
- **Docker Support**: Containerized deployment with GPU support
- **Singleton Pipeline**: Single pipeline instance for memory efficiency
- **Progress Logging**: S3 download progress with configurable intervals

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Environment Variables

Copy the example environment file and configure:

```bash
cp env.example .env
# Edit .env with your configuration
```

### 3. Run the Application

```bash
python run_app.py
```

The API will be available at `http://localhost:8000`

### 4. View API Documentation

Visit `http://localhost:8000/docs` for interactive API documentation.

## 🔐 Authentication

The API supports optional shared secret authentication using Bearer tokens. Authentication can be enabled/disabled via environment variables.

### Authentication Configuration

```bash
# Enable/disable authentication
AUTH_ENABLED=true

# Set the shared secret token
AUTH_TOKEN="your-secret-token-here"
```

### Using Authentication

When authentication is enabled, include the Bearer token in the Authorization header:

```bash
curl -X POST "http://localhost:8000/v1/images/memory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token-here" \
  -d '{"user_id": "user123", "prompt": "A beautiful sunset"}'
```

### Authentication Behavior

- **When `AUTH_ENABLED=false`**: No authentication required (default)
- **When `AUTH_ENABLED=true`**: All image generation endpoints require valid Bearer token
- **Health endpoint**: Always accessible without authentication
- **Invalid token**: Returns 401 Unauthorized
- **Missing token**: Returns 401 Unauthorized with WWW-Authenticate header

## 📡 API Endpoints

### Generate Memory Illustration
- **POST** `/v1/images/memory`
- **Description**: Generates an illustration using the user's avatar from S3 as IP-Adapter input
- **Request Body**:
```json
{
  "user_id": "user123",
  "prompt": "A beautiful sunset over mountains",
  "num_inference_steps": 50,
  "ip_adapter_scale": 0.33,
  "negative_prompt": "blurry, low quality",
  "style_prompt": "highest quality, monochrome, professional sketch"
}
```
- **Response**:
```json
{
  "data": [{
    "s3_uri": "s3://auto-bio-illustrations/generated/user123/memory_abc123.png"
  }]
}
```

### Generate Subject Illustration
- **POST** `/v1/images/subject`
- **Description**: Generates a professional portrait illustration using the user's uploaded photo from S3
- **Request Body**:
```json
{
  "user_id": "user123",
  "num_inference_steps": 50,
  "ip_adapter_scale": 0.33,
  "negative_prompt": "blurry, low quality",
  "style_prompt": "highest quality, professional portrait, monochrome"
}
```
- **Response**:
```json
{
  "data": [{
    "s3_uri": "s3://auto-bio-illustrations/generated/user123/subject_def456.png"
  }]
}
```

### Health Check
- **GET** `/health/`
- **Response**:
```json
{
  "status": "healthy",
  "message": "Image generation service is ready"
}
```

## ⚙️ Configuration

### Key Environment Variables

#### Model Configuration
```bash
MODEL_PATH="stabilityai/stable-diffusion-xl-base-1.0"
MODEL_S3_PATH="s3://auto-bio-illustrations/models/checkpoint-1.safetensors"
ENABLE_IP_ADAPTER=true
ENABLE_LORA=false
```

#### Inference Parameter Defaults
```bash
DEFAULT_NUM_INFERENCE_STEPS=50
DEFAULT_IP_ADAPTER_SCALE=0.33
DEFAULT_NEGATIVE_PROMPT="error, glitch, mistake"
DEFAULT_MEMORY_STYLE_PROMPT="highest quality, monochrome, professional sketch, personal, nostalgic, clean"
DEFAULT_SUBJECT_STYLE_PROMPT="highest quality, professional sketch, monochrome"
```

#### S3 Configuration
```bash
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"
S3_BUCKET_NAME="auto-bio-illustrations"
S3_AVATAR_PREFIX="avatars/"
S3_SUBJECT_PREFIX="subjects/"
S3_GENERATED_PREFIX="generated/"
```

#### Authentication Configuration
```bash
AUTH_ENABLED=false
AUTH_TOKEN="your-secret-token-here"
```

#### Service Configuration
```bash
SERVICE_URL="http://localhost:8000"
UVICORN_HOST="0.0.0.0"
UVICORN_PORT=8000
UVICORN_LOG_LEVEL="info"
```

## 🐳 Docker Deployment

### Build Image
```bash
docker build -t illustration-gen-api .
```

### Run Container with GPU Support
```bash
docker run --gpus all -p 8000:8000 \
  -e AWS_ACCESS_KEY_ID=your-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret \
  -e S3_BUCKET_NAME=your-bucket \
  illustration-gen-api
```

### Production Deployment
```bash
# Build and push to registry
docker build -t your-registry/illustration-gen-api:latest .
docker push your-registry/illustration-gen-api:latest

# Deploy to ECS/EC2 with GPU support
# Ensure --gpus all flag is used for GPU access
```

## 🧪 Testing

### Test Scripts
The `scripts/` directory contains ready-to-use test scripts:

```bash
# Test memory illustration endpoint
./scripts/test-memory-illustration.sh http://your-api-url

# Test subject illustration endpoint  
./scripts/test-subject-illustration.sh http://your-api-url

# Test health endpoint
./scripts/test-health.sh http://your-api-url

# Test authentication
./scripts/test-auth.sh http://your-api-url your-secret-token
```

### Testing with Authentication

```bash
# Test with authentication token
./scripts/test-memory-illustration.sh http://your-api-url your-secret-token

# Test authentication behavior
./scripts/test-auth.sh http://your-api-url your-secret-token
```

### Manual Testing

#### Without Authentication (if disabled)
```bash
# Test memory illustration
curl -X POST "http://localhost:8000/v1/images/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "prompt": "A beautiful sunset over mountains",
    "num_inference_steps": 30,
    "ip_adapter_scale": 0.5
  }'
```

#### With Authentication (if enabled)
```bash
# Test memory illustration with auth
curl -X POST "http://localhost:8000/v1/images/memory" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token" \
  -d '{
    "user_id": "test_user_123",
    "prompt": "A beautiful sunset over mountains",
    "num_inference_steps": 30,
    "ip_adapter_scale": 0.5
  }'

# Test subject illustration with auth
curl -X POST "http://localhost:8000/v1/images/subject" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-token" \
  -d '{
    "user_id": "test_user_123",
    "num_inference_steps": 30,
    "ip_adapter_scale": 0.5
  }'
```

## 🔧 Runtime Parameter Control

The API supports runtime adjustment of inference parameters:

### Available Parameters
- **`num_inference_steps`**: Number of denoising steps (default: 50)
- **`ip_adapter_scale`**: IP-Adapter influence strength (default: 0.33)
- **`negative_prompt`**: What to avoid in generation (default: "error, glitch, mistake")
- **`style_prompt`**: Artistic style guidance (defaults vary by endpoint)

### Parameter Effects
- **Higher `num_inference_steps`**: Better quality, slower generation
- **Higher `ip_adapter_scale`**: Stronger subject/avatar influence
- **Custom `negative_prompt`**: More control over unwanted elements
- **Custom `style_prompt`**: Specific artistic direction

## 🏗️ Development

### Project Structure Benefits
1. **Separation of Concerns**: Each module has a specific responsibility
2. **Testability**: Components can be tested independently
3. **Scalability**: Easy to add new endpoints or services
4. **Maintainability**: Clear code organization
5. **Type Safety**: Pydantic ensures data validation

### Adding New Features
1. **New Endpoint**: Add to `app/api/endpoints/`
2. **New Service**: Add to `app/services/`
3. **New Schema**: Add to `app/schemas/`
4. **New Utility**: Add to `app/utils/`

### Key Components
- **`IllustrationService`**: Main business logic for image generation
- **`TextToImagePipeline`**: Singleton pipeline management
- **`S3Client`**: S3 operations with progress logging
- **`ImageUtils`**: Image processing and inference utilities

## 📊 Performance

### Memory Usage
- **Base Model**: ~18GB VRAM (SDXL + IP-Adapter)
- **Inference**: ~2-4GB additional VRAM per request
- **Total**: ~20-22GB VRAM recommended

### Generation Times
- **Memory Illustration**: 15-30 seconds (depending on steps)
- **Subject Illustration**: 15-30 seconds (depending on steps)
- **Model Loading**: 2-3 minutes (first startup only)

### Optimization Features
- **Singleton Pipeline**: Reuses loaded model across requests
- **S3 Direct Upload**: No local storage for generated images
- **Progress Logging**: Configurable S3 download progress
- **Error Handling**: Comprehensive error messages and fallbacks

## 🔍 Monitoring

### Health Checks
- **GET** `/health/`: Service readiness check
- **Pipeline Status**: Validates model loading and GPU availability
- **S3 Connectivity**: Tests S3 access and permissions

### Logging
- **Structured Logging**: JSON-formatted logs for easy parsing
- **Progress Tracking**: S3 download progress with configurable intervals
- **Error Tracking**: Detailed error messages with context
- **Performance Metrics**: Generation times and resource usage

## 🚨 Troubleshooting

### Common Issues

#### CUDA Out of Memory
```bash
# Check GPU memory usage
nvidia-smi

# Reduce inference steps or use smaller model
# Ensure only one pipeline instance is loaded
```

#### S3 Access Denied
```bash
# Verify AWS credentials and permissions
# Check S3 bucket policy and IAM roles
# Ensure bucket exists and is accessible
```

#### Model Download Failures
```bash
# Check S3 path and file existence
# Verify network connectivity
# Check AWS credentials and permissions
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
export UVICORN_LOG_LEVEL=debug
```

## 📚 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Hugging Face Diffusers](https://huggingface.co/docs/diffusers/)
- [IP-Adapter Documentation](https://huggingface.co/docs/diffusers/en/using-diffusers/ip_adapter)
- [Stable Diffusion XL](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.