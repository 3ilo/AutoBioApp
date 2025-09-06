import torch
import logging
import os
from diffusers import StableDiffusionXLPipeline
from app.core.config import settings

logger = logging.getLogger(__name__)


class TextToImagePipeline:
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(TextToImagePipeline, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.pipeline = None
            self.device = None
            self._initialized = True

    def start(self):
        if torch.cuda.is_available():
            logger.info("Loading CUDA")
            self.device = "cuda"

            # Load pipeline
            if settings.model_file:
                logger.info("Loading model from single file")
                self.pipeline = StableDiffusionXLPipeline.from_single_file(
                    settings.model_file,
                    torch_dtype=torch.bfloat16,
                ).to(device=self.device)
            else:
                logger.info("Loading model from model path")
                self.pipeline = StableDiffusionXLPipeline.from_pretrained(
                    settings.model_path,
                    torch_dtype=torch.bfloat16,
                ).to(device=self.device)

            # Load IP Adapter if enabled
            if settings.enable_ip_adapter:
                self._load_ip_adapter()

            # Load LoRA weights if enabled
            if settings.enable_lora:
                self._load_lora()

        elif torch.backends.mps.is_available():
            logger.info("MPS device available, but not implemented")
            raise Exception("MPS device not supported yet")
        else:
            raise Exception("No CUDA or MPS device available")

    def _load_ip_adapter(self):
        """Load IP Adapter weights"""
        logger.info("Attaching IP-Adapter")
        self.pipeline.load_ip_adapter(
            settings.ip_adapter,
            subfolder=settings.ip_adapter_subfolder,
            weight_name=settings.ip_adapter_weights
        )
        self.pipeline.set_ip_adapter_scale(settings.ip_adapter_scale)

    def _load_lora(self):
        """Load LoRA weights"""
        logger.info("Attaching LoRA weights")
        self.pipeline.load_lora_weights(
            settings.lora_weights, 
            weight_name=settings.lora_weights_name
        )
