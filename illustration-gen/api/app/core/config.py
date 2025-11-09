from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    app_name: str = "Image Generation API"
    debug: bool = False
    
    # Model configuration
    model_file: str = ""
    model_s3_path: str = "s3://auto-bio-illustrations/models/checkpoint-1.safetensors" 
    model_path: str = "stabilityai/stable-diffusion-xl-base-1.0"
    
    # IP Adapter configuration
    enable_ip_adapter: bool = False
    ip_adapter: str = ""
    ip_adapter_subfolder: str = ""
    ip_adapter_weights: str = ""
    ip_adapter_scale_subject: float = 1.0
    ip_adapter_scale_memory: float = 0.33
    ip_adapter_image: str = ""
    
    # LoRA configuration
    enable_lora: bool = False
    lora_weights: str = ""
    lora_weights_name: str = ""
    
    # Inference parameter defaults
    default_num_inference_steps: int = 50
    default_ip_adapter_scale: float = 0.33
    default_negative_prompt: str = "error, glitch, mistake"
    default_memory_style_prompt: str = "highest quality, monochrome, professional sketch, personal, nostalgic, clean"
    default_subject_style_prompt: str = "highest quality, professional sketch, monochrome"
    
    # Authentication configuration
    auth_token: str = ""  
    auth_enabled: bool = True
    
    # Service configuration
    service_url: str = "http://localhost:8000"
    
    # Uvicorn configuration
    uvicorn_host: str = "0.0.0.0"
    uvicorn_port: int = 8000
    uvicorn_reload: bool = False
    uvicorn_log_level: str = "info"
    
    # S3 configuration
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket_name: str = ""
    s3_avatar_prefix: str = "avatars/"
    s3_subject_prefix: str = "subjects/"
    s3_generated_prefix: str = "generated/"
    
    model_config = {
        "env_file": ".env",
        "protected_namespaces": ("settings_",),
        "extra": "ignore"
    }


settings = Settings()