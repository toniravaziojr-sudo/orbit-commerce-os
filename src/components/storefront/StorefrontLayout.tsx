import { Outlet, useParams, useLocation } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Loader2 } from 'lucide-react';
import { CartProvider } from '@/contexts/CartContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { useTenantCanonicalDomain } from '@/hooks/useTenantCanonicalDomain';
import { 
  isAppDomain, 
  getPlatformSubdomainUrl,
  isPlatformSubdomain,
  SAAS_CONFIG,
} from '@/lib/canonicalDomainService';
import { useEffect, useState } from 'react';

/**
 * Check if we need to redirect to the canonical domain
 * This handles:
 * 1. Users accessing storefront via app.comandocentral.com.br → redirect to tenant domain
 * 2. Users accessing /store/{slug}/... on tenant domain → redirect to clean path
 */
function useCanonicalRedirect(
  tenantSlug: string | undefined,
  customDomain: string | null,
  isPreview: boolean,
  isReady: boolean
) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const location = useLocation();
  
  useEffect(() => {
    // Don't redirect in preview mode or if not ready
    if (isPreview || !isReady || !tenantSlug) return;
    
    const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    const currentPath = location.pathname;
    
    // Determine if we're on a tenant-specific host (custom domain or platform subdomain)
    const isOnTenantHost = isPlatformSubdomain(currentHost) || (
      !isAppDomain(currentHost) && 
      currentHost !== new URL(SAAS_CONFIG.fallbackOrigin).hostname
    );
    
    // Case 1: On app domain → redirect to canonical tenant domain
    if (isAppDomain(currentHost)) {
      const canonicalOrigin = customDomain 
        ? `https://${customDomain}` 
        : getPlatformSubdomainUrl(tenantSlug);
      
      // Clean the path: remove /store/{tenantSlug} prefix
      let cleanPath = currentPath;
      const storePrefix = `/store/${tenantSlug}`;
      if (cleanPath.startsWith(storePrefix)) {
        cleanPath = cleanPath.slice(storePrefix.length) || '/';
      }
      
      const cleanParams = new URLSearchParams(window.location.search);
      cleanParams.delete('preview');
      cleanParams.delete('previewId');
      cleanParams.delete('draft');
      const queryString = cleanParams.toString();
      
      const redirectUrl = `${canonicalOrigin}${cleanPath}${queryString ? `?${queryString}` : ''}`;
      
      console.log(`[StorefrontLayout] Redirecting from app domain to canonical: ${redirectUrl}`);
      setIsRedirecting(true);
      window.location.replace(redirectUrl);
      return;
    }
    
    // Case 2: On tenant host but path still has /store/{slug} prefix → redirect to clean path
    if (isOnTenantHost) {
      const storePrefix = `/store/${tenantSlug}`;
      if (currentPath.startsWith(storePrefix)) {
        // Remove the /store/{slug} prefix
        const cleanPath = currentPath.slice(storePrefix.length) || '/';
        
        const cleanParams = new URLSearchParams(window.location.search);
        cleanParams.delete('preview');
        cleanParams.delete('previewId');
        cleanParams.delete('draft');
        const queryString = cleanParams.toString();
        
        const redirectUrl = `${cleanPath}${queryString ? `?${queryString}` : ''}`;
        
        console.log(`[StorefrontLayout] Cleaning path from ${currentPath} to ${redirectUrl}`);
        setIsRedirecting(true);
        window.location.replace(redirectUrl);
        return;
      }
    }
  }, [tenantSlug, customDomain, isPreview, isReady, location.pathname]);
  
  return isRedirecting;
}

export function StorefrontLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, storeSettings, isLoading, isPublished } = usePublicStorefront(tenantSlug || '');
  const { domain: customDomain, isLoading: isDomainLoading } = useTenantCanonicalDomain(tenant?.id);

  // Check for preview mode
  const searchParams = new URLSearchParams(window.location.search);
  const isPreview = searchParams.get('preview') === '1';

  // Check if we need to redirect to canonical domain
  const isRedirecting = useCanonicalRedirect(
    tenantSlug,
    customDomain,
    isPreview,
    !isLoading && !isDomainLoading && !!tenant
  );

  // Show loading while redirecting
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // CartProvider wraps EVERYTHING to persist state across navigation and loading states
  return (
    <CartProvider tenantSlug={tenantSlug || ''}>
      <StorefrontLayoutContent
        tenant={tenant}
        tenantSlug={tenantSlug || ''}
        customDomain={customDomain}
        isLoading={isLoading || isDomainLoading}
        isPublished={isPublished}
        isPreview={isPreview}
      />
    </CartProvider>
  );
}

// Inner component to handle loading/error states while keeping CartProvider always mounted
function StorefrontLayoutContent({
  tenant,
  tenantSlug,
  customDomain,
  isLoading,
  isPublished,
  isPreview,
}: {
  tenant: any;
  tenantSlug: string;
  customDomain: string | null;
  isLoading: boolean;
  isPublished: boolean;
  isPreview: boolean;
}) {
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Loja não encontrada</h1>
          <p className="text-gray-600">Verifique se o endereço está correto.</p>
        </div>
      </div>
    );
  }

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
    <StorefrontConfigProvider tenantId={tenant.id} customDomain={customDomain}>
      <div className="min-h-screen flex flex-col bg-white">
        {isPreview && (
          <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
            Modo de pré-visualização - Esta página não está publicada
          </div>
        )}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </StorefrontConfigProvider>
  );
}
