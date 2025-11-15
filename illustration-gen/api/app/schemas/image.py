from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.core.config import settings


class GenerateIllustrationInput(BaseModel):
    prompt: str
    num_inference_steps: Optional[int] = settings.default_num_inference_steps
    style: Optional[str] = None
    reference_image_url: Optional[str] = None  # For IP-Adapter
    ip_adapter_scale: Optional[float] = settings.default_ip_adapter_scale
    negative_prompt: Optional[str] = settings.default_negative_prompt


class GenerateMemoryIllustrationInput(BaseModel):
    user_id: str
    prompt: str
    num_inference_steps: Optional[int] = settings.default_num_inference_steps
    ip_adapter_scale: Optional[float] = settings.default_ip_adapter_scale
    negative_prompt: Optional[str] = settings.default_negative_prompt
    style_prompt: Optional[str] = settings.default_memory_style_prompt
    lora_id: Optional[str] = None


class GenerateSubjectIllustrationInput(BaseModel):
    user_id: str
    num_inference_steps: Optional[int] = settings.default_num_inference_steps
    ip_adapter_scale: Optional[float] = settings.default_ip_adapter_scale
    negative_prompt: Optional[str] = settings.default_negative_prompt
    style_prompt: Optional[str] = settings.default_subject_style_prompt
    lora_id: Optional[str] = None


class ImageData(BaseModel):
    url: str


class S3ImageData(BaseModel):
    s3_uri: str


class ImageResponse(BaseModel):
    data: List[ImageData]


class S3ImageResponse(BaseModel):
    data: List[S3ImageData]


class HealthResponse(BaseModel):
    status: str
    message: str


class TrainLoRAInput(BaseModel):
    user_id: str
    training_images_s3_path: str
    lora_name: Optional[str] = None
    learning_rate: Optional[float] = None
    num_train_epochs: Optional[int] = None
    lora_rank: Optional[int] = None
    lora_alpha: Optional[int] = None


class TrainLoRAResponse(BaseModel):
    lora_id: str
    lora_s3_uri: str
    user_id: str
    status: str