import uuid
import os
import logging
import subprocess
import shutil
from typing import Optional, Dict, Any
from app.utils.s3_utils import s3_client
from app.utils.training_utils import (
    validate_images,
    prepare_training_dataset,
    get_instance_prompt,
    create_training_output_dir,
    cleanup_temp_files
)
from app.core.training_config import training_config
from app.core.config import settings

logger = logging.getLogger(__name__)


class SubjectCustomizationService:
    """Service for training LoRA models using Dreambooth"""
    
    def __init__(self):
        self.training_config = training_config
    
    async def train_lora(
        self,
        user_id: str,
        training_images_s3_path: str,
        lora_name: Optional[str] = None,
        learning_rate: Optional[float] = None,
        num_train_epochs: Optional[int] = None,
        lora_rank: Optional[int] = None,
        lora_alpha: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Train a LoRA model using Dreambooth with provided training images.
        
        Args:
            user_id: Owner of the LoRA
            training_images_s3_path: S3 path/prefix containing training images
            lora_name: Optional human-readable name
            learning_rate: Optional learning rate override
            num_train_epochs: Optional epochs override
            lora_rank: Optional LoRA rank override
            lora_alpha: Optional LoRA alpha override
            **kwargs: Additional training parameters
        
        Returns:
            Dict with lora_id, lora_s3_uri, user_id, status
        """
        lora_id = str(uuid.uuid4())
        temp_dirs = []
        temp_files = []
        
        try:
            logger.info("Starting LoRA training for user: {}, lora_id: {}".format(user_id, lora_id))
            
            # Download training images from S3
            logger.info("Downloading training images from: {}".format(training_images_s3_path))
            image_paths = s3_client.download_images_from_s3_path(training_images_s3_path)
            
            if not image_paths:
                raise ValueError("No training images found in S3 path: {}".format(training_images_s3_path))
            
            temp_dirs.append(os.path.dirname(image_paths[0]) if image_paths else None)
            
            # Validate images
            valid_images = validate_images(image_paths)
            
            if len(valid_images) < 1:
                raise ValueError("Need at least 1 valid training image, found {}".format(len(valid_images)))
            
            # Create output directory
            output_dir = create_training_output_dir(lora_id)
            temp_dirs.append(output_dir)
            
            # Prepare dataset
            dataset_dir = prepare_training_dataset(valid_images, output_dir)
            
            # Get training parameters
            lr = learning_rate or self.training_config.learning_rate
            epochs = num_train_epochs or self.training_config.num_train_epochs
            rank = lora_rank or self.training_config.lora_rank
            alpha = lora_alpha or self.training_config.lora_alpha
            instance_prompt = get_instance_prompt()
            
            # Run training
            logger.info("Starting LoRA training with {} images".format(len(valid_images)))
            lora_path = await self._run_training(
                dataset_dir=dataset_dir,
                output_dir=output_dir,
                instance_prompt=instance_prompt,
                learning_rate=lr,
                num_train_epochs=epochs,
                lora_rank=rank,
                lora_alpha=alpha,
                **kwargs
            )
            
            if not lora_path or not os.path.exists(lora_path):
                raise Exception("Training failed: LoRA file not generated")
            
            # Upload LoRA to S3
            logger.info("Uploading LoRA to S3")
            lora_s3_uri = s3_client.upload_lora(lora_path, lora_id)
            
            if not lora_s3_uri:
                raise Exception("Failed to upload LoRA to S3")
            
            logger.info("Successfully trained and uploaded LoRA: {}".format(lora_id))
            
            return {
                "lora_id": lora_id,
                "lora_s3_uri": lora_s3_uri,
                "user_id": user_id,
                "status": "completed"
            }
            
        except Exception as e:
            logger.error("LoRA training failed: {}".format(str(e)))
            raise Exception("LoRA training failed: {}".format(str(e)))
        
        finally:
            # Cleanup temp files and directories
            for temp_dir in temp_dirs:
                if temp_dir and os.path.exists(temp_dir):
                    cleanup_temp_files(temp_dir)
            for temp_file in temp_files:
                if temp_file and os.path.exists(temp_file):
                    cleanup_temp_files(temp_file)
    
    async def _run_training(
        self,
        dataset_dir: str,
        output_dir: str,
        instance_prompt: str,
        learning_rate: float,
        num_train_epochs: int,
        lora_rank: int,
        lora_alpha: int,
        **kwargs
    ) -> Optional[str]:
        """
        Run the actual LoRA training using diffusers.
        This uses subprocess to call the diffusers training script.
        """
        try:
            # Use diffusers' train_dreambooth_lora_sdxl.py script
            # For now, we'll use a simplified approach that can be enhanced
            # In production, you might want to use the diffusers API directly
            
            # Get base model path
            base_model = settings.model_path
            if settings.model_s3_path:
                # If using S3 model, we need to download it first
                model_path = s3_client.download_model_from_s3(settings.model_s3_path)
                if model_path:
                    base_model = os.path.dirname(model_path)  # Use directory containing the model
            
            # Build training command
            # Note: This is a placeholder - actual implementation would use diffusers API
            # or call the training script properly
            training_script_path = self._get_training_script_path()
            
            if not training_script_path:
                # Fallback: Use diffusers API directly (simplified)
                logger.warning("Training script not found, using simplified training approach")
                return await self._train_with_diffusers_api(
                    dataset_dir=dataset_dir,
                    output_dir=output_dir,
                    instance_prompt=instance_prompt,
                    learning_rate=learning_rate,
                    num_train_epochs=num_train_epochs,
                    lora_rank=lora_rank,
                    lora_alpha=lora_alpha,
                    base_model=base_model
                )
            
            # Use accelerate to run training
            cmd = [
                "accelerate", "launch", training_script_path,
                "--pretrained_model_name_or_path", base_model,
                "--instance_data_dir", dataset_dir,
                "--instance_prompt", instance_prompt,
                "--output_dir", output_dir,
                "--resolution", str(self.training_config.resolution),
                "--train_batch_size", str(self.training_config.train_batch_size),
                "--gradient_accumulation_steps", str(self.training_config.gradient_accumulation_steps),
                "--learning_rate", str(learning_rate),
                "--lr_scheduler", self.training_config.lr_scheduler,
                "--lr_warmup_steps", str(self.training_config.lr_warmup_steps),
                "--num_train_epochs", str(num_train_epochs),
                "--lora_rank", str(lora_rank),
                "--lora_alpha", str(lora_alpha),
                "--mixed_precision", self.training_config.mixed_precision,
                "--seed", str(self.training_config.seed),
            ]
            
            if self.training_config.random_flip:
                cmd.append("--random_flip")
            
            if self.training_config.gradient_checkpointing:
                cmd.append("--gradient_checkpointing")
            
            logger.info("Running training command: {}".format(" ".join(cmd)))
            
            # Run training
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=output_dir
            )
            
            if result.returncode != 0:
                logger.error("Training failed with return code: {}".format(result.returncode))
                logger.error("STDOUT: {}".format(result.stdout))
                logger.error("STDERR: {}".format(result.stderr))
                raise Exception("Training process failed: {}".format(result.stderr))
            
            # Find the generated LoRA file
            # Diffusers typically saves to output_dir/pytorch_lora_weights.safetensors
            lora_file = os.path.join(output_dir, "pytorch_lora_weights.safetensors")
            
            if not os.path.exists(lora_file):
                # Try alternative locations
                for filename in os.listdir(output_dir):
                    if filename.endswith(".safetensors"):
                        lora_file = os.path.join(output_dir, filename)
                        break
            
            if os.path.exists(lora_file):
                return lora_file
            else:
                raise Exception("LoRA file not found in output directory: {}".format(output_dir))
                
        except Exception as e:
            logger.error("Training execution failed: {}".format(str(e)))
            raise
    
    def _get_training_script_path(self) -> Optional[str]:
        """Get path to diffusers training script"""
        # Try to find the script in common locations
        possible_paths = [
            "/opt/diffusers/examples/dreambooth/train_dreambooth_lora_sdxl.py",
            os.path.expanduser("~/diffusers/examples/dreambooth/train_dreambooth_lora_sdxl.py"),
            "./diffusers/examples/dreambooth/train_dreambooth_lora_sdxl.py",
        ]
        
        for path in possible_paths:
            if os.path.exists(path):
                return path
        
        return None
    
    async def _train_with_diffusers_api(
        self,
        dataset_dir: str,
        output_dir: str,
        instance_prompt: str,
        learning_rate: float,
        num_train_epochs: int,
        lora_rank: int,
        lora_alpha: int,
        base_model: str
    ) -> Optional[str]:
        """
        Simplified training using diffusers API directly.
        This is a placeholder - full implementation would require
        setting up the training loop with diffusers.
        """
        # This would require implementing the full training loop
        # For now, raise an error indicating this needs to be implemented
        raise NotImplementedError(
            "Direct diffusers API training not yet implemented. "
            "Please install diffusers training scripts or implement the training loop."
        )



