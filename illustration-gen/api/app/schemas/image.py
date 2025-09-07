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


class GenerateSubjectIllustrationInput(BaseModel):
    user_id: str
    num_inference_steps: Optional[int] = settings.default_num_inference_steps
    ip_adapter_scale: Optional[float] = settings.default_ip_adapter_scale
    negative_prompt: Optional[str] = settings.default_negative_prompt
    style_prompt: Optional[str] = settings.default_subject_style_prompt


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