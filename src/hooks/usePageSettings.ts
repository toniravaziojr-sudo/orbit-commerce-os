// =============================================
// USE PAGE SETTINGS - FONTE ÚNICA DE VERDADE
// Conforme docs/REGRAS.md - Arquitetura Builder vs Storefront Público
// =============================================
// 
// REGRAS:
// 1. Este arquivo é a ÚNICA fonte de verdade para interfaces de settings
// 2. Todos os hooks de settings específicos (cart, checkout, thankYou) devem ser importados daqui
// 3. Não criar interfaces duplicadas em outros arquivos
// 4. Para builder: usar templateSetId para ler de draft_content
// 5. Para storefront público: ler de published_content
// =============================================

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// =============================================
// INTERFACES - Fonte única de verdade
// Conforme docs/REGRAS.md - Padrão de Settings por Página
// =============================================

export interface CategorySettings {
  showCategoryName?: boolean;
  showBanner?: boolean;
  showRatings?: boolean;
  // Conforme REGRAS.md
  quickBuyEnabled?: boolean;        // Compra rápida - vai direto ao checkout
  showAddToCartButton?: boolean;    // Exibir botão adicionar ao carrinho
  showBadges?: boolean;             // Mostrar selos dos produtos
  buyNowButtonText?: string;        // Texto do botão principal
  // Botão personalizado
  customButtonEnabled?: boolean;
  customButtonText?: string;
  customButtonColor?: string;
  customButtonLink?: string;
}

export interface ProductSettings {
  showGallery?: boolean;
  showDescription?: boolean;
  showVariants?: boolean;
  showStock?: boolean;
  showRelatedProducts?: boolean;
  showBuyTogether?: boolean;
  showReviews?: boolean;
  openMiniCartOnAdd?: boolean;
  // Conforme REGRAS.md
  showFloatingCart?: boolean;       // Carrinho rápido (popup flutuante)
  showWhatsAppButton?: boolean;     // Mostrar botão WhatsApp
  showAddToCartButton?: boolean;    // Mostrar botão Adicionar ao carrinho
  buyNowButtonText?: string;        // Texto do botão principal
  showBadges?: boolean;             // Mostrar selos (do Aumentar Ticket)
  showAdditionalHighlight?: boolean; // Destaque adicional (imagens)
  additionalHighlightImages?: string[]; // URLs das imagens do destaque adicional (máx 3)
  showShippingCalculator?: boolean; // Calculadora de frete
}

export interface CartSettings {
  showCrossSell?: boolean;
  couponEnabled?: boolean;
  shippingCalculatorEnabled?: boolean;
  showTrustBadges?: boolean;
  showBenefitBar?: boolean;
  showPromoBanner?: boolean;
  // Legacy fields (mantidos para compatibilidade)
  miniCartEnabled?: boolean;
  showGoToCartButton?: boolean;
  sessionTrackingEnabled?: boolean;
  bannerDesktopEnabled?: boolean;
  bannerMobileEnabled?: boolean;
}

export interface CheckoutSettings {
  showOrderBump?: boolean;
  showTimeline?: boolean;
  couponEnabled?: boolean;
  testimonialsEnabled?: boolean;
  showTrustBadges?: boolean;
  showSecuritySeals?: boolean;
  // Legacy fields
  purchaseEventAllOrders?: boolean;
}

export interface ThankYouSettings {
  showTimeline?: boolean;
  showUpsell?: boolean;
  showWhatsApp?: boolean;
  showOrderSummary?: boolean;
  showTrackingLink?: boolean;
  showSocialShare?: boolean;
  // Legacy fields
  showRelatedProducts?: boolean;
  showTrackingInfo?: boolean;
  showOrderDetails?: boolean;
}

export type PageSettings = CategorySettings | ProductSettings | CartSettings | CheckoutSettings | ThankYouSettings;

// =============================================
// DEFAULTS - Conforme docs/REGRAS.md
// =============================================

