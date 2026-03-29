import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { startOfDay, subDays, endOfDay } from 'date-fns';

export interface DashboardMetrics {
  salesToday: number;
  salesYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  paidOrdersToday: number;
  paidOrdersYesterday: number;
  unpaidOrdersToday: number;
  unpaidOrdersYesterday: number;
  ticketToday: number;
  ticketYesterday: number;
  newCustomersToday: number;
  newCustomersYesterday: number;
  visitorsToday: number;
  visitorsYesterday: number;
  // Funnel metrics
  cartsToday: number;
  cartsYesterday: number;
  checkoutsStartedToday: number;
  checkoutsStartedYesterday: number;
  leadsToday: number;
  leadsYesterday: number;
  shippingSelectedToday: number;
  shippingSelectedYesterday: number;
  paymentSelectedToday: number;
  paymentSelectedYesterday: number;
  // Abandoned checkout metrics
  abandonedCheckoutsToday: number;
  abandonedCheckoutsYesterday: number;
  recoveredCheckoutsToday: number;
  errorCheckoutsToday: number;
  // Faturamento metrics
  totalRevenueToday: number;
  totalRevenueYesterday: number;
  adSpendToday: number;
  adSpendYesterday: number;
  conversionRateToday: number;
  conversionRateYesterday: number;
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

const EMPTY_METRICS: DashboardMetrics = {
  salesToday: 0, salesYesterday: 0,
  ordersToday: 0, ordersYesterday: 0,
  paidOrdersToday: 0, paidOrdersYesterday: 0,
  unpaidOrdersToday: 0, unpaidOrdersYesterday: 0,
  ticketToday: 0, ticketYesterday: 0,
  newCustomersToday: 0, newCustomersYesterday: 0,
  visitorsToday: 0, visitorsYesterday: 0,
  cartsToday: 0, cartsYesterday: 0,
  checkoutsStartedToday: 0, checkoutsStartedYesterday: 0,
  leadsToday: 0, leadsYesterday: 0,
  shippingSelectedToday: 0, shippingSelectedYesterday: 0,
  paymentSelectedToday: 0, paymentSelectedYesterday: 0,
  abandonedCheckoutsToday: 0, abandonedCheckoutsYesterday: 0,
  recoveredCheckoutsToday: 0, errorCheckoutsToday: 0,
  totalRevenueToday: 0, totalRevenueYesterday: 0,
  adSpendToday: 0, adSpendYesterday: 0,
  conversionRateToday: 0, conversionRateYesterday: 0,
};

function computePeriods(startDate?: Date, endDate?: Date, firstOrderDate?: Date) {
  const now = new Date();

  // "Todo o período": use first confirmed order date as start (not arbitrary 2000-01-01)
  const isAllTime = !startDate && !endDate;
  
  let periodStart: string;
  let periodEnd: string;

  if (isAllTime) {
    // Use first confirmed order or fallback to 90 days ago
    const baseDate = firstOrderDate || subDays(now, 90);
    periodStart = startOfDay(baseDate).toISOString();
    periodEnd = endOfDay(now).toISOString();
  } else {
    periodStart = startOfDay(startDate!).toISOString();
    periodEnd = endOfDay(endDate!).toISOString();
  }

  const startMs = isAllTime
    ? (firstOrderDate || subDays(now, 90)).getTime()
    : startDate!.getTime();
  const endMs = isAllTime ? now.getTime() : endDate!.getTime();
  const periodDuration = (endMs - startMs) || 24 * 60 * 60 * 1000;

  const prevPeriodEnd = new Date(startMs - 1);
  const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodDuration);

  return {
    periodStart,
    periodEnd,
    prevStart: startOfDay(prevPeriodStart).toISOString(),
    prevEnd: endOfDay(prevPeriodEnd).toISOString(),
  };
}

