from pydantic import BaseModel
from typing import Optional, List


class GenerateIllustrationInput(BaseModel):
    prompt: str
    num_inference_steps: Optional[int] = 50
    style: Optional[str] = None
    reference_image_url: Optional[str] = None  # For IP-Adapter


class GenerateMemoryIllustrationInput(BaseModel):
    user_id: str
    prompt: str
    num_inference_steps: Optional[int] = 50


class GenerateSubjectIllustrationInput(BaseModel):
    user_id: str
    num_inference_steps: Optional[int] = 50


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
