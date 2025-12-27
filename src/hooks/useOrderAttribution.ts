// =============================================
// USE ORDER ATTRIBUTION HOOK
// Fetches attribution data for orders in admin panel
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface OrderAttributionData {
  id: string;
  tenant_id: string;
  order_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  gclid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  msclkid: string | null;
  referrer_url: string | null;
  referrer_domain: string | null;
  landing_page: string | null;
  attribution_source: string | null;
  attribution_medium: string | null;
  session_id: string | null;
  first_touch_at: string | null;
  created_at: string;
}

export interface AttributionStats {
  source: string;
  medium: string;
  orders_count: number;
  total_revenue: number;
  avg_order_value: number;
}

/**
 * Fetch attribution data for a specific order
 */
export function useOrderAttribution(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-attribution', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('order_attribution')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching order attribution:', error);
        return null;
      }
      
      return data as OrderAttributionData | null;
    },
    enabled: !!orderId,
  });
}

/**
 * Fetch attribution stats for the tenant
 */
export function useAttributionStats(dateFrom?: string, dateTo?: string) {
  const { currentTenant } = useAuth();
  
  return useQuery({
    queryKey: ['attribution-stats', currentTenant?.id, dateFrom, dateTo],
    queryFn: async (): Promise<AttributionStats[]> => {
      if (!currentTenant?.id) return [];
      
      // Build query with date filters
      let query = supabase
        .from('order_attribution')
        .select(`
          attribution_source,
          attribution_medium,
          order_id,
          orders!inner(total, status)
        `)
        .eq('tenant_id', currentTenant.id);
      
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching attribution stats:', error);
        return [];
      }
      
      // Aggregate stats by source/medium
      const statsMap = new Map<string, AttributionStats>();
      
      for (const item of data || []) {
        const source = item.attribution_source || 'unknown';
        const medium = item.attribution_medium || 'unknown';
        const key = `${source}|${medium}`;
        const order = item.orders as any;
        
        // Only count paid/completed orders
        if (!order || !['paid', 'confirmed', 'shipped', 'delivered'].includes(order.status)) {
          continue;
        }
        
        const existing = statsMap.get(key) || {
          source,
          medium,
          orders_count: 0,
          total_revenue: 0,
          avg_order_value: 0,
        };
        
        existing.orders_count += 1;
        existing.total_revenue += order.total || 0;
        existing.avg_order_value = existing.total_revenue / existing.orders_count;
        
        statsMap.set(key, existing);
      }
      
      // Convert to array and sort by revenue
      return Array.from(statsMap.values())
        .sort((a, b) => b.total_revenue - a.total_revenue);
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Fetch all attribution records for orders list
 */
export function useOrdersAttribution(orderIds: string[]) {
  return useQuery({
    queryKey: ['orders-attribution', orderIds],
    queryFn: async () => {
      if (!orderIds.length) return {};
      
      const { data, error } = await supabase
        .from('order_attribution')
        .select('order_id, attribution_source, attribution_medium')
        .in('order_id', orderIds);
      
      if (error) {
        console.error('Error fetching orders attribution:', error);
        return {};
      }
      
      // Create a map for quick lookup
      const attributionMap: Record<string, { source: string; medium: string }> = {};
      for (const item of data || []) {
        attributionMap[item.order_id] = {
          source: item.attribution_source || 'unknown',
          medium: item.attribution_medium || 'unknown',
        };
      }
      
      return attributionMap;
    },
    enabled: orderIds.length > 0,
  });
}
