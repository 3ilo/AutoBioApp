from pydantic_settings import BaseSettings


class TrainingConfig(BaseSettings):
    """Configuration for LoRA training service"""
    
    # Instance token (guaranteed unused)
    instance_token: str = "SKS"
    
    # Instance prompt template
    instance_prompt_template: str = "a photo of {token} person"
    
    # Training hyperparameters
    learning_rate: float = 1e-4
    num_train_epochs: int = 100
    train_batch_size: int = 1
    gradient_accumulation_steps: int = 1
    
    # LoRA-specific settings
    lora_rank: int = 16
    lora_alpha: int = 32
    lora_dropout: float = 0.0
    
    # Training configuration
    resolution: int = 1024
    random_flip: bool = True
    mixed_precision: str = "bf16"
    gradient_checkpointing: bool = True
    
    # Training output
    output_dir: str = "/tmp/lora_training"
    
    # Checkpointing
    checkpointing_steps: int = 500
    save_steps: int = 500
    
    # Validation
    validation_prompt: str = "a photo of SKS person"
    num_validation_images: int = 4
    
    # Other settings
    seed: int = 42
    lr_scheduler: str = "constant"
    lr_warmup_steps: int = 0
    
    model_config = {
        "env_file": ".env",
        "protected_namespaces": ("training_",),
        "extra": "ignore"
    }
    
    def get_instance_prompt(self) -> str:
        """Get the instance prompt with token substituted"""
        return self.instance_prompt_template.format(token=self.instance_token)


training_config = TrainingConfig()



