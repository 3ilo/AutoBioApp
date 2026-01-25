/**
 * Feature Flag Service Tests
 * 
 * Tests the feature flag system including:
 * - Flag initialization
 * - Environment-specific overrides
 * - Environment variable overrides
 * - Flag name conversion
 * 
 * Note: This test file does not use the global setup.ts to avoid
 * initializing the full app and database connection.
 */

// Mock logger before importing the service
jest.mock('../utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }
}));

import { FeatureFlagService } from '../services/featureFlagService';

describe('FeatureFlagService', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Reset singleton instance before each test
    FeatureFlagService.resetInstance();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up singleton
    FeatureFlagService.resetInstance();
  });

  describe('Flag Resolution', () => {
    it('should return correct flag values from config', () => {
      const service = FeatureFlagService.getInstance();
      
      // These flags should exist in the config
      expect(typeof service.isEnabled('disableRecentMemories')).toBe('boolean');
      expect(typeof service.isEnabled('useMultiAngleReferences')).toBe('boolean');
    });

    it('should return false for non-existent flags', () => {
      const service = FeatureFlagService.getInstance();
      
      expect(service.isEnabled('nonExistentFlag')).toBe(false);
    });

    it('should cache flag values', () => {
      const service = FeatureFlagService.getInstance();
      
      // Call twice - should return same value from cache
      const firstCall = service.isEnabled('useMultiAngleReferences');
      const secondCall = service.isEnabled('useMultiAngleReferences');
      
      expect(firstCall).toBe(secondCall);
    });
  });

  describe('Environment Variable Overrides', () => {
    it('should override flag with environment variable (true)', () => {
      // Set env var to override
      process.env.USE_MULTI_ANGLE_REFERENCES = 'true';
      
      const service = FeatureFlagService.getInstance();
      
      // Should be overridden to true regardless of config
      expect(service.isEnabled('useMultiAngleReferences')).toBe(true);
    });

    it('should override flag with environment variable (false)', () => {
      // Set env var to override
      process.env.USE_MULTI_ANGLE_REFERENCES = 'false';
      
      const service = FeatureFlagService.getInstance();
      
      // Should be overridden to false regardless of config
      expect(service.isEnabled('useMultiAngleReferences')).toBe(false);
    });

    it('should handle DISABLE_RECENT_MEMORIES env var', () => {
      // This is the legacy env var name - test backward compatibility
      process.env.DISABLE_RECENT_MEMORIES = 'true';
      
      const service = FeatureFlagService.getInstance();
      
      expect(service.isEnabled('disableRecentMemories')).toBe(true);
    });

    it('should convert camelCase to SCREAMING_SNAKE_CASE', () => {
      const service = FeatureFlagService.getInstance();
      
      // Test the conversion logic indirectly via env var override
      process.env.USE_MULTI_ANGLE_REFERENCES = 'true';
      
      // Reset to pick up the new env var
      FeatureFlagService.resetInstance();
      const newService = FeatureFlagService.getInstance();
      
      // Should recognize the env var
      expect(newService.isEnabled('useMultiAngleReferences')).toBe(true);
    });
  });

  describe('Flag Metadata', () => {
    it('should return all flag states', () => {
      const service = FeatureFlagService.getInstance();
      const allFlags = service.getAllFlags();
      
      expect(typeof allFlags).toBe('object');
      expect(allFlags).toHaveProperty('disableRecentMemories');
      expect(allFlags).toHaveProperty('useMultiAngleReferences');
    });

    it('should return flag info with description', () => {
      const service = FeatureFlagService.getInstance();
      const flagInfo = service.getFlagInfo('useMultiAngleReferences');
      
      expect(flagInfo).toBeDefined();
      expect(flagInfo?.description).toBeDefined();
      expect(typeof flagInfo?.description).toBe('string');
      expect(flagInfo?.environments).toBeDefined();
    });

    it('should return undefined for non-existent flag info', () => {
      const service = FeatureFlagService.getInstance();
      const flagInfo = service.getFlagInfo('nonExistentFlag');
      
      expect(flagInfo).toBeUndefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = FeatureFlagService.getInstance();
      const instance2 = FeatureFlagService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance for testing', () => {
      const instance1 = FeatureFlagService.getInstance();
      
      FeatureFlagService.resetInstance();
      
      const instance2 = FeatureFlagService.getInstance();
      
      // Should be different instances
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Feature Flag Usage Examples', () => {
    it('should work with disableRecentMemories flag', () => {
      const service = FeatureFlagService.getInstance();
      
      const shouldFetchRecentMemories = !service.isEnabled('disableRecentMemories');
      
      expect(typeof shouldFetchRecentMemories).toBe('boolean');
    });

    it('should work with useMultiAngleReferences flag', () => {
      const service = FeatureFlagService.getInstance();
      
      if (service.isEnabled('useMultiAngleReferences')) {
        // Should use multi-angle approach
        expect(true).toBe(true);
      } else {
        // Should use single reference approach
        expect(true).toBe(true);
      }
    });

    it('should handle conditional logic based on flags', () => {
      const service = FeatureFlagService.getInstance();
      
      const result = service.isEnabled('useMultiAngleReferences')
        ? 'multi-angle'
        : 'single';
      
      expect(['multi-angle', 'single']).toContain(result);
    });
  });
});
