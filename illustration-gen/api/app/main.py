import os
import tempfile
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.endpoints import images, health

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    description="A FastAPI service for generating images using diffusion models",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup static files for generated images
image_dir = os.path.join(tempfile.gettempdir(), "images")
if not os.path.exists(image_dir):
    os.makedirs(image_dir)
    logger.info("Created image directory: {}".format(image_dir))

app.mount("/images", StaticFiles(directory=image_dir), name="images")

# Include API routes
app.include_router(images.router, prefix="/v1/images", tags=["images"])
app.include_router(health.router, prefix="/health", tags=["health"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "wello horld",
        "docs": "/docs",
        "health": "/health"
    }


@app.on_event("startup")
async def startup_event():
    """Startup event handler"""
    logger.info("Starting up Image Generation API...")
    logger.info("App name: {}".format(settings.app_name))
    logger.info("Model path: {}".format(settings.model_path))
    logger.info("CUDA available: {}".format(os.getenv('CUDA_VISIBLE_DEVICES', 'Not set')))


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler"""
    logger.info("Shutting down Image Generation API...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
