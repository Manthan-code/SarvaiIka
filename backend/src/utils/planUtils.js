/**
 * Plan utilities for consistent plan name handling
 * Ensures proper case conversion between plans table (capitalized) and profiles table (lowercase)
 */

const logger = require('../config/logger');

/**
 * Normalize plan name for storage in profiles table
 * @param {string} planName - Plan name from plans table (e.g., 'Free', 'Plus', 'Pro')
 * @returns {string} - Normalized lowercase plan name (e.g., 'free', 'plus', 'pro')
 */
function normalizePlanName(planName) {
  if (!planName || typeof planName !== 'string') {
    logger.warn('Invalid plan name provided to normalizePlanName:', planName);
    return 'free'; // Default fallback
  }
  
  const normalized = planName.toLowerCase().trim();
  
  // Validate against allowed values
  const allowedPlans = ['free', 'plus', 'pro'];
  if (!allowedPlans.includes(normalized)) {
    logger.warn(`Invalid plan name "${planName}" normalized to "${normalized}". Using fallback "free".`);
    return 'free';
  }
  
  return normalized;
}

/**
 * Capitalize plan name for display purposes
 * @param {string} planName - Lowercase plan name (e.g., 'free', 'plus', 'pro')
 * @returns {string} - Capitalized plan name (e.g., 'Free', 'Plus', 'Pro')
 */
function capitalizePlanName(planName) {
  if (!planName || typeof planName !== 'string') {
    return 'Free';
  }
  
  const normalized = planName.toLowerCase().trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Validate plan name against database constraints
 * @param {string} planName - Plan name to validate
 * @returns {boolean} - True if valid for profiles table
 */
function isValidProfilePlan(planName) {
  const allowedPlans = ['free', 'plus', 'pro'];
  return allowedPlans.includes(planName?.toLowerCase());
}

/**
 * Safe plan name update for profiles table
 * Ensures the plan name is properly normalized before database update
 * @param {string} planName - Plan name from any source
 * @returns {string} - Safe plan name for profiles table
 */
function safePlanNameForProfile(planName) {
  const normalized = normalizePlanName(planName);
  
  if (!isValidProfilePlan(normalized)) {
    logger.error(`Plan name "${planName}" is not valid for profiles table. Using "free" as fallback.`);
    return 'free';
  }
  
  return normalized;
}

module.exports = {
  normalizePlanName,
  capitalizePlanName,
  isValidProfilePlan,
  safePlanNameForProfile
};