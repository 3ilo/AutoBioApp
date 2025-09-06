# Image Generation API

A FastAPI service for generating images using diffusion models with proper project structure and best practices.

## Project Structure

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
│   │   └── image_service.py  # Image generation service
│   │
│   └── utils/                 # Utility functions
│       ├── __init__.py
│       └── image_utils.py    # Image processing utilities
│
├── run_app.py                 # Application runner
├── requirements.txt           # Python dependencies
├── env.example               # Environment variables template
├── Dockerfile                # Docker configuration
└── README.md                 # This file
```

## Features

- **Structured FastAPI Application**: Clean separation of concerns
- **Pydantic Validation**: Automatic request/response validation
- **Configuration Management**: Environment-based settings
- **Health Checks**: Service monitoring endpoint
- **GPU Support**: CUDA-enabled illustration generation
- **IP-Adapter Support**: Text + image input for enhanced generation
- **S3 Integration**: Automatic upload/download of images to/from S3
- **Memory Illustrations**: Generate illustrations using user avatars
- **Subject Illustrations**: Generate professional portraits from user photos
- **Singleton Pipeline**: Single pipeline instance for memory efficiency
- **Docker Support**: Containerized deployment
- **Static File Serving**: Generated images served via FastAPI

## Quick Start

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

## API Endpoints

### Generate Memory Illustration
- **POST** `/v1/images/memory`
- **Body**: `{"user_id": "user123", "prompt": "your memory description", "num_inference_steps": 50}`
- **Response**: `{"data": [{"s3_uri": "s3://bucket/generated/user123/memory_abc123.png"}]}`
- **Description**: Generates an illustration using the user's avatar from S3 as IP-Adapter input

### Generate Subject Illustration
- **POST** `/v1/images/subject`
- **Body**: `{"user_id": "user123", "num_inference_steps": 50}`
- **Response**: `{"data": [{"s3_uri": "s3://bucket/generated/user123/subject_def456.png"}]}`
- **Description**: Generates a professional portrait illustration using the user's uploaded photo from S3

### Generate Illustration (Legacy)
- **POST** `/v1/images/generations`
- **Body**: `{"prompt": "your text prompt", "num_inference_steps": 50, "reference_image_url": "optional_image_url"}`
- **Response**: `{"data": [{"url": "http://localhost:8000/images/generated_image.png"}]}`

### Health Check
- **GET** `/health/`
- **Response**: `{"status": "healthy", "message": "Image generation service is ready"}`

### Root
- **GET** `/`
- **Response**: Welcome message and available endpoints

## Configuration

Key environment variables:

- `MODEL_PATH`: Hugging Face model path (default: "stabilityai/stable-diffusion-xl-base-1.0")
- `MODEL_FILE`: Path to local model file (optional)
- `ENABLE_IP_ADAPTER`: Enable IP Adapter (true/false)
- `ENABLE_LORA`: Enable LoRA weights (true/false)
- `SERVICE_URL`: Base URL for generated image links
- `AWS_ACCESS_KEY_ID`: AWS access key for S3
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3
- `S3_BUCKET_NAME`: S3 bucket name for image storage
- `S3_AVATAR_PREFIX`: S3 prefix for user avatars (default: "avatars/")
- `S3_SUBJECT_PREFIX`: S3 prefix for user subject images (default: "subjects/")
- `S3_GENERATED_PREFIX`: S3 prefix for generated images (default: "generated/")

## Docker Deployment

### Build Image
```bash
docker build -t image-generation-api .
```

### Run Container
```bash
docker run --gpus all -p 8000:8000 image-generation-api
```

## Development

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

## Migration from server.py

The original `server.py` has been refactored into this structured format:

- **Main app logic** → `app/main.py`
- **Pipeline management** → `app/core/pipeline.py`
- **Image generation** → `app/services/image_service.py`
- **Utility functions** → `app/utils/image_utils.py`
- **API endpoints** → `app/api/endpoints/`
- **Configuration** → `app/core/config.py`
- **Data models** → `app/schemas/image.py`

This provides better organization, testability, and maintainability while preserving all original functionality.
