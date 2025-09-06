'''
taken from @link https://github.com/huggingface/diffusers/blob/main/examples/server/
'''

import asyncio
import logging
import os
import random
import tempfile
import traceback
import uuid

import aiohttp
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from diffusers import StableDiffusionXLPipeline
from diffusers.utils import load_image


logger = logging.getLogger(__name__)


class GenerateIllustrationInput(BaseModel):
    prompt: str
    
class HttpClient:
    session: aiohttp.ClientSession = None

    def start(self):
        self.session = aiohttp.ClientSession()

    async def stop(self):
        await self.session.close()
        self.session = None

    def __call__(self) -> aiohttp.ClientSession:
        assert self.session is not None
        return self.session

class TextToImagePipeline:
    pipeline: any = None
    device: str = None

    def start(self):
        if torch.cuda.is_available():
            model_file = os.getenv("MODEL_FILE")
            model_path = os.getenv("MODEL_PATH", "stabilityai/stable-diffusion-xl-base-1.0")
            logger.info("Loading CUDA")
            self.device = "cuda"

            # load pipeline
            if model_file != None:
                logger.info("Loading model from single file")
                self.pipeline = StableDiffusionXLPipeline.from_single_file(
                model_file,
                torch_dtype=torch.bfloat16,
            ).to(device=self.device)
            else:
                logger.info("Loading model from model path")
                self.pipeline = StableDiffusionXLPipeline.from_pretrained(
                    model_path,
                    torch_dtype=torch.bfloat16,
                ).to(device=self.device)

            # (optional) attach adapters
            enable_ip_adapter = os.getenv("ENABLE_IP_ADAPTER", "false")
            ip_adapter = os.getenv("IP_ADAPTER")
            ip_adapter_subfolder = os.getenv("IP_ADAPTER_SUBFOLDER")
            ip_adapter_weights = os.getenv("IP_ADAPTER_WEIGHTS")
            if enable_ip_adapter == "true":
                logger.info("Attaching IP-Adapter")
                self.pipeline.load_ip_adapter(
                ip_adapter,
                subfolder=ip_adapter_subfolder,
                weight_name=ip_adapter_weights
                )
                self.pipeline.set_ip_adapter_scale(float(os.getenv("IP_ADAPTER_SCALE", 0.33)))

            # (optional) attach LoRA weights
            enable_lora = os.getenv("ENABLE_LORA", "false")
            lora_weights = os.getenv("LORA_WEIGHTS")
            lora_weights_name = os.getenv("LORA_WEIGHTS_NAME")
            if enable_lora == "true":
                logger.info("Attaching LoRA weights")
                self.pipeline.load_lora_weights(
                    lora_weights, weight_name=lora_weights_name
                )

        elif torch.backends.mps.is_available():
            logger.info("mps device, failing open")
            pass
        else:
            raise Exception("No CUDA or MPS device available")
            
def prompt_builder(content_prompt, style_prompt, age = -1):
    if age > -1:
        return f"{prompt}, age {age}, {style_prompt}"
    return f"{content_prompt}, {style_prompt}"

def inference(pipeline, prompt, num_inference_steps):
    # inference

    prompt_style_experiments = [
        "high contrast, minimalistic, colored black and grungy white, stark, graphic novel illustration, cross hatching",
        "monochrome, bright highlights, deep shadows, graphic novel illustration",
        "monochrome, journal entry sketch, graphic novel illustration",
        "highest quality, monochrome, professional sketch, personal, intimate, nostalgic",
        "highest quality, monochrome, professional sketch, personal, nostalgic, clean",
        "highest quality, monochrome, professional sketch, personal, nostalgic, clean",
        "highest quality, monochrome, professional sketch, clean, simple",
        "highest quality, monochrome, professional sketch, clean, simple", # can't decide about adding "stylized"
        "highest quality, professional sketch, monochrome", # can't decide about adding "stylized"
    ]

    negative_prompt_experiments = [
        "worst quality, low quality, error, glitch, mistake, busy, words, writing, photo, photo-realistic",
        "error, glitch, mistake",
    ]
    if os.getenv("ENABLE_IP_ADAPTER") == "true":
        ip_adapter_image = load_image(os.getenv("IP_ADAPTER_IMAGE"))
        return pipeline(
            prompt = prompt_builder(prompt, prompt_style_experiments[5]),
            negative_prompt=negative_prompt_experiments[1],
            ip_adapter_image=ip_adapter_image,
            num_inference_steps=num_inference_steps
        ).images[0]
    else:
        return pipeline(
            prompt = prompt_builder(prompt, prompt_style_experiments[5]),
            negative_prompt=negative_prompt_experiments[1],
            num_inference_steps=num_inference_steps
        ).images[0]

app = FastAPI()
service_url = os.getenv("SERVICE_URL", "http://localhost:8000")
image_dir = os.path.join(tempfile.gettempdir(), "images")
if not os.path.exists(image_dir):
    os.makedirs(image_dir)
app.mount("/images", StaticFiles(directory=image_dir), name="images")
http_client = HttpClient()
shared_pipeline = TextToImagePipeline()

# Configure CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods, e.g., GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allows all headers
)


@app.on_event("startup")
def startup():
    http_client.start()
    shared_pipeline.start()


def save_image(image):
    filename = "draw" + str(uuid.uuid4()).split("-")[0] + ".png"
    image_path = os.path.join(image_dir, filename)
    # write image to disk at image_path
    logger.info(f"Saving image to {image_path}")
    image.save(image_path)
    return os.path.join(service_url, "images", filename)


@app.get("/")
@app.post("/")
@app.options("/")
async def base():
    return "Welcome to Diffusers! Where you can use diffusion models to generate images"


@app.post("/v1/images/generations")
async def generate_image(image_input: GenerateIllustrationInput):
    try:
        loop = asyncio.get_event_loop()
        scheduler = shared_pipeline.pipeline.scheduler.from_config(shared_pipeline.pipeline.scheduler.config)
        pipeline = StableDiffusionXLPipeline.from_pipe(shared_pipeline.pipeline, scheduler=scheduler)
        output = await loop.run_in_executor(None, lambda: inference(pipeline, image_input.prompt, num_inference_steps = 50))
        logger.info(f"output: {output}")
        image_url = save_image(output.images[0])
        return {"data": [{"url": image_url}]}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        elif hasattr(e, "message"):
            raise HTTPException(status_code=500, detail=e.message + traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e) + traceback.format_exc())


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)