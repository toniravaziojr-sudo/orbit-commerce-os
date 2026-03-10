import React, { Suspense, lazy } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
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
/**
 * StorefrontLayout - Used for /store/:tenantSlug routes (legacy/app domain)
 * This layout is ONLY used when accessed via the app domain or fallback origin.
 * No redirects are performed here - routing is handled by App.tsx.
 * OPTIMIZED: Uses customDomain from bootstrap (no separate useTenantCanonicalDomain query)
 */
export function StorefrontLayout() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { tenant, storeSettings, isLoading, isPublished, customDomain, template: bootstrapTemplate } = usePublicStorefront(tenantSlug || '');

  // Check for preview mode
  const searchParams = new URLSearchParams(window.location.search);
  const isPreview = searchParams.get('preview') === '1';

  // CartProvider and DiscountProvider wrap EVERYTHING to persist state across navigation
  return (
    <CartProvider tenantSlug={tenantSlug || ''}>
      <DiscountProvider>
        <MiniCartProvider>
          <StorefrontLayoutContent
            tenant={tenant}
            tenantSlug={tenantSlug || ''}
            storeSettings={storeSettings}
            customDomain={customDomain}
            bootstrapTemplate={bootstrapTemplate}
            isLoading={isLoading}
            isPublished={isPublished}
            isPreview={isPreview}
          />
        </MiniCartProvider>
      </DiscountProvider>
    </CartProvider>
  );
}

// Inner component to handle loading/error states while keeping CartProvider always mounted
function StorefrontLayoutContent({
  tenant,
  tenantSlug,
  storeSettings,
  customDomain,
  bootstrapTemplate,
  isLoading,
  isPublished,
  isPreview,
}: {
  tenant: any;
  tenantSlug: string;
  storeSettings: any;
  customDomain: string | null;
  bootstrapTemplate: any;
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

  const DomainDisabledGuard = lazy(() => import('./DomainDisabledGuard'));
  const SupportChatWidget = lazy(() => import('./SupportChatWidget').then(m => ({ default: m.SupportChatWidget })));
  const NewsletterPopupLoader = lazy(() => import('./NewsletterPopupLoader').then(m => ({ default: m.NewsletterPopupLoader })));

  return (
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
                <Outlet />
              </main>
              <LayoutMiniCartDrawer tenantSlug={tenantSlug} isPreview={isPreview} />
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
  );
}

// Single MiniCartDrawer instance for the entire storefront
function LayoutMiniCartDrawer({ tenantSlug, isPreview }: { tenantSlug: string; isPreview: boolean }) {
  const { isOpen, setOpen } = useMiniCart();
  return (
    <MiniCartDrawer
      open={isOpen}
      onOpenChange={setOpen}
      tenantSlug={tenantSlug}
      isPreview={isPreview}
    />
  );
}
