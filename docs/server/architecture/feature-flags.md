# Feature Flag System

## Overview

The AutoBio server uses a centralized feature flag system to control experimental features and A/B testing scenarios. This system provides a clean, single point of control for toggling features on/off across different environments.

## Architecture

### Components

1. **Configuration File** (`server/src/config/feature-flags.json`)
   - JSON file containing all feature flag definitions
   - Supports environment-specific overrides (local, dev, prod)
   - Includes descriptions for documentation

2. **Feature Flag Service** (`server/src/services/featureFlagService.ts`)
   - Singleton service that reads and caches flag states
   - Supports runtime environment variable overrides
   - Provides simple `isEnabled(flagName)` API

3. **JSON Schema** (`server/src/config/feature-flags.schema.json`)
   - Validates feature flag configuration
   - Provides IDE autocomplete and validation

## Usage

### Checking a Feature Flag

```typescript
import { featureFlags } from './services/featureFlagService';

// Simple boolean check
if (featureFlags.isEnabled('useMultiAngleReferences')) {
  // Use multi-angle reference images
} else {
  // Use single reference images (original approach)
}
```

### Adding a New Feature Flag

1. Add the flag definition to `server/src/config/feature-flags.json`:

```json
{
  "flags": {
    "myNewFeature": {
      "enabled": false,
      "description": "Description of what this feature does",
      "environments": {
        "local": true,
        "dev": true,
        "prod": false
      }
    }
  }
}
```

2. Use the flag in your code:

```typescript
if (featureFlags.isEnabled('myNewFeature')) {
  // New feature code
} else {
  // Original code
}
```

## Flag Priority

Feature flag values are determined by the following priority (highest to lowest):

1. **Environment Variable Override** - `FEATURE_FLAG_NAME=true/false`
   - Converts camelCase to SCREAMING_SNAKE_CASE
   - Example: `useMultiAngleReferences` → `USE_MULTI_ANGLE_REFERENCES`
   
2. **Environment-Specific Config** - Value from `environments[local|dev|prod]`

3. **Global Enabled Flag** - Value from `enabled` field (fallback)

## Environment Variable Overrides

You can override any feature flag at runtime using environment variables:

```bash
# Override in local development
USE_MULTI_ANGLE_REFERENCES=false npm start

# Override in deployed environment (serverless.yml)
environment:
  USE_MULTI_ANGLE_REFERENCES: true
```

This is useful for:
- Testing different configurations without code changes
- Emergency rollbacks in production
- Per-deployment customization

## Available Feature Flags

### `disableRecentMemories`

**Status:** Disabled by default  
**Environments:** All disabled

When enabled, disables fetching and summarizing recent memories during memory illustration generation. This reduces API costs and generation time but may result in less contextually rich illustrations.

**Usage:**
```typescript
if (!featureFlags.isEnabled('disableRecentMemories')) {
  // Fetch and use recent memories context
}
```

### `useMultiAngleReferences`

**Status:** Disabled by default  
**Environments:** All disabled

Controls the character avatar generation workflow and which references are used for memory illustrations.

**When enabled (true):**
- **Avatar generation:** Creates 3 separate images (left profile, front, right profile), stitches them into `multi-angle.png`, extracts front as `avatar.png`
- **Memory illustrations:** Uses `multi-angle.png` as reference
- **Benefits:** Better consistency across different angles, more context for AI
- **Cost:** 3x generation time (3 images instead of 1), 3x API costs

**When disabled (false):**
- **Avatar generation:** Creates single `avatar.png` only (no multi-angle generation)
- **Memory illustrations:** Uses `avatar.png` as reference
- **Benefits:** Faster generation (1 image), lower API costs
- **Cost:** Slightly less contextual information

**Usage:**
```typescript
if (featureFlags.isEnabled('useMultiAngleReferences')) {
  // Generate 3-angle array + extract front as avatar
  await generateMultiAngleAvatar();
} else {
  // Generate single avatar only
  await generateCharacterAvatar();
}
```

**Impact:**
- **Enabled:** Better multi-angle consistency, but 3x generation time and cost
- **Disabled:** Faster, cheaper generation with single avatar

## Best Practices

### 1. Single Point of Control

