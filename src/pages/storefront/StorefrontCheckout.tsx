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
import { PageColorsInjector } from '@/components/storefront/PageColorsInjector';
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

  // Build checkout header config with ABSOLUTE PRIORITY for checkout props
  // Visual props (colors/logo) are inherited from global ONLY if NOT explicitly set in checkout
  const checkoutHeaderConfig = useMemo((): BlockNode => {
    const globalHeaderProps = globalLayout?.header_config?.props || {};
    const checkoutHeaderProps = globalLayout?.checkout_header_config?.props || {};
    
    // RULE: Checkout props have ABSOLUTE priority
    // Only inherit visual props that are NOT explicitly set in checkout
    const visualPropsToInherit = [
      'headerBgColor', 'headerTextColor', 'headerIconColor',
      'logoUrl', 'mobileLogoUrl', 'logoWidth', 'logoHeight',
      'logoSize' // Logo size setting
    ];
    
    const mergedProps: Record<string, unknown> = {};
    
    // Step 1: Inherit visual props from global ONLY if checkout doesn't have them
    for (const key of visualPropsToInherit) {
      // Check if checkout has this prop explicitly set (not undefined, not empty string)
      const checkoutValue = checkoutHeaderProps[key];
      if (checkoutValue === undefined || checkoutValue === '') {
        // Not set in checkout, inherit from global
        if (globalHeaderProps[key] !== undefined && globalHeaderProps[key] !== '') {
          mergedProps[key] = globalHeaderProps[key];
        }
      }
    }
    
    // Step 2: Apply ALL checkout-specific props (ABSOLUTE PRIORITY)
    // This includes both visual props AND functional toggles
    for (const [key, value] of Object.entries(checkoutHeaderProps)) {
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

  // Build checkout footer config with ABSOLUTE PRIORITY for checkout props
  const checkoutFooterConfig = useMemo((): BlockNode => {
    const globalFooterProps = globalLayout?.footer_config?.props || {};
    const checkoutFooterProps = globalLayout?.checkout_footer_config?.props || {};
    
    // Helper to check if a value is "empty" (undefined, null, empty string, or empty array)
    const isEmpty = (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') return true;
      if (Array.isArray(value) && value.length === 0) return true;
      // For objects like { items: [] }, check if items array is empty
      if (typeof value === 'object' && value !== null && 'items' in value) {
        const obj = value as { items?: unknown[] };
        if (Array.isArray(obj.items) && obj.items.length === 0) return true;
      }
      return false;
    };
    
    // Props that should be inherited from global when empty in checkout
    const propsToInherit = [
      'footerBgColor', 'footerTextColor', 'footerTitlesColor', 'logoUrl',
      // Inherit image sections (payment methods, security seals) if not set
      'paymentMethods', 'securitySeals', 'shippingMethods', 'officialStores',
      // Also inherit copyright text if not set
      'copyrightText',
      // Visual menu settings
      'menuVisualStyle', 'badgeSize'
    ];
    
    const mergedProps: Record<string, unknown> = {};
    
    // Step 1: Start with ALL checkout props that have values
    for (const [key, value] of Object.entries(checkoutFooterProps)) {
      // For inheritable props, only add if not empty
      if (propsToInherit.includes(key)) {
        if (!isEmpty(value)) {
          mergedProps[key] = value;
        }
      } else {
        // For non-inheritable props (toggles, etc), always use checkout value
        if (value !== undefined) {
          mergedProps[key] = value;
        }
      }
    }
    
    // Step 2: Fill in missing inheritable props from global
    for (const key of propsToInherit) {
      if (isEmpty(mergedProps[key])) {
        const globalValue = globalFooterProps[key];
        if (!isEmpty(globalValue)) {
          mergedProps[key] = globalValue;
        }
      }
    }
    
    // Step 3: Set default visibility toggles to TRUE when there's data
    // This ensures payment methods and security seals show by default when inherited
    if (mergedProps.showPaymentMethods === undefined && !isEmpty(mergedProps.paymentMethods)) {
      mergedProps.showPaymentMethods = true;
    }
    if (mergedProps.showSecuritySeals === undefined && !isEmpty(mergedProps.securitySeals)) {
      mergedProps.showSecuritySeals = true;
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

  // Extract icon color for CSS injection to timeline
  const checkoutIconColor = checkoutHeaderConfig.props?.headerIconColor as string | undefined;

  return (
    <>
      {/* Inject theme CSS variables for buttons and text */}
      <StorefrontThemeInjector tenantSlug={tenantSlug || ''} />
      
      {/* Inject page-specific color overrides (checkout custom colors) */}
      <PageColorsInjector tenantSlug={tenantSlug || ''} pageType="checkout" />
      
      {/* Inject checkout-specific accent color for timeline steps if icon color is set */}
      {checkoutIconColor && (
        <style dangerouslySetInnerHTML={{ __html: `
          .storefront-container {
            --theme-accent-color: ${checkoutIconColor};
          }
        `}} />
      )}
      
      <div className="storefront-container min-h-screen flex flex-col">
        {/* Checkout header - uses checkout_header_config */}
        <StorefrontHeaderContent
          tenantSlug={tenantSlug || ''}
          headerConfig={checkoutHeaderConfig}
          storeSettings={storeSettings}
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
