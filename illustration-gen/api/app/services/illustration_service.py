import asyncio
import logging
import os
from diffusers import StableDiffusionXLPipeline
from app.core.pipeline import TextToImagePipeline
from app.utils.image_utils import subject_generation_inference, memory_generation_inference, save_image
from app.utils.s3_utils import s3_client

logger = logging.getLogger(__name__)


class IllustrationService:
    def __init__(self):
        self.pipeline = TextToImagePipeline()
        if not self.pipeline.pipeline:  # Only start if not already initialized
            self.pipeline.start()
    
    async def generate_illustration(self, prompt: str, num_inference_steps: int = 50, reference_image_url: str = None):
        """Generate an illustration from a text prompt and optional reference image"""
        try:
            loop = asyncio.get_event_loop()
            
            # Create a new scheduler instance for thread safety
            scheduler = self.pipeline.pipeline.scheduler.from_config(
                self.pipeline.pipeline.scheduler.config
            )
            pipeline = StableDiffusionXLPipeline.from_pipe(
                self.pipeline.pipeline, scheduler=scheduler
            )
            
            # Run inference in executor to avoid blocking
            output = await loop.run_in_executor(
                None, 
                lambda: subject_generation_inference(pipeline, num_inference_steps, reference_image_url)
            )
            
            logger.info("Generated illustration for prompt: {}".format(prompt))
            image_url = save_image(output)
            
            return {"data": [{"url": image_url}]}
            
        except Exception as e:
            logger.error("Illustration generation failed: {}".format(str(e)))
            raise Exception("Illustration generation failed: {}".format(str(e)))
    
    async def generate_memory_illustration(self, user_id: str, prompt: str, num_inference_steps: int = 50):
        """Generate a memory illustration using user's avatar as IP-Adapter input"""
        try:
            # Download user's avatar from S3
            avatar_key = s3_client.get_avatar_key(user_id)
            avatar_local_path = s3_client.download_image(avatar_key)
            
            if not avatar_local_path:
                raise Exception("Failed to download user avatar from S3")
            
            # Generate illustration with avatar as reference
            loop = asyncio.get_event_loop()
            scheduler = self.pipeline.pipeline.scheduler.from_config(
                self.pipeline.pipeline.scheduler.config
            )
            pipeline = StableDiffusionXLPipeline.from_pipe(
                self.pipeline.pipeline, scheduler=scheduler
            )
            
            # Run inference with avatar as IP-Adapter input
            output = await loop.run_in_executor(
                None, 
                lambda: memory_generation_inference(pipeline, prompt, num_inference_steps, avatar_local_path)
            )
            
            # Save generated image locally first
            local_image_path = save_image(output)
            
            # Upload to S3
            generated_key = s3_client.get_generated_key(user_id, "memory")
            s3_uri = s3_client.upload_image(local_image_path, generated_key)
            
            # Clean up local files
            os.unlink(avatar_local_path)
            os.unlink(local_image_path)
            
            if not s3_uri:
                raise Exception("Failed to upload generated illustration to S3")
            
            logger.info("Generated memory illustration for user: {}".format(user_id))
            return {"data": [{"s3_uri": s3_uri}]}
            
        except Exception as e:
            logger.error("Memory illustration generation failed: {}".format(str(e)))
            raise Exception("Memory illustration generation failed: {}".format(str(e)))
    
    async def generate_subject_illustration(self, user_id: str, num_inference_steps: int = 50):
        """Generate a subject illustration using user's uploaded photo and special prompt"""
        try:
            # Download user's subject image from S3
            subject_key = s3_client.get_subject_key(user_id)
            subject_local_path = s3_client.download_image(subject_key)
            
            if not subject_local_path:
                raise Exception("Failed to download user subject image from S3")
            
            # Special prompt for subject illustration
            special_prompt = "professional portrait, high quality, detailed, artistic illustration, clean background"
            
            # Generate illustration with subject image as reference
            loop = asyncio.get_event_loop()
            scheduler = self.pipeline.pipeline.scheduler.from_config(
                self.pipeline.pipeline.scheduler.config
            )
            pipeline = StableDiffusionXLPipeline.from_pipe(
                self.pipeline.pipeline, scheduler=scheduler
            )
            
            # Run inference with subject image as IP-Adapter input
            output = await loop.run_in_executor(
                None, 
                lambda: inference(pipeline, special_prompt, num_inference_steps, subject_local_path)
            )
            
            # Save generated image locally first
            local_image_path = save_image(output)
            
            # Upload to S3
            generated_key = s3_client.get_generated_key(user_id, "subject")
            s3_uri = s3_client.upload_image(local_image_path, generated_key)
            
            # Clean up local files
            os.unlink(subject_local_path)
            os.unlink(local_image_path)
            
            if not s3_uri:
                raise Exception("Failed to upload generated illustration to S3")
            
            logger.info("Generated subject illustration for user: {}".format(user_id))
            return {"data": [{"s3_uri": s3_uri}]}
            
        except Exception as e:
            logger.error("Subject illustration generation failed: {}".format(str(e)))
            raise Exception("Subject illustration generation failed: {}".format(str(e)))
    
    def is_ready(self) -> bool:
        """Check if the service is ready to generate illustrations"""
        return self.pipeline.pipeline is not None
