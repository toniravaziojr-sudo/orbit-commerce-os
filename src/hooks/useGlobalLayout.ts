// =============================================
// GLOBAL LAYOUT HOOK - Manage global Header/Footer config
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';

interface GlobalLayout {
  id: string;
  tenant_id: string;
  header_config: BlockNode | null;
  footer_config: BlockNode | null;
  checkout_header_config: BlockNode | null;
  checkout_footer_config: BlockNode | null;
  created_at: string;
  updated_at: string;
}

// Default Header config
const defaultHeaderConfig: BlockNode = {
  id: 'global-header',
  type: 'Header',
  props: {
    menuId: '',
    showSearch: true,
    showCart: true,
    sticky: true,
    noticeEnabled: false,
    noticeText: '',
    noticeBgColor: '#1e40af',
    noticeTextColor: '#ffffff',
  },
};

// Default Footer config
const defaultFooterConfig: BlockNode = {
  id: 'global-footer',
  type: 'Footer',
  props: {
    menuId: '',
    showSocial: true,
    copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
  },
};

// Checkout-specific defaults (simpler)
const defaultCheckoutHeaderConfig: BlockNode = {
  id: 'checkout-header',
  type: 'Header',
  props: {
    menuId: '',
    showSearch: false,
    showCart: true,
    sticky: true,
    noticeEnabled: false,
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

export function useGlobalLayout() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: layout, isLoading } = useQuery({
    queryKey: ['global-layout', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('storefront_global_layout')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;

      // If no layout exists, return defaults
      if (!data) {
        return {
          header_config: defaultHeaderConfig,
          footer_config: defaultFooterConfig,
          checkout_header_config: defaultCheckoutHeaderConfig,
          checkout_footer_config: defaultCheckoutFooterConfig,
          isDefault: true,
        };
      }

      return {
        ...data,
        header_config: (data.header_config as unknown as BlockNode) || defaultHeaderConfig,
        footer_config: (data.footer_config as unknown as BlockNode) || defaultFooterConfig,
        checkout_header_config: (data.checkout_header_config as unknown as BlockNode) || defaultCheckoutHeaderConfig,
        checkout_footer_config: (data.checkout_footer_config as unknown as BlockNode) || defaultCheckoutFooterConfig,
        isDefault: false,
      };
    },
    enabled: !!currentTenant?.id,
  });

  const updateGlobalLayout = useMutation({
    mutationFn: async (params: {
      headerConfig?: BlockNode;
      footerConfig?: BlockNode;
      checkoutHeaderConfig?: BlockNode;
      checkoutFooterConfig?: BlockNode;
    }) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      const updateData: Record<string, Json> = {};
      if (params.headerConfig) updateData.header_config = params.headerConfig as unknown as Json;
      if (params.footerConfig) updateData.footer_config = params.footerConfig as unknown as Json;
      if (params.checkoutHeaderConfig) updateData.checkout_header_config = params.checkoutHeaderConfig as unknown as Json;
      if (params.checkoutFooterConfig) updateData.checkout_footer_config = params.checkoutFooterConfig as unknown as Json;

      const { data: existing } = await supabase
        .from('storefront_global_layout')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('storefront_global_layout')
          .update(updateData)
          .eq('tenant_id', currentTenant.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('storefront_global_layout')
          .insert({
            tenant_id: currentTenant.id,
            ...updateData,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout'] });
      toast({ title: 'Layout global atualizado!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar layout', description: error.message, variant: 'destructive' });
    },
  });

  // Initialize global layout from Home template (migration)
  const initializeFromHome = useMutation({
    mutationFn: async (homeContent: BlockNode) => {
      if (!currentTenant?.id) throw new Error('No tenant');

      // Extract Header and Footer from home content
      const headerBlock = homeContent.children?.find(c => c.type === 'Header');
      const footerBlock = homeContent.children?.find(c => c.type === 'Footer');

      const insertData = {
        tenant_id: currentTenant.id,
        header_config: (headerBlock || defaultHeaderConfig) as unknown as Json,
        footer_config: (footerBlock || defaultFooterConfig) as unknown as Json,
        checkout_header_config: defaultCheckoutHeaderConfig as unknown as Json,
        checkout_footer_config: defaultCheckoutFooterConfig as unknown as Json,
      };

      const { error } = await supabase
        .from('storefront_global_layout')
        .upsert(insertData, { onConflict: 'tenant_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-layout'] });
    },
  });

  return {
    layout,
    isLoading,
    headerConfig: layout?.header_config || defaultHeaderConfig,
    footerConfig: layout?.footer_config || defaultFooterConfig,
    checkoutHeaderConfig: layout?.checkout_header_config || defaultCheckoutHeaderConfig,
    checkoutFooterConfig: layout?.checkout_footer_config || defaultCheckoutFooterConfig,
    isDefault: layout?.isDefault ?? true,
    updateGlobalLayout,
    initializeFromHome,
    defaultHeaderConfig,
    defaultFooterConfig,
    defaultCheckoutHeaderConfig,
    defaultCheckoutFooterConfig,
  };
}

// Hook for public storefront (by slug)
export function usePublicGlobalLayout(tenantSlug: string) {
  return useQuery({
    queryKey: ['public-global-layout', tenantSlug],
    queryFn: async () => {
      // First get tenant ID from slug
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
        };
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
        };
      }

      return {
        header_config: (data.header_config as unknown as BlockNode) || defaultHeaderConfig,
        footer_config: (data.footer_config as unknown as BlockNode) || defaultFooterConfig,
        checkout_header_config: (data.checkout_header_config as unknown as BlockNode) || defaultCheckoutHeaderConfig,
        checkout_footer_config: (data.checkout_footer_config as unknown as BlockNode) || defaultCheckoutFooterConfig,
      };
    },
    enabled: !!tenantSlug,
  });
}
