import { Outlet, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { Loader2 } from 'lucide-react';
import { CartProvider } from '@/contexts/CartContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { 
  useTenantCanonicalDomain, 
  isValidStorefrontHost,
  getCanonicalRedirectUrl,
} from '@/hooks/useTenantCanonicalDomain';
import { stripPreviewParams } from '@/lib/sanitizePublicUrl';

export function StorefrontLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, storeSettings, isLoading, isPublished } = usePublicStorefront(tenantSlug || '');
  const { domain: customDomain, isLoading: isDomainLoading } = useTenantCanonicalDomain(tenant?.id);

  // Check for preview mode
  const searchParams = new URLSearchParams(window.location.search);
  const isPreview = searchParams.get('preview') === '1';

  // Handle canonical redirect
  const [shouldRedirect, setShouldRedirect] = useState(false);

  useEffect(() => {
    // Don't redirect while still loading
    if (isLoading || isDomainLoading) return;
    
    // Don't redirect in preview mode (admin testing)
    if (isPreview) return;

    // Don't redirect if no tenant slug
    if (!tenantSlug) return;

    const currentHost = window.location.host;
    
    // Check if we're on a valid storefront host
    if (isValidStorefrontHost(currentHost, customDomain, tenantSlug)) {
      // We're on a valid host - check if we need to redirect to canonical
      const redirectUrl = getCanonicalRedirectUrl(
        currentHost,
        window.location.pathname + window.location.search,
        customDomain,
        tenantSlug
      );
      
      if (redirectUrl) {
        console.log('[StorefrontLayout] Redirecting to canonical domain:', redirectUrl);
        window.location.replace(redirectUrl);
        setShouldRedirect(true);
      }
    }
  }, [isLoading, isDomainLoading, customDomain, isPreview, tenantSlug]);

  // Show loading while redirecting
  if (shouldRedirect) {
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
