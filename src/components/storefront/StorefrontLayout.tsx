import { Outlet, useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Loader2 } from 'lucide-react';
import { CartProvider } from '@/contexts/CartContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { useTenantCanonicalDomain } from '@/hooks/useTenantCanonicalDomain';
import { isAppDomain, getPlatformSubdomainUrl } from '@/lib/canonicalDomainService';
import { useEffect, useState } from 'react';

/**
 * Check if we need to redirect to the canonical domain
 * This handles the case when users access storefront via app.comandocentral.com.br
 */
function useCanonicalRedirect(
  tenantSlug: string | undefined,
  customDomain: string | null,
  isPreview: boolean,
  isReady: boolean
) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  useEffect(() => {
    // Don't redirect in preview mode or if not ready
    if (isPreview || !isReady || !tenantSlug) return;
    
    const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');
    
    // If we're on app.comandocentral.com.br or lovable.app accessing storefront,
    // redirect to the canonical domain
    if (isAppDomain(currentHost)) {
      // Determine canonical URL
      const canonicalOrigin = customDomain 
        ? `https://${customDomain}` 
        : getPlatformSubdomainUrl(tenantSlug);
      
      // Build redirect URL (keep path and search, remove preview params)
      const cleanParams = new URLSearchParams(window.location.search);
      cleanParams.delete('preview');
      cleanParams.delete('previewId');
      cleanParams.delete('draft');
      const queryString = cleanParams.toString();
      
      const redirectUrl = `${canonicalOrigin}${window.location.pathname}${queryString ? `?${queryString}` : ''}`;
      
      console.log(`[StorefrontLayout] Redirecting from ${currentHost} to canonical: ${redirectUrl}`);
      setIsRedirecting(true);
      window.location.replace(redirectUrl);
    }
  }, [tenantSlug, customDomain, isPreview, isReady]);
  
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
