import os
import uuid
import tempfile
import logging
from diffusers.utils import load_image
from app.core.config import settings

logger = logging.getLogger(__name__)

prompt_style_experiments = [
    "high contrast, minimalistic, colored black and grungy white, stark, graphic novel illustration, cross hatching",
    "monochrome, bright highlights, deep shadows, graphic novel illustration",
    "monochrome, journal entry sketch, graphic novel illustration",
    "highest quality, monochrome, professional sketch, personal, intimate, nostalgic",
    "highest quality, monochrome, professional sketch, personal, nostalgic, clean",
    "highest quality, monochrome, professional sketch, personal, nostalgic, clean",
    "highest quality, monochrome, professional sketch, clean, simple",
    "highest quality, monochrome, professional sketch, clean, simple"
]

subject_generation_prompt_experiments = [
    "highest quality, professional sketch, monochrome"
]

negative_prompt_experiments = [
    "worst quality, low quality, error, glitch, mistake, busy, words, writing, photo, photo-realistic",
    "error, glitch, mistake",
]

def prompt_builder(content_prompt: str, style_prompt: str, age: int = -1) -> str:
    """Build a complete prompt from content and style"""
    if age > -1:
        return f"{content_prompt}, age {age}, {style_prompt}"
    return f"{content_prompt}, {style_prompt}"

def subject_generation_inference(pipeline, num_inference_steps: int = 50, reference_image_url: str = None):
    prompt = subject_generation_prompt_experiments[0]
    inference(pipeline, prompt, num_inference_steps, reference_image_url)

def memory_generation_inference(pipeline, prompt: str, num_inference_steps: int = 50, reference_image_url: str = None):
    augmented_prompt = prompt_builder(prompt, prompt_style_experiments[5])
    inference(pipeline, augmented_prompt, num_inference_steps, reference_image_url)

def inference(pipeline, prompt: str, num_inference_steps: int = 50, reference_image_url: str = None):
    """Run inference on the pipeline"""

    if settings.enable_ip_adapter and reference_image_url:
        # Use the provided reference image
        ip_adapter_image = load_image(reference_image_url)
        return pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt_experiments[1],
            ip_adapter_image=ip_adapter_image,
            num_inference_steps=num_inference_steps
        ).images[0]
    elif settings.enable_ip_adapter and settings.ip_adapter_image:
        # Use the default IP adapter image from settings
        ip_adapter_image = load_image(settings.ip_adapter_image)
        return pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt_experiments[1],
            ip_adapter_image=ip_adapter_image,
            num_inference_steps=num_inference_steps
        ).images[0]
    else:
        return pipeline(
            prompt=prompt,
            negative_prompt=negative_prompt_experiments[1],
            num_inference_steps=num_inference_steps
        ).images[0]


def save_image(image) -> str:
    """Save image to disk and return URL"""
    image_dir = os.path.join(tempfile.gettempdir(), "images")
    if not os.path.exists(image_dir):
        os.makedirs(image_dir)
    
    filename = "draw" + str(uuid.uuid4()).split("-")[0] + ".png"
    image_path = os.path.join(image_dir, filename)
    
    logger.info("Saving image to {}".format(image_path))
    image.save(image_path)
    
    return os.path.join(settings.service_url, "images", filename)
