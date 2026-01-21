import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, format, parseISO } from "date-fns";

export interface SalesReportData {
  date: string;
  orders_count: number;
  total_revenue: number;
  avg_order_value: number;
  items_sold: number;
}

export interface SalesByCouponData {
  coupon_code: string;
  orders_count: number;
  total_revenue: number;
  total_discount: number;
}

export interface SalesByChannelData {
  channel: string;
  orders_count: number;
  total_revenue: number;
  percentage: number;
}

export interface SalesByProductData {
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity_sold: number;
  total_revenue: number;
}

export interface SalesByPaymentMethodData {
  payment_method: string;
  orders_count: number;
  total_revenue: number;
  percentage: number;
}

export interface SalesByStatusData {
  status: string;
  orders_count: number;
  total_revenue: number;
  percentage: number;
}

export interface SalesByRegionData {
  state: string;
  city: string;
  orders_count: number;
  total_revenue: number;
}

export interface CustomerReportData {
  new_customers: number;
  returning_customers: number;
  total_customers: number;
  avg_orders_per_customer: number;
}

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  groupBy?: 'day' | 'week' | 'month';
}

// Sales Over Time Report
export function useSalesReport(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'sales', tenantId, filters.startDate, filters.endDate, filters.groupBy],
    queryFn: async (): Promise<SalesReportData[]> => {
      if (!tenantId) return [];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, subtotal, created_at, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())
        .in('status', ['paid', 'processing', 'shipped', 'delivered']);

      if (error) throw error;

      // Get order items for items_sold count
      const orderIds = orders?.map(o => o.id) || [];
      let itemsData: { order_id: string; quantity: number }[] = [];
      
      if (orderIds.length > 0) {
        const { data: items } = await supabase
          .from('order_items')
          .select('order_id, quantity')
          .in('order_id', orderIds);
        itemsData = items || [];
      }

      // Group by date
      const groupedData: Record<string, { orders: number; revenue: number; items: number }> = {};
      
      orders?.forEach(order => {
        const date = format(parseISO(order.created_at), 
          filters.groupBy === 'month' ? 'yyyy-MM' : 
          filters.groupBy === 'week' ? 'yyyy-\'W\'ww' : 'yyyy-MM-dd'
        );
        
        if (!groupedData[date]) {
          groupedData[date] = { orders: 0, revenue: 0, items: 0 };
        }
        groupedData[date].orders++;
        groupedData[date].revenue += order.total || 0;
        
        const orderItems = itemsData.filter(i => i.order_id === order.id);
        groupedData[date].items += orderItems.reduce((sum, i) => sum + i.quantity, 0);
      });

      return Object.entries(groupedData)
        .map(([date, data]) => ({
          date,
          orders_count: data.orders,
          total_revenue: data.revenue,
          avg_order_value: data.orders > 0 ? data.revenue / data.orders : 0,
          items_sold: data.items,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Sales by Coupon Report
export function useSalesByCoupon(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'coupon', tenantId, filters.startDate, filters.endDate],
    queryFn: async (): Promise<SalesByCouponData[]> => {
      if (!tenantId) return [];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('discount_code, total, discount_total')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())
        .not('discount_code', 'is', null)
        .in('status', ['paid', 'processing', 'shipped', 'delivered']);

      if (error) throw error;

      const grouped: Record<string, { orders: number; revenue: number; discount: number }> = {};
      
      orders?.forEach(order => {
        const code = order.discount_code || 'Sem cupom';
        if (!grouped[code]) {
          grouped[code] = { orders: 0, revenue: 0, discount: 0 };
        }
        grouped[code].orders++;
        grouped[code].revenue += order.total || 0;
        grouped[code].discount += order.discount_total || 0;
      });

      return Object.entries(grouped)
        .map(([code, data]) => ({
          coupon_code: code,
          orders_count: data.orders,
          total_revenue: data.revenue,
          total_discount: data.discount,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Sales by Channel Report (marketplace_source)
export function useSalesByChannel(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'channel', tenantId, filters.startDate, filters.endDate],
    queryFn: async (): Promise<SalesByChannelData[]> => {
      if (!tenantId) return [];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('marketplace_source, total')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())
        .in('status', ['paid', 'processing', 'shipped', 'delivered']);

      if (error) throw error;

      const grouped: Record<string, { orders: number; revenue: number }> = {};
      let totalRevenue = 0;
      
      orders?.forEach(order => {
        const channel = order.marketplace_source || 'website';
        if (!grouped[channel]) {
          grouped[channel] = { orders: 0, revenue: 0 };
        }
        grouped[channel].orders++;
        grouped[channel].revenue += order.total || 0;
        totalRevenue += order.total || 0;
      });

      return Object.entries(grouped)
        .map(([channel, data]) => ({
          channel: getChannelLabel(channel),
          orders_count: data.orders,
          total_revenue: data.revenue,
          percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Sales by Product Report (Top Products)
export function useSalesByProduct(filters: ReportFilters, limit = 20) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'product', tenantId, filters.startDate, filters.endDate, limit],
    queryFn: async (): Promise<SalesByProductData[]> => {
      if (!tenantId) return [];

      // Get orders in date range
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())
        .in('status', ['paid', 'processing', 'shipped', 'delivered']);

      if (ordersError) throw ordersError;

      const orderIds = orders?.map(o => o.id) || [];
      if (orderIds.length === 0) return [];

      // Get order items
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, product_name, product_image_url, quantity, total_price')
        .in('order_id', orderIds);

      if (itemsError) throw itemsError;

      const grouped: Record<string, { name: string; image: string | null; qty: number; revenue: number }> = {};
      
      items?.forEach(item => {
        const pid = item.product_id || 'unknown';
        if (!grouped[pid]) {
          grouped[pid] = { name: item.product_name || 'Produto', image: item.product_image_url, qty: 0, revenue: 0 };
        }
        grouped[pid].qty += item.quantity || 0;
        grouped[pid].revenue += item.total_price || 0;
      });

      return Object.entries(grouped)
        .map(([id, data]) => ({
          product_id: id,
          product_name: data.name,
          product_image: data.image,
          quantity_sold: data.qty,
          total_revenue: data.revenue,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, limit);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Sales by Payment Method
export function useSalesByPaymentMethod(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'payment-method', tenantId, filters.startDate, filters.endDate],
    queryFn: async (): Promise<SalesByPaymentMethodData[]> => {
      if (!tenantId) return [];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('payment_method, total')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())
        .in('status', ['paid', 'processing', 'shipped', 'delivered']);

      if (error) throw error;

      const grouped: Record<string, { orders: number; revenue: number }> = {};
      let totalRevenue = 0;
      
      orders?.forEach(order => {
        const method = order.payment_method || 'Não informado';
        if (!grouped[method]) {
          grouped[method] = { orders: 0, revenue: 0 };
        }
        grouped[method].orders++;
        grouped[method].revenue += order.total || 0;
        totalRevenue += order.total || 0;
      });

      return Object.entries(grouped)
        .map(([method, data]) => ({
          payment_method: getPaymentMethodLabel(method),
          orders_count: data.orders,
          total_revenue: data.revenue,
          percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Sales by Status
export function useSalesByStatus(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'status', tenantId, filters.startDate, filters.endDate],
    queryFn: async (): Promise<SalesByStatusData[]> => {
      if (!tenantId) return [];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('status, total')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString());

      if (error) throw error;

      const grouped: Record<string, { orders: number; revenue: number }> = {};
      let totalOrders = 0;
      
      orders?.forEach(order => {
        const status = order.status || 'pending';
        if (!grouped[status]) {
          grouped[status] = { orders: 0, revenue: 0 };
        }
        grouped[status].orders++;
        grouped[status].revenue += order.total || 0;
        totalOrders++;
      });

      return Object.entries(grouped)
        .map(([status, data]) => ({
          status: getStatusLabel(status),
          orders_count: data.orders,
          total_revenue: data.revenue,
          percentage: totalOrders > 0 ? (data.orders / totalOrders) * 100 : 0,
        }))
        .sort((a, b) => b.orders_count - a.orders_count);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Sales by Region (State/City)
export function useSalesByRegion(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'region', tenantId, filters.startDate, filters.endDate],
    queryFn: async (): Promise<SalesByRegionData[]> => {
      if (!tenantId) return [];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('shipping_state, shipping_city, total')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())
        .in('status', ['paid', 'processing', 'shipped', 'delivered']);

      if (error) throw error;

      const grouped: Record<string, { orders: number; revenue: number; city: string }> = {};
      
      orders?.forEach(order => {
        const state = order.shipping_state || 'Não informado';
        const city = order.shipping_city || 'Não informado';
        const key = `${state}-${city}`;
        
        if (!grouped[key]) {
          grouped[key] = { orders: 0, revenue: 0, city };
        }
        grouped[key].orders++;
        grouped[key].revenue += order.total || 0;
      });

      return Object.entries(grouped)
        .map(([key, data]) => {
          const [state] = key.split('-');
          return {
            state,
            city: data.city,
            orders_count: data.orders,
            total_revenue: data.revenue,
          };
        })
        .sort((a, b) => b.total_revenue - a.total_revenue);
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Customer Report
export function useCustomerReport(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'customers', tenantId, filters.startDate, filters.endDate],
    queryFn: async (): Promise<CustomerReportData> => {
      if (!tenantId) return { new_customers: 0, returning_customers: 0, total_customers: 0, avg_orders_per_customer: 0 };

      // Get all customers created in period
      const { data: newCustomers, error: newError } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString());

      if (newError) throw newError;

      // Get all orders with customer info
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('customer_email')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString())
        .in('status', ['paid', 'processing', 'shipped', 'delivered']);

      if (ordersError) throw ordersError;

      const uniqueCustomers = new Set(orders?.map(o => o.customer_email).filter(Boolean));
      const customerOrderCount: Record<string, number> = {};
      
      orders?.forEach(order => {
        const email = order.customer_email;
        if (email) {
          customerOrderCount[email] = (customerOrderCount[email] || 0) + 1;
        }
      });

      const returningCustomers = Object.values(customerOrderCount).filter(count => count > 1).length;
      const totalCustomers = uniqueCustomers.size;
      const totalOrders = orders?.length || 0;

      return {
        new_customers: newCustomers?.length || 0,
        returning_customers: returningCustomers,
        total_customers: totalCustomers,
        avg_orders_per_customer: totalCustomers > 0 ? totalOrders / totalCustomers : 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Summary Stats for Dashboard
export function useReportSummary(filters: ReportFilters) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['reports', 'summary', tenantId, filters.startDate, filters.endDate],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, status, created_at')
        .eq('tenant_id', tenantId)
        .gte('created_at', filters.startDate.toISOString())
        .lte('created_at', filters.endDate.toISOString());

      if (error) throw error;

      const paidStatuses = ['paid', 'processing', 'shipped', 'delivered'];
      const paidOrders = orders?.filter(o => paidStatuses.includes(o.status)) || [];
      
      const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
      
      // Calculate compared to previous period
      const periodDays = Math.ceil((filters.endDate.getTime() - filters.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const prevStart = new Date(filters.startDate);
      prevStart.setDate(prevStart.getDate() - periodDays);
      const prevEnd = new Date(filters.startDate);
      prevEnd.setDate(prevEnd.getDate() - 1);

      const { data: prevOrders } = await supabase
        .from('orders')
        .select('total, status')
        .eq('tenant_id', tenantId)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString());

      const prevPaidOrders = prevOrders?.filter(o => paidStatuses.includes(o.status)) || [];
      const prevRevenue = prevPaidOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      const revenueChange = prevRevenue > 0 
        ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 
        : totalRevenue > 0 ? 100 : 0;

      return {
        total_orders: orders?.length || 0,
        paid_orders: paidOrders.length,
        total_revenue: totalRevenue,
        avg_order_value: avgOrderValue,
        revenue_change: revenueChange,
        cancelled_orders: orders?.filter(o => o.status === 'cancelled').length || 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

// Helper functions
function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    website: 'Loja Virtual',
    mercadolivre: 'Mercado Livre',
    shopee: 'Shopee',
    amazon: 'Amazon',
    americanas: 'Americanas',
    magalu: 'Magazine Luiza',
    manual: 'Venda Manual',
    api: 'API',
  };
  return labels[channel] || channel;
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    pix: 'PIX',
    boleto: 'Boleto',
    deposit: 'Depósito',
    cash: 'Dinheiro',
  };
  return labels[method] || method;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    awaiting_payment: 'Aguardando Pagamento',
    paid: 'Pago',
    processing: 'Processando',
    shipped: 'Enviado',
    in_transit: 'Em Trânsito',
    delivered: 'Entregue',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    returned: 'Devolvido',
  };
  return labels[status] || status;
}
