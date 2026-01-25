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

export function useDashboardMetrics(startDate?: Date, endDate?: Date) {
  const { currentTenant } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard-metrics', currentTenant?.id, startDate?.toISOString(), endDate?.toISOString()],
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
      // Use provided dates or default to today
      const periodStart = startDate ? startOfDay(startDate).toISOString() : startOfDay(now).toISOString();
      const periodEnd = endDate ? endOfDay(endDate).toISOString() : endOfDay(now).toISOString();
      
      // Calculate previous period (same duration before the start date)
      const periodDuration = endDate && startDate 
        ? endDate.getTime() - startDate.getTime() 
        : 24 * 60 * 60 * 1000; // 1 day default
      
      const prevPeriodEnd = startDate 
        ? new Date(startDate.getTime() - 1) 
        : subDays(now, 1);
      const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);
      
      const prevStart = startOfDay(prevPeriodStart).toISOString();
      const prevEnd = endOfDay(prevPeriodEnd).toISOString();

      // Fetch current period orders (only paid orders for sales metrics)
      const { data: currentOrders } = await supabase
        .from('orders')
        .select('id, total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd);

      // Fetch previous period orders
      const { data: prevOrders } = await supabase
        .from('orders')
        .select('id, total, payment_status')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', prevStart)
        .lte('created_at', prevEnd);

      // Fetch current period new customers
      const { count: newCustomersCurrent } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .is('deleted_at', null)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd);

      // Fetch previous period new customers
      const { count: newCustomersPrev } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .is('deleted_at', null)
        .gte('created_at', prevStart)
        .lte('created_at', prevEnd);

      // Calculate metrics - consider approved orders for sales
      const paidCurrentOrders = currentOrders?.filter(o => o.payment_status === 'approved') || [];
      const paidPrevOrders = prevOrders?.filter(o => o.payment_status === 'approved') || [];

      const salesCurrent = paidCurrentOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const salesPrev = paidPrevOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      const ordersCurrent = currentOrders?.length || 0;
      const ordersPrev = prevOrders?.length || 0;

      const ticketCurrent = paidCurrentOrders.length > 0 ? salesCurrent / paidCurrentOrders.length : 0;
      const ticketPrev = paidPrevOrders.length > 0 ? salesPrev / paidPrevOrders.length : 0;

      return {
        salesToday: salesCurrent,
        salesYesterday: salesPrev,
        ordersToday: ordersCurrent,
        ordersYesterday: ordersPrev,
        ticketToday: ticketCurrent,
        ticketYesterday: ticketPrev,
        newCustomersToday: newCustomersCurrent || 0,
        newCustomersYesterday: newCustomersPrev || 0,
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
