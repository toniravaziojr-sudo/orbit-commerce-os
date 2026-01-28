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

  // Build checkout header config with INDEPENDENT props
  // Visual props (colors) are only inherited if NOT set in checkout config
  const checkoutHeaderConfig = useMemo((): BlockNode => {
    const globalHeaderProps = globalLayout?.header_config?.props || {};
    const checkoutHeaderProps = globalLayout?.checkout_header_config?.props || {};
    
    // Build merged props: global visual props as fallback, checkout props as priority
    // This means: if checkout has a color set, use it; otherwise fall back to global
    const mergedProps: Record<string, unknown> = {};
    
    // List of visual/styling props that can be inherited from global
    const visualProps = ['headerBgColor', 'headerTextColor', 'logoUrl', 'mobileLogoUrl', 'logoWidth', 'logoHeight'];
    
    // First pass: inherit visual props from global (as fallback only)
    for (const key of visualProps) {
      if (globalHeaderProps[key] !== undefined && globalHeaderProps[key] !== '') {
        mergedProps[key] = globalHeaderProps[key];
      }
    }
    
    // Apply checkout defaults
    mergedProps.showSearch = false;
    mergedProps.showCart = true;
    mergedProps.showHeaderMenu = false;
    mergedProps.customerAreaEnabled = false;
    mergedProps.sticky = true;
    mergedProps.featuredPromosEnabled = false;
    
    // Second pass: override with ALL checkout-specific props (these take full priority)
    for (const [key, value] of Object.entries(checkoutHeaderProps)) {
      // Only override if value is explicitly set (not undefined)
      if (value !== undefined) {
        mergedProps[key] = value;
      }
    }
    
    return {
      id: 'checkout-header',
      type: 'Header',
      props: mergedProps,
    };
  }, [globalLayout?.header_config?.props, globalLayout?.checkout_header_config?.props]);

  const checkoutFooterConfig = useMemo((): BlockNode => {
    const globalFooterProps = globalLayout?.footer_config?.props || {};
    const checkoutFooterProps = globalLayout?.checkout_footer_config?.props || {};
    
    // Build merged props: global visual props as fallback, checkout props as priority
    const mergedProps: Record<string, unknown> = {};
    
    // List of visual/styling props that can be inherited from global
    const visualProps = ['footerBgColor', 'footerTextColor', 'footerTitlesColor', 'logoUrl'];
    
    // First pass: inherit visual props from global (as fallback only)
    for (const key of visualProps) {
      if (globalFooterProps[key] !== undefined && globalFooterProps[key] !== '') {
        mergedProps[key] = globalFooterProps[key];
      }
    }
    
    // Apply checkout defaults
    mergedProps.menuId = '';
    mergedProps.showSocial = false;
    mergedProps.showNewsletterSection = false;
    mergedProps.showFooter1 = false;
    mergedProps.showFooter2 = false;
    mergedProps.showSac = false;
    mergedProps.showLogo = true;
    mergedProps.showStoreInfo = false;
    mergedProps.showCopyright = true;
    
    // Second pass: override with ALL checkout-specific props (these take full priority)
    for (const [key, value] of Object.entries(checkoutFooterProps)) {
      // Only override if value is explicitly set (not undefined)
      if (value !== undefined) {
        mergedProps[key] = value;
      }
    }
    
    return {
      id: 'checkout-footer',
      type: 'Footer',
      props: mergedProps,
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
