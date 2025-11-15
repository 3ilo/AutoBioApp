import asyncio
import logging
import os
from diffusers import StableDiffusionXLPipeline
from app.core.pipeline import TextToImagePipeline
from app.utils.image_utils import subject_generation_inference, memory_generation_inference, inference, save_image
from app.utils.s3_utils import s3_client
from app.core.config import settings

logger = logging.getLogger(__name__)


class IllustrationService:
    def __init__(self):
        self.pipeline = TextToImagePipeline()
        if not self.pipeline.pipeline:  # Only start if not already initialized
            self.pipeline.start()
    
    async def generate_illustration(self, prompt: str, num_inference_steps: int = None, 
                                  reference_image_url: str = None, ip_adapter_scale: float = None, 
                                  negative_prompt: str = None):
        """Generate an illustration from a text prompt and optional reference image"""
        try:
            loop = asyncio.get_event_loop()
            
            # Run inference in executor to avoid blocking (reuse existing pipeline)
            output = await loop.run_in_executor(
                None, 
                lambda: subject_generation_inference(
                    self.pipeline.pipeline, num_inference_steps, reference_image_url, 
                    ip_adapter_scale, negative_prompt
                )
            )
            
            logger.info("Generated illustration for prompt: {}".format(prompt))
            image_url = save_image(output)
            
            return {"data": [{"url": image_url}]}
            
        except Exception as e:
            logger.error("Illustration generation failed: {}".format(str(e)))
            raise Exception("Illustration generation failed: {}".format(str(e)))
    
    async def generate_memory_illustration(self, user_id: str, prompt: str, num_inference_steps: int = None, 
                                         ip_adapter_scale: float = None, negative_prompt: str = None, 
                                         style_prompt: str = None, lora_id: str = None):
        """Generate a memory illustration using user's avatar as IP-Adapter input"""
        try:
            # Load LoRA if provided
            adapter_name = None
            if lora_id:
                adapter_name = f"lora_{lora_id}"
                if not self.pipeline.is_lora_loaded(lora_id):
                    logger.info("Loading LoRA {} for memory illustration".format(lora_id))
                    if not self.pipeline.load_lora(lora_id, adapter_name):
                        logger.warning("Failed to load LoRA {}, continuing without it".format(lora_id))
                else:
                    logger.debug("LoRA {} already loaded".format(lora_id))
            # Download user's avatar from S3
            avatar_key = s3_client.get_avatar_key(user_id)
            logger.info("Downloading avatar from S3: {}".format(avatar_key))
            avatar_local_path = s3_client.download_image(avatar_key)
            
            if not avatar_local_path:
                raise Exception("Failed to download user avatar from S3. Make sure avatar exists at: {}".format(avatar_key))
            
            # Generate illustration with avatar as reference
            loop = asyncio.get_event_loop()
            
            # Run inference with avatar as IP-Adapter input (reuse existing pipeline)
            output = await loop.run_in_executor(
                None, 
                lambda: memory_generation_inference(
                    self.pipeline.pipeline, prompt, num_inference_steps, avatar_local_path, 
                    ip_adapter_scale, negative_prompt, style_prompt, adapter_name
                )
            )
            
            # Upload generated image directly to S3 from memory
            generated_key = s3_client.get_generated_key(user_id, "memory")
            s3_uri = s3_client.upload_image_from_memory(output, generated_key)
            
            # Clean up avatar file
            os.unlink(avatar_local_path)
            
            if not s3_uri:
                raise Exception("Failed to upload generated illustration to S3")
            
            logger.info("Generated memory illustration for user: {}".format(user_id))
            
            # Note: We keep LoRA loaded for potential reuse (can be unloaded if needed)
            # Uncomment below to unload after generation:
            # if lora_id:
            #     self.pipeline.unload_lora(f"lora_{lora_id}")
            
            return {"data": [{"s3_uri": s3_uri}]}
            
        except Exception as e:
            logger.error("Memory illustration generation failed: {}".format(str(e)))
            raise Exception("Memory illustration generation failed: {}".format(str(e)))
    
    async def generate_subject_illustration(self, user_id: str, num_inference_steps: int = None, 
                                          ip_adapter_scale: float = None, negative_prompt: str = None, 
                                          style_prompt: str = None, lora_id: str = None):
        """Generate a subject illustration using user's uploaded photo and special prompt"""
        try:
            # Load LoRA if provided
            adapter_name = None
            if lora_id:
                adapter_name = f"lora_{lora_id}"
                if not self.pipeline.is_lora_loaded(lora_id):
                    logger.info("Loading LoRA {} for subject illustration".format(lora_id))
                    if not self.pipeline.load_lora(lora_id, adapter_name):
                        logger.warning("Failed to load LoRA {}, continuing without it".format(lora_id))
                else:
                    logger.debug("LoRA {} already loaded".format(lora_id))
            # Download user's subject image from S3
            subject_key = s3_client.get_subject_key(user_id)
            logger.info("Downloading subject image from S3: {}".format(subject_key))
            subject_local_path = s3_client.download_image(subject_key)
            
            if not subject_local_path:
                raise Exception("Failed to download user subject image from S3. Make sure subject image exists at: {}".format(subject_key))
            
            # Verify the downloaded file is a valid image
            try:
                from PIL import Image
                with Image.open(subject_local_path) as img:
                    img.verify()  # Verify it's a valid image
            except Exception as img_error:
                raise Exception("Downloaded subject image is not a valid image file: {}".format(str(img_error)))       
            
            # Generate illustration with subject image as reference
            loop = asyncio.get_event_loop()
            
            # Run inference with subject image as IP-Adapter input (reuse existing pipeline)
            output = await loop.run_in_executor(
                None, 
                lambda: subject_generation_inference(
                    self.pipeline.pipeline, num_inference_steps, subject_local_path, 
                    ip_adapter_scale, negative_prompt, style_prompt, adapter_name
                )
            )
            
            # Upload generated image directly to S3 from memory
            generated_key = s3_client.get_generated_key(user_id, "subject")
            s3_uri = s3_client.upload_image_from_memory(output, generated_key)
            
            # Clean up subject file
            os.unlink(subject_local_path)
            
            if not s3_uri:
                raise Exception("Failed to upload generated illustration to S3")
            
            logger.info("Generated subject illustration for user: {}".format(user_id))
            
            # Note: We keep LoRA loaded for potential reuse (can be unloaded if needed)
            # Uncomment below to unload after generation:
            # if lora_id:
            #     self.pipeline.unload_lora(f"lora_{lora_id}")
            
            return {"data": [{"s3_uri": s3_uri}]}
            
        except Exception as e:
            logger.error("Subject illustration generation failed: {}".format(str(e)))
            raise Exception("Subject illustration generation failed: {}".format(str(e)))
    
    def is_ready(self) -> bool:
        """Check if the service is ready to generate illustrations"""
        return self.pipeline.pipeline is not None