Always toggle feature behavior through the feature flag service, not scattered environment variable checks:

❌ **Bad:**
```typescript
const useFeature = process.env.USE_FEATURE === 'true';
```

✅ **Good:**
```typescript
const useFeature = featureFlags.isEnabled('useFeature');
```

### 2. Descriptive Flag Names

Use clear, action-oriented names in camelCase:
- ✅ `useMultiAngleReferences`
- ✅ `enableAdvancedCaching`
- ✅ `disableRecentMemories`
- ❌ `feature1`
- ❌ `new_thing`

### 3. Document in Code

Add comments explaining what each branch does:

```typescript
if (featureFlags.isEnabled('useMultiAngleReferences')) {
  // NEW: Multi-angle reference approach (3 stitched images)
  // Better consistency but 3x generation time
  return await fetchMultiAngleReference();
} else {
  // ORIGINAL: Single reference approach
  // Faster but less consistent
  return await fetchSingleReference();
}
```

### 4. Clean Up Old Flags

When a feature is fully rolled out and the old code path is no longer needed:
1. Remove the old code branch
2. Remove the feature flag from the config
3. Remove any feature flag checks

### 5. Test Both Branches

Always test both enabled and disabled states, especially before deployment:

```bash
# Test with feature enabled
USE_MULTI_ANGLE_REFERENCES=true npm test

# Test with feature disabled
USE_MULTI_ANGLE_REFERENCES=false npm test
```

## Debugging

### View All Flags

```typescript
const allFlags = featureFlags.getAllFlags();
console.log('Current flag states:', allFlags);
// Output: { disableRecentMemories: false, useMultiAngleReferences: true }
```

### Get Flag Metadata

```typescript
const flagInfo = featureFlags.getFlagInfo('useMultiAngleReferences');
console.log('Flag description:', flagInfo?.description);
console.log('Environment states:', flagInfo?.environments);
```

### Check Logs

The feature flag service logs all flag states on initialization:

```
INFO Feature Flag Service: Initializing flags
INFO Feature Flag: disableRecentMemories { enabled: false, description: '...', environment: 'local' }
INFO Feature Flag: useMultiAngleReferences { enabled: true, description: '...', environment: 'local' }
```

## Migration Guide

### Migrating Existing Environment Variables

If you have existing environment variable checks like:

```typescript
const DISABLE_FEATURE = process.env.DISABLE_FEATURE === 'true';
```

Migrate to the feature flag system:

1. Add flag to `feature-flags.json`:
```json
{
  "disableFeature": {
    "enabled": false,
    "description": "...",
    "environments": { "local": false, "dev": false, "prod": false }
  }
}
```

2. Replace the check:
```typescript
if (!featureFlags.isEnabled('disableFeature')) {
  // Feature enabled
}
```

3. (Optional) Keep env var override support:
   - The flag name `disableFeature` automatically supports `DISABLE_FEATURE` env var
   - No code changes needed!

## Testing

### Unit Tests

```typescript
import { FeatureFlagService } from './services/featureFlagService';

describe('Feature Flag Tests', () => {
  beforeEach(() => {
    FeatureFlagService.resetInstance();
  });

  it('should respect feature flag settings', () => {
    const flags = FeatureFlagService.getInstance();
    
    // Test your feature with flag enabled
    // ...
    
    // Test your feature with flag disabled
    // ...
  });
});
```

### Integration Tests

Test with actual environment variables:

```bash
# Run tests with different flag states
USE_MULTI_ANGLE_REFERENCES=false npm test
USE_MULTI_ANGLE_REFERENCES=true npm test
```

## Future Enhancements

Potential improvements to consider:

1. **Remote Configuration** - Load flags from a remote service (e.g., LaunchDarkly, Split.io)
2. **User-Specific Flags** - Enable features for specific users/cohorts
3. **Gradual Rollouts** - Percentage-based rollouts (e.g., enable for 10% of users)
4. **A/B Testing Integration** - Track metrics per feature flag state
5. **Admin UI** - Web interface for toggling flags without deployment

## Related Documentation

- [Multi-Person Illustration Feature](../features/multi-person-illustration.md)
- [Environment Configuration](./environment-configuration.md)
- [Deployment Guide](../../DEPLOYMENT.md)
