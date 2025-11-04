/**
 * Plan Utils Unit Tests
 * Tests plan name normalization and validation utilities
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// Mock logger
jest.mock('../../../src/config/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../../src/config/logger');
const {
  normalizePlanName,
  capitalizePlanName,
  isValidProfilePlan,
  safePlanNameForProfile
} = require('../../../src/utils/planUtils');

describe('PlanUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizePlanName', () => {
    it('should normalize valid plan names to lowercase', () => {
      expect(normalizePlanName('FREE')).toBe('free');
      expect(normalizePlanName('Plus')).toBe('plus');
      expect(normalizePlanName('PRO')).toBe('pro');
    });

    it('should handle mixed case plan names', () => {
      expect(normalizePlanName('FrEe')).toBe('free');
      expect(normalizePlanName('pLuS')).toBe('plus');
      expect(normalizePlanName('pRo')).toBe('pro');
    });

    it('should trim whitespace from plan names', () => {
      expect(normalizePlanName('  free  ')).toBe('free');
      expect(normalizePlanName('\tplus\t')).toBe('plus');
      expect(normalizePlanName('\npro\n')).toBe('pro');
    });

    it('should handle plan names with extra spaces', () => {
      expect(normalizePlanName('  FREE  ')).toBe('free');
      expect(normalizePlanName('   PLUS   ')).toBe('plus');
    });

    it('should return "free" for invalid plan names', () => {
      expect(normalizePlanName('invalid')).toBe('free');
      expect(normalizePlanName('premium')).toBe('free');
      expect(normalizePlanName('starter')).toBe('free');
      expect(normalizePlanName('')).toBe('free');
    });

    it('should return "free" for non-string inputs', () => {
      expect(normalizePlanName(null)).toBe('free');
      expect(normalizePlanName(undefined)).toBe('free');
      expect(normalizePlanName(123)).toBe('free');
      expect(normalizePlanName({})).toBe('free');
      expect(normalizePlanName([])).toBe('free');
    });

    it('should log warning for invalid plan names', () => {
      normalizePlanName('invalid');
      expect(logger.warn).toHaveBeenCalledWith('Invalid plan name "invalid" normalized to "invalid". Using fallback "free".');
    });

    it('should not log warning for valid plan names', () => {
      normalizePlanName('free');
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('capitalizePlanName', () => {
    it('should capitalize valid plan names', () => {
      expect(capitalizePlanName('free')).toBe('Free');
      expect(capitalizePlanName('plus')).toBe('Plus');
      expect(capitalizePlanName('pro')).toBe('Pro');
    });

    it('should handle different case inputs', () => {
      expect(capitalizePlanName('FREE')).toBe('Free');
      expect(capitalizePlanName('Plus')).toBe('Plus');
      expect(capitalizePlanName('PRO')).toBe('Pro');
    });

    it('should handle whitespace in inputs', () => {
      expect(capitalizePlanName('  free  ')).toBe('Free');
      expect(capitalizePlanName('\tplus\t')).toBe('Plus');
      expect(capitalizePlanName('\npro\n')).toBe('Pro');
    });

    it('should return "Free" for invalid inputs', () => {
      expect(capitalizePlanName('')).toBe('Free');
      expect(capitalizePlanName(null)).toBe('Free');
      expect(capitalizePlanName(undefined)).toBe('Free');
      expect(capitalizePlanName(123)).toBe('Free');
    });
  });

  describe('isValidProfilePlan', () => {
    it('should return true for valid plan names', () => {
      expect(isValidProfilePlan('free')).toBe(true);
      expect(isValidProfilePlan('plus')).toBe(true);
      expect(isValidProfilePlan('pro')).toBe(true);
    });

    it('should return true for valid plan names with different cases', () => {
      expect(isValidProfilePlan('FREE')).toBe(true);
      expect(isValidProfilePlan('Plus')).toBe(true);
      expect(isValidProfilePlan('PRO')).toBe(true);
    });

    it('should return false for invalid plan names', () => {
      expect(isValidProfilePlan('invalid')).toBe(false);
      expect(isValidProfilePlan('premium')).toBe(false);
      expect(isValidProfilePlan('starter')).toBe(false);
      expect(isValidProfilePlan('')).toBe(false);
    });

    it('should handle null and undefined inputs gracefully', () => {
      // The function uses optional chaining, so null/undefined should not throw errors
      expect(() => isValidProfilePlan(null)).not.toThrow();
      expect(() => isValidProfilePlan(undefined)).not.toThrow();
      
      // They should return false since they can't be converted to valid plan names
      expect(isValidProfilePlan(null)).toBe(false);
      expect(isValidProfilePlan(undefined)).toBe(false);
    });

    it('should throw for non-string, non-null inputs', () => {
      // Numbers, objects, and arrays don't have toLowerCase method
      expect(() => isValidProfilePlan(123)).toThrow();
      expect(() => isValidProfilePlan({})).toThrow();
      expect(() => isValidProfilePlan([])).toThrow();
    });
  });

  describe('safePlanNameForProfile', () => {
    it('should return normalized plan name for valid inputs', () => {
      expect(safePlanNameForProfile('FREE')).toBe('free');
      expect(safePlanNameForProfile('Plus')).toBe('plus');
      expect(safePlanNameForProfile('PRO')).toBe('pro');
    });

    it('should handle whitespace in inputs', () => {
      expect(safePlanNameForProfile('  free  ')).toBe('free');
      expect(safePlanNameForProfile('\tplus\t')).toBe('plus');
      expect(safePlanNameForProfile('\npro\n')).toBe('pro');
    });

    it('should return "free" for invalid plan names', () => {
      expect(safePlanNameForProfile('invalid')).toBe('free');
      expect(safePlanNameForProfile('premium')).toBe('free');
      expect(safePlanNameForProfile('starter')).toBe('free');
      expect(safePlanNameForProfile('')).toBe('free');
    });

    it('should return "free" for non-string inputs', () => {
      expect(safePlanNameForProfile(null)).toBe('free');
      expect(safePlanNameForProfile(undefined)).toBe('free');
      expect(safePlanNameForProfile(123)).toBe('free');
      expect(safePlanNameForProfile({})).toBe('free');
      expect(safePlanNameForProfile([])).toBe('free');
    });

    it('should log warning for invalid plan names (via normalizePlanName)', () => {
      safePlanNameForProfile('invalid');
      expect(logger.warn).toHaveBeenCalledWith('Invalid plan name "invalid" normalized to "invalid". Using fallback "free".');
    });

    it('should not log warning for valid plan names', () => {
      safePlanNameForProfile('free');
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Integration tests', () => {
    it('should work correctly with all functions together', () => {
      const inputPlan = '  PLUS  ';
      
      // Normalize the plan
      const normalized = normalizePlanName(inputPlan);
      expect(normalized).toBe('plus');
      
      // Validate the normalized plan
      expect(isValidProfilePlan(normalized)).toBe(true);
      
      // Get display name
      const displayName = capitalizePlanName(normalized);
      expect(displayName).toBe('Plus');
      
      // Safe plan name for profile
      const safePlan = safePlanNameForProfile(inputPlan);
      expect(safePlan).toBe('plus');
    });

    it('should handle invalid input gracefully across all functions', () => {
      const invalidPlan = 'invalid';
      
      expect(normalizePlanName(invalidPlan)).toBe('free');
      expect(isValidProfilePlan(invalidPlan)).toBe(false);
      expect(capitalizePlanName(invalidPlan)).toBe('Invalid');
      expect(safePlanNameForProfile(invalidPlan)).toBe('free');
    });
  });
});