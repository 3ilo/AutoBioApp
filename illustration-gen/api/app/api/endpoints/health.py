from fastapi import APIRouter, Depends
from app.schemas.image import HealthResponse
from app.services.illustration_service import IllustrationService

router = APIRouter()


def get_illustration_service() -> IllustrationService:
    """Dependency to get illustration service instance"""
    return IllustrationService()


@router.get("/", response_model=HealthResponse)
async def health_check(service: IllustrationService = Depends(get_illustration_service)):
    """Health check endpoint"""
    if service.is_ready():
        return HealthResponse(
            status="healthy",
            message="Illustration generation service is ready"
        )
    else:
        return HealthResponse(
            status="unhealthy",
            message="Illustration generation service is not ready"
        )
