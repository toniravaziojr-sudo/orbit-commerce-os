// =============================================
// TENANT STOREFRONT LAYOUT
// Wrapper for storefront when accessed via custom domain or platform subdomain
// Resolves tenant from hostname instead of URL param
// =============================================

import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
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

/**
 * Resolve tenant from current hostname
 */
function useTenantFromHostname() {
  const hostname = typeof window !== 'undefined' 
    ? window.location.hostname.toLowerCase().replace(/^www\./, '') 
    : '';
  
  return useQuery({
    queryKey: ['resolve-tenant-hostname', hostname],
    queryFn: async () => {
      if (!hostname) return null;
      
      // If on platform subdomain, extract tenant slug directly
      if (isPlatformSubdomain(hostname)) {
        const slug = extractTenantFromPlatformSubdomain(hostname);
        if (slug) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('id, slug')
            .eq('slug', slug)
            .single();
          return tenant;
        }
      }
      
      // If on app domain or fallback origin, we shouldn't be here
      if (isAppDomain(hostname)) {
        return null;
      }
      
      const fallbackHost = new URL(SAAS_CONFIG.fallbackOrigin).hostname;
      if (hostname === fallbackHost) {
        return null;
      }
      
      // Try to resolve as custom domain
      const { data: domainRecord } = await supabase
        .from('tenant_domains')
        .select('tenant_id, tenants!inner(id, slug)')
        .eq('domain', hostname)
        .eq('status', 'verified')
        .eq('ssl_status', 'active')
        .maybeSingle();
      
      if (domainRecord?.tenants) {
        return domainRecord.tenants as { id: string; slug: string };
      }
      
      return null;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!hostname && !isAppDomain(hostname),
  });
}

export function TenantStorefrontLayout() {
  const { data: tenant, isLoading: isTenantLoading, error } = useTenantFromHostname();
  const tenantSlug = tenant?.slug || '';
  
  const { tenant: storefrontTenant, storeSettings, isLoading: isStoreLoading, isPublished } = 
    usePublicStorefront(tenantSlug);
  
  const { domain: customDomain, isLoading: isDomainLoading } = 
    useTenantCanonicalDomain(tenant?.id);

  // Check for preview mode
  const searchParams = new URLSearchParams(window.location.search);
  const isPreview = searchParams.get('preview') === '1';

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

// Context to provide tenantSlug to child components when not in URL
import { createContext, useContext } from 'react';

const TenantSlugContext = createContext<string>('');

export function useTenantSlugFromContext(): string {
  return useContext(TenantSlugContext);
}
