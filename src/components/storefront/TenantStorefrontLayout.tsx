// =============================================
// TENANT STOREFRONT LAYOUT
// Wrapper for storefront when accessed via custom domain or platform subdomain
// Resolves tenant from hostname instead of URL param
// Handles canonical redirects (301) to primary public host
// =============================================

import { useEffect, createContext, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { CartProvider } from '@/contexts/CartContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { useTenantCanonicalDomain } from '@/hooks/useTenantCanonicalDomain';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { 
  isPlatformSubdomain, 
  extractTenantFromPlatformSubdomain,
  isAppDomain,
  SAAS_CONFIG,
} from '@/lib/canonicalDomainService';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// Context to provide tenantSlug to child components when not in URL
const TenantSlugContext = createContext<string>('');

export function useTenantSlugFromContext(): string {
  return useContext(TenantSlugContext);
}

interface ResolveResult {
  tenant: { id: string; slug: string };
  primaryPublicHost: string;
  canonicalOrigin: string;
  shouldRedirect: boolean;
}

/**
 * Resolve tenant from current hostname and determine if redirect is needed
 */
function useTenantFromHostname(): { data: ResolveResult | null; isLoading: boolean; error: Error | null } {
  const hostname = typeof window !== 'undefined' 
    ? window.location.hostname.toLowerCase().replace(/^www\./, '') 
    : '';
  
  return useQuery({
    queryKey: ['resolve-tenant-hostname', hostname],
    queryFn: async (): Promise<ResolveResult | null> => {
      if (!hostname) return null;
      
      // If on app domain or fallback origin, we shouldn't be here (handled by App.tsx)
      if (isAppDomain(hostname)) {
        return null;
      }
      
      const fallbackHost = new URL(SAAS_CONFIG.fallbackOrigin).hostname;
      if (hostname === fallbackHost) {
        return null;
      }
      
      // Call resolve-domain edge function to get complete info
      const { data: resolveData, error: resolveError } = await supabase.functions.invoke('resolve-domain', {
        body: { hostname },
      });
      
      if (resolveError || !resolveData?.found) {
        // Try fallback: direct DB lookup for platform subdomain
        if (isPlatformSubdomain(hostname)) {
          const slug = extractTenantFromPlatformSubdomain(hostname);
          if (slug) {
            const { data: tenant } = await supabase
              .from('tenants')
              .select('id, slug')
              .eq('slug', slug)
              .single();
            
            if (tenant) {
              // Check for primary custom domain
              const { data: primaryDomain } = await supabase
                .from('tenant_domains')
                .select('domain')
                .eq('tenant_id', tenant.id)
                .eq('type', 'custom')
                .eq('is_primary', true)
                .eq('status', 'verified')
                .eq('ssl_status', 'active')
                .maybeSingle();
              
              const primaryHost = primaryDomain?.domain || hostname;
              const shouldRedirect = !!primaryDomain && hostname !== primaryDomain.domain;
              
              return {
                tenant,
                primaryPublicHost: primaryHost,
                canonicalOrigin: `https://${primaryHost}`,
                shouldRedirect,
              };
            }
          }
        }
        
        return null;
      }
      
      // Use resolve-domain response
      const tenant = {
        id: resolveData.tenant_id,
        slug: resolveData.tenant_slug,
      };
      
      const primaryHost = resolveData.primary_public_host || hostname;
      const shouldRedirect = hostname !== primaryHost;
      
      return {
        tenant,
        primaryPublicHost: primaryHost,
        canonicalOrigin: resolveData.canonical_origin || `https://${primaryHost}`,
        shouldRedirect,
      };
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    enabled: !!hostname && !isAppDomain(hostname),
  });
}

export function TenantStorefrontLayout() {
  const location = useLocation();
  const { data: resolveResult, isLoading: isTenantLoading, error } = useTenantFromHostname();
  
  const tenant = resolveResult?.tenant || null;
  const tenantSlug = tenant?.slug || '';
  
  const { tenant: storefrontTenant, storeSettings, isLoading: isStoreLoading, isPublished } = 
    usePublicStorefront(tenantSlug);
  
  const { domain: customDomain, isLoading: isDomainLoading } = 
    useTenantCanonicalDomain(tenant?.id);

  // Check for preview mode
  const searchParams = new URLSearchParams(window.location.search);
  const isPreview = searchParams.get('preview') === '1';

  // Handle canonical redirect (301) and path cleanup
  useEffect(() => {
    if (!resolveResult || isPreview) return;
    
    const currentPath = location.pathname;
    
    // Check if path has /store/{tenantSlug} prefix that needs to be cleaned
    const storePrefixMatch = currentPath.match(/^\/store\/[^/]+(.*)$/);
    const hasLegacyPrefix = !!storePrefixMatch;
    
    if (resolveResult.shouldRedirect || hasLegacyPrefix) {
      // Build redirect URL
      let cleanPath = currentPath;
      
      // Remove /store/{tenantSlug} prefix
      if (storePrefixMatch) {
        cleanPath = storePrefixMatch[1] || '/';
      }
      
      // Build clean query string (remove preview params)
      const params = new URLSearchParams(location.search);
      params.delete('preview');
      params.delete('previewId');
      params.delete('draft');
      const queryString = params.toString();
      
      const targetOrigin = resolveResult.shouldRedirect 
        ? resolveResult.canonicalOrigin 
        : window.location.origin;
      
      const redirectUrl = `${targetOrigin}${cleanPath}${queryString ? `?${queryString}` : ''}`;
      
      console.log(`[TenantStorefrontLayout] Redirecting to: ${redirectUrl}`);
      window.location.replace(redirectUrl);
    }
  }, [resolveResult, location.pathname, location.search, isPreview]);

  // Show loading while resolving tenant or redirecting
  if (isTenantLoading || isStoreLoading || isDomainLoading || (resolveResult?.shouldRedirect && !isPreview)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Error or no tenant found
  if (error || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loja não encontrada</h1>
          <p className="text-gray-600">Verifique se o endereço está correto.</p>
        </div>
      </div>
    );
  }

  // Store not published
  if (!isPublished && !isPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loja em construção</h1>
          <p className="text-gray-600">Esta loja ainda não está disponível para o público.</p>
        </div>
      </div>
    );
  }

  return (
    <CartProvider tenantSlug={tenantSlug}>
      <StorefrontConfigProvider tenantId={tenant.id} customDomain={customDomain}>
        <div className="min-h-screen flex flex-col bg-white">
          {isPreview && (
            <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
              Modo de pré-visualização - Esta página não está publicada
            </div>
          )}
          <main className="flex-1">
            {/* Pass tenantSlug via context since it's not in URL */}
            <TenantSlugContext.Provider value={tenantSlug}>
              <Outlet />
            </TenantSlugContext.Provider>
          </main>
        </div>
      </StorefrontConfigProvider>
    </CartProvider>
  );
}
