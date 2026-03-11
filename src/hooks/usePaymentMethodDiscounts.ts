import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface PaymentMethodDiscount {
  id?: string;
  tenant_id: string;
  provider: string;
  payment_method: string;
  discount_type: string;
  discount_value: number;
  is_enabled: boolean;
  installments_max: number;
  installments_min_value_cents: number;
  description: string | null;
}

const PAYMENT_METHODS = ['pix', 'credit_card', 'boleto'] as const;

function getDefaults(provider: string): Omit<PaymentMethodDiscount, 'id' | 'tenant_id'>[] {
  return PAYMENT_METHODS.map(method => ({
    provider,
    payment_method: method,
    discount_type: 'percentage',
    discount_value: 0,
    is_enabled: false,
    installments_max: method === 'credit_card' ? 12 : 1,
    installments_min_value_cents: method === 'credit_card' ? 500 : 0,
    description: null,
  }));
}

export function usePaymentMethodDiscounts(provider?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payment-method-discounts', tenantId, provider],
    queryFn: async () => {
      if (!tenantId) return [];
      let q = supabase
        .from('payment_method_discounts')
        .select('*')
        .eq('tenant_id', tenantId);
      
      if (provider) {
        q = q.eq('provider' as any, provider);
      }

      const { data, error } = await q;
      if (error) throw error;

      const existing = (data || []) as PaymentMethodDiscount[];

      // If filtering by provider, merge with defaults
      if (provider) {
        return PAYMENT_METHODS.map(method => {
          const found = existing.find(d => d.payment_method === method);
          if (found) return found;
          const def = getDefaults(provider).find(d => d.payment_method === method)!;
          return { ...def, tenant_id: tenantId } as PaymentMethodDiscount;
        });
      }

      return existing;
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (discount: Partial<PaymentMethodDiscount> & { payment_method: string; provider: string }) => {
      if (!tenantId) throw new Error('No tenant');
      const payload = {
        tenant_id: tenantId,
        provider: discount.provider,
        payment_method: discount.payment_method,
        discount_type: discount.discount_type || 'percentage',
        discount_value: discount.discount_value ?? 0,
        is_enabled: discount.is_enabled ?? false,
        installments_max: discount.installments_max ?? 12,
        installments_min_value_cents: discount.installments_min_value_cents ?? 500,
        description: discount.description || null,
      };

      const { error } = await supabase
        .from('payment_method_discounts')
        .upsert(payload as any, { onConflict: 'tenant_id,provider,payment_method' as any });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-method-discounts', tenantId] });
      toast.success('Configuração salva');
    },
    onError: () => {
      toast.error('Erro ao salvar configuração');
    },
  });

  return {
    discounts: query.data || [],
    isLoading: query.isLoading,
    saveDiscount: saveMutation.mutate,
    isSaving: saveMutation.isPending,
  };
}
