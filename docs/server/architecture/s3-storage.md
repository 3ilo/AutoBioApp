# S3 Storage Architecture

## Overview

The AutoBio server uses a **single S3 bucket in a single region** with path-based separation for logical organization. All S3 operations go through a centralized singleton client that manages bucket configuration and access.

## Design Principles

1. **Single Bucket**: One S3 bucket per environment (local, dev, prod)
2. **Single Region**: Default to `us-east-1` (configurable via `S3_CLIENT_REGION`)
3. **Path-Based Separation**: Use prefixes to organize different types of content
4. **Centralized Client**: All S3 operations use the same singleton instance
5. **Consistent Configuration**: Bucket and region configured once, reused everywhere

## Bucket Structure

All content is organized using path prefixes within the single bucket:

```
s3://auto-bio-illustrations/
├── subjects/           # Subject reference images for LoRA training
│   └── {userId}.png
├── avatars/            # User avatar images
│   └── {userId}.png
├── generated/          # AI-generated illustrations
│   ├── memory/
│   │   └── {userId}/{timestamp}-{uuid}.png
│   └── subject/
│       └── {userId}/{timestamp}-{uuid}.png
└── stubs/              # Development stub images
    └── *.png
```

## Environment Variables

### Required Configuration

```env
# S3 Configuration
S3_BUCKET_NAME=auto-bio-illustrations       # Single bucket for all content
S3_CLIENT_REGION=us-east-1                  # Single region (defaults to us-east-1)

# Backend AWS Credentials (local development only)
BACKEND_AWS_KEY=your-access-key             # Not needed in Lambda (uses IAM role)
BACKEND_AWS_SECRET=your-secret-key          # Not needed in Lambda (uses IAM role)
```

### Optional Prefix Configuration

You can override the default prefixes if needed:

```env
S3_SUBJECT_PREFIX=subjects/                 # Default: subjects/
S3_AVATAR_PREFIX=avatars/                   # Default: avatars/
S3_GENERATED_PREFIX=generated/              # Default: generated/
S3_STUBS_PREFIX=stubs/                      # Default: stubs/
```

## S3 Client Singleton

The S3 client is implemented as a singleton pattern to ensure consistent configuration across the application.

### Key Features

- **Single Instance**: One S3 client instance shared across the entire application
- **Centralized Configuration**: Bucket name, region, and prefixes managed in one place
- **Helper Methods**: Provides utility methods for common S3 operations
- **Presigned URLs**: Generates presigned URLs for secure upload/download

### Usage

```typescript
import { s3Client } from '../utils/s3Client';

// Get bucket configuration
const bucketName = s3Client.getBucketName();
const region = s3Client.getRegion();

// Generate presigned URLs
const uploadUrl = await s3Client.generatePresignedUploadUrl(userId, 'image/png');
const downloadUrl = await s3Client.generatePresignedDownloadUrl(key);

// Get file keys
const subjectKey = s3Client.getSubjectKey(userId);
const avatarKey = s3Client.getAvatarKey(userId);

// Fetch objects
const imageBase64 = await s3Client.getObjectAsBase64(bucketName, key);

// Get raw client for advanced operations
const rawClient = s3Client.getClient();
```

## IAM Permissions

The serverless deployment automatically configures Lambda with the following S3 permissions:

```yaml
- Effect: Allow
  Action:
    - s3:GetObject
    - s3:PutObject
    - s3:DeleteObject
    - s3:ListBucket
  Resource:
    - 'arn:aws:s3:::${S3_BUCKET_NAME}'
    - 'arn:aws:s3:::${S3_BUCKET_NAME}/*'
```

## Local vs. Serverless Credentials

### Local Development

- Uses explicit AWS credentials from environment variables
- Set `BACKEND_AWS_KEY` and `BACKEND_AWS_SECRET` in `.env.local`
- S3 client automatically detects local environment and uses credentials

### Serverless (Dev/Prod)

