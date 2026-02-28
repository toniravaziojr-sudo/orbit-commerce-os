import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que carrega TODOS os dados iniciais do storefront em uma única chamada.
 * Substitui múltiplas queries individuais por uma edge function otimizada.
 * 
 * staleTime: 2 minutos — dados de storefront mudam raramente
 * gcTime: 5 minutos — mantém cache por mais tempo
 */
export interface BootstrapData {
  tenant: { id: string; name: string; slug: string; logo_url: string | null };
  store_settings: any;
  header_menu: { menu: any; items: any[] };
  footer_menu: { menu: any; items: any[] };
  categories: any[];
  template: any;
  custom_domain: string | null;
  is_published: boolean;
  products?: any[];
}

export function useStorefrontBootstrap(
  tenantSlug: string,
  options?: { includeProducts?: boolean }
) {
  return useQuery<BootstrapData | null>({
    queryKey: ['storefront-bootstrap', tenantSlug, options?.includeProducts],
    queryFn: async () => {
      if (!tenantSlug) return null;

      const { data, error } = await supabase.functions.invoke('storefront-bootstrap', {
        body: {
          tenant_slug: tenantSlug,
          include_products: options?.includeProducts ?? false,
        },
      });

      if (error) throw error;
      if (!data?.success) return null;

      return data as BootstrapData;
    },
    enabled: !!tenantSlug,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
  });
}

/**
 * Hook para bootstrap por tenant_id (usado em TenantStorefrontLayout)
 */
export function useStorefrontBootstrapById(
  tenantId: string | undefined,
  options?: { includeProducts?: boolean }
) {
  return useQuery<BootstrapData | null>({
    queryKey: ['storefront-bootstrap-id', tenantId, options?.includeProducts],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase.functions.invoke('storefront-bootstrap', {
        body: {
          tenant_id: tenantId,
          include_products: options?.includeProducts ?? false,
        },
      });

      if (error) throw error;
      if (!data?.success) return null;

      return data as BootstrapData;
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
