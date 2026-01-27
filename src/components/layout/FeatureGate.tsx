import { ReactNode } from 'react';
import { useTenantAccess } from '@/hooks/useTenantAccess';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  /** Feature key to check access for */
  feature: string;
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
 * 1. Feature overrides in tenant_feature_overrides table (highest priority)
 * 2. Plan-based access from FEATURE_CONFIG
 * 3. Default: allow if feature not configured (backwards compatibility)
 * 
 * Special cases:
 * - Unlimited/special tenants: always have access to all customer features
 * - Platform tenants: use PlatformAdminGate instead
 * 
 * Usage:
 * ```tsx
 * <FeatureGate feature="fiscal">
 *   <FiscalModule />
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
  children, 
  fallback = null,
  showUpgradeCTA = false,
  featureName,
}: FeatureGateProps) {
  const { canAccess, isLoading, plan } = useTenantAccess();
  const navigate = useNavigate();

  // While loading, render nothing to avoid flash
  if (isLoading) {
    return null;
  }

  // Check if feature is accessible
  if (!canAccess(feature)) {
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
          <Button onClick={() => navigate('/settings/plans')} size="sm">
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
