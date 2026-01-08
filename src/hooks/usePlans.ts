import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Plan {
  plan_key: string;
  name: string;
  description: string | null;
  monthly_fee_cents: number;
  fee_bps: number; // basis points (350 = 3.5%)
  order_limit: number | null;
  support_level: string;
  features: any[];
  is_custom: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_key: string;
  status: 'pending_payment_method' | 'active' | 'suspended' | 'cancelled';
  activated_at: string | null;
  payment_method_type: string | null;
  card_last_four: string | null;
  card_brand: string | null;
  created_at: string;
}

export interface TenantMonthlyUsage {
  id: string;
  tenant_id: string;
  year_month: string;
  orders_count: number;
  gmv_cents: number;
  ai_usage_cents: number;
  over_limit: boolean;
}

export interface TenantInvoice {
  id: string;
  tenant_id: string;
  year_month: string;
  base_fee_cents: number;
  variable_fee_cents: number;
  ai_fee_cents: number;
  addons_cents: number;
  discount_cents: number;
  total_cents: number;
  status: 'draft' | 'open' | 'paid' | 'failed' | 'cancelled';
  due_date: string | null;
  paid_at: string | null;
  line_items: any[];
}

export interface OrderLimitCheck {
  is_over_limit: boolean;
  current_count: number;
  order_limit: number | null;
  plan_key: string;
  hard_enforcement_enabled: boolean;
}

// Hook para buscar planos disponíveis
export function usePlans() {
  return useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as Plan[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

// Hook para buscar assinatura do tenant atual
export function useTenantSubscription() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['tenant-subscription', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data as TenantSubscription | null;
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook para buscar uso mensal do tenant
export function useTenantMonthlyUsage(yearMonth?: string) {
  const { currentTenant } = useAuth();
  const currentYearMonth = yearMonth || new Date().toISOString().slice(0, 7);

  return useQuery({
    queryKey: ['tenant-monthly-usage', currentTenant?.id, currentYearMonth],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tenant_monthly_usage')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('year_month', currentYearMonth)
        .maybeSingle();

      if (error) throw error;
      return data as TenantMonthlyUsage | null;
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook para buscar faturas do tenant
export function useTenantInvoices() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['tenant-invoices', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('tenant_invoices')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('year_month', { ascending: false });

      if (error) throw error;
      return data as TenantInvoice[];
    },
    enabled: !!currentTenant?.id,
  });
}

// Hook para verificar limite de pedidos
export function useOrderLimitCheck() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['order-limit-check', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .rpc('check_tenant_order_limit', { p_tenant_id: currentTenant.id });

      if (error) throw error;
      return data?.[0] as OrderLimitCheck | null;
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 60000, // Refresh a cada minuto
  });
}

// Hook para ativar assinatura
export function useActivateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      tenant_id: string;
      plan_key: string;
      payment_method_type: 'card' | 'pix_validation';
      card_data?: {
        number: string;
        holder_name: string;
        exp_month: string;
        exp_year: string;
        cvv: string;
      };
      addons?: Array<{
        addon_key: string;
        name: string;
        price_cents: number;
      }>;
      utm?: {
        source?: string;
        medium?: string;
        campaign?: string;
        content?: string;
        term?: string;
      };
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('billing-activate-subscription', {
        body: params,
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`,
        } : undefined,
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['order-limit-check'] });
      
      if (data.status === 'active') {
        toast.success('Plano ativado com sucesso!');
      } else if (data.status === 'pending_pix') {
        toast.info('Aguardando pagamento do Pix');
      }
    },
    onError: (error) => {
      toast.error(`Erro ao ativar plano: ${error.message}`);
    },
  });
}

// Hook para verificar Pix pendente
export function useCheckPixValidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { validation_id?: string; tenant_id?: string }) => {
      const response = await supabase.functions.invoke('billing-check-pix-validation', {
        body: params,
      });

      if (response.error) throw response.error;
      if (!response.data.success) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: (data) => {
      if (data.status === 'paid' && data.activated) {
        queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] });
        toast.success('Pix confirmado! Plano ativado.');
      }
    },
  });
}

// Utilitários
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function formatPercentage(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}
