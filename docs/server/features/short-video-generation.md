# Short Video Generation

## Overview

The short video feature generates 1–3 second looping videos instead of static illustrations. Frames are generated sequentially using the existing GPT image model (OpenAI), conditioned on the prompt and the previous frame. Frames are then post-processed (duplication, film grain, parallax, smear), encoded to MP4, and stored in S3.

- **Memory context**: One LLM call for memory summarization; **no** recent-memory context.
- **Loop**: Normal loop (frames 0..N-1, then repeat). No ping-pong.
- **Style**: Minimalist editorial, flat backgrounds, soft muted palette, gentle motion, flat illustration with depth hints, friendly but intelligent. Color, playful, whimsical.
- **Character support**: User and tagged character reference images are supported (same grid stitching as memory illustration).

## Architecture

- **ShortVideoService** (`services/shortVideoService.ts`): Orchestrates distillation, reference fetch, frame generation loop, effects, encoding, and S3 upload.
- **ShortVideoPromptBuilder** (`services/promptBuilders/shortVideoPromptBuilder.ts`): Builds first-frame and continuation prompts; uses templates under `promptBuilders/templates/short-video-*-v1.txt`.
- **Video encoding** (`utils/videoEncoder.ts`): Writes frames to a temp directory and runs ffmpeg to produce MP4.
- **Post-processing** (`utils/shortVideoEffects.ts`): Frame duplication, film grain, parallax shift, smear frame. Blink effect is deferred.

## API

### POST /api/images/short-video

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Yes | User ID (must have avatar/subject reference) |
| memoryTitle | string | Yes | Memory title for scene context |
| memoryContent | string | Yes | Raw memory content (distilled via one LLM call) |
| memoryDate | string \| Date | Yes | Memory date |
| taggedCharacterIds | string[] | No | Character IDs to include (reference images stitched into grid) |
| fps | number | No | Frames per second (default: 6) |
| durationSeconds | number | No | Duration in seconds (default: 1.2) |
| framesPerBatch | number | No | Generate N frames per batch; last frame used as ref for next batch |

**Response:**

```json
{
  "status": "success",
  "data": {
    "url": "https://...",
    "s3Uri": "s3://bucket/key"
  },
  "message": "Short video generated successfully"
}
```

`url` is a pre-signed URL for playback; `s3Uri` is the stored object URI.

## Options

- **fps**: Typically 6–12. Default 6.
- **durationSeconds**: 1–2 seconds typical. Default 1.2. Total frames = `round(fps * durationSeconds)`.
- **framesPerBatch**: Optional. When set (e.g. 4), the service generates N frames in sequence and uses the last frame of each batch as the reference for the next batch. Helps with logging and future optimizations.

## Style (Prompt Builder)

The short-video prompt builder uses a dedicated style and format:

1. **Minimalist + editorial**: Flat backgrounds, clean composition, large negative space, centered or balanced framing.
2. **Soft, muted palette**: Pastels, warm neutrals, desaturated accents; no harsh saturation; controlled contrast.
3. **Gentle motion**: Slow easing, micro-bounces, subtle parallax, slight float; loop-safe.
4. **Flat illustration with depth hints**: Mostly 2D, very soft gradients, subtle shadow under characters, no heavy outlines, slight rounded forms.
5. **Friendly but intelligent**: Expressive but understated faces, calm thoughtful mood, “professional optimism.”

## Dependencies

- **ffmpeg**: The pipeline encodes image sequences to MP4 using the **ffmpeg** binary. It must be installed on the host and available on `PATH`, or you can set **FFMPEG_PATH** (full path to the ffmpeg executable) in your environment. Example: `brew install ffmpeg` (macOS), or `FFMPEG_PATH=/usr/local/bin/ffmpeg` in `.env`.
- **Lambda**: If the app runs on AWS Lambda, the default runtime does not include ffmpeg. You must either:
  - Add a **Lambda layer** that includes the ffmpeg binary, or
  - Run the server in a **container image** that installs ffmpeg.
- Document the ffmpeg requirement in deployment/README or serverless config if you deploy to Lambda.

## Configuration

Uses the same illustration provider and memory summary configuration as the rest of the app:

- **USE_STUB=true**: Uses stub image generator (repeated/random stub frames).
- **OPENAI_API_KEY**: Required for real short-video generation (OpenAI image generator).
- **Memory summary**: Same Bedrock/stub memory summary service as memory illustrations; no recent-memory context is passed.

## Choosing short video vs illustration (configuration)

Set the **ILLUSTRATION_PROVIDER** environment variable on the server to choose the mode:

- **`openai`** – Static illustration (default OpenAI flow).
- **`openai-short-video`** – Short video (1–3 s loop) instead of a static image.
- **`sdxl`** – Static illustration via SDXL.
- **`stub`** – Stub (or use **USE_STUB=true**).

The frontend does not depend on which provider is configured. It always calls `POST /api/images/generate` with the same body. The server returns either `{ url: s3Uri }` (static image) or `{ url: presignedUrl, s3Uri }` (short video). The client detects type from the response (presence of `s3Uri` for video) and stores the S3 URI for the memory; the shared `MemoryImage` component detects video vs image from the stored URL (e.g. `.mp4`) and renders `<video>` or `<img>` accordingly. Messaging (e.g. “Generate Illustration”) is the same for both modalities.

## S3 Storage

Short videos are stored under the generated prefix:

- Key pattern: `generated/short-video/{userId}/{timestamp}-{uuid}.mp4`
- Content-Type: `video/mp4`
- Pre-signed URLs can be generated via the existing S3 client for playback.
