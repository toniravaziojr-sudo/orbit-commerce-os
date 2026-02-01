// =============================================
// GLOBAL LAYOUT INTEGRATION - Apply global Header/Footer to content
// =============================================

import { useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import { PageOverrides } from '@/hooks/usePageOverrides';

// Default configs
const defaultHeaderConfig: BlockNode = {
  id: 'global-header',
  type: 'Header',
  props: {
    menuId: '',
    showSearch: true,
    showCart: true,
    sticky: true,
    noticeEnabled: false,
  },
};

const defaultFooterConfig: BlockNode = {
  id: 'global-footer',
  type: 'Footer',
  props: {
    menuId: '',
    showSocial: true,
    copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
  },
};

// Checkout-specific defaults: minimal distractions for conversion
const defaultCheckoutHeaderConfig: BlockNode = {
  id: 'checkout-header',
  type: 'Header',
  props: {
    menuId: '',
    showSearch: false,
    showCart: true,
    sticky: true,
    // Checkout-specific: hide navigation elements
    showHeaderMenu: false,
    customerAreaEnabled: false,
    featuredPromosEnabled: false,
    noticeEnabled: false,
  },
};

const defaultCheckoutFooterConfig: BlockNode = {
  id: 'checkout-footer',
  type: 'Footer',
  props: {
    menuId: '',
    // Checkout-optimized: hide all navigation and contact elements
    showSocial: false,
    showNewsletterSection: false,
    showFooter1: false,  // Hide menu columns
    showFooter2: false,  // Hide policy links
    showSac: false,      // Hide SAC/contact section
    showLogo: true,      // Keep logo for brand recognition
    showStoreInfo: false, // Hide legal info
    showCopyright: true,  // Keep copyright
    copyrightText: '© 2024 Sua Loja. Todos os direitos reservados.',
  },
};

export interface GlobalLayoutData {
  header_config: BlockNode;
  footer_config: BlockNode;
  checkout_header_config: BlockNode;
  checkout_footer_config: BlockNode;
  // Visibility toggles
  header_enabled: boolean;
  footer_enabled: boolean;
  show_footer_1: boolean;
  show_footer_2: boolean;
  isDefault: boolean;
  needsMigration: boolean;
}

/**
 * Applies global Header/Footer to a content tree.
 * For non-checkout pages: replaces page's Header/Footer with global.
 * For checkout pages: uses checkout-specific config.
 * 
 * @param content - The page content tree
 * @param globalLayout - Global layout configuration
 * @param isCheckout - Whether this is a checkout page
 * @param pageOverrides - Optional page-specific overrides
 * @param isEditing - If true, always include header/footer with hidden prop for toggling
 */
// Blocos que são renderizados automaticamente pelos blocos principais de cada página
// e NÃO devem existir como standalone (evita duplicação)
// REGRAS.md: Cada página principal renderiza suas seções internamente via configurações
const DUPLICATE_BLOCKS_BY_PAGE_TYPE: Record<string, string[]> = {
  // ProductDetailsBlock renderiza CompreJunto e ProdutosRelacionados via ProductPageSections
  product: ['CompreJuntoSlot', 'ProductGrid'],
  // CartContent renderiza CrossSellSection internamente (crossSellEnabled)
  cart: ['CrossSellSlot'],
  // CheckoutContent renderiza OrderBumpSection internamente (orderBumpEnabled via toggle)
  // OrderBumpSlot is now a legacy block - filter it out to prevent warning
  checkout: ['OrderBumpSlot'],
  // ThankYouContent renderiza UpsellSection internamente
  thank_you: ['UpsellSlot'],
  obrigado: ['UpsellSlot'], // Alias
};

/**
 * Filtra recursivamente blocos duplicados de uma árvore de conteúdo
 */
function filterDuplicateBlocks(children: BlockNode[], blockTypesToRemove: string[]): BlockNode[] {
  return children
    .filter(child => !blockTypesToRemove.includes(child.type))
    .map(child => {
      if (child.children && child.children.length > 0) {
        return {
          ...child,
          children: filterDuplicateBlocks(child.children, blockTypesToRemove),
        };
      }
      return child;
    })
    // Remove Section containers que ficaram vazios após a filtragem
    .filter(child => {
      if (child.type === 'Section' && (!child.children || child.children.length === 0)) {
        return false;
      }
      return true;
    });
}

export function applyGlobalLayout(
  content: BlockNode,
  globalLayout: GlobalLayoutData | null,
  isCheckout: boolean,
  pageOverrides?: PageOverrides | null,
  isEditing: boolean = false,
  pageType?: string
): BlockNode {
  if (!content || !globalLayout) return content;

  // For checkout pages: apply same inheritance logic as StorefrontCheckout.tsx
  // This ensures visual consistency between builder preview and public storefront
  let headerConfig: BlockNode;
  let footerConfig: BlockNode;

  if (isCheckout) {
    // SYNCHRONIZED with StorefrontCheckout.tsx logic for builder-public parity
    const globalHeaderProps = globalLayout.header_config?.props || {};
    const checkoutHeaderProps = globalLayout.checkout_header_config?.props || {};
    
    // Visual props to inherit from global when empty in checkout
    const headerVisualPropsToInherit = [
      'headerBgColor', 'headerTextColor', 'headerIconColor',
      'logoUrl', 'mobileLogoUrl', 'logoWidth', 'logoHeight'
    ];
    
    const mergedHeaderProps: Record<string, unknown> = {};
    
    // Step 1: Inherit visual props from global ONLY if checkout doesn't have them
    for (const key of headerVisualPropsToInherit) {
      const checkoutValue = checkoutHeaderProps[key];
      if (checkoutValue === undefined || checkoutValue === '') {
        if (globalHeaderProps[key] !== undefined && globalHeaderProps[key] !== '') {
          mergedHeaderProps[key] = globalHeaderProps[key];
        }
      }
    }
    
    // Step 2: Apply ALL checkout-specific props (ABSOLUTE PRIORITY)
    for (const [key, value] of Object.entries(checkoutHeaderProps)) {
      if (value !== undefined) {
        mergedHeaderProps[key] = value;
      }
    }
    
    headerConfig = {
      ...globalLayout.checkout_header_config,
      id: 'checkout-header',
      props: mergedHeaderProps,
    };
    
    // FOOTER: Same inheritance logic
    const globalFooterProps = globalLayout.footer_config?.props || {};
    const checkoutFooterProps = globalLayout.checkout_footer_config?.props || {};
    
    // Helper to check if a value is "empty"
    const isEmpty = (value: unknown): boolean => {
      if (value === undefined || value === null || value === '') return true;
      if (Array.isArray(value) && value.length === 0) return true;
      if (typeof value === 'object' && value !== null && 'items' in value) {
        const obj = value as { items?: unknown[] };
        if (Array.isArray(obj.items) && obj.items.length === 0) return true;
      }
      return false;
    };
    
    // Props that should be inherited from global when empty in checkout
    const footerPropsToInherit = [
      'footerBgColor', 'footerTextColor', 'footerTitlesColor', 'logoUrl',
      'paymentMethods', 'securitySeals', 'shippingMethods', 'officialStores',
      'copyrightText'
    ];
    
    const mergedFooterProps: Record<string, unknown> = {};
    
    // Step 1: Start with checkout props that have values
    for (const [key, value] of Object.entries(checkoutFooterProps)) {
      if (footerPropsToInherit.includes(key)) {
        if (!isEmpty(value)) {
          mergedFooterProps[key] = value;
        }
      } else {
        if (value !== undefined) {
          mergedFooterProps[key] = value;
        }
      }
    }
    
    // Step 2: Fill in missing inheritable props from global
    for (const key of footerPropsToInherit) {
      if (isEmpty(mergedFooterProps[key])) {
        const globalValue = globalFooterProps[key];
        if (!isEmpty(globalValue)) {
          mergedFooterProps[key] = globalValue;
        }
      }
    }
    
    // Step 3: Set default visibility toggles to TRUE when there's data
    if (mergedFooterProps.showPaymentMethods === undefined && !isEmpty(mergedFooterProps.paymentMethods)) {
      mergedFooterProps.showPaymentMethods = true;
    }
    if (mergedFooterProps.showSecuritySeals === undefined && !isEmpty(mergedFooterProps.securitySeals)) {
      mergedFooterProps.showSecuritySeals = true;
    }
    
    footerConfig = {
      ...globalLayout.checkout_footer_config,
      id: 'checkout-footer',
      props: mergedFooterProps,
    };
  } else {
    headerConfig = globalLayout.header_config;
    footerConfig = globalLayout.footer_config;
  }

  // Global visibility flags
  const globalHeaderEnabled = globalLayout.header_enabled ?? true;
  const globalFooterEnabled = globalLayout.footer_enabled ?? true;

  // Determine effective visibility (priority: page override > global)
  // For checkout pages, always use global (no overrides)
  const effectiveHeaderEnabled = !isCheckout && pageOverrides?.header?.headerEnabled !== undefined
    ? pageOverrides.header.headerEnabled
    : globalHeaderEnabled;
  
  const effectiveFooterEnabled = !isCheckout && pageOverrides?.footer?.footerEnabled !== undefined
    ? pageOverrides.footer.footerEnabled
    : globalFooterEnabled;

  // If content has no children, return as is
  if (!content.children || content.children.length === 0) {
    return content;
  }

  // Filter out existing Header/Footer blocks
  let filteredChildren = content.children.filter(
    child => child.type !== 'Header' && child.type !== 'Footer'
  );

  // REGRAS.md: Remover blocos duplicados que são renderizados automaticamente
  // pelos blocos principais de cada página (evita duplicação)
  if (pageType && DUPLICATE_BLOCKS_BY_PAGE_TYPE[pageType]) {
    filteredChildren = filterDuplicateBlocks(filteredChildren, DUPLICATE_BLOCKS_BY_PAGE_TYPE[pageType]);
  }

  // Apply page overrides to header props (only for non-checkout pages)
  let finalHeaderConfig = { ...headerConfig };
  if (!isCheckout && pageOverrides?.header) {
    // Apply notice enabled override
    if (pageOverrides.header.noticeEnabled !== undefined) {
      finalHeaderConfig = {
        ...finalHeaderConfig,
        props: {
          ...finalHeaderConfig.props,
          noticeEnabled: pageOverrides.header.noticeEnabled,
        },
      };
    }
    // Apply show header menu override
    if (pageOverrides.header.showHeaderMenu !== undefined) {
      finalHeaderConfig = {
        ...finalHeaderConfig,
        props: {
          ...finalHeaderConfig.props,
          showHeaderMenu: pageOverrides.header.showHeaderMenu,
        },
      };
    }
  }

  // Build children array based on visibility
  const newChildren: BlockNode[] = [];
  
  // Add header - always in editor (with hidden prop), only if enabled in public
  if (effectiveHeaderEnabled || isEditing) {
    newChildren.push({ 
      ...finalHeaderConfig, 
      id: isCheckout ? 'checkout-header' : 'global-header',
      hidden: !effectiveHeaderEnabled,
    });
  }
  
  // Add content
  newChildren.push(...filteredChildren);
  
  // Add footer - always in editor (with hidden prop), only if enabled in public
  if (effectiveFooterEnabled || isEditing) {
    newChildren.push({ 
      ...footerConfig, 
      id: isCheckout ? 'checkout-footer' : 'global-footer',
      hidden: !effectiveFooterEnabled,
    });
  }

  return {
    ...content,
    children: newChildren,
  };
}

/**
 * Extracts Header and Footer configs from a content tree.
 */
export function extractHeaderFooter(content: BlockNode): {
  header: BlockNode | null;
  footer: BlockNode | null;
} {
  if (!content.children) {
    return { header: null, footer: null };
  }

  const header = content.children.find(child => child.type === 'Header') || null;
  const footer = content.children.find(child => child.type === 'Footer') || null;

  return { header, footer };
}

/**
 * Hook to fetch and manage global layout for editor context.
 * NEVER throws - always returns valid defaults to prevent blank screens
 */
export function useGlobalLayoutForEditor(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  // Default layout data to prevent blank screens
  const defaultLayoutData: GlobalLayoutData = {
    header_config: defaultHeaderConfig,
    footer_config: defaultFooterConfig,
    checkout_header_config: defaultCheckoutHeaderConfig,
    checkout_footer_config: defaultCheckoutFooterConfig,
    header_enabled: true,
    footer_enabled: true,
    show_footer_1: true,
    show_footer_2: true,
    isDefault: true,
    needsMigration: false,
  };

  // Fetch global layout - NEVER throws
  const { data: globalLayout, isLoading, error, isFetched } = useQuery({
    queryKey: ['global-layout-editor', tenantId],
    queryFn: async () => {
      console.log('[useGlobalLayoutForEditor] Fetching for tenant:', tenantId);
      
      if (!tenantId) {
        console.warn('[useGlobalLayoutForEditor] No tenantId, returning defaults');
        return defaultLayoutData;
      }

      try {
        const { data, error } = await supabase
          .from('storefront_global_layout')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (error) {
          console.error('[useGlobalLayoutForEditor] Supabase error:', error);
          return defaultLayoutData;
        }

        console.log('[useGlobalLayoutForEditor] Data fetched:', data ? 'found' : 'not found');

        const isEmpty = !data || 
          (!data.header_config && !data.footer_config);

        return {
          header_config: (data?.header_config as unknown as BlockNode) || defaultHeaderConfig,
          footer_config: (data?.footer_config as unknown as BlockNode) || defaultFooterConfig,
          checkout_header_config: (data?.checkout_header_config as unknown as BlockNode) || defaultCheckoutHeaderConfig,
          checkout_footer_config: (data?.checkout_footer_config as unknown as BlockNode) || defaultCheckoutFooterConfig,
          header_enabled: data?.header_enabled ?? true,
          footer_enabled: data?.footer_enabled ?? true,
          show_footer_1: data?.show_footer_1 ?? true,
          show_footer_2: data?.show_footer_2 ?? true,
          isDefault: !data,
          needsMigration: isEmpty,
        } as GlobalLayoutData;
      } catch (err) {
        console.error('[useGlobalLayoutForEditor] Unexpected error:', err);
        return defaultLayoutData;
      }
    },
    enabled: !!tenantId,
    staleTime: 5000, // Reduced to allow faster updates from settings panel
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Log state for debugging
  useEffect(() => {
    console.log('[useGlobalLayoutForEditor] State:', {
      tenantId,
      isLoading,
      isFetched,
      hasData: !!globalLayout,
      error: error?.message,
    });
  }, [tenantId, isLoading, isFetched, globalLayout, error]);

  // Update global layout (header or footer)
  const updateGlobalHeader = useMutation({
    mutationFn: async (headerConfig: BlockNode) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const updateData = { header_config: headerConfig as unknown as Json };

      if (existing) {
        await supabase
          .from('storefront_global_layout')
          .update(updateData)
          .eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            ...updateData,
            footer_config: defaultFooterConfig as unknown as Json,
            checkout_header_config: defaultCheckoutHeaderConfig as unknown as Json,
            checkout_footer_config: defaultCheckoutFooterConfig as unknown as Json,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor'] });
      queryClient.invalidateQueries({ queryKey: ['public-global-layout'] });
    },
  });

  const updateGlobalFooter = useMutation({
    mutationFn: async (footerConfig: BlockNode) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const updateData = { footer_config: footerConfig as unknown as Json };

      if (existing) {
        await supabase
          .from('storefront_global_layout')
          .update(updateData)
          .eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            header_config: defaultHeaderConfig as unknown as Json,
            ...updateData,
            checkout_header_config: defaultCheckoutHeaderConfig as unknown as Json,
            checkout_footer_config: defaultCheckoutFooterConfig as unknown as Json,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor'] });
      queryClient.invalidateQueries({ queryKey: ['public-global-layout'] });
    },
  });

  // Update checkout-specific layout
  const updateCheckoutHeader = useMutation({
    mutationFn: async (headerConfig: BlockNode) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const updateData = { checkout_header_config: headerConfig as unknown as Json };

      if (existing) {
        await supabase
          .from('storefront_global_layout')
          .update(updateData)
          .eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            header_config: defaultHeaderConfig as unknown as Json,
            footer_config: defaultFooterConfig as unknown as Json,
            ...updateData,
            checkout_footer_config: defaultCheckoutFooterConfig as unknown as Json,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor'] });
    },
  });

  const updateCheckoutFooter = useMutation({
    mutationFn: async (footerConfig: BlockNode) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const updateData = { checkout_footer_config: footerConfig as unknown as Json };

      if (existing) {
        await supabase
          .from('storefront_global_layout')
          .update(updateData)
          .eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            header_config: defaultHeaderConfig as unknown as Json,
            footer_config: defaultFooterConfig as unknown as Json,
            checkout_header_config: defaultCheckoutHeaderConfig as unknown as Json,
            ...updateData,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor'] });
    },
  });

  // Migrate from Home template to global layout
  const migrateFromHome = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('No tenant');

      // Check if already has data
      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('header_config, footer_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      // Only migrate if empty
      if (existing?.header_config || existing?.footer_config) {
        return { migrated: false };
      }

      // Try to get Home template content
      const { data: homeTemplate } = await supabase
        .from('storefront_page_templates')
        .select('published_version, draft_version')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'home')
        .maybeSingle();

      let homeContent: BlockNode | null = null;

      if (homeTemplate) {
        const versionNum = homeTemplate.published_version || homeTemplate.draft_version;
        if (versionNum) {
          const { data: version } = await supabase
            .from('store_page_versions')
            .select('content')
            .eq('tenant_id', tenantId)
            .eq('entity_type', 'template')
            .eq('page_type', 'home')
            .eq('version', versionNum)
            .maybeSingle();

          if (version?.content) {
            homeContent = version.content as unknown as BlockNode;
          }
        }
      }

      // Extract Header/Footer from home, or use defaults
      let headerConfig = defaultHeaderConfig;
      let footerConfig = defaultFooterConfig;

      if (homeContent?.children) {
        const foundHeader = homeContent.children.find(c => c.type === 'Header');
        const foundFooter = homeContent.children.find(c => c.type === 'Footer');
        if (foundHeader) headerConfig = { ...foundHeader, id: 'global-header' };
        if (foundFooter) footerConfig = { ...foundFooter, id: 'global-footer' };
      }

      // Upsert the global layout
      await supabase
        .from('storefront_global_layout')
        .upsert({
          tenant_id: tenantId,
          header_config: headerConfig as unknown as Json,
          footer_config: footerConfig as unknown as Json,
          checkout_header_config: defaultCheckoutHeaderConfig as unknown as Json,
          checkout_footer_config: defaultCheckoutFooterConfig as unknown as Json,
        }, { onConflict: 'tenant_id' });

      return { migrated: true, headerConfig, footerConfig };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor'] });
      queryClient.invalidateQueries({ queryKey: ['public-global-layout'] });
    },
  });

  // Update visibility toggles
  const updateVisibilityToggles = useMutation({
    mutationFn: async (toggles: {
      header_enabled?: boolean;
      footer_enabled?: boolean;
      show_footer_1?: boolean;
      show_footer_2?: boolean;
    }) => {
      if (!tenantId) throw new Error('No tenant');

      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('storefront_global_layout')
          .update(toggles)
          .eq('tenant_id', tenantId);
      } else {
        await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: tenantId,
            header_config: defaultHeaderConfig as unknown as Json,
            footer_config: defaultFooterConfig as unknown as Json,
            checkout_header_config: defaultCheckoutHeaderConfig as unknown as Json,
            checkout_footer_config: defaultCheckoutFooterConfig as unknown as Json,
            ...toggles,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout-editor'] });
      queryClient.invalidateQueries({ queryKey: ['public-global-layout'] });
    },
  });

  return {
    globalLayout,
    isLoading,
    updateGlobalHeader,
    updateGlobalFooter,
    updateCheckoutHeader,
    updateCheckoutFooter,
    updateVisibilityToggles,
    migrateFromHome,
  };
}

/**
 * Hook for public storefront to get global layout by tenant slug.
 */
export function usePublicGlobalLayout(tenantSlug: string) {
  return useQuery({
    queryKey: ['public-global-layout', tenantSlug],
    queryFn: async () => {
      // Get tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) {
        return {
          header_config: defaultHeaderConfig,
          footer_config: defaultFooterConfig,
          checkout_header_config: defaultCheckoutHeaderConfig,
          checkout_footer_config: defaultCheckoutFooterConfig,
          header_enabled: true,
          footer_enabled: true,
          show_footer_1: true,
          show_footer_2: true,
          isDefault: true,
          needsMigration: false,
        } as GlobalLayoutData;
      }

      const { data, error } = await supabase
        .from('storefront_global_layout')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (error || !data) {
        return {
          header_config: defaultHeaderConfig,
          footer_config: defaultFooterConfig,
          checkout_header_config: defaultCheckoutHeaderConfig,
          checkout_footer_config: defaultCheckoutFooterConfig,
          header_enabled: true,
          footer_enabled: true,
          show_footer_1: true,
          show_footer_2: true,
          isDefault: true,
          needsMigration: false,
        } as GlobalLayoutData;
      }

      return {
        header_config: (data.header_config as unknown as BlockNode) || defaultHeaderConfig,
        footer_config: (data.footer_config as unknown as BlockNode) || defaultFooterConfig,
        checkout_header_config: (data.checkout_header_config as unknown as BlockNode) || defaultCheckoutHeaderConfig,
        checkout_footer_config: (data.checkout_footer_config as unknown as BlockNode) || defaultCheckoutFooterConfig,
        header_enabled: data.header_enabled ?? true,
        footer_enabled: data.footer_enabled ?? true,
        show_footer_1: data.show_footer_1 ?? true,
        show_footer_2: data.show_footer_2 ?? true,
        isDefault: false,
        needsMigration: false,
      } as GlobalLayoutData;
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
