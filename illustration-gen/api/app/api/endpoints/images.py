from fastapi import APIRouter, HTTPException, Depends
from app.schemas.image import (
    GenerateIllustrationInput, 
    GenerateMemoryIllustrationInput,
    GenerateSubjectIllustrationInput,
    ImageResponse,
    S3ImageResponse,
    TrainLoRAInput,
    TrainLoRAResponse,
    TrainingStatusResponse
)
from app.services.illustration_service import IllustrationService
from app.services.subject_customization_service import SubjectCustomizationService
from app.middleware.auth import get_auth_dependency

router = APIRouter()


def get_illustration_service() -> IllustrationService:
    """Dependency to get illustration service instance"""
    return IllustrationService()


def get_subject_customization_service() -> SubjectCustomizationService:
    """Dependency to get subject customization service instance"""
    return SubjectCustomizationService()


@router.post("/memory", response_model=S3ImageResponse)
async def generate_memory_illustration(
    memory_input: GenerateMemoryIllustrationInput,
    service: IllustrationService = Depends(get_illustration_service),
    _: bool = Depends(get_auth_dependency)
):
    """Generate a memory illustration using user's avatar as IP-Adapter input"""
    try:
        return await service.generate_memory_illustration(
            memory_input.user_id,
            memory_input.prompt,
            memory_input.num_inference_steps,
            memory_input.ip_adapter_scale,
            memory_input.negative_prompt,
            memory_input.style_prompt,
            memory_input.lora_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/subject", response_model=S3ImageResponse)
async def generate_subject_illustration(
    subject_input: GenerateSubjectIllustrationInput,
    service: IllustrationService = Depends(get_illustration_service),
    _ = Depends(get_auth_dependency)
):
    """Generate a subject illustration using user's uploaded photo and special prompt"""
    try:
        return await service.generate_subject_illustration(
            subject_input.user_id,
            subject_input.num_inference_steps,
            subject_input.ip_adapter_scale,
            subject_input.negative_prompt,
            subject_input.style_prompt,
            subject_input.lora_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train-lora", response_model=TrainLoRAResponse)
async def train_lora(
    train_input: TrainLoRAInput,
    service: SubjectCustomizationService = Depends(get_subject_customization_service),
    _: bool = Depends(get_auth_dependency)
):
    """Start a LoRA training job asynchronously. Returns immediately with job_id."""
    try:
        job_id = service.start_training_job(
            user_id=train_input.user_id,
            training_images_s3_path=train_input.training_images_s3_path,
            lora_name=train_input.lora_name,
            learning_rate=train_input.learning_rate,
            num_train_epochs=train_input.num_train_epochs,
            lora_rank=train_input.lora_rank,
            lora_alpha=train_input.lora_alpha
        )
        
        # Get initial status
        status = service.get_training_status(job_id)
        if not status:
            raise HTTPException(status_code=500, detail="Failed to create training job")
        
        return TrainLoRAResponse(
            job_id=job_id,
            status=status["status"],
            lora_id=status.get("lora_id")
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/train-lora/{job_id}", response_model=TrainingStatusResponse)
async def get_training_status(
    job_id: str,
    service: SubjectCustomizationService = Depends(get_subject_customization_service),
    _: bool = Depends(get_auth_dependency)
):
    """Get the status of a LoRA training job"""
    try:
        status = service.get_training_status(job_id)
        if not status:
            raise HTTPException(status_code=404, detail="Training job not found")
        
        return TrainingStatusResponse(
            job_id=job_id,
            status=status["status"],
            lora_id=status.get("lora_id"),
            lora_s3_uri=status.get("lora_s3_uri"),
            error_message=status.get("error_message")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))