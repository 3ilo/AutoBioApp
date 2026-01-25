/**
 * Feature Flag Service
 * 
 * Centralized feature flag management system that reads from a JSON configuration file.
 * Supports environment-specific overrides and runtime env var overrides.
 * 
 * Usage:
 *   const featureFlags = FeatureFlagService.getInstance();
 *   if (featureFlags.isEnabled('useMultiAngleReferences')) {
 *     // Use multi-angle flow
 *   } else {
 *     // Use single reference flow
 *   }
 */

import { getEnvironment, Environment } from '../utils/env';
import logger from '../utils/logger';

// Import feature flags config - use require for JSON to avoid TS issues
const featureFlagsConfig = require('../config/feature-flags.json');

export interface FeatureFlag {
  enabled: boolean;
  description: string;
  environments: {
    local: boolean;
    dev: boolean;
    prod: boolean;
  };
}

export interface FeatureFlagsConfig {
  flags: {
    [key: string]: FeatureFlag;
  };
}

/**
 * Singleton service for managing feature flags
 */
export class FeatureFlagService {
  private static instance: FeatureFlagService;
  private config: FeatureFlagsConfig;
  private environment: Environment;
  private flagCache: Map<string, boolean> = new Map();

  private constructor() {
    this.config = featureFlagsConfig as FeatureFlagsConfig;
    this.environment = getEnvironment();
    this.initializeFlags();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): FeatureFlagService {
    if (!FeatureFlagService.instance) {
      FeatureFlagService.instance = new FeatureFlagService();
    }
    return FeatureFlagService.instance;
  }

  /**
   * Initialize all flags and log their states
   */
  private initializeFlags(): void {
    logger.info('Feature Flag Service: Initializing flags', {
      environment: this.environment,
      availableFlags: Object.keys(this.config.flags),
    });

    for (const [flagName, flag] of Object.entries(this.config.flags)) {
      const isEnabled = this.computeFlagValue(flagName, flag);
      this.flagCache.set(flagName, isEnabled);
      
      logger.info(`Feature Flag: ${flagName}`, {
        enabled: isEnabled,
        description: flag.description,
        environment: this.environment,
      });
    }
  }

  /**
   * Compute the final value for a flag based on:
   * 1. Environment variable override (highest priority)
   * 2. Environment-specific config
   * 3. Global enabled flag (fallback)
   */
  private computeFlagValue(flagName: string, flag: FeatureFlag): boolean {
    // Check for environment variable override first
    // Convert camelCase to SCREAMING_SNAKE_CASE for env var
    const envVarName = this.toEnvVarName(flagName);
    const envVarValue = process.env[envVarName];
    
    if (envVarValue !== undefined) {
      const overrideValue = envVarValue === 'true';
      logger.info(`Feature Flag: ${flagName} overridden by env var ${envVarName}`, {
        envVarValue,
        overrideValue,
      });
      return overrideValue;
    }

    // Use environment-specific config if available
    const envSpecificValue = flag.environments[this.environment];
    if (envSpecificValue !== undefined) {
      return envSpecificValue;
    }

    // Fall back to global enabled flag
    return flag.enabled;
  }

  /**
   * Convert camelCase flag name to SCREAMING_SNAKE_CASE for env var
   * e.g., "useMultiAngleReferences" -> "USE_MULTI_ANGLE_REFERENCES"
   */
  private toEnvVarName(flagName: string): string {
    return flagName
      .replace(/([A-Z])/g, '_$1')
      .toUpperCase()
      .replace(/^_/, '');
  }

  /**
   * Check if a feature flag is enabled
   * 
   * @param flagName - The feature flag name (camelCase)
   * @returns true if the flag is enabled, false otherwise
   */
  public isEnabled(flagName: string): boolean {
    // Check cache first
    if (this.flagCache.has(flagName)) {
      return this.flagCache.get(flagName)!;
    }

    // Flag not found - log warning and return false (safe default)
    logger.warn(`Feature Flag: ${flagName} not found in configuration`, {
      availableFlags: Object.keys(this.config.flags),
    });
    return false;
  }

  /**
   * Get all flag states (useful for debugging)
   */
  public getAllFlags(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [flagName, isEnabled] of this.flagCache.entries()) {
      result[flagName] = isEnabled;
    }
    return result;
  }

  /**
   * Get flag metadata
   */
  public getFlagInfo(flagName: string): FeatureFlag | undefined {
    return this.config.flags[flagName];
  }

  /**
   * Reset instance (useful for testing)
   */
  public static resetInstance(): void {
    FeatureFlagService.instance = null as any;
  }
}

// Export singleton instance for convenience
export const featureFlags = FeatureFlagService.getInstance();
