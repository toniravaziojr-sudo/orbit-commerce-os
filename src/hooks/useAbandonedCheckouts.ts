import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AbandonedCheckout {
  id: string;
  created_at: string;
  updated_at: string;
  abandoned_at: string | null;
  completed_at: string | null;
  status: string | null;
  recovery_status: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_state: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
  subtotal: number | null;
  shipping_total: number | null;
  discount_total: number | null;
  total: number | null;
  items_snapshot: any[];
  step: string | null;
}

export interface AbandonedCheckoutsFilters {
  search?: string;
  status?: string;
  recoveryStatus?: string;
  startDate?: Date;
  endDate?: Date;
  region?: string;
}

export function useAbandonedCheckouts(filters: AbandonedCheckoutsFilters = {}) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['abandoned-checkouts', currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('checkouts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('updated_at', { ascending: false });

      // Filter by status
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Filter by recovery status
      if (filters.recoveryStatus && filters.recoveryStatus !== 'all') {
        query = query.eq('recovery_status', filters.recoveryStatus);
      }

      // Filter by date range
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString());
      }

      // Filter by region (state)
      if (filters.region && filters.region !== 'all') {
        query = query.eq('shipping_state', filters.region);
      }

      // Search by email, name, phone, or id
      if (filters.search) {
        query = query.or(
          `customer_email.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,customer_phone.ilike.%${filters.search}%,id.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as AbandonedCheckout[];
    },
    enabled: !!currentTenant?.id,
  });
}

export function useAbandonedCheckoutStats() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['abandoned-checkout-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('checkouts')
        .select('status, recovery_status, total')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        inProgress: data?.filter(c => c.status === 'pending' && !c.recovery_status?.includes('recovered')).length || 0,
        abandoned: data?.filter(c => c.status === 'abandoned').length || 0,
        converted: data?.filter(c => c.status === 'completed').length || 0,
        notRecovered: data?.filter(c => c.recovery_status === 'not_recovered').length || 0,
        totalValue: data?.reduce((sum, c) => sum + (c.total || 0), 0) || 0,
      };

      return stats;
    },
    enabled: !!currentTenant?.id,
  });
}
