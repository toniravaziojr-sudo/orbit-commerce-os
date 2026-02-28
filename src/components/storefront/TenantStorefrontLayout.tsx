// =============================================
// TENANT STOREFRONT LAYOUT
// Wrapper for storefront when accessed via custom domain or platform subdomain
// Resolves tenant from hostname instead of URL param
// POLICY: "Domínio muda, tudo muda" - SEM REDIRECTS
// When custom domain is active, platform subdomain shows "domain disabled" page
// =============================================

import { createContext, useContext, Suspense, lazy } from 'react';
import { Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { CartProvider } from '@/contexts/CartContext';
import { DiscountProvider } from '@/contexts/DiscountContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { MarketingTrackerProvider } from '@/components/storefront/MarketingTrackerProvider';
import { useTenantCanonicalDomain } from '@/hooks/useTenantCanonicalDomain';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { StorefrontHead } from '@/components/storefront/StorefrontHead';
import { LcpPreloader } from '@/components/storefront/LcpPreloader';
import { StorefrontThemeInjector } from '@/components/storefront/StorefrontThemeInjector';
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

  // NO REDIRECTS - DomainDisabledGuard handles showing "domain disabled" page
  // when accessing .shops subdomain while custom domain is active

  // Show loading while resolving tenant
  if (isTenantLoading || isStoreLoading || isDomainLoading) {
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

  // Lazy load components
  const DomainDisabledGuard = lazy(() => import('./DomainDisabledGuard'));
  const SupportChatWidget = lazy(() => import('./SupportChatWidget').then(m => ({ default: m.SupportChatWidget })));
  const NewsletterPopupLoader = lazy(() => import('./NewsletterPopupLoader').then(m => ({ default: m.NewsletterPopupLoader })));

  return (
    <CartProvider tenantSlug={tenantSlug}>
      <DiscountProvider>
        <StorefrontConfigProvider tenantId={tenant.id} customDomain={customDomain}>
          <MarketingTrackerProvider tenantId={tenant.id}>
            <StorefrontHead tenantId={tenant.id} />
            <LcpPreloader tenantId={tenant.id} />
            <StorefrontThemeInjector tenantSlug={tenantSlug} />
            <Suspense fallback={null}>
              <DomainDisabledGuard tenantSlug={tenantSlug}>
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
                  <Suspense fallback={null}>
                    <SupportChatWidget />
                  </Suspense>
                  <Suspense fallback={null}>
                    <NewsletterPopupLoader tenantId={tenant.id} />
                  </Suspense>
                </div>
              </DomainDisabledGuard>
            </Suspense>
          </MarketingTrackerProvider>
        </StorefrontConfigProvider>
      </DiscountProvider>
    </CartProvider>
  );
}
