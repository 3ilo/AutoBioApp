# Short Video Generation

## Overview

The short video feature generates 1–3 second looping **flipbook-style** videos instead of static illustrations. The pipeline uses a two-stage LLM flow (moment summarizer → distiller) to produce a structured spec with **fixed elements** and **per-frame actions only**, then pre-generates images for up to 5 story elements (subject with `isUser: true` = user avatar; subject with `isUser: false` and props/setting = generated), stitches them into a single reference, and generates frames from that reference. This reduces frame-to-frame shifting.

- **Moment summarizer**: One LLM call to extract the single most interesting/piquing/provoking moment from the memory.
- **Distiller**: One LLM call to turn that moment into JSON: fixed elements (setting, subject, props, mood), one action per frame (up to 6 frames), and an elements list (max 5) for reference image generation.
- **Element images**: The single subject element uses the user-uploaded avatar when `isUser: true` (the memory author); when the subject is not the user (`isUser: false`), it is generated from its description like props/setting. Other elements (props, setting) get one generated image each. All are stitched into one reference image.
- **Frame generation**: Each frame uses a prompt built from the same fixed elements + that frame’s action. All frames use the stitched elements reference (same reference for consistency; frames are generated in parallel).
- **Loop**: Normal loop (frames 0..N-1, then repeat). No ping-pong. Target: choppy flipbook feel, up to 6 frames.
- **Style**: Minimalist, flat, soft muted palette, simple and abstract (versioned in templates).

## Architecture

- **ShortVideoService** (`services/shortVideoService.ts`): Orchestrates moment → distiller → element image generation → stitch → frame loop → effects → encode → S3.
- **MomentSummarizerService** (`services/shortVideo/momentSummarizerService.ts`): Extracts the main moment from the memory; prompts from `promptBuilders/templates/short-video-moment-summarizer-*-v1.txt`.
- **ShortVideoDistillerService** (`services/shortVideo/shortVideoDistillerService.ts`): Produces structured JSON (fixedElements, frames, elements); prompts from `short-video-distiller-*-v1.txt`.
- **ShortVideoPromptBuilder** (`services/promptBuilders/shortVideoPromptBuilder.ts`): `buildFramePromptFromSpec` (per-frame from fixed elements + action), `buildElementImagePrompt` (for element images); templates `short-video-frame-from-spec-v1.txt`, `short-video-element-image-v1.txt`, `short-video-style-v1.txt`.
- **Video encoding** (`utils/videoEncoder.ts`): Frames to temp directory, ffmpeg to MP4.
- **Post-processing** (`utils/shortVideoEffects.ts`): Frame duplication, film grain, parallax, smear. Blink deferred.

## API

### POST /api/images/short-video

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | Yes | User ID (must have avatar/subject reference) |
| memoryTitle | string | Yes | Memory title for scene context |
| memoryContent | string | Yes | Raw memory content (distilled via one LLM call) |
| memoryDate | string \| Date | Yes | Memory date |
| taggedCharacterIds | string[] | No | Reserved for future use (flipbook path uses only user ref for subject) |
| fps | number | No | Frames per second (default: 2) |
| durationSeconds | number | No | Duration in seconds (default: 3) |
| framesPerBatch | number | No | Unused in flipbook pipeline (all frames in one sequence) |

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

- **fps**: Default 2 (slower flipbook). Total frames = `min(6, round(fps * durationSeconds))`.
- **durationSeconds**: Default 3. Typical 2–4 seconds.
- **Max frames**: Capped at 6 (configurable via `SHORT_VIDEO_MAX_FRAMES` in code; optional in `.env`).

## Distiller output (JSON schema)

The distiller returns a single JSON object:

- **fixedElements**: `{ setting, subjectInScene, props?: string[], mood?: string }` — same for every frame.
- **frames**: Array of length `totalFrames`; each item `{ action: string }` — only the action varies per frame.
- **elements**: Array of 1–5 items; each `{ type: "subject" | "character" | "prop" | "setting", description: string, isUser?: boolean }`. Exactly one must be `type: "subject"` (main character). Use `type: "character"` for other people in the story. For the subject, `isUser: true` means use the user’s reference image; `isUser: false` or omitted means generate from the description. At most one element may have `isUser: true`. Character, prop, and setting elements are generated as images; all are stitched into the reference for frame 0.

## Style (Prompt Builder)

The short-video prompt builder uses a dedicated style and format with a strong emphasis on **frame-to-frame consistency**:

1. **Minimalist + editorial**: Flat backgrounds, clean composition, large negative space, centered or balanced framing.
2. **Soft, muted palette**: Pastels, warm neutrals, desaturated accents; no harsh saturation; controlled contrast.
3. **Flipbook motion, not style shifts**: Only the small per-frame action should change. Camera distance, angle, crop, lighting, palette, and subject proportions should remain as close as possible across frames.
4. **Flat illustration with depth hints**: Mostly 2D, very soft gradients, subtle shadow under characters, no heavy outlines, slight rounded forms.
5. **Friendly but intelligent**: Expressive but understated faces, calm thoughtful mood, “professional optimism.” Imperfections (texture, brush, noise) should be consistent from frame to frame instead of changing each time.

## Dependencies

- **ffmpeg**: The pipeline encodes image sequences to MP4 using the **ffmpeg** binary. It must be installed on the host and available on `PATH`, or you can set **FFMPEG_PATH** (full path to the ffmpeg executable) in your environment. Example: `brew install ffmpeg` (macOS), or `FFMPEG_PATH=/usr/local/bin/ffmpeg` in `.env`.
- **Lambda**: If the app runs on AWS Lambda, the default runtime does not include ffmpeg. You must either:
  - Add a **Lambda layer** that includes the ffmpeg binary, or
  - Run the server in a **container image** that installs ffmpeg.
- Document the ffmpeg requirement in deployment/README or serverless config if you deploy to Lambda.

## Configuration

- **USE_STUB=true** or **USE_STUB_MEMORY_SUMMARY=true**: Uses stub moment summarizer and stub distiller (and stub image generator if USE_STUB).
- **OPENAI_API_KEY**: Required for real short-video generation (OpenAI image generator for element images and frames).
- **BEDROCK_SUMMARY_MODEL_ID** / **BEDROCK_CLIENT_REGION**: Used for moment summarizer and distiller (Bedrock). Same as other Bedrock summarization in the app.
- **Prompts**: All prompts are versioned under `server/src/services/promptBuilders/templates/` (e.g. `short-video-moment-summarizer-*-v1.txt`, `short-video-distiller-*-v1.txt`, `short-video-element-image-v1.txt`, `short-video-frame-from-spec-v1.txt`).

## Choosing short video vs illustration (configuration)

Set the **ILLUSTRATION_PROVIDER** environment variable on the server to choose the mode:

- **`openai`** – Static illustration (default OpenAI flow).
- **`openai-short-video`** – Short video (1–3 s loop) instead of a static image.
- **`sdxl`** – Static illustration via SDXL.
- **`stub`** – Stub (or use **USE_STUB=true**).

The frontend does not depend on which provider is configured. It always calls `POST /api/images/generate` with the same body. The server returns either `{ url: s3Uri }` (static image) or `{ url: presignedUrl, s3Uri }` (short video). The client detects type from the response (presence of `s3Uri` for video) and stores the S3 URI for the memory; the shared `MemoryImage` component detects video vs image from the stored URL (e.g. `.mp4`) and renders `<video>` or `<img>` accordingly. Messaging (e.g. “Generate Illustration”) is the same for both modalities.

## S3 Storage

Short videos are stored under the generated prefix:

- **Final MP4**: `generated/short-video/{userId}/{timestamp}-{uuid}.mp4` (Content-Type: `video/mp4`).
- **Per-run artifacts** (same `runId` as in the path below): `generated/short-video/{userId}/{runId}/frame-XXXX.png`, `element-XX.png`, and **workflow-log.json**.
- **Workflow log**: Each run writes a `workflow-log.json` next to the frame and element images for that run. It contains the full request/response for every step (moment summarizer prompts and response, distiller prompts and raw/parsed response, each element image request/response, each frame prompt/response, and final s3Uri or error). Use it for debugging without relying on server log level; download the object from S3 for the run’s `runId`.
- Pre-signed URLs can be generated via the existing S3 client for playback.

## Retry and robustness

- **Image generation** (element images and frames): Each call to the image generator is wrapped in a **retry with exponential backoff** (default up to 4 retries). Retries are triggered on throttling (429), rate limits, 5xx, and common transient network errors. This avoids a single throttled frame (e.g. frame 7) from failing the whole run or dropping that frame; the frame is retried and then stitched into the final video.
- On unrecoverable failure, the **workflow log is still uploaded** to S3 (with an `error` step), so you can inspect the failing step’s request/response.
