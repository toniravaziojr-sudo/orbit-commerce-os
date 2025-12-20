// =============================================
// USE TENANT SLUG - Smart hook that gets tenantSlug from URL params or hostname context
// =============================================

import { useParams } from 'react-router-dom';
import { useTenantSlugFromContext } from '@/components/storefront/TenantStorefrontLayout';

/**
 * Get the tenant slug from URL params (legacy) or from context (custom/platform domain)
 * Use this hook in all storefront page components instead of useParams directly
 */
export function useTenantSlug(): string {
  const { tenantSlug: paramSlug } = useParams<{ tenantSlug: string }>();
  const contextSlug = useTenantSlugFromContext();
  
  // Prefer URL param if available (legacy mode), otherwise use context (custom domain mode)
  return paramSlug || contextSlug || '';
}