export const DEFAULT_CATEGORY_SETTINGS: CategorySettings = {
  showCategoryName: true,
  showBanner: true,
  showRatings: true,
  quickBuyEnabled: false,
  showAddToCartButton: true,
  showBadges: true,
  buyNowButtonText: 'Comprar agora',
  customButtonEnabled: false,
  customButtonText: '',
  customButtonColor: '',
  customButtonLink: '',
};

export const DEFAULT_PRODUCT_SETTINGS: ProductSettings = {
  showGallery: true,
  showDescription: true,
  showVariants: true,
  showStock: true,
  showRelatedProducts: true,
  showBuyTogether: true,
  showReviews: true,
  openMiniCartOnAdd: true,
  showFloatingCart: true,
  showWhatsAppButton: true,
  showAddToCartButton: true,
  buyNowButtonText: 'Comprar agora',
  showBadges: true,
  showAdditionalHighlight: false,
  additionalHighlightImages: [],
  showShippingCalculator: true,
};

export const DEFAULT_CART_SETTINGS: CartSettings = {
  showCrossSell: true,
  couponEnabled: true,
  shippingCalculatorEnabled: true,
  showTrustBadges: true,
  showBenefitBar: true,
  showPromoBanner: true,
  miniCartEnabled: true,
  showGoToCartButton: true,
  sessionTrackingEnabled: true,
  bannerDesktopEnabled: false,
  bannerMobileEnabled: false,
};

export const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  showOrderBump: true,
  showTimeline: true,
  couponEnabled: true,
  testimonialsEnabled: true,
  showTrustBadges: true,
  showSecuritySeals: true,
  purchaseEventAllOrders: true,
};

export const DEFAULT_THANKYOU_SETTINGS: ThankYouSettings = {
  showTimeline: true,
  showUpsell: true,
  showWhatsApp: true,
  showOrderSummary: true,
  showTrackingLink: true,
  showSocialShare: false,
  showRelatedProducts: true,
  showTrackingInfo: true,
  showOrderDetails: true,
};

const DEFAULT_SETTINGS: Record<string, PageSettings> = {
  category: DEFAULT_CATEGORY_SETTINGS,
  product: DEFAULT_PRODUCT_SETTINGS,
  cart: DEFAULT_CART_SETTINGS,
  checkout: DEFAULT_CHECKOUT_SETTINGS,
  thank_you: DEFAULT_THANKYOU_SETTINGS,
};

function getSettingsKey(pageType: string): string {
  const keys: Record<string, string> = {
    category: 'categorySettings',
    product: 'productSettings',
    cart: 'cartSettings',
    checkout: 'checkoutSettings',
    thank_you: 'thankYouSettings',
  };
  return keys[pageType] || `${pageType}Settings`;
}

// =============================================
// HOOK PRINCIPAL - usePageSettings
// Suporta templateSetId para leitura de draft_content (builder)
// =============================================

export function usePageSettings<T extends PageSettings>(
  tenantId: string, 
  pageType: string,
  templateSetId?: string
) {
  return useQuery({
    queryKey: ['page-settings', tenantId, templateSetId || 'tenant', pageType],
    queryFn: async (): Promise<T> => {
      if (!tenantId || !pageType) {
        return (DEFAULT_SETTINGS[pageType] || {}) as T;
      }

      // If templateSetId is provided, try to get settings from template set first
      if (templateSetId) {
        const { data: templateSet, error: tsError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!tsError && templateSet?.draft_content) {
          const draftContent = templateSet.draft_content as Record<string, unknown>;
          const themeSettings = draftContent.themeSettings as Record<string, unknown> | undefined;
          const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
          
          if (pageSettings?.[pageType]) {
            return {
              ...(DEFAULT_SETTINGS[pageType] || {}),
              ...(pageSettings[pageType] as T),
            } as T;
          }
        }
      }

      // Fallback: get from storefront_page_templates (legacy/compatibility)
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', pageType)
        .maybeSingle();

      if (error) {
        console.error('Error fetching page settings:', error);
        return (DEFAULT_SETTINGS[pageType] || {}) as T;
      }

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      const settingsKey = getSettingsKey(pageType);

      if (overrides?.[settingsKey]) {
        return {
          ...(DEFAULT_SETTINGS[pageType] || {}),
          ...(overrides[settingsKey] as T),
        } as T;
      }

      return (DEFAULT_SETTINGS[pageType] || {}) as T;
    },
    enabled: !!tenantId && !!pageType,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
}

// =============================================
// HOOKS ESPECÍFICOS COM SUPORTE A TEMPLATE SET
// Usados pelo VisualBuilder para passar settings via context
// =============================================

export function useCartSettings(tenantId: string, templateSetId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['cart-settings-builder', tenantId, templateSetId || 'legacy'];
  
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId) return null;
      
      if (templateSetId) {
        const { data: templateSet, error: tsError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!tsError && templateSet?.draft_content) {
          const draftContent = templateSet.draft_content as Record<string, unknown>;
          const themeSettings = draftContent.themeSettings as Record<string, unknown> | undefined;
          const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
          
          if (pageSettings?.cart) {
            return pageSettings.cart as CartSettings;
          }
        }
      }
      
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'cart')
        .maybeSingle();

      if (error) throw error;

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.cartSettings as CartSettings) || null;
    },
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 500,
  });

  const settings: CartSettings = {
    ...DEFAULT_CART_SETTINGS,
    ...data,
  };

  const setSettings = (newSettings: CartSettings) => {
    queryClient.setQueryData(queryKey, newSettings);
  };

  return { settings, setSettings, isLoading };
}

export function useCheckoutSettings(tenantId: string, templateSetId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['checkout-settings-builder', tenantId, templateSetId || 'legacy'];
  
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId) return null;
      
      if (templateSetId) {
        const { data: templateSet, error: tsError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!tsError && templateSet?.draft_content) {
          const draftContent = templateSet.draft_content as Record<string, unknown>;
          const themeSettings = draftContent.themeSettings as Record<string, unknown> | undefined;
          const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
          
          if (pageSettings?.checkout) {
            return pageSettings.checkout as CheckoutSettings;
          }
        }
      }
      
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'checkout')
        .maybeSingle();

      if (error) throw error;

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.checkoutSettings as CheckoutSettings) || null;
    },
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 500,
  });

  const settings: CheckoutSettings = {
    ...DEFAULT_CHECKOUT_SETTINGS,
    ...data,
  };

  const setSettings = (newSettings: CheckoutSettings) => {
    queryClient.setQueryData(queryKey, newSettings);
  };

  return { settings, setSettings, isLoading };
}

export function useThankYouSettings(tenantId: string, templateSetId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['thankYou-settings-builder', tenantId, templateSetId || 'legacy'];
  
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId) return null;
      
      if (templateSetId) {
        const { data: templateSet, error: tsError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!tsError && templateSet?.draft_content) {
          const draftContent = templateSet.draft_content as Record<string, unknown>;
          const themeSettings = draftContent.themeSettings as Record<string, unknown> | undefined;
          const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
          
          if (pageSettings?.thankYou) {
            return pageSettings.thankYou as ThankYouSettings;
          }
        }
      }
      
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'thank_you')
        .maybeSingle();

      if (error) throw error;

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      return (overrides?.thankYouSettings as ThankYouSettings) || null;
    },
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchInterval: 500,
  });

  const settings: ThankYouSettings = {
    ...DEFAULT_THANKYOU_SETTINGS,
    ...data,
  };

  const setSettings = (newSettings: ThankYouSettings) => {
    queryClient.setQueryData(queryKey, newSettings);
  };

  return { settings, setSettings, isLoading };
}

// =============================================
// HOOKS LEGADOS - Mantidos para compatibilidade
// Usam o hook principal usePageSettings
// =============================================

export function useProductPageSettings(tenantId: string) {
  return usePageSettings<ProductSettings>(tenantId, 'product');
}

export function useCategoryPageSettings(tenantId: string) {
  return usePageSettings<CategorySettings>(tenantId, 'category');
}
