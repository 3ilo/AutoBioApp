import os
import logging
from typing import List, Optional
from PIL import Image
from app.core.training_config import training_config

logger = logging.getLogger(__name__)


def validate_images(image_paths: List[str]) -> List[str]:
    """Validate that image files exist and are valid images"""
    valid_images = []
    
    for image_path in image_paths:
        try:
            with Image.open(image_path) as img:
                img.verify()  # Verify it's a valid image
            valid_images.append(image_path)
            logger.debug("Validated image: {}".format(image_path))
        except Exception as e:
            logger.warning("Invalid image file {}: {}".format(image_path, str(e)))
    
    if not valid_images:
        raise ValueError("No valid images found in provided paths")
    
    logger.info("Validated {} out of {} images".format(len(valid_images), len(image_paths)))
    return valid_images


def prepare_training_dataset(image_paths: List[str], output_dir: str) -> str:
    """
    Prepare training dataset directory structure.
    Returns the path to the dataset directory.
    """
    # Create dataset directory
    dataset_dir = os.path.join(output_dir, "dataset")
    os.makedirs(dataset_dir, exist_ok=True)
    
    # Copy images to dataset directory
    for i, image_path in enumerate(image_paths):
        # Get file extension
        _, ext = os.path.splitext(image_path)
        # Create new filename
        new_filename = "{:04d}{}".format(i, ext)
        new_path = os.path.join(dataset_dir, new_filename)
        
        # Copy image
        with Image.open(image_path) as img:
            img.save(new_path)
        
        logger.debug("Copied image: {} -> {}".format(image_path, new_path))
    
    logger.info("Prepared dataset with {} images in {}".format(len(image_paths), dataset_dir))
    return dataset_dir


def get_instance_prompt() -> str:
    """Get the instance prompt with token substituted"""
    return training_config.get_instance_prompt()


def create_training_output_dir(lora_id: str) -> str:
    """Create output directory for LoRA training"""
    output_dir = os.path.join(training_config.output_dir, lora_id)
    os.makedirs(output_dir, exist_ok=True)
    logger.info("Created training output directory: {}".format(output_dir))
    return output_dir


def cleanup_temp_files(*paths: str):
    """Clean up temporary files and directories"""
    import shutil
    
    for path in paths:
        try:
            if os.path.isfile(path):
                os.unlink(path)
                logger.debug("Removed file: {}".format(path))
            elif os.path.isdir(path):
                shutil.rmtree(path)
                logger.debug("Removed directory: {}".format(path))
        except Exception as e:
            logger.warning("Failed to remove {}: {}".format(path, str(e)))



