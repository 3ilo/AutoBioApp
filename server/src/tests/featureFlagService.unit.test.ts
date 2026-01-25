/**
 * Feature Flag Service Unit Tests
 * 
 * Isolated unit tests for the feature flag system.
 * Run with: npm test -- --testPathIgnorePatterns=setup.ts featureFlagService.unit.test.ts
 */

// Set up minimal environment before any imports
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

describe('FeatureFlagService - Unit Tests', () => {
  let FeatureFlagService: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Mock logger before importing
    jest.mock('../utils/logger', () => ({
      default: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      }
    }), { virtual: true });
  });

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Clear module cache to get fresh instance
    jest.resetModules();
    
    // Import fresh
    const module = require('../services/featureFlagService');
    FeatureFlagService = module.FeatureFlagService;
    
    // Reset singleton if it exists
    if (FeatureFlagService.resetInstance) {
      FeatureFlagService.resetInstance();
    }
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    
    // Clean up singleton
    if (FeatureFlagService.resetInstance) {
      FeatureFlagService.resetInstance();
    }
  });

  describe('Basic Functionality', () => {
    it('should create singleton instance', () => {
      const instance1 = FeatureFlagService.getInstance();
      const instance2 = FeatureFlagService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should check if flags are enabled', () => {
      const service = FeatureFlagService.getInstance();
      
      // Should return boolean for any flag
      expect(typeof service.isEnabled('useMultiAngleReferences')).toBe('boolean');
    });

    it('should return false for unknown flags', () => {
      const service = FeatureFlagService.getInstance();
      
      expect(service.isEnabled('unknownFlag12345')).toBe(false);
    });
  });

  describe('Environment Variable Overrides', () => {
    it('should respect USE_MULTI_ANGLE_REFERENCES=false', () => {
      process.env.USE_MULTI_ANGLE_REFERENCES = 'false';
      jest.resetModules();
      const module = require('../services/featureFlagService');
      const service = module.FeatureFlagService.getInstance();
      
      expect(service.isEnabled('useMultiAngleReferences')).toBe(false);
    });

    it('should respect USE_MULTI_ANGLE_REFERENCES=true', () => {
      process.env.USE_MULTI_ANGLE_REFERENCES = 'true';
      jest.resetModules();
      const module = require('../services/featureFlagService');
      const service = module.FeatureFlagService.getInstance();
      
      expect(service.isEnabled('useMultiAngleReferences')).toBe(true);
    });
  });

  describe('Flag Metadata', () => {
    it('should return all flags', () => {
      const service = FeatureFlagService.getInstance();
      const allFlags = service.getAllFlags();
      
      expect(typeof allFlags).toBe('object');
      expect(Object.keys(allFlags).length).toBeGreaterThan(0);
    });

    it('should return flag info', () => {
      const service = FeatureFlagService.getInstance();
      const flagInfo = service.getFlagInfo('useMultiAngleReferences');
      
      if (flagInfo) {
        expect(flagInfo).toHaveProperty('description');
        expect(flagInfo).toHaveProperty('enabled');
        expect(flagInfo).toHaveProperty('environments');
      }
    });
  });
});
