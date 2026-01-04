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

const defaultCheckoutHeaderConfig: BlockNode = {
  id: 'checkout-header',
  type: 'Header',
  props: {
    menuId: '',
    showSearch: false,
    showCart: true,
    sticky: true,
  },
};

const defaultCheckoutFooterConfig: BlockNode = {
  id: 'checkout-footer',
  type: 'Footer',
  props: {
    menuId: '',
    showSocial: false,
    copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
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
export function applyGlobalLayout(
  content: BlockNode,
  globalLayout: GlobalLayoutData | null,
  isCheckout: boolean,
  pageOverrides?: PageOverrides | null,
  isEditing: boolean = false
): BlockNode {
  if (!content || !globalLayout) return content;

  const headerConfig = isCheckout 
    ? globalLayout.checkout_header_config 
    : globalLayout.header_config;
  const footerConfig = isCheckout 
    ? globalLayout.checkout_footer_config 
    : globalLayout.footer_config;

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
  const filteredChildren = content.children.filter(
    child => child.type !== 'Header' && child.type !== 'Footer'
  );

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
 */
export function useGlobalLayoutForEditor(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch global layout
  const { data: globalLayout, isLoading } = useQuery({
    queryKey: ['global-layout-editor', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('storefront_global_layout')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;

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
    },
    enabled: !!tenantId,
  });

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
