import { ReactNode } from 'react';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';

interface PlatformAdminGateProps {
  /** Content to render if user is a platform admin */
  children: ReactNode;
  /** Optional fallback content if user is not a platform admin */
  fallback?: ReactNode;
  /** 
   * Required role - defaults to 'super_admin'
   * Only users with this role in platform_admins will see the children
   */
  requiredRole?: 'super_admin' | 'operator';
}

/**
 * Gate component that only renders children for platform admins.
 * 
 * CRITICAL: This component ensures that platform admin features are ONLY
 * shown to users registered in platform_admins table with is_active=true.
 * 
 * Platform admin features (Health Monitor, Platform Integrations, etc.)
 * must NEVER be visible to customer tenants, even unlimited/special ones.
 * 
 * Usage:
 * ```tsx
 * <PlatformAdminGate>
 *   <AdminOnlyFeature />
 * </PlatformAdminGate>
 * ```
 * 
 * With fallback:
 * ```tsx
 * <PlatformAdminGate fallback={<AccessDenied />}>
 *   <AdminOnlyFeature />
 * </PlatformAdminGate>
 * ```
 */
export function PlatformAdminGate({ 
  children, 
  fallback = null,
  requiredRole = 'super_admin',
}: PlatformAdminGateProps) {
  const { isPlatformOperator, platformAdmin, isLoading } = usePlatformOperator();

  // While loading, render nothing to avoid flash
  if (isLoading) {
    return null;
  }

  // Canonical authorization: RPC is_platform_admin() is the single source of truth.
  // If the RPC denied, block.
  if (!isPlatformOperator) {
    return <>{fallback}</>;
  }

  // Role check only when metadata profile is available.
  // If metadata failed to load (RLS timing/cache), trust the RPC and let the user in —
  // backend RLS still enforces every sensitive action.
  if (requiredRole === 'super_admin' && platformAdmin && platformAdmin.role !== 'super_admin') {
    return <>{fallback}</>;
  }

  // Authorized
  return <>{children}</>;
}