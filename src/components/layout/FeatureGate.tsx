import { ReactNode } from 'react';
import { useTenantAccess } from '@/hooks/useTenantAccess';

interface FeatureGateProps {
  /** Feature key to check access for */
  feature: string;
  /** Content to render if feature is accessible */
  children: ReactNode;
  /** Optional fallback content if feature is not accessible */
  fallback?: ReactNode;
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
 * With fallback:
 * ```tsx
 * <FeatureGate feature="whatsapp" fallback={<UpgradePrompt />}>
 *   <WhatsAppIntegration />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({ 
  feature, 
  children, 
  fallback = null,
}: FeatureGateProps) {
  const { canAccess, isLoading } = useTenantAccess();

  // While loading, render nothing to avoid flash
  if (isLoading) {
    return null;
  }

  // Check if feature is accessible
  if (!canAccess(feature)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
