// ============================================
// USE PAYMENT GATEWAY MAP - Maps payment methods to gateways
// Each tenant can assign which gateway handles PIX, Boleto, Credit Card
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface PaymentGatewayMapEntry {
  id?: string;
  tenant_id: string;
  payment_method: 'pix' | 'credit_card' | 'boleto';
  provider: string;
  is_enabled: boolean;
}

const DEFAULT_METHODS = ['pix', 'credit_card', 'boleto'] as const;

export function usePaymentGatewayMap() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payment-gateway-map', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('payment_method_gateway_map' as any)
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return (data || []) as any as PaymentGatewayMapEntry[];
    },
    enabled: !!tenantId,
  });

  const getMethodGateway = (method: string): PaymentGatewayMapEntry | undefined => {
    return (query.data || []).find(e => e.payment_method === method);
  };

  const saveMutation = useMutation({
    mutationFn: async (entry: { payment_method: string; provider: string; is_enabled: boolean }) => {
      if (!tenantId) throw new Error('No tenant');

      const { error } = await supabase
        .from('payment_method_gateway_map' as any)
        .upsert({
          tenant_id: tenantId,
          payment_method: entry.payment_method,
          provider: entry.provider,
          is_enabled: entry.is_enabled,
        } as any, { onConflict: 'tenant_id,payment_method' as any });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateway-map', tenantId] });
      toast.success('Mapeamento de gateway salvo');
    },
    onError: () => {
      toast.error('Erro ao salvar mapeamento');
    },
  });

  const saveAll = useMutation({
    mutationFn: async (entries: { payment_method: string; provider: string; is_enabled: boolean }[]) => {
      if (!tenantId) throw new Error('No tenant');

      for (const entry of entries) {
        const { error } = await supabase
          .from('payment_method_gateway_map' as any)
          .upsert({
            tenant_id: tenantId,
            payment_method: entry.payment_method,
            provider: entry.provider,
            is_enabled: entry.is_enabled,
          } as any, { onConflict: 'tenant_id,payment_method' as any });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-gateway-map', tenantId] });
      toast.success('Configurações de gateway salvas');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações');
    },
  });

  return {
    entries: query.data || [],
    isLoading: query.isLoading,
    getMethodGateway,
    saveEntry: saveMutation.mutate,
    saveAll: saveAll.mutate,
    isSaving: saveMutation.isPending || saveAll.isPending,
  };
}

/**
 * Public hook for storefront checkout - resolves gateway per method
 */
export function usePublicPaymentGatewayMap(tenantId: string) {
  return useQuery({
    queryKey: ['public-payment-gateway-map', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('payment_method_gateway_map' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_enabled', true);

      if (error) throw error;
      return (data || []) as any as PaymentGatewayMapEntry[];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}
