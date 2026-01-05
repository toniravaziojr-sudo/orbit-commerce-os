/**
 * Feature Access Configuration
 * 
 * Defines which features are available for each tenant plan.
 * Default behavior: if a feature is NOT in this config, it's allowed (for backwards compatibility).
 */

export type TenantPlan = 'start' | 'growth' | 'scale' | 'enterprise' | 'unlimited';

export interface FeatureConfig {
  /** Minimum plan required to access this feature */
  minPlan?: TenantPlan;
  /** Specific plans that can access this feature (overrides minPlan) */
  allowedPlans?: TenantPlan[];
  /** Feature description for documentation */
  description?: string;
}

/**
 * Plan hierarchy levels for comparison
 * Higher number = more access
 */
export const PLAN_LEVELS: Record<TenantPlan, number> = {
  start: 1,
  growth: 2,
  scale: 3,
  enterprise: 4,
  unlimited: 5,
};

/**
 * Get numeric level for a plan
 */
export function planLevel(plan: TenantPlan): number {
  return PLAN_LEVELS[plan] ?? 1;
}

/**
 * Check if plan A has at least the same level as plan B
 */
export function hasMinimumPlan(currentPlan: TenantPlan, requiredPlan: TenantPlan): boolean {
  return planLevel(currentPlan) >= planLevel(requiredPlan);
}

/**
 * Feature configuration map
 * 
 * IMPORTANT: Features NOT listed here are allowed by default.
 * Only add features here when you want to restrict them.
 * 
 * This is initially empty - add features as needed when implementing plan restrictions.
 */
export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  // Example configurations (commented out, add as needed):
  // 
  // 'fiscal': {
  //   minPlan: 'enterprise',
  //   description: 'Módulo fiscal para emissão de NF-e',
  // },
  // 
  // 'whatsapp': {
  //   minPlan: 'enterprise',
  //   description: 'Integração com WhatsApp Business',
  // },
  // 
  // 'advanced_reports': {
  //   minPlan: 'scale',
  //   description: 'Relatórios avançados e analytics',
  // },
  // 
  // 'automations': {
  //   minPlan: 'scale',
  //   description: 'Automações de marketing e operações',
  // },
  // 
  // 'multi_users': {
  //   allowedPlans: ['enterprise', 'unlimited'],
  //   description: 'Múltiplos usuários por tenant',
  // },
};

/**
 * Check if a feature is allowed for a given plan
 * 
 * @param featureKey - The feature identifier
 * @param plan - The tenant's plan
 * @param isUnlimited - Whether the tenant has unlimited access
 * @returns true if the feature is allowed
 */
export function isFeatureAllowed(
  featureKey: string, 
  plan: TenantPlan, 
  isUnlimited: boolean = false
): boolean {
  // Unlimited tenants have access to all customer features
  if (isUnlimited) {
    return true;
  }

  const config = FEATURE_CONFIG[featureKey];
  
  // If feature is not configured, allow by default (backwards compatibility)
  if (!config) {
    return true;
  }

  // Check specific allowed plans first
  if (config.allowedPlans) {
    return config.allowedPlans.includes(plan);
  }

  // Check minimum plan requirement
  if (config.minPlan) {
    return hasMinimumPlan(plan, config.minPlan);
  }

  // No restrictions defined, allow
  return true;
}

/**
 * Platform admin features - these are NEVER shown to customers
 */
export const PLATFORM_ADMIN_FEATURES = [
  'health_monitor',
  'platform_integrations',
  'block_suggestions',
] as const;

export type PlatformAdminFeature = typeof PLATFORM_ADMIN_FEATURES[number];
