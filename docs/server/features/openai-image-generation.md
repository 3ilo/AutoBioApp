# OpenAI Image Generation Integration

## Overview

AutoBio supports OpenAI's `gpt-image-1.5` model as an alternative to the self-hosted SDXL pipeline for generating memory and subject illustrations. This integration provides high-quality image generation with excellent subject fidelity through structured prompts and reference images.

## Architecture

The illustration system uses a **Strategy pattern** to abstract the generation provider:

```
imageController.ts
       │
       ▼
illustrationServiceFactory.ts ─── selects provider based on config
       │
       ├── IllustrationService (SDXL) ─── self-hosted pipeline
       ├── OpenAIIllustrationService ─── OpenAI gpt-image-1.5
       └── IllustrationStubService ─── development stubs
```

### Key Components

| Component | Path | Description |
|-----------|------|-------------|
| Interface | `services/interfaces/IIllustrationService.ts` | Abstract interface for all providers |
| Factory | `services/illustrationServiceFactory.ts` | Provider selection based on config |
| OpenAI Service | `services/openai/openAIIllustrationService.ts` | OpenAI implementation |
| Prompt Builder | `services/openai/promptBuilder.ts` | Structured prompt generation |

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# Select the illustration provider: 'sdxl' | 'openai'
# Default: 'sdxl' (for backward compatibility)
ILLUSTRATION_PROVIDER=openai

# OpenAI API Configuration
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_IMAGE_MODEL=gpt-image-1.5
OPENAI_IMAGE_SIZE=1024x1024
OPENAI_IMAGE_QUALITY=high

# S3 Configuration (shared with other services)
S3_BUCKET_NAME=auto-bio-illustrations
S3_CLIENT_REGION=us-west-2
S3_AVATAR_PREFIX=avatars/
```

### Provider Selection Logic

The factory selects providers in this order:

1. **USE_STUB=true** → StubService (development/testing)
2. **ILLUSTRATION_PROVIDER=openai** → OpenAIIllustrationService
3. **Default** → IllustrationService (SDXL)

## Structured Prompt System

The OpenAI integration uses a structured prompt format to ensure consistent, high-quality results with subject fidelity.

### Prompt Fields

| Field | Source | Description |
|-------|--------|-------------|
| SUBJECT | User model | Subject identity with reference image instruction |
| IDENTITY_CONSTRAINTS | User model | Physical invariants (age, gender, cultural background) |
| STYLE_CONSTRAINTS | Global config + preferredStyle | Consistent illustration aesthetic |
| SCENE | LLM-generated | Context-aware scene description from memory |
| COMPOSITION | LLM-generated | Layout and framing guidance |

### Example Structured Prompt

```
[SUBJECT]
The subject is male aged 32 named Alex Chen. Use the provided reference image to accurately preserve Alex's identity and facial features throughout the illustration.

[IDENTITY CONSTRAINTS]
- Name: Alex Chen
- Age appearance: Adult, approximately 32 years old
- Gender presentation: male
- Cultural/ethnic appearance: Chinese-American
- Professional context: Software Engineer (may influence attire in relevant scenes)

[STYLE CONSTRAINTS]
- Style: Professional hand-drawn illustration with clean linework
- Color palette: Soft, muted tones with warm undertones
- Aesthetic: Personal, nostalgic, autobiographical memoir style
- Quality: Highest quality, detailed but not overwhelming
- Mood: Intimate, reflective, emotionally resonant

[SCENE]
A cozy home office with a large window overlooking a garden. Late afternoon sunlight streams through the window, casting warm shadows. A desk with dual monitors, a coffee mug, and scattered notes.

[COMPOSITION]
Position the subject using rule of thirds, slightly to the left. Medium shot at eye level. Shallow depth of field to emphasize the subject while maintaining context of the workspace.
```

## Reference Images

### Avatar Reference

The OpenAI service fetches the user's canonical reference image from S3:

- **Location**: `s3://{bucket}/avatars/{userId}.png`
- **Purpose**: Maintains subject identity across all memory illustrations
- **Format**: PNG, ideally in the AutoBio illustration style

### Workflow

1. User uploads their photo
2. System generates a stylized avatar (using subject illustration)
3. Avatar is stored at `avatars/{userId}.png`
4. All memory illustrations reference this avatar for subject consistency

## API Usage

### Generate Memory Illustration

```typescript
POST /api/images/generate
Content-Type: application/json

{
  "title": "Morning Coffee Ritual",
  "content": "Started my day with a perfect cup of Ethiopian coffee...",
  "date": "2024-01-15",
  "userId": "user123"
}
```

### Generate Subject Illustration

```typescript
POST /api/images/subject
Content-Type: application/json

{
  "userId": "user123"
}
```

## Error Handling

The service includes fallback mechanisms:

1. **Missing Reference Image**: Proceeds with text-only prompt
2. **OpenAI API Error**: Logs error, optionally falls back to Bedrock (if enabled)
3. **Health Check**: Verifies API key validity before processing

## Performance Considerations

| Metric | Value |
|--------|-------|
| API Timeout | 120 seconds |
| Image Size | 1024x1024 (configurable) |
| Output Format | PNG (base64 → S3 upload) |
| Health Check Timeout | 5 seconds |

## Comparison: OpenAI vs SDXL

| Feature | OpenAI (gpt-image-1.5) | SDXL (Self-hosted) |
|---------|------------------------|-------------------|
| Setup Complexity | Low (API key only) | High (GPU infrastructure) |
| Cost Model | Per-request | Fixed infrastructure |
| Subject Fidelity | Reference image + prompt | IP-Adapter + LoRA |
| Customization | Prompt-based | Fine-tuned models |
| Latency | ~15-30s | ~15-30s |
| Offline Support | No | Yes |

## Switching Providers

To switch between providers:

```bash
# Use OpenAI
ILLUSTRATION_PROVIDER=openai

# Use SDXL (self-hosted)
ILLUSTRATION_PROVIDER=sdxl

# Use stubs (development)
USE_STUB=true
```

No code changes required - the factory handles provider selection automatically.

## Troubleshooting

### Common Issues

1. **"OPENAI_API_KEY not configured"**
   - Ensure `OPENAI_API_KEY` is set in your environment

2. **"User not found"**
   - Verify the userId exists in the database

3. **"Reference image not found"**
   - User needs to upload an avatar first
   - Check S3 bucket permissions

4. **Timeout errors**
   - OpenAI may be experiencing high load
   - Consider increasing timeout or implementing retry logic

### Health Check

```bash
# Check provider status
curl http://localhost:3000/api/health/illustration
```

## Future Enhancements

- [ ] Batch image generation
- [ ] Style presets selection
- [ ] Quality/speed tradeoff options
- [ ] Caching of generated images
- [ ] A/B testing between providers

