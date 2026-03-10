import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface PaymentMethodDiscount {
  id?: string;
  tenant_id: string;
  payment_method: string;
  discount_type: string;
  discount_value: number;
  is_enabled: boolean;
  installments_max: number;
  installments_min_value_cents: number;
  description: string | null;
}

const DEFAULT_CONFIGS: Omit<PaymentMethodDiscount, 'id' | 'tenant_id'>[] = [
  {
    payment_method: 'pix',
    discount_type: 'percentage',
    discount_value: 0,
    is_enabled: false,
    installments_max: 1,
    installments_min_value_cents: 0,
    description: null,
  },
  {
    payment_method: 'credit_card',
    discount_type: 'percentage',
    discount_value: 0,
    is_enabled: false,
    installments_max: 12,
    installments_min_value_cents: 500,
    description: null,
  },
  {
    payment_method: 'boleto',
    discount_type: 'percentage',
    discount_value: 0,
    is_enabled: false,
    installments_max: 1,
    installments_min_value_cents: 0,
    description: null,
  },
];

export function usePaymentMethodDiscounts() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['payment-method-discounts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from('payment_method_discounts')
        .select('*')
        .eq('tenant_id', tenantId);
      if (error) throw error;

      // Merge with defaults for any missing methods
      const existing = (data || []) as PaymentMethodDiscount[];
      const methods = ['pix', 'credit_card', 'boleto'];
      return methods.map(method => {
        const found = existing.find(d => d.payment_method === method);
        if (found) return found;
        const def = DEFAULT_CONFIGS.find(d => d.payment_method === method)!;
        return { ...def, tenant_id: tenantId } as PaymentMethodDiscount;
      });
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (discount: Partial<PaymentMethodDiscount> & { payment_method: string }) => {
      if (!tenantId) throw new Error('No tenant');
      const payload = {
        tenant_id: tenantId,
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
        .upsert(payload, { onConflict: 'tenant_id,payment_method' });
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
