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

def subject_generation_inference(pipeline, num_inference_steps: int = None, reference_image_url: str = None, 
                                ip_adapter_scale: float = None, negative_prompt: str = None, 
                                style_prompt: str = None, adapter_name: str = None):
    # Use config defaults if not provided
    if num_inference_steps is None:
        num_inference_steps = settings.default_num_inference_steps
    if ip_adapter_scale is None:
        ip_adapter_scale = settings.default_ip_adapter_scale
    if negative_prompt is None:
        negative_prompt = settings.default_negative_prompt
    if style_prompt is None:
        style_prompt = settings.default_subject_style_prompt
    
    # If using LoRA, include instance token in prompt
    from app.core.training_config import training_config
    if adapter_name:
        # Add instance token to prompt for LoRA
        instance_token = training_config.instance_token
        prompt_with_token = f"{instance_token} {style_prompt}"
    else:
        prompt_with_token = style_prompt
    
    return inference(pipeline, prompt_with_token, num_inference_steps, reference_image_url, 
                    ip_adapter_scale, negative_prompt, None, adapter_name)

def memory_generation_inference(pipeline, prompt: str, num_inference_steps: int = None, 
                               reference_image_url: str = None, ip_adapter_scale: float = None, 
                               negative_prompt: str = None, style_prompt: str = None,
                               adapter_name: str = None):
    # Use config defaults if not provided
    if num_inference_steps is None:
        num_inference_steps = settings.default_num_inference_steps
    if ip_adapter_scale is None:
        ip_adapter_scale = settings.default_ip_adapter_scale
    if negative_prompt is None:
        negative_prompt = settings.default_negative_prompt
    if style_prompt is None:
        style_prompt = settings.default_memory_style_prompt
    
    # If using LoRA, include instance token in prompt
    from app.core.training_config import training_config
    if adapter_name:
        # Add instance token to prompt for LoRA
        instance_token = training_config.instance_token
        augmented_prompt = f"{instance_token} {prompt}"
    else:
        augmented_prompt = prompt
    
    return inference(pipeline, augmented_prompt, num_inference_steps, reference_image_url, 
                    ip_adapter_scale, negative_prompt, style_prompt, adapter_name)

def inference(pipeline, prompt: str, num_inference_steps: int = None, reference_image_url: str = None, 
              ip_adapter_scale: float = None, negative_prompt: str = None, style_prompt: str = "",
              adapter_name: str = None):
    """Run inference on the pipeline"""
    print("prompt", prompt)
    print("num_inference_steps", num_inference_steps)
    print("reference_image_url", reference_image_url)
    print("ip_adapter_scale", ip_adapter_scale)
    print("negative_prompt", negative_prompt)
    print("style_prompt", style_prompt)
    
    # Use config defaults if not provided
    if num_inference_steps is None:
        num_inference_steps = settings.default_num_inference_steps
    if ip_adapter_scale is None:
        ip_adapter_scale = settings.default_ip_adapter_scale
    if negative_prompt is None:
        negative_prompt = settings.default_negative_prompt

    # Prepare pipeline call kwargs
    pipeline_kwargs = {
        "prompt": prompt,
        "negative_prompt": negative_prompt,
        "num_inference_steps": num_inference_steps
    }
    
    # Add LoRA adapter if specified
    if adapter_name:
        pipeline_kwargs["cross_attention_kwargs"] = {"scale": 1.0}
        # Note: adapter_name is handled by diffusers when LoRA is loaded
    
    if settings.enable_ip_adapter and reference_image_url:
        # Use the provided reference image
        ip_adapter_image = load_image(reference_image_url)
        
        # Set IP adapter scale if different from default
        if ip_adapter_scale != settings.default_ip_adapter_scale:
            pipeline.set_ip_adapter_scale(ip_adapter_scale)
        
        pipeline_kwargs["prompt_2"] = style_prompt
        pipeline_kwargs["ip_adapter_image"] = ip_adapter_image
        
        return pipeline(**pipeline_kwargs).images[0]
    else:
        return pipeline(**pipeline_kwargs).images[0]


def save_image(image) -> str:
    """Save image to disk and return local file path"""
    image_dir = os.path.join(tempfile.gettempdir(), "images")
    if not os.path.exists(image_dir):
        os.makedirs(image_dir)
    
    filename = "draw" + str(uuid.uuid4()).split("-")[0] + ".png"
    image_path = os.path.join(image_dir, filename)
    
    logger.info("Saving image to {}".format(image_path))
    image.save(image_path)
    
    return image_path  # Return local file path, not URL