# Illustration Service Integration

This document describes the integration of the custom illustration generation service with the AutoBio server.

## Overview

The AutoBio server now supports two image generation methods:

1. **Custom Illustration Service** (Recommended) - Uses the EC2 G5 instance running the illustration-gen service
2. **Bedrock Service** (Deprecated) - Legacy AWS Bedrock integration for fallback

## Architecture

```
┌─────────────────┐    ┌─────────────────┐   
│   AutoBio API   │    │  Illustration   │
│   (Node.js)     │◄──►│  Service (EC2)  │
└─────────────────┘    └─────────────────┘   
                              │
                              ▼
                       ┌─────────────────┐
                       │   S3 Storage    │
                       │ (auto-bio-      │
                       │  illustrations) │
                       └─────────────────┘
```

## Environment Variables

Add these environment variables to your `.env` file:

```bash
# Illustration Service Configuration (Required)
ILLUSTRATION_SERVICE_URL=http://your-ec2-instance:8000
ILLUSTRATION_SERVICE_AUTH_TOKEN=your-secret-token
USE_ILLUSTRATION_SERVICE=true

# Optional: Bedrock Fallback Configuration
USE_BEDROCK_FALLBACK=false  # Set to 'true' to enable fallback
BEDROCK_CLIENT_REGION=us-west-2
BEDROCK_IMAGE_MODEL_ID=stability.stable-diffusion-xl-v1
AWS_STAGING_BUCKET=autobio-staging
```

## API Endpoints

### Generate Memory Illustration
- **POST** `/api/images/generate`
- **Description**: Generates an illustration for a memory using the user's avatar
- **Request Body**:
```json
{
  "title": "Memory Title",
  "content": "Memory content",
  "date": "2024-01-01T00:00:00.000Z",
  "userId": "user123"
}
```

### Regenerate Memory Illustration
- **POST** `/api/images/regenerate`
- **Description**: Generates a variation of an existing memory illustration
- **Request Body**:
```json
{
  "title": "Memory Title",
  "content": "Memory content", 
  "date": "2024-01-01T00:00:00.000Z",
  "previousUrl": "https://...",
  "userId": "user123"
}
```

### Generate Subject Illustration
- **POST** `/api/images/subject`
- **Description**: Generates a professional portrait illustration using user's uploaded photo
- **Request Body**:
```json
{
  "userId": "user123"
}
```

## Service Behavior

### Primary Service (Illustration Service)
- Uses the EC2 G5 instance for high-quality image generation
- Leverages user avatars and photos for personalized illustrations
- Saves images directly to S3 with structured paths
- Returns public S3 URLs for frontend consumption
- **Required**: Service must be enabled and available, otherwise requests fail

### Fallback Service (Bedrock) - Optional
- Only used when `USE_BEDROCK_FALLBACK=true` is explicitly set
- Generates basic illustrations without user-specific context
- Saves to staging bucket
- Deprecated but available for emergency fallback
- **Default**: Disabled - requests fail if illustration service is unavailable

## S3 Integration

The illustration service uses the `auto-bio-illustrations` S3 bucket with the following structure:

```
auto-bio-illustrations/
├── avatars/           # User avatar images
│   └── {userId}.png
├── subjects/          # User subject photos
│   └── {userId}.png
└── generated/         # Generated illustrations
    └── {userId}/
        ├── memory_{id}.png
        └── subject_{id}.png
```

## Error Handling

The service includes comprehensive error handling:

1. **Service Disabled**: Returns 500 if `USE_ILLUSTRATION_SERVICE` is not set to 'true'
2. **Service Unavailable**: Returns 500 if illustration service is unreachable
3. **Generation Failures**: Returns 500 if image generation fails (with optional Bedrock fallback)
4. **Authentication Errors**: Returns 401 with clear error messages
5. **Missing User Data**: Returns 400 with validation errors
6. **S3 Errors**: Logs detailed error information

## Health Checks

The service automatically checks the health of the illustration service before making requests:

```typescript
const isHealthy = await illustrationService.checkHealth();
```

## Migration Guide

### From Bedrock to Illustration Service

1. **Deploy Illustration Service**: Ensure your EC2 G5 instance is running
2. **Update Environment Variables**: Add the new configuration
3. **Test Integration**: Verify health checks pass
4. **Monitor Logs**: Watch for fallback usage during transition

### Rollback Plan

If issues arise, you can quickly rollback by setting:
```bash
USE_ILLUSTRATION_SERVICE=false
USE_BEDROCK_FALLBACK=true
```

**Note**: With the new behavior, setting `USE_ILLUSTRATION_SERVICE=false` will cause all image generation requests to fail with a 500 error unless `USE_BEDROCK_FALLBACK=true` is also set.

## Performance Considerations

- **Illustration Service**: 15-30 seconds per image (high quality)
- **Bedrock Service**: 5-10 seconds per image (basic quality)
- **Health Checks**: 5 second timeout
- **Request Timeout**: 2 minutes for image generation

## Monitoring

Key metrics to monitor:

1. **Service Availability**: Health check success rate
2. **Fallback Usage**: Frequency of Bedrock fallback
3. **Generation Times**: Response times for each service
4. **Error Rates**: Failed requests by service type

## Troubleshooting

### Common Issues

1. **Service Unreachable**
   - Check EC2 instance status
   - Verify network connectivity
   - Confirm port 8000 is open

2. **Authentication Failures**
   - Verify `ILLUSTRATION_SERVICE_AUTH_TOKEN`
   - Check token format (Bearer token)

3. **S3 Access Issues**
   - Verify AWS credentials
   - Check S3 bucket permissions
   - Confirm bucket exists

### Debug Mode

Enable detailed logging:
```bash
LOG_LEVEL=debug
```

## Future Enhancements

- [ ] Add retry logic for failed requests
- [ ] Implement request queuing for high load
- [ ] Add metrics collection and monitoring
- [ ] Support for batch image generation
- [ ] Custom style prompts per user
