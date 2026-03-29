// =============================================
// USE PAYMENT TRANSACTIONS - Histórico de tentativas de pagamento por pedido
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentTransaction {
  id: string;
  order_id: string | null;
  provider: string;
  provider_transaction_id: string | null;
  method: string;
  status: string;
  amount: number;
  paid_amount: number | null;
  currency: string;
  error_message: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export function usePaymentTransactions(orderId?: string) {
  return useQuery({
    queryKey: ['payment-transactions', orderId],
    queryFn: async (): Promise<PaymentTransaction[]> => {
      if (!orderId) return [];

      const { data, error } = await supabase
        .from('payment_transactions')
        .select('id, order_id, provider, provider_transaction_id, method, status, amount, paid_amount, currency, error_message, paid_at, created_at, updated_at')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PaymentTransaction[];
    },
    enabled: !!orderId,
  });
}