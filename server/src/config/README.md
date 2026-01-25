# Server Configuration

This directory contains configuration files for the AutoBio server.

## Feature Flags (`feature-flags.json`)

Central configuration for feature flags and A/B testing.

### Quick Start

1. **Check a flag in code:**
   ```typescript
   import { featureFlags } from '../services/featureFlagService';
   
   if (featureFlags.isEnabled('useMultiAngleReferences')) {
     // Feature enabled
   }
   ```

2. **Add a new flag:**
   - Edit `feature-flags.json`
   - Add your flag with description and environment settings
   - Use in code with `featureFlags.isEnabled('yourFlagName')`

3. **Override at runtime:**
   ```bash
   # Convert flag name from camelCase to SCREAMING_SNAKE_CASE
   USE_MULTI_ANGLE_REFERENCES=false npm start
   ```

### Current Flags

| Flag Name | Default | Description |
|-----------|---------|-------------|
| `disableRecentMemories` | `false` | Disables recent memories summarization during illustration generation |
| `useMultiAngleReferences` | `true` | Uses multi-angle (3-view) reference images for characters |

### Documentation

See [Feature Flags Documentation](../../../docs/server/architecture/feature-flags.md) for:
- Detailed usage guide
- Best practices
- Migration guide
- Testing strategies
- Architecture overview

### Schema

The `feature-flags.schema.json` file provides IDE autocomplete and validation for the feature flags configuration. Most IDEs will automatically use this schema when editing `feature-flags.json`.

## Environment-Specific Configuration

Feature flags support environment-specific overrides:

- **local** - Local development (NODE_ENV not set or 'local')
- **dev** - Development/staging deployment
- **prod** - Production deployment

Example:
```json
{
  "flags": {
    "experimentalFeature": {
      "enabled": false,
      "description": "...",
      "environments": {
        "local": true,   // Enabled locally for testing
        "dev": true,     // Enabled in staging
        "prod": false    // Disabled in production
      }
    }
  }
}
```

## Priority Order

1. **Environment variable** (highest) - `FEATURE_FLAG_NAME=true`
2. **Environment-specific config** - `environments.local/dev/prod`
3. **Global default** (lowest) - `enabled`
