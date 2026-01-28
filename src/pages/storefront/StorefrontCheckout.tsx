// =============================================
// STOREFRONT CHECKOUT - Public checkout page
// =============================================
// SISTEMA: Esta página renderiza o CheckoutStepWizard com header/footer
// configuráveis exclusivos do checkout (checkout_header_config/checkout_footer_config).
// Configuração via Builder: ao clicar no header/footer no template de checkout.

import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicGlobalLayout } from '@/hooks/useGlobalLayoutIntegration';
import { CheckoutStepWizard } from '@/components/storefront/checkout/CheckoutStepWizard';
import { StorefrontHeaderContent } from '@/components/storefront/StorefrontHeaderContent';
import { StorefrontFooterContent } from '@/components/storefront/StorefrontFooterContent';
import { StorefrontThemeInjector } from '@/components/storefront/StorefrontThemeInjector';
import { Loader2 } from 'lucide-react';
import { isPreviewUrl } from '@/lib/sanitizePublicUrl';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import type { BlockNode } from '@/lib/builder/types';

export default function StorefrontCheckout() {
  const tenantSlug = useTenantSlug();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Redirect to public URL if accessing with preview param in public context
  useEffect(() => {
    if (isPreviewUrl(searchParams)) {
      // Remove preview params and redirect to clean URL
      const basePath = getStoreBaseUrl(tenantSlug || '');
      navigate(`${basePath}/checkout`, { replace: true });
    }
  }, [searchParams, tenantSlug, navigate]);

  const { tenant, storeSettings, isLoading } = usePublicStorefront(tenantSlug || '');
  const { data: globalLayout, isLoading: layoutLoading } = usePublicGlobalLayout(tenantSlug || '');

  // Merge: global visual props (colors) + checkout-specific functional props
  // This allows checkout to maintain brand consistency while having its own minimalist layout
  const checkoutHeaderConfig = useMemo((): BlockNode => {
    const globalHeaderProps = globalLayout?.header_config?.props || {};
    const checkoutHeaderProps = globalLayout?.checkout_header_config?.props || {};
    
    return {
      id: 'checkout-header',
      type: 'Header',
      props: {
        // First: inherit all global visual props (colors, background, styling)
        ...globalHeaderProps,
        // Then: apply checkout-specific defaults (minimal distractions)
        showSearch: false,
        showCart: true,
        showHeaderMenu: false,
        customerAreaEnabled: false,
        sticky: true,
        featuredPromosEnabled: false,
        // Finally: apply saved checkout config (user customizations take priority)
        ...checkoutHeaderProps,
      },
    };
  }, [globalLayout?.header_config?.props, globalLayout?.checkout_header_config?.props]);

  const checkoutFooterConfig = useMemo((): BlockNode => {
    const globalFooterProps = globalLayout?.footer_config?.props || {};
    const checkoutFooterProps = globalLayout?.checkout_footer_config?.props || {};
    
    return {
      id: 'checkout-footer',
      type: 'Footer',
      props: {
        // First: inherit all global visual props (colors, background, styling)
        ...globalFooterProps,
        // Then: apply checkout-specific defaults (minimal distractions)
        menuId: '',
        showSocial: false,
        showNewsletterSection: false,
        showFooter1: false,  // Hide menu columns
        showFooter2: false,  // Hide policy links
        showSac: false,      // Hide SAC/contact section
        showLogo: true,      // Keep logo for brand recognition
        showStoreInfo: false, // Hide legal info
        showCopyright: true,  // Keep copyright
        // Finally: apply saved checkout config (user customizations take priority)
        ...checkoutFooterProps,
      },
    };
  }, [globalLayout?.footer_config?.props, globalLayout?.checkout_footer_config?.props]);

  if (isLoading || layoutLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loja não encontrada</p>
      </div>
    );
  }

  return (
    <>
      {/* Inject theme CSS variables for buttons and text */}
      <StorefrontThemeInjector tenantSlug={tenantSlug || ''} />
      
      <div className="storefront-container min-h-screen flex flex-col">
        {/* Checkout header - uses checkout_header_config */}
      <StorefrontHeaderContent
        tenantSlug={tenantSlug || ''}
        headerConfig={checkoutHeaderConfig}
        isEditing={false}
      />

      {/* Main checkout content */}
      <main className="flex-1 bg-muted/30">
        <CheckoutStepWizard tenantId={tenant.id} />
      </main>

      {/* Checkout footer - uses checkout_footer_config */}
      <StorefrontFooterContent
        tenantSlug={tenantSlug || ''}
        footerConfig={checkoutFooterConfig}
        isEditing={false}
      />
      </div>
    </>
  );
}
