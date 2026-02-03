// =============================================
// AI LANDING PAGE URL - Hook to get the public URL for AI Landing Pages
// Uses tenant's primary domain (custom or platform subdomain)
// =============================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SAAS_CONFIG } from '@/lib/canonicalDomainService';

interface UseAILandingPageUrlOptions {
  tenantId?: string;
  tenantSlug?: string;
  lpSlug?: string;
}

interface AILandingPageUrlResult {
  /** Full public URL for the landing page */
  publicUrl: string | null;
  /** Base URL (domain only) */
  baseUrl: string | null;
  /** Whether loading domain info */
  isLoading: boolean;
  /** The primary domain (custom or platform subdomain) */
  primaryDomain: string | null;
}

/**
 * Hook to get the correct public URL for an AI Landing Page
 * Resolves the tenant's primary domain (custom domain or platform subdomain)
 * and builds the full /ai-lp/{slug} URL
 */
export function useAILandingPageUrl({
  tenantId,
  tenantSlug,
  lpSlug,
}: UseAILandingPageUrlOptions): AILandingPageUrlResult {
  // Fetch the tenant's primary domain
  const { data: primaryDomain, isLoading } = useQuery({
    queryKey: ['tenant-primary-domain', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      // Try to get a verified custom domain first
      const { data, error } = await supabase
        .from('tenant_domains')
        .select('domain')
        .eq('tenant_id', tenantId)
        .eq('is_primary', true)
        .eq('status', 'verified')
        .maybeSingle();

      if (error) {
        console.error('[useAILandingPageUrl] Error fetching domain:', error);
        return null;
      }

      return data?.domain || null;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Build the URLs
  const { baseUrl, publicUrl } = useMemo(() => {
    // Priority: Custom domain > Platform subdomain > App domain fallback
    let base: string;

    if (primaryDomain) {
      // Use the verified custom domain
      base = `https://${primaryDomain}`;
    } else if (tenantSlug) {
      // Use the platform subdomain
      base = `https://${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}`;
    } else {
      // Fallback (shouldn't happen in normal use)
      return { baseUrl: null, publicUrl: null };
    }

    const fullUrl = lpSlug ? `${base}/ai-lp/${lpSlug}` : null;

    return {
      baseUrl: base,
      publicUrl: fullUrl,
    };
  }, [primaryDomain, tenantSlug, lpSlug]);

  return {
    publicUrl,
    baseUrl,
    isLoading,
    primaryDomain,
  };
}

/**
 * Synchronous helper to build AI Landing Page URL
 * Use when you already have the domain info
 */
export function buildAILandingPageUrl(
  lpSlug: string,
  primaryDomain: string | null,
  tenantSlug: string
): string {
  if (primaryDomain) {
    return `https://${primaryDomain}/ai-lp/${lpSlug}`;
  }
  return `https://${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}/ai-lp/${lpSlug}`;
}
