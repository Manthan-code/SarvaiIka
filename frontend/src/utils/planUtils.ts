/**
 * Plan utilities for consistent plan name handling in frontend
 * Ensures proper case conversion between plans table (capitalized) and profiles table (lowercase)
 */

/**
 * Normalize plan name for consistency with backend
 * @param planName - Plan name from any source (e.g., 'Free', 'Plus', 'Pro' or 'free', 'plus', 'pro')
 * @returns Normalized lowercase plan name (e.g., 'free', 'plus', 'pro')
 */
export function normalizePlanName(planName: string | undefined | null): string {
  if (!planName || typeof planName !== 'string') {
    console.warn('Invalid plan name provided to normalizePlanName:', planName);
    return 'free'; // Default fallback
  }
  
  const normalized = planName.toLowerCase().trim();
  
  // Validate against allowed values
  const allowedPlans = ['free', 'plus', 'pro'];
  if (!allowedPlans.includes(normalized)) {
    console.warn(`Invalid plan name "${planName}" normalized to "${normalized}". Using fallback "free".`);
    return 'free';
  }
  
  return normalized;
}

/**
 * Capitalize plan name for display purposes
 * @param planName - Lowercase plan name (e.g., 'free', 'plus', 'pro')
 * @returns Capitalized plan name (e.g., 'Free', 'Plus', 'Pro')
 */
export function capitalizePlanName(planName: string | undefined | null): string {
  if (!planName || typeof planName !== 'string') {
    return 'Free';
  }
  
  const normalized = planName.toLowerCase().trim();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

/**
 * Validate plan name against allowed values
 * @param planName - Plan name to validate
 * @returns True if valid plan name
 */
export function isValidPlan(planName: string | undefined | null): boolean {
  const allowedPlans = ['free', 'plus', 'pro'];
  return allowedPlans.includes(planName?.toLowerCase() || '');
}

/**
 * Safe plan name for frontend state management
 * Ensures the plan name is properly normalized
 * @param planName - Plan name from any source
 * @returns Safe plan name for frontend use
 */
export function safePlanName(planName: string | undefined | null): string {
  const normalized = normalizePlanName(planName);
  
  if (!isValidPlan(normalized)) {
    console.error(`Plan name "${planName}" is not valid. Using "free" as fallback.`);
    return 'free';
  }
  
  return normalized;
}

/**
 * Compare plan names safely (case-insensitive)
 * @param plan1 - First plan name
 * @param plan2 - Second plan name
 * @returns True if plans are the same
 */
export function comparePlans(plan1: string | undefined | null, plan2: string | undefined | null): boolean {
  return normalizePlanName(plan1) === normalizePlanName(plan2);
}

/**
 * Get plan order for comparison (free < plus < pro)
 * @param planName - Plan name
 * @returns Numeric order (0 = free, 1 = plus, 2 = pro)
 */
export function getPlanOrder(planName: string | undefined | null): number {
  const planOrder = { free: 0, plus: 1, pro: 2 };
  const normalized = normalizePlanName(planName);
  return planOrder[normalized as keyof typeof planOrder] || 0;
}