export function useDashboardMetrics(startDate?: Date, endDate?: Date) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['dashboard-metrics', currentTenant?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async (): Promise<DashboardMetrics> => {
      if (!currentTenant?.id) return EMPTY_METRICS;

      const tid = currentTenant.id;
      const isAllTime = !startDate && !endDate;

      // For "Todo o período": fetch first confirmed order date as baseline
      let firstOrderDate: Date | undefined;
      if (isAllTime) {
        const { data: firstOrder } = await supabase
          .from('orders')
          .select('created_at')
          .eq('tenant_id', tid)
          .not('payment_gateway_id', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        
        if (firstOrder?.created_at) {
          firstOrderDate = new Date(firstOrder.created_at);
        }
      }

      const { periodStart, periodEnd, prevStart, prevEnd } = computePeriods(startDate, endDate, firstOrderDate);
      const tid = currentTenant.id;

      // Use REST API for checkout_sessions funnel fields (not in generated types yet)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      const [
        currentOrdersRes, prevOrdersRes,
        newCustomersCurrentRes, newCustomersPrevRes,
        visitorsCurrentRes, visitorsPrevRes,
        cartsCurrentRes, cartsPrevRes,
        checkoutsCurrentRes, checkoutsPrevRes,
        metaSpendCurrentRes, metaSpendPrevRes,
        googleSpendCurrentRes, googleSpendPrevRes,
        tiktokSpendCurrentRes, tiktokSpendPrevRes,
      ] = await Promise.all([
        // Ghost Order Rule: only count orders confirmed by gateway
        supabase.from('orders').select('id, total, payment_status').eq('tenant_id', tid).not('payment_gateway_id', 'is', null).gte('created_at', periodStart).lte('created_at', periodEnd),
        supabase.from('orders').select('id, total, payment_status').eq('tenant_id', tid).not('payment_gateway_id', 'is', null).gte('created_at', prevStart).lte('created_at', prevEnd),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).is('deleted_at', null).gte('created_at', periodStart).lte('created_at', periodEnd),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).is('deleted_at', null).gte('created_at', prevStart).lte('created_at', prevEnd),
        // Unique visitors via DB-level COUNT(DISTINCT) — no 1000-row limit
        supabase.rpc('count_unique_visitors', { p_tenant_id: tid, p_start: periodStart, p_end: periodEnd }),
        supabase.rpc('count_unique_visitors', { p_tenant_id: tid, p_start: prevStart, p_end: prevEnd }),
        supabase.from('carts').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', periodStart).lte('created_at', periodEnd),
        supabase.from('carts').select('id', { count: 'exact', head: true }).eq('tenant_id', tid).gte('created_at', prevStart).lte('created_at', prevEnd),
        supabase.from('checkout_sessions').select('id, status, recovered_at, customer_email, customer_phone, order_id').eq('tenant_id', tid).gte('created_at', periodStart).lte('created_at', periodEnd),
        supabase.from('checkout_sessions').select('id, status, order_id').eq('tenant_id', tid).gte('created_at', prevStart).lte('created_at', prevEnd),
        // Ad spend - Meta
        supabase.from('meta_ad_insights').select('spend_cents').eq('tenant_id', tid).gte('date_start', periodStart.slice(0, 10)).lte('date_start', periodEnd.slice(0, 10)),
        supabase.from('meta_ad_insights').select('spend_cents').eq('tenant_id', tid).gte('date_start', prevStart.slice(0, 10)).lte('date_start', prevEnd.slice(0, 10)),
        // Ad spend - Google (cost_micros = micros, /1_000_000 to get currency)
        supabase.from('google_ad_insights').select('cost_micros').eq('tenant_id', tid).gte('date', periodStart.slice(0, 10)).lte('date', periodEnd.slice(0, 10)),
        supabase.from('google_ad_insights').select('cost_micros').eq('tenant_id', tid).gte('date', prevStart.slice(0, 10)).lte('date', prevEnd.slice(0, 10)),
        // Ad spend - TikTok
        supabase.from('tiktok_ad_insights').select('spend_cents').eq('tenant_id', tid).gte('date_start', periodStart.slice(0, 10)).lte('date_start', periodEnd.slice(0, 10)),
        supabase.from('tiktok_ad_insights').select('spend_cents').eq('tenant_id', tid).gte('date_start', prevStart.slice(0, 10)).lte('date_start', prevEnd.slice(0, 10)),
      ]);

      // Fetch funnel step counts via REST API (new columns not in types yet)
      let leadsCurrentCount = 0;
      let leadsPrevCount = 0;
      let shippingCurrentCount = 0;
      let shippingPrevCount = 0;
      let paymentCurrentCount = 0;
      let paymentPrevCount = 0;

      if (accessToken) {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Prefer': 'count=exact',
        };

        const [leadsCur, leadsPrev, shipCur, shipPrev, payCur, payPrev] = await Promise.all([
          // Leads current period
          fetch(`${supabaseUrl}/rest/v1/checkout_sessions?tenant_id=eq.${tid}&contact_captured_at=gte.${periodStart}&contact_captured_at=lte.${periodEnd}&select=id`, { headers, method: 'HEAD' }),
          fetch(`${supabaseUrl}/rest/v1/checkout_sessions?tenant_id=eq.${tid}&contact_captured_at=gte.${prevStart}&contact_captured_at=lte.${prevEnd}&select=id`, { headers, method: 'HEAD' }),
          // Shipping selected current
          fetch(`${supabaseUrl}/rest/v1/checkout_sessions?tenant_id=eq.${tid}&shipping_selected_at=gte.${periodStart}&shipping_selected_at=lte.${periodEnd}&select=id`, { headers, method: 'HEAD' }),
          fetch(`${supabaseUrl}/rest/v1/checkout_sessions?tenant_id=eq.${tid}&shipping_selected_at=gte.${prevStart}&shipping_selected_at=lte.${prevEnd}&select=id`, { headers, method: 'HEAD' }),
          // Payment selected current
          fetch(`${supabaseUrl}/rest/v1/checkout_sessions?tenant_id=eq.${tid}&payment_selected_at=gte.${periodStart}&payment_selected_at=lte.${periodEnd}&select=id`, { headers, method: 'HEAD' }),
          fetch(`${supabaseUrl}/rest/v1/checkout_sessions?tenant_id=eq.${tid}&payment_selected_at=gte.${prevStart}&payment_selected_at=lte.${prevEnd}&select=id`, { headers, method: 'HEAD' }),
        ]);

        leadsCurrentCount = parseInt(leadsCur.headers.get('content-range')?.split('/')[1] || '0', 10) || 0;
        leadsPrevCount = parseInt(leadsPrev.headers.get('content-range')?.split('/')[1] || '0', 10) || 0;
        shippingCurrentCount = parseInt(shipCur.headers.get('content-range')?.split('/')[1] || '0', 10) || 0;
        shippingPrevCount = parseInt(shipPrev.headers.get('content-range')?.split('/')[1] || '0', 10) || 0;
        paymentCurrentCount = parseInt(payCur.headers.get('content-range')?.split('/')[1] || '0', 10) || 0;
        paymentPrevCount = parseInt(payPrev.headers.get('content-range')?.split('/')[1] || '0', 10) || 0;
      }

      const currentOrders = currentOrdersRes.data || [];
      const prevOrders = prevOrdersRes.data || [];

      // RPC returns integer directly (COUNT DISTINCT at DB level)
      const uniqueVisitorsCurrent = (visitorsCurrentRes.data as unknown as number) || 0;
      const uniqueVisitorsPrev = (visitorsPrevRes.data as unknown as number) || 0;

      const paidCurrent = currentOrders.filter(o => o.payment_status === 'approved');
      const paidPrev = prevOrders.filter(o => o.payment_status === 'approved');
      const unpaidCurrent = currentOrders.filter(o => o.payment_status !== 'approved');
      const unpaidPrev = prevOrders.filter(o => o.payment_status !== 'approved');

      const salesCurrent = paidCurrent.reduce((s, o) => s + (o.total || 0), 0);
      const salesPrev = paidPrev.reduce((s, o) => s + (o.total || 0), 0);

      // Total revenue (paid + unpaid)
      const totalRevenueCurrent = currentOrders.reduce((s, o) => s + (o.total || 0), 0);
      const totalRevenuePrev = prevOrders.reduce((s, o) => s + (o.total || 0), 0);

      // Ad spend aggregation (Meta cents + Google micros + TikTok cents)
      const metaSpendCurrent = (metaSpendCurrentRes.data || []).reduce((s, r) => s + (r.spend_cents || 0), 0) / 100;
      const metaSpendPrev = (metaSpendPrevRes.data || []).reduce((s, r) => s + (r.spend_cents || 0), 0) / 100;
      const googleSpendCurrent = (googleSpendCurrentRes.data || []).reduce((s, r) => s + (r.cost_micros || 0), 0) / 1_000_000;
      const googleSpendPrev = (googleSpendPrevRes.data || []).reduce((s, r) => s + (r.cost_micros || 0), 0) / 1_000_000;
      const tiktokSpendCurrent = (tiktokSpendCurrentRes.data || []).reduce((s, r) => s + (r.spend_cents || 0), 0) / 100;
      const tiktokSpendPrev = (tiktokSpendPrevRes.data || []).reduce((s, r) => s + (r.spend_cents || 0), 0) / 100;

      const adSpendCurrent = metaSpendCurrent + googleSpendCurrent + tiktokSpendCurrent;
      const adSpendPrev = metaSpendPrev + googleSpendPrev + tiktokSpendPrev;

      // Conversion rate: paid orders / visitors * 100
      const convRateCurrent = uniqueVisitorsCurrent > 0 ? (paidCurrent.length / uniqueVisitorsCurrent) * 100 : 0;
      const convRatePrev = uniqueVisitorsPrev > 0 ? (paidPrev.length / uniqueVisitorsPrev) * 100 : 0;

      // Checkout sessions metrics
      const checkoutsCurrent = checkoutsCurrentRes.data || [];
      const checkoutsPrev = checkoutsPrevRes.data || [];
      // REGRA: só contar abandono real (sem pedido vinculado) — ghost orders não são abandono
      const abandonedCurrent = checkoutsCurrent.filter(c => c.status === 'abandoned' && !c.order_id);
      const abandonedPrev = checkoutsPrev.filter(c => c.status === 'abandoned' && !c.order_id);
      const recoveredCurrent = checkoutsCurrent.filter(c => c.recovered_at != null);
      const errorCurrent = abandonedCurrent.filter(c => {
        const hasEmail = c.customer_email && c.customer_email.includes('@');
        const hasPhone = c.customer_phone && c.customer_phone.length >= 8;
        return !hasEmail && !hasPhone;
      });

      return {
        salesToday: salesCurrent,
        salesYesterday: salesPrev,
        ordersToday: currentOrders.length,
        ordersYesterday: prevOrders.length,
        paidOrdersToday: paidCurrent.length,
        paidOrdersYesterday: paidPrev.length,
        unpaidOrdersToday: unpaidCurrent.length,
        unpaidOrdersYesterday: unpaidPrev.length,
        ticketToday: paidCurrent.length > 0 ? salesCurrent / paidCurrent.length : 0,
        ticketYesterday: paidPrev.length > 0 ? salesPrev / paidPrev.length : 0,
        newCustomersToday: newCustomersCurrentRes.count || 0,
        newCustomersYesterday: newCustomersPrevRes.count || 0,
        visitorsToday: uniqueVisitorsCurrent,
        visitorsYesterday: uniqueVisitorsPrev,
        cartsToday: cartsCurrentRes.count || 0,
        cartsYesterday: cartsPrevRes.count || 0,
        checkoutsStartedToday: checkoutsCurrent.length,
        checkoutsStartedYesterday: checkoutsPrev.length,
        leadsToday: leadsCurrentCount,
        leadsYesterday: leadsPrevCount,
        shippingSelectedToday: shippingCurrentCount,
        shippingSelectedYesterday: shippingPrevCount,
        paymentSelectedToday: paymentCurrentCount,
        paymentSelectedYesterday: paymentPrevCount,
        abandonedCheckoutsToday: abandonedCurrent.length,
        abandonedCheckoutsYesterday: abandonedPrev.length,
        recoveredCheckoutsToday: recoveredCurrent.length,
        errorCheckoutsToday: errorCurrent.length,
        totalRevenueToday: totalRevenueCurrent,
        totalRevenueYesterday: totalRevenuePrev,
        adSpendToday: adSpendCurrent,
        adSpendYesterday: adSpendPrev,
        conversionRateToday: convRateCurrent,
        conversionRateYesterday: convRatePrev,
      };
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 60000,
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
    refetchInterval: 30000,
  });
}

export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

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