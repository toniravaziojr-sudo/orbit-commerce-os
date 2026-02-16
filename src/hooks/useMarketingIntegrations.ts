// =============================================
// USE MARKETING INTEGRATIONS
// Hook for managing marketing integrations per tenant
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface MarketingIntegration {
  id: string;
  tenant_id: string;
  
  // Meta
  meta_pixel_id: string | null;
  meta_enabled: boolean;
  meta_capi_enabled: boolean;
  meta_status: string;
  meta_last_test_at: string | null;
  meta_last_error: string | null;
  
  // Google
  google_measurement_id: string | null;
  google_ads_conversion_id: string | null;
  google_ads_conversion_label: string | null;
  google_enabled: boolean;
  google_status: string;
  google_last_test_at: string | null;
  google_last_error: string | null;
  
  // TikTok
  tiktok_pixel_id: string | null;
  tiktok_enabled: boolean;
  tiktok_events_api_enabled: boolean;
  tiktok_status: string;
  tiktok_last_test_at: string | null;
  tiktok_last_error: string | null;
  
  // Additional Pixels
  meta_additional_pixel_ids: string[] | null;
  
  // General
  consent_mode_enabled: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface PublicMarketingConfig {
  meta_pixel_id: string | null;
  meta_enabled: boolean;
  google_measurement_id: string | null;
  google_ads_conversion_id: string | null;
  google_ads_conversion_label: string | null;
  google_enabled: boolean;
  tiktok_pixel_id: string | null;
  tiktok_enabled: boolean;
  consent_mode_enabled: boolean;
}

/**
 * Hook for tenant admin to manage marketing integrations
 */
export function useMarketingIntegrations() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['marketing-integrations', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('marketing_integrations')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as MarketingIntegration | null;
    },
    enabled: !!currentTenant?.id,
  });

  const upsertConfig = useMutation({
    mutationFn: async (updates: Partial<MarketingIntegration>) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      if (config?.id) {
        // Update existing
        const { data, error } = await supabase
          .from('marketing_integrations')
          .update(updates)
          .eq('id', config.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('marketing_integrations')
          .insert({ 
            tenant_id: currentTenant.id, 
            ...updates 
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-integrations'] });
      toast.success('Configuração salva com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  return {
    config,
    isLoading,
    error,
    upsertConfig,
  };
}

/**
 * Hook to get public marketing config for storefront (no secrets)
 * Uses RPC function that only returns public fields
 */
export function usePublicMarketingConfig(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['public-marketing-config', tenantId],
    queryFn: async (): Promise<PublicMarketingConfig | null> => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .rpc('get_public_marketing_config', { p_tenant_id: tenantId });

      if (error) {
        console.error('Error fetching public marketing config:', error);
        return null;
      }

      // RPC returns array, get first row
      const row = Array.isArray(data) ? data[0] : data;
      return row || null;
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}
