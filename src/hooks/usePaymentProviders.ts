// ============================================
// USE PAYMENT PROVIDERS - Manage payment gateway configs
// Persists to payment_providers table
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PaymentProvider {
  id: string;
  tenant_id: string;
  provider: string;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  credentials: Record<string, string>;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentProviderInput {
  provider: string;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  credentials: Record<string, string>;
  settings?: Record<string, any>;
}

export function usePaymentProviders() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading, error } = useQuery({
    queryKey: ['payment-providers', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      
      const { data, error } = await supabase
        .from('payment_providers')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as PaymentProvider[];
    },
    enabled: !!currentTenant?.id,
  });

  const upsertProvider = useMutation({
    mutationFn: async (input: PaymentProviderInput) => {
      if (!currentTenant?.id) throw new Error('No tenant selected');

      // Check if provider already exists
      const existing = providers.find(p => p.provider === input.provider);

      if (existing) {
        // Update
        const { data, error } = await supabase
          .from('payment_providers')
          .update({
            is_enabled: input.is_enabled,
            environment: input.environment,
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
        // Insert
        const { data, error } = await supabase
          .from('payment_providers')
          .insert({
            tenant_id: currentTenant.id,
            provider: input.provider,
            is_enabled: input.is_enabled,
            environment: input.environment,
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
      queryClient.invalidateQueries({ queryKey: ['payment-providers', currentTenant?.id] });
      toast.success('Gateway de pagamento salvo com sucesso');
    },
    onError: (error) => {
      console.error('Error saving payment provider:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  const deleteProvider = useMutation({
    mutationFn: async (providerId: string) => {
      const { error } = await supabase
        .from('payment_providers')
        .delete()
        .eq('id', providerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers', currentTenant?.id] });
      toast.success('Gateway removido');
    },
    onError: (error) => {
      console.error('Error deleting provider:', error);
      toast.error('Erro ao remover gateway');
    },
  });

  // Helper to get a specific provider
  const getProvider = (providerName: string) => {
    return providers.find(p => p.provider === providerName);
  };

  return {
    providers,
    isLoading,
    error,
    upsertProvider,
    deleteProvider,
    getProvider,
  };
}