- Lambda uses IAM role for AWS service access
- No explicit credentials needed in environment variables
- S3 client automatically detects serverless environment and uses IAM role

The `getAwsClientConfig()` utility automatically handles this:

```typescript
// In s3Client.ts
import { getAwsClientConfig } from './env';

this.s3Client = new S3Client(getAwsClientConfig(S3_CLIENT_REGION));
```

## External Services

If you use external services (like the illustration-gen SDXL service) that also interact with S3:

1. **Configure them to use the same bucket**: Pass `S3_BUCKET_NAME` to the service
2. **Configure them to use the same region**: Pass `S3_CLIENT_REGION` to the service
3. **Ensure consistent IAM permissions**: External services need appropriate S3 access

Example configuration for illustration-gen service:

```env
# In illustration-gen service
S3_BUCKET_NAME=auto-bio-illustrations
S3_REGION=us-east-1
```

## Migration Guide

If you previously used multiple buckets or regions, here's how to consolidate:

### Step 1: Update Environment Variables

Replace any bucket-specific variables with the single `S3_BUCKET_NAME`:

```env
# OLD - Multiple buckets
AWS_STAGING_BUCKET=autobio-staging
AWS_ASSETS_BUCKET=autobio-assets

# NEW - Single bucket
S3_BUCKET_NAME=auto-bio-illustrations
```

### Step 2: Use S3 Client Helper Methods

Instead of hardcoding bucket names in code, use the singleton:

```typescript
// OLD - Hardcoded bucket
const bucket = 'auto-bio-illustrations';

// NEW - Use singleton
const bucket = s3Client.getBucketName();
```

### Step 3: Migrate Existing Data

If you have data in multiple buckets, migrate it to the single bucket with appropriate prefixes:

```bash
# Example: Copy from old bucket to new with prefix
aws s3 cp s3://old-bucket/ s3://auto-bio-illustrations/generated/ --recursive
```

### Step 4: Update IAM Policies

Ensure Lambda and external services have permissions for the single bucket:

```yaml
Resource:
  - 'arn:aws:s3:::auto-bio-illustrations'
  - 'arn:aws:s3:::auto-bio-illustrations/*'
```

## Benefits of This Architecture

1. **Simplified Configuration**: One bucket to configure and manage
2. **Cost Optimization**: Easier to track and optimize storage costs
3. **Consistent Permissions**: Single IAM policy for all S3 operations
4. **Easy Monitoring**: All S3 metrics in one place
5. **Simplified Backup**: Single bucket to backup and replicate
6. **Region Consistency**: All data in same region reduces latency and data transfer costs

## Considerations

1. **Bucket Naming**: Choose a globally unique bucket name
2. **Region Selection**: 
   - Default is `us-east-1` (lowest cost, highest availability)
   - Choose region closest to your users/services for best performance
3. **Path Organization**: Use clear, hierarchical prefixes for easy management
4. **Lifecycle Policies**: Consider implementing S3 lifecycle rules for cost optimization
5. **Versioning**: Enable versioning for production buckets to prevent data loss

## Troubleshooting

### Permission Errors

```
Access Denied when accessing S3
```

**Solution**: Verify IAM role has correct permissions and bucket name is correct in environment variables.

### Region Mismatch

```
PermanentRedirect: The bucket is in this region: us-west-2
```

**Solution**: Ensure `S3_CLIENT_REGION` matches your actual bucket region.

### External Service Issues

```
SDXL service returns S3 URIs in different bucket
```

**Solution**: Configure external service to use the same `S3_BUCKET_NAME` and `S3_CLIENT_REGION`.

## Future Enhancements

Potential improvements to consider:

1. **CloudFront Distribution**: Add CDN for faster content delivery
2. **S3 Transfer Acceleration**: Enable for faster uploads from distant regions
3. **Intelligent Tiering**: Automatically move infrequently accessed objects to cheaper storage
4. **Cross-Region Replication**: Replicate to other regions for disaster recovery
5. **Access Logging**: Enable S3 access logs for audit and monitoring
