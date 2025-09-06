from fastapi import APIRouter, HTTPException, Depends
from app.schemas.image import (
    GenerateIllustrationInput, 
    GenerateMemoryIllustrationInput,
    GenerateSubjectIllustrationInput,
    ImageResponse,
    S3ImageResponse
)
from app.services.illustration_service import IllustrationService

router = APIRouter()


def get_illustration_service() -> IllustrationService:
    """Dependency to get illustration service instance"""
    return IllustrationService()


@router.post("/memory", response_model=S3ImageResponse)
async def generate_memory_illustration(
    memory_input: GenerateMemoryIllustrationInput,
    service: IllustrationService = Depends(get_illustration_service)
):
    """Generate a memory illustration using user's avatar as IP-Adapter input"""
    try:
        return await service.generate_memory_illustration(
            memory_input.user_id,
            memory_input.prompt,
            memory_input.num_inference_steps
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subject", response_model=S3ImageResponse)
async def generate_subject_illustration(
    subject_input: GenerateSubjectIllustrationInput,
    service: IllustrationService = Depends(get_illustration_service)
):
    """Generate a subject illustration using user's uploaded photo and special prompt"""
    try:
        return await service.generate_subject_illustration(
            subject_input.user_id,
            subject_input.num_inference_steps
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
