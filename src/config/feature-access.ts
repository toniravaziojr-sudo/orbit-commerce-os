/**
 * Feature Access Configuration
 * 
 * Defines which features are available for each tenant plan.
 * Default behavior: if a feature is NOT in this config, it's allowed (for backwards compatibility).
 * 
 * PLANOS (v2):
 * - basico_v2: Essencial, integrações limitadas
 * - medio_v2: CRM, Calendário, Agenda, Marketplaces, WhatsApp
 * - completo_v2: Tudo liberado
 */

export type TenantPlan = 'basico_v2' | 'medio_v2' | 'completo_v2' | 'start' | 'growth' | 'scale' | 'enterprise' | 'unlimited';

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
  basico_v2: 2,
  growth: 3,
  medio_v2: 4,
  scale: 5,
  completo_v2: 6,
  enterprise: 7,
  unlimited: 8,
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
 * Features NOT listed here are allowed by default.
 * 
 * Gating baseado nos 3 planos v2:
 * - basico_v2: módulos essenciais, integrações limitadas
 * - medio_v2: CRM, Calendário, Agenda, Marketplaces, WhatsApp, Atendimento
 * - completo_v2: Tudo
 */
export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  // === BLOQUEADOS NO BÁSICO, liberados a partir do Médio ===
  'crm_advanced': {
    minPlan: 'medio_v2',
    description: 'CRM completo (segmentação avançada, automações)',
  },
  'content_calendar': {
    minPlan: 'medio_v2',
    description: 'Calendário de conteúdos e publicações',
  },
  'agenda': {
    minPlan: 'medio_v2',
    description: 'Agenda de tarefas e compromissos',
  },
  'marketplaces': {
    minPlan: 'medio_v2',
    description: 'Integração com marketplaces',
  },
  'whatsapp': {
    minPlan: 'medio_v2',
    description: 'Integração WhatsApp Business + Atendimento',
  },
  'atendimento': {
    minPlan: 'medio_v2',
    description: 'Central de atendimento multicanal',
  },
  'social_publishing': {
    minPlan: 'medio_v2',
    description: 'Publicações Meta/Google/TikTok (além de pixel/CAPI)',
  },

  // === BLOQUEADOS NO BÁSICO E MÉDIO, só no Completo ===
  'marketing_advanced': {
    minPlan: 'completo_v2',
    description: 'Marketing avançado (automações, sequências, A/B)',
  },
  'content_hub': {
    minPlan: 'completo_v2',
    description: 'Central de conteúdo completa',
  },
  'command_assistant': {
    minPlan: 'completo_v2',
    description: 'Auxiliar de comando IA',
  },
  'partnerships': {
    minPlan: 'completo_v2',
    description: 'Parcerias e programa de afiliados',
  },
  'data_importer': {
    minPlan: 'completo_v2',
    description: 'Importador de dados em massa',
  },
  'financial': {
    minPlan: 'completo_v2',
    description: 'Módulo financeiro e compras',
  },
  'notifications_whatsapp': {
    minPlan: 'medio_v2',
    description: 'Notificações via WhatsApp (básico só email)',
  },
};

/**
 * Storage limits per plan (in bytes)
 */
export const PLAN_STORAGE_LIMITS: Record<string, number> = {
  basico_v2: 5 * 1024 * 1024 * 1024,    // 5 GB
  medio_v2: 10 * 1024 * 1024 * 1024,     // 10 GB
  completo_v2: 30 * 1024 * 1024 * 1024,  // 30 GB
};

/**
 * AI credits included per plan
 */
export const PLAN_AI_CREDITS: Record<string, number> = {
  basico_v2: 500,
  medio_v2: 1000,
  completo_v2: 2000,
};

/**
 * Order limits and overage pricing per plan
 */
export const PLAN_ORDER_CONFIG: Record<string, { limit: number; overageCents: number }> = {
  basico_v2: { limit: 300, overageCents: 100 },    // R$ 1,00/pedido extra
  medio_v2: { limit: 700, overageCents: 75 },      // R$ 0,75/pedido extra
  completo_v2: { limit: 2000, overageCents: 50 },  // R$ 0,50/pedido extra
};

/**
 * Check if a feature is allowed for a given plan
 */
export function isFeatureAllowed(
  featureKey: string, 
  plan: TenantPlan, 
  isUnlimited: boolean = false
): boolean {
  if (isUnlimited) return true;

  const config = FEATURE_CONFIG[featureKey];
  if (!config) return true;

  if (config.allowedPlans) {
    return config.allowedPlans.includes(plan);
  }

  if (config.minPlan) {
    return hasMinimumPlan(plan, config.minPlan);
  }

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
