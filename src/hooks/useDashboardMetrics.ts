import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfDay, subDays, endOfDay } from 'date-fns';

interface DashboardMetrics {
  salesToday: number;
  salesYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  ticketToday: number;
  ticketYesterday: number;
  newCustomersToday: number;
  newCustomersYesterday: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export function useDashboardMetrics() {
  const { currentTenant } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard-metrics', currentTenant?.id],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!currentTenant?.id) {
        return {
          salesToday: 0,
          salesYesterday: 0,
          ordersToday: 0,
          ordersYesterday: 0,
          ticketToday: 0,
          ticketYesterday: 0,
          newCustomersToday: 0,
          newCustomersYesterday: 0,
        };
      }

      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
      const yesterdayEnd = endOfDay(subDays(now, 1)).toISOString();

      // Fetch today's orders (only paid orders for sales metrics)
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('id, total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      // Fetch yesterday's orders
      const { data: yesterdayOrders } = await supabase
        .from('orders')
        .select('id, total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', yesterdayStart)
        .lte('created_at', yesterdayEnd);

      // Fetch today's new customers
      const { count: newCustomersToday } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .is('deleted_at', null)
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      // Fetch yesterday's new customers
      const { count: newCustomersYesterday } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .is('deleted_at', null)
        .gte('created_at', yesterdayStart)
        .lte('created_at', yesterdayEnd);

      // Calculate metrics - consider approved orders for sales
      const paidTodayOrders = todayOrders?.filter(o => o.payment_status === 'approved') || [];
      const paidYesterdayOrders = yesterdayOrders?.filter(o => o.payment_status === 'approved') || [];

      const salesToday = paidTodayOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const salesYesterday = paidYesterdayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      const ordersToday = todayOrders?.length || 0;
      const ordersYesterday = yesterdayOrders?.length || 0;

      const ticketToday = ordersToday > 0 ? salesToday / paidTodayOrders.length : 0;
      const ticketYesterday = ordersYesterday > 0 ? salesYesterday / paidYesterdayOrders.length : 0;

      return {
        salesToday,
        salesYesterday,
        ordersToday,
        ordersYesterday,
        ticketToday: paidTodayOrders.length > 0 ? ticketToday : 0,
        ticketYesterday: paidYesterdayOrders.length > 0 ? ticketYesterday : 0,
        newCustomersToday: newCustomersToday || 0,
        newCustomersYesterday: newCustomersYesterday || 0,
      };
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useRecentOrders(limit = 5) {
  const { currentTenant } = useAuth();
  
  return useQuery({
    queryKey: ['recent-orders', currentTenant?.id, limit],
    queryFn: async (): Promise<RecentOrder[]> => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, status, payment_status, created_at, customers(full_name)')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number || `#${order.id.slice(0, 5).toUpperCase()}`,
        customer_name: (order.customers as any)?.full_name || 'Cliente',
        total: order.total || 0,
        status: order.status || 'pending',
        payment_status: order.payment_status || 'pending',
        created_at: order.created_at,
      }));
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

// Helper to calculate trend percentage
export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
}

// Helper to format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value / 100); // Assuming value is in cents
}

// Helper to format relative time
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Agora';
  if (diffMins < 60) return `Há ${diffMins} min`;
  if (diffHours < 24) return `Há ${diffHours}h`;
  return `Há ${diffDays}d`;
}
