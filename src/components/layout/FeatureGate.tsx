import { ReactNode } from 'react';
import { useTenantAccess } from '@/hooks/useTenantAccess';
import { useAllModuleAccess } from '@/hooks/useModuleAccess';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  /** Feature key to check access for */
  feature: string;
  /** Optional module key to check blocked_features within */
  moduleKey?: string;
  /** Content to render if feature is accessible */
  children: ReactNode;
  /** Optional fallback content if feature is not accessible */
  fallback?: ReactNode;
  /** 
   * Show upgrade CTA when blocked instead of hiding
   * @default false
   */
  showUpgradeCTA?: boolean;
  /** Feature name for upgrade prompt */
  featureName?: string;
}

/**
 * Gate component that only renders children if the current tenant
 * has access to the specified feature.
 * 
 * Access is determined by:
 * 1. Module blocked_features in plan_module_access table (if moduleKey provided)
 * 2. Feature overrides in tenant_feature_overrides table
 * 3. Plan-based access from FEATURE_CONFIG
 * 4. Default: allow if feature not configured (backwards compatibility)
 * 
 * Special cases:
 * - Unlimited/special tenants: always have access to all customer features
 * - Platform tenants: use PlatformAdminGate instead
 * 
 * Usage:
 * ```tsx
 * // Simple feature check
 * <FeatureGate feature="fiscal">
 *   <FiscalModule />
 * </FeatureGate>
 * 
 * // Check blocked_features within a module
 * <FeatureGate feature="export_orders" moduleKey="ecommerce">
 *   <ExportButton />
 * </FeatureGate>
 * ```
 * 
 * With upgrade CTA:
 * ```tsx
 * <FeatureGate feature="whatsapp" showUpgradeCTA featureName="WhatsApp">
 *   <WhatsAppIntegration />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({ 
  feature, 
  moduleKey,
  children, 
  fallback = null,
  showUpgradeCTA = false,
  featureName,
}: FeatureGateProps) {
  const { canAccess, isLoading: tenantAccessLoading, isUnlimited, isPlatform } = useTenantAccess();
  const { data: moduleAccess, isLoading: moduleAccessLoading } = useAllModuleAccess();
  const navigate = useNavigate();

  const isLoading = tenantAccessLoading || moduleAccessLoading;

  // While loading, render nothing to avoid flash
  if (isLoading) {
    return null;
  }

  // Unlimited/platform tenants have full access
  if (isUnlimited || isPlatform) {
    return <>{children}</>;
  }

  // Check if feature is blocked
  let isBlocked = false;

  // First check module-specific blocked_features
  if (moduleKey && moduleAccess) {
    const access = moduleAccess[moduleKey];
    if (access?.blockedFeatures?.includes(feature)) {
      isBlocked = true;
    }
    if (access?.blockedFeatures?.includes('*')) {
      isBlocked = true;
    }
    if (access?.accessLevel === 'none') {
      isBlocked = true;
    }
  }

  // Also check feature overrides and FEATURE_CONFIG via canAccess
  if (!isBlocked && !canAccess(feature)) {
    isBlocked = true;
  }

  // If blocked by feature key as module (e.g., export_orders could be module key)
  if (!isBlocked && moduleAccess?.[feature]) {
    const directAccess = moduleAccess[feature];
    if (directAccess.accessLevel === 'none' || directAccess.blockedFeatures?.includes('*')) {
      isBlocked = true;
    }
  }

  // Check common module mappings for features without explicit moduleKey
  if (!isBlocked && !moduleKey && moduleAccess) {
    // Map feature to known module
    const featureModuleMap: Record<string, string> = {
      'export_orders': 'ecommerce',
      'export_customers': 'ecommerce',
      'whatsapp_notifications': 'crm',
      'support_chat': 'crm',
      'support_whatsapp': 'crm',
      'emails': 'crm',
      'ai_campaigns': 'blog',
      'attribution': 'marketing_basico',
      'email_marketing': 'marketing_avancado',
      'quizzes': 'marketing_avancado',
      'remessas': 'erp_logistica',
      'frete_personalizado': 'erp_logistica',
      'conversao_carrinho': 'erp_logistica',
      'templates': 'loja_online',
      'mercadolivre': 'marketplaces',
      'shopee': 'marketplaces',
      'amazon': 'marketplaces',
      'influencers': 'parcerias',
      'reports': 'central',
      'analytics': 'central',
      'agenda': 'central',
      'assistant': 'central',
      'pagseguro': 'sistema_integracoes',
      'pix_proprio': 'sistema_integracoes',
      'meta': 'sistema_integracoes',
      'tiktok': 'sistema_integracoes',
    };

    const mappedModule = featureModuleMap[feature];
    if (mappedModule) {
      const access = moduleAccess[mappedModule];
      if (access?.blockedFeatures?.includes(feature)) {
        isBlocked = true;
      }
      if (access?.blockedFeatures?.includes('*')) {
        isBlocked = true;
      }
      if (access?.accessLevel === 'none') {
        isBlocked = true;
      }
    }
  }

  if (isBlocked) {
    // If showUpgradeCTA, show inline upgrade prompt
    if (showUpgradeCTA) {
      return (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-dashed">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{featureName || feature}</p>
              <p className="text-sm text-muted-foreground">
                Funcionalidade disponível em planos superiores
              </p>
            </div>
          </div>
          <Button onClick={() => navigate('/settings/billing')} size="sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Fazer Upgrade
          </Button>
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
