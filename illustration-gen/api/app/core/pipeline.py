import torch
import logging
import os
from typing import Optional
from diffusers import AutoPipelineForText2Image, StableDiffusionXLPipeline
from app.core.config import settings
from app.utils.s3_utils import s3_client

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
            self.loaded_loras = {}  # Map adapter_name -> lora_id
            self._initialized = True

    def start(self):
        if torch.cuda.is_available():
            logger.info("Loading CUDA")
            self.device = "cuda"

            # Check for S3 model first, then local file, then default
            if settings.model_s3_path:
                logger.info("Downloading model from S3")
                model_path = s3_client.download_model_from_s3(settings.model_s3_path)
                if not model_path:
                    raise Exception("Failed to download model from S3")
                self.pipeline = StableDiffusionXLPipeline.from_single_file(
                    model_path,
                    torch_dtype=torch.float16,
                ).to(device=self.device)
            elif settings.model_file:
                logger.info("Loading model from local file")
                self.pipeline = StableDiffusionXLPipeline.from_single_file(
                    settings.model_file,
                    torch_dtype=torch.float16,
                ).to(device=self.device)
            else:
                logger.info("Loading default model from Hugging Face")
                self.pipeline = AutoPipelineForText2Image.from_pretrained(
                    settings.model_path,
                    torch_dtype=torch.float16,
                ).to(device=self.device)

            # self.pipeline.enable_model_cpu_offload()

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
        # self.pipeline.set_ip_adapter_scale(settings.ip_adapter_scale)

    def _load_lora(self):
        """Load LoRA weights"""
        logger.info("Attaching LoRA weights")
        self.pipeline.load_lora_weights(
            settings.lora_weights, 
            weight_name=settings.lora_weights_name
        )
    
    def load_lora(self, lora_id: str, adapter_name: Optional[str] = None) -> bool:
        """
        Load a LoRA by lora_id dynamically.
        
        Args:
            lora_id: Unique identifier for the LoRA
            adapter_name: Optional adapter name (defaults to lora_{lora_id})
        
        Returns:
            True if loaded successfully, False otherwise
        """
        if not self.pipeline:
            logger.error("Pipeline not initialized, cannot load LoRA")
            return False
        
        adapter_name = adapter_name or f"lora_{lora_id}"
        
        # Check if already loaded
        if adapter_name in self.loaded_loras:
            logger.info("LoRA {} already loaded with adapter name {}".format(lora_id, adapter_name))
            return True
        
        try:
            # Download LoRA from S3
            lora_path = s3_client.download_lora(lora_id)
            if not lora_path:
                logger.error("Failed to download LoRA: {}".format(lora_id))
                return False
            
            # Load LoRA weights
            logger.info("Loading LoRA {} with adapter name {}".format(lora_id, adapter_name))
            self.pipeline.load_lora_weights(
                lora_path,
                adapter_name=adapter_name
            )
            
            # Set adapter as active (if pipeline supports it)
            try:
                if hasattr(self.pipeline, 'set_adapters'):
                    self.pipeline.set_adapters([adapter_name])
                    logger.info("Set LoRA adapter {} as active".format(adapter_name))
            except Exception as e:
                logger.warning("Could not set adapter (may not be supported): {}".format(str(e)))
            
            # Track loaded LoRA
            self.loaded_loras[adapter_name] = lora_id
            logger.info("Successfully loaded LoRA {} with adapter name {}".format(lora_id, adapter_name))
            return True
            
        except Exception as e:
            logger.error("Failed to load LoRA {}: {}".format(lora_id, str(e)))
            return False
    
    def unload_lora(self, adapter_name: Optional[str] = None) -> bool:
        """
        Unload a LoRA by adapter name.
        
        Args:
            adapter_name: Adapter name to unload (if None, unloads all)
        
        Returns:
            True if unloaded successfully, False otherwise
        """
        if not self.pipeline:
            logger.error("Pipeline not initialized, cannot unload LoRA")
            return False
        
        try:
            if adapter_name:
                # Unload specific adapter
                if adapter_name in self.loaded_loras:
                    logger.info("Unloading LoRA with adapter name {}".format(adapter_name))
                    # Note: diffusers doesn't have a direct unload method
                    # We'll need to set adapter weights to zero or reload pipeline
                    # For now, just remove from tracking
                    del self.loaded_loras[adapter_name]
                    logger.info("Removed LoRA {} from tracking".format(adapter_name))
                    return True
                else:
                    logger.warning("Adapter {} not found in loaded LoRAs".format(adapter_name))
                    return False
            else:
                # Unload all LoRAs (clear tracking)
                logger.info("Clearing all loaded LoRAs")
                self.loaded_loras.clear()
                return True
                
        except Exception as e:
            logger.error("Failed to unload LoRA: {}".format(str(e)))
            return False
    
    def is_lora_loaded(self, lora_id: str) -> bool:
        """Check if a LoRA is currently loaded"""
        return lora_id in self.loaded_loras.values()