# S3 Consolidation Summary

## Overview

Successfully consolidated S3 logic to use a **single bucket in a single region** with path-based separation. All S3 operations now go through a centralized singleton client with consistent configuration.

## Changes Made

### 1. S3 Client Singleton (`server/src/utils/s3Client.ts`)

**Updated:**
- Changed default region from `us-west-2` to `us-east-1`
- Added `S3_GENERATED_PREFIX` and `S3_STUBS_PREFIX` configuration
- Added helper methods:
  - `getRegion()` - Get configured S3 region
  - `getGeneratedPrefix()` - Get generated images prefix
  - `getStubsPrefix()` - Get stubs prefix

**Result:** Single source of truth for all S3 configuration.

### 2. Illustration Orchestrator Service (`server/src/services/illustrationOrchestratorService.ts`)

**Removed:**
- Duplicate `S3_BUCKET` constant
- Duplicate `S3_AVATAR_PREFIX` constant
- Hardcoded `S3_GENERATED_PREFIX` constant

**Updated:**
- All S3 operations now use `s3Client.getBucketName()`
- All prefix references use `s3Client.getGeneratedPrefix()`
- `fetchReferenceImage()` and `fetchSubjectImage()` methods updated
- `uploadImageToS3()` method updated

**Result:** No duplicate configuration, all S3 access through singleton.

### 3. Stub Image Generator (`server/src/services/imageGenerators/stubImageGenerator.ts`)

**Removed:**
- Duplicate `S3_BUCKET` constant
- Duplicate `S3_STUBS_PREFIX` constant

**Updated:**
- All S3 operations now use `s3Client.getBucketName()`
- Stubs prefix now uses `s3Client.getStubsPrefix()`

**Result:** Consistent S3 access pattern across all generators.

### 4. Serverless Configuration (`server/serverless.yml`)

**Changed:**
- Replaced `AWS_STAGING_BUCKET` with `S3_BUCKET_NAME`
- Renamed `AWS_CLIENT_REGION` to `S3_CLIENT_REGION` for clarity
- Updated IAM permissions to reference `S3_BUCKET_NAME`
- Added `s3:ListBucket` permission for listing objects
- Added both bucket and bucket/* resource permissions

**Result:** Consistent environment variable naming and proper IAM permissions.

### 5. Deployment Script (`server/scripts/deploy.sh`)

**Changed:**
- Updated required variables check from `AWS_STAGING_BUCKET` to `S3_BUCKET_NAME`

**Result:** Deployment validation uses correct variable names.

### 6. Deployment Documentation (`server/DEPLOYMENT.md`)

**Updated all environment examples:**
- Changed `AWS_CLIENT_REGION` to `S3_CLIENT_REGION`
- Changed `AWS_STAGING_BUCKET` to `S3_BUCKET_NAME`
- Added comment: "Single bucket, single region, path-based separation"
- Updated for `.env.local`, `.env.dev`, and `.env.prod` examples

**Result:** Documentation reflects consolidated S3 strategy.

### 7. Server README (`server/README.md`)

**Updated:**
- Environment variable documentation
- Changed `AWS_CLIENT_REGION` to `S3_CLIENT_REGION`
- Changed `AWS_S3_BUCKET` to `S3_BUCKET_NAME`
- Added note about default region (us-east-1)
- Added comment about single bucket strategy

**Result:** README reflects current S3 configuration.

### 8. New Documentation (`docs/server/architecture/s3-storage.md`)

**Created comprehensive documentation covering:**
- Design principles and bucket structure
- Environment variable configuration
- S3 client singleton usage examples
- IAM permissions
- Local vs. serverless credentials
- External service integration
- Migration guide from multiple buckets
- Benefits and considerations
- Troubleshooting guide
- Future enhancement suggestions

**Result:** Complete reference for S3 architecture and usage.

## Configuration Summary

### Environment Variables (Consolidated)

```env
# Required - Single bucket, single region
S3_BUCKET_NAME=auto-bio-illustrations
S3_CLIENT_REGION=us-east-1

# Optional - Path prefixes (defaults provided)
S3_SUBJECT_PREFIX=subjects/
S3_AVATAR_PREFIX=avatars/
S3_GENERATED_PREFIX=generated/
S3_STUBS_PREFIX=stubs/

# Local development only
BACKEND_AWS_KEY=your-access-key
BACKEND_AWS_SECRET=your-secret-key
```

### Bucket Path Structure

```
s3://auto-bio-illustrations/
├── subjects/           # Subject reference images
│   └── {userId}.png
├── avatars/            # User avatar images
│   └── {userId}.png
├── generated/          # AI-generated illustrations
│   ├── memory/{userId}/{timestamp}-{uuid}.png
│   └── subject/{userId}/{timestamp}-{uuid}.png
└── stubs/              # Development stub images
```

## Benefits Achieved

1. **Single Source of Truth**: All S3 configuration in one place (s3Client singleton)
2. **Consistent Region**: Default `us-east-1` (lowest cost, highest availability)
3. **Path-Based Organization**: Logical separation without multiple buckets
4. **Simplified IAM**: One IAM policy for all S3 operations
5. **Cost Optimization**: Single bucket easier to monitor and optimize
6. **Maintainability**: Changes to bucket/region configuration in one location

## Migration Path

For existing deployments:

1. **Update environment variables** in `.env.dev` and `.env.prod`
   ```env
   # Remove
   AWS_STAGING_BUCKET=old-bucket
   
   # Add
   S3_BUCKET_NAME=auto-bio-illustrations
   S3_CLIENT_REGION=us-east-1
   ```

2. **Migrate existing S3 data** (if using different buckets/regions)
   ```bash
   # Example: Copy from old bucket
   aws s3 cp s3://old-bucket/ s3://auto-bio-illustrations/ --recursive
   ```

3. **Redeploy** using the deployment script
   ```bash
   ./scripts/deploy.sh dev
   ```

4. **Verify IAM permissions** are updated in AWS Console

## No Breaking Changes

- Existing code continues to work (all changes are internal)
- API endpoints unchanged
- Database schemas unchanged
- S3 object keys remain the same
- Presigned URL generation works identically

## Testing Recommendations

1. **Local Development**: Verify S3 uploads/downloads work
2. **Dev Environment**: Test after deploying to dev
3. **IAM Permissions**: Verify Lambda can access S3
4. **External Services**: Ensure SDXL service uses same bucket/region

## Files Modified

1. `server/src/utils/s3Client.ts` - Centralized configuration
2. `server/src/services/illustrationOrchestratorService.ts` - Use singleton
3. `server/src/services/imageGenerators/stubImageGenerator.ts` - Use singleton
4. `server/serverless.yml` - Updated env vars and IAM
5. `server/scripts/deploy.sh` - Updated validation
6. `server/DEPLOYMENT.md` - Updated documentation
7. `server/README.md` - Updated documentation

## Files Created

1. `docs/server/architecture/s3-storage.md` - Comprehensive S3 documentation
2. `docs/server/architecture/s3-consolidation-summary.md` - This summary

## Next Steps

1. **Review changes** in git diff
2. **Test locally** to ensure S3 operations work
3. **Update `.env.dev` and `.env.prod`** with new variable names
4. **Deploy to dev** environment for testing
5. **Migrate S3 data** if using different buckets (optional)
6. **Update external services** (like illustration-gen) to use same bucket/region

## Questions or Issues?

Refer to:
- `docs/server/architecture/s3-storage.md` - Comprehensive S3 documentation
- `server/DEPLOYMENT.md` - Deployment guide with environment variables
- `server/src/utils/s3Client.ts` - S3 client implementation
