// =============================================
// TENANT STOREFRONT LAYOUT
// v2.0.0: Unified resolve-domain + bootstrap in single Edge Function call
// Resolves tenant from hostname via storefront-bootstrap directly
// POLICY: "Domínio muda, tudo muda" - SEM REDIRECTS
// =============================================

import { createContext, useContext, Suspense, lazy, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { CartProvider } from '@/contexts/CartContext';
import { DiscountProvider } from '@/contexts/DiscountContext';
import { StorefrontConfigProvider } from '@/contexts/StorefrontConfigContext';
import { MiniCartProvider, useMiniCart } from '@/contexts/MiniCartContext';
import { MiniCartDrawer } from '@/components/storefront/MiniCartDrawer';
import { MarketingTrackerProvider } from '@/components/storefront/MarketingTrackerProvider';
import { StorefrontHead } from '@/components/storefront/StorefrontHead';
import { LcpPreloader } from '@/components/storefront/LcpPreloader';
import { StorefrontThemeInjector } from '@/components/storefront/StorefrontThemeInjector';
import { isAppDomain } from '@/lib/canonicalDomainService';
import { useStorefrontBootstrapByHostname } from '@/hooks/useStorefrontBootstrap';
import { parseSocialCustom } from '@/hooks/useStorefront';

// Context to provide tenantSlug to child components when not in URL
export const TenantSlugContext = createContext<string>('');

export function useTenantSlugFromContext(): string {
  return useContext(TenantSlugContext);
}

export function TenantStorefrontLayout() {
  // Get hostname once
  const hostname = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const h = window.location.hostname.toLowerCase().replace(/^www\./, '');
    if (isAppDomain(h)) return undefined;
    return h;
  }, []);

  // Single call: resolves domain + fetches all bootstrap data
  const { data: bootstrap, isLoading, error } = useStorefrontBootstrapByHostname(hostname);

  const tenant = bootstrap?.tenant || null;
  const tenantSlug = tenant?.slug || '';
  const storeSettings = bootstrap?.store_settings
    ? { ...bootstrap.store_settings, social_custom: parseSocialCustom(bootstrap.store_settings.social_custom) }
    : null;
  const customDomain = bootstrap?.custom_domain || null;
  const isPublished = bootstrap?.is_published ?? false;
  const bootstrapTemplate = bootstrap?.template || null;

  // Check for preview mode
  const searchParams = new URLSearchParams(window.location.search);
  const isPreview = searchParams.get('preview') === '1';

  // Show loading while resolving
  if (isLoading) {
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
            <StorefrontHead tenantId={tenant.id} storeSettings={storeSettings} />
            <LcpPreloader tenantId={tenant.id} bootstrapTemplate={bootstrapTemplate} />
            <StorefrontThemeInjector tenantSlug={tenantSlug} bootstrapTemplate={bootstrapTemplate} />
            <Suspense fallback={null}>
              <DomainDisabledGuard tenantSlug={tenantSlug}>
                <div className="min-h-screen flex flex-col bg-white">
                  {isPreview && (
                    <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
                      Modo de pré-visualização - Esta página não está publicada
                    </div>
                  )}
                  <main className="flex-1">
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
