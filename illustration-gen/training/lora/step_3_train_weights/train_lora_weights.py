# -*- coding: utf-8 -*-
"""
Just `git clone https://github.com/huggingface/diffusers` and run 
```
> pip install -r /content/diffusers/examples/text_to_image/requirements.txt
> accelerate config
> accelerate launch /content/diffusers/examples/text_to_image/train_text_to_image_lora.py \
  --pretrained_model_name_or_path="runwayml/stable-diffusion-v1-5" \
  --dataset_name="3ilo/test-style-dataset" --caption_column="prompt" \
  --resolution=512 --random_flip \
  --train_batch_size=1 \
  --num_train_epochs=100 --checkpointing_steps=2500 \
  --learning_rate=1e-05 --lr_scheduler="constant" --lr_warmup_steps=0 \
  --seed=42 \
  --output_dir="auto-bio-test-sd15" \
  --validation_prompt="a dog" --report_to="wandb" \
  --mixed_precision="bf16"
```
NOTE: there might be some dependency conflicts. TODO: create a requirements.txt for this project.
"""