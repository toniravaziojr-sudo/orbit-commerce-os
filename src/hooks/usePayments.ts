import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Payment {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  total: number;
  payment_method: string | null;
  payment_status: string;
  payment_gateway: string | null;
  payment_gateway_id: string | null;
  paid_at: string | null;
  created_at: string;
}

interface PaymentStats {
  totalReceived: number;
  totalPending: number;
  approvedCount: number;
  approvalRate: number;
}

interface UsePaymentsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

export function usePayments(options: UsePaymentsOptions = {}) {
  const { currentTenant } = useAuth();
  const { page = 1, pageSize = 20, status } = options;

  const paymentsQuery = useQuery({
    queryKey: ['payments', currentTenant?.id, page, pageSize, status],
    queryFn: async () => {
      if (!currentTenant?.id) return { payments: [], totalCount: 0 };

      let query = supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total, payment_method, payment_status, payment_gateway, payment_gateway_id, paid_at, created_at', { count: 'exact' })
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('payment_status', status as 'pending' | 'processing' | 'approved' | 'declined' | 'refunded' | 'cancelled');
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('Error fetching payments:', error);
        throw error;
      }

      return {
        payments: (data || []) as Payment[],
        totalCount: count || 0,
      };
    },
    enabled: !!currentTenant?.id,
  });

  const statsQuery = useQuery({
    queryKey: ['payment-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return { totalReceived: 0, totalPending: 0, approvedCount: 0, approvalRate: 0 };

      // Get current month start
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get approved payments this month
      const { data: approvedData } = await supabase
        .from('orders')
        .select('total')
        .eq('tenant_id', currentTenant.id)
        .eq('payment_status', 'approved')
        .gte('paid_at', monthStart);

      const totalReceived = (approvedData || []).reduce((sum, o) => sum + (o.total || 0), 0);

      // Get pending payments
      const { data: pendingData } = await supabase
        .from('orders')
        .select('total')
        .eq('tenant_id', currentTenant.id)
        .in('payment_status', ['pending', 'processing']);

      const totalPending = (pendingData || []).reduce((sum, o) => sum + (o.total || 0), 0);

      // Get counts for approval rate
      const { count: approvedCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('payment_status', 'approved');

      const { count: totalCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .not('payment_status', 'is', null);

      const approvalRate = totalCount && totalCount > 0 ? ((approvedCount || 0) / totalCount) * 100 : 0;

      return {
        totalReceived,
        totalPending,
        approvedCount: approvedCount || 0,
        approvalRate,
      };
    },
    enabled: !!currentTenant?.id,
  });

  return {
    payments: paymentsQuery.data?.payments || [],
    totalCount: paymentsQuery.data?.totalCount || 0,
    stats: statsQuery.data || { totalReceived: 0, totalPending: 0, approvedCount: 0, approvalRate: 0 },
    isLoading: paymentsQuery.isLoading,
    isStatsLoading: statsQuery.isLoading,
  };
}
