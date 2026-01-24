// ============================================
// USE SHIPPING PROVIDERS - Manage shipping carrier configs
// Persists to shipping_providers table
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface TestConnectionResult {
  success: boolean;
  auth_mode?: string;
  token_expires_at?: string;
  cep_lookup_works?: boolean;
  error?: string;
  error_code?: string;
}

export interface ShippingProvider {
  id: string;
  tenant_id: string;
  provider: string;
  is_enabled: boolean;
  supports_quote: boolean;
  supports_tracking: boolean;
  credentials: Record<string, string>;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ShippingProviderInput {
  provider: string;
  is_enabled: boolean;
  supports_quote?: boolean;
  supports_tracking?: boolean;
  credentials: Record<string, string>;
  settings?: Record<string, any>;
}

export function useShippingProviders() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading, error } = useQuery({
    queryKey: ['shipping-providers', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('shipping_providers')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as ShippingProvider[];
    },
    enabled: !!currentTenant?.id,
  });

  const upsertProvider = useMutation({
    mutationFn: async (input: ShippingProviderInput) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      const existing = providers.find(p => p.provider === input.provider);

      if (existing) {
        const { data, error } = await supabase
          .from('shipping_providers')
          .update({
            is_enabled: input.is_enabled,
            supports_quote: input.supports_quote ?? true,
            supports_tracking: input.supports_tracking ?? true,
            credentials: input.credentials,
            settings: input.settings || {},
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('shipping_providers')
          .insert({
            tenant_id: currentTenant.id,
            provider: input.provider,
            is_enabled: input.is_enabled,
            supports_quote: input.supports_quote ?? true,
            supports_tracking: input.supports_tracking ?? true,
            credentials: input.credentials,
            settings: input.settings || {},
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-providers', currentTenant?.id] });
      toast.success('Transportadora salva com sucesso');
    },
    onError: (error) => {
      console.error('Error saving shipping provider:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  const deleteProvider = useMutation({
    mutationFn: async (providerId: string) => {
      const { error } = await supabase
        .from('shipping_providers')
        .delete()
        .eq('id', providerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-providers', currentTenant?.id] });
      toast.success('Transportadora removida');
    },
    onError: (error) => {
      console.error('Error deleting provider:', error);
      toast.error('Erro ao remover transportadora');
    },
  });

  const getProvider = (providerName: string) => {
    return providers.find(p => p.provider === providerName);
  };

  const testConnection = useMutation({
    mutationFn: async (params: { provider: string; credentials: Record<string, string> }): Promise<TestConnectionResult> => {
      const { provider, credentials } = params;
      
      // Map provider to edge function
      const endpointMap: Record<string, string> = {
        'correios': 'correios-test-connection',
        'loggi': 'loggi-test-connection',
      };

      const endpoint = endpointMap[provider];
      if (!endpoint) {
        throw new Error(`Teste de conexão não disponível para ${provider}`);
      }

      // For correios, ensure auth_mode defaults to 'api_code' if not specified
      const body = { ...credentials };
      if (provider === 'correios' && !body.auth_mode) {
        body.auth_mode = 'api_code';
      }

      const { data, error } = await supabase.functions.invoke(endpoint, {
        body,
      });

      if (error) throw error;
      return data as TestConnectionResult;
    },
  });

  return {
    providers,
    isLoading,
    error,
    upsertProvider,
    deleteProvider,
    getProvider,
    testConnection,
  };
}
