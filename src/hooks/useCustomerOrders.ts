// =============================================
// USE CUSTOMER ORDERS - Provider for customer order data
// Supports real DB or mock mode for dev/preview
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderItem {
  id: string;
  product_name: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  status: 'pending' | 'awaiting_payment' | 'paid' | 'processing' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'returned';
  payment_status: 'pending' | 'processing' | 'approved' | 'declined';
  shipping_status: 'pending' | 'processing' | 'shipped' | 'in_transit' | 'delivered';
  total: number;
  subtotal: number;
  shipping_total: number;
  discount_total: number;
  created_at: string;
  shipped_at?: string;
  delivered_at?: string;
  tracking_code?: string;
  shipping_carrier?: string;
  items: OrderItem[];
  items_count?: number; // Legacy support for CustomerDetail
  customer_name: string;
  customer_email: string;
}

// Check if mock mode is enabled
function isMockMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('demoAccount') || params.has('mockOrders');
}

// Mock data for development/preview
const mockOrders: CustomerOrder[] = [
  {
    id: 'mock-order-1',
    order_number: 'PED-25-000001',
    status: 'delivered',
    payment_status: 'approved',
    shipping_status: 'delivered',
    total: 299.90,
    subtotal: 279.90,
    shipping_total: 20.00,
    discount_total: 0,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    shipped_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    delivered_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tracking_code: 'BR123456789XX',
    shipping_carrier: 'Correios',
    customer_name: 'Cliente Demo',
    customer_email: 'demo@exemplo.com',
    items: [
      { id: '1', product_name: 'Camiseta Premium', quantity: 2, unit_price: 89.95, total_price: 179.90, product_image_url: '' },
      { id: '2', product_name: 'Calça Jeans', quantity: 1, unit_price: 100.00, total_price: 100.00, product_image_url: '' },
    ],
  },
  {
    id: 'mock-order-2',
    order_number: 'PED-25-000002',
    status: 'shipped',
    payment_status: 'approved',
    shipping_status: 'in_transit',
    total: 159.90,
    subtotal: 139.90,
    shipping_total: 20.00,
    discount_total: 0,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    shipped_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    tracking_code: 'BR987654321YY',
    shipping_carrier: 'Correios',
    customer_name: 'Cliente Demo',
    customer_email: 'demo@exemplo.com',
    items: [
      { id: '3', product_name: 'Tênis Esportivo', quantity: 1, unit_price: 139.90, total_price: 139.90, product_image_url: '' },
    ],
  },
  {
    id: 'mock-order-3',
    order_number: 'PED-25-000003',
    status: 'processing',
    payment_status: 'approved',
    shipping_status: 'processing',
    total: 450.00,
    subtotal: 450.00,
    shipping_total: 0,
    discount_total: 0,
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    customer_name: 'Cliente Demo',
    customer_email: 'demo@exemplo.com',
    items: [
      { id: '4', product_name: 'Kit Completo', quantity: 1, unit_price: 450.00, total_price: 450.00, product_image_url: '' },
    ],
  },
];

// List orders for a customer
export function useCustomerOrders(customerEmail?: string) {
  const mockMode = isMockMode();

  const ordersQuery = useQuery({
    queryKey: ['customer-orders', customerEmail, mockMode],
    queryFn: async (): Promise<CustomerOrder[]> => {
      // Mock mode for dev/preview
      if (mockMode) {
        await new Promise(r => setTimeout(r, 500)); // Simulate latency
        return mockOrders;
      }

      if (!customerEmail) return [];

      // Real query
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, shipping_status,
          total, subtotal, shipping_total, discount_total,
          created_at, shipped_at, delivered_at, tracking_code, shipping_carrier,
          customer_name, customer_email
        `)
        .eq('customer_email', customerEmail)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch items for each order
      const ordersWithItems: CustomerOrder[] = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('id, product_name, product_image_url, quantity, unit_price, total_price')
            .eq('order_id', order.id);

          return {
            ...order,
            items: items || [],
          } as CustomerOrder;
        })
      );

      return ordersWithItems;
    },
    enabled: mockMode || !!customerEmail,
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    error: ordersQuery.error,
    isMockMode: mockMode,
  };
}

// Get single order by ID
export function useCustomerOrder(orderId?: string) {
  const mockMode = isMockMode();

  const orderQuery = useQuery({
    queryKey: ['customer-order', orderId, mockMode],
    queryFn: async (): Promise<CustomerOrder | null> => {
      if (!orderId) return null;

      // Mock mode
      if (mockMode) {
        await new Promise(r => setTimeout(r, 300));
        return mockOrders.find(o => o.id === orderId || o.order_number === orderId) || null;
      }

      // Real query
      const { data: order, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, shipping_status,
          total, subtotal, shipping_total, discount_total,
          created_at, shipped_at, delivered_at, tracking_code, shipping_carrier,
          customer_name, customer_email
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      if (!order) return null;

      // Fetch items
      const { data: items } = await supabase
        .from('order_items')
        .select('id, product_name, product_image_url, quantity, unit_price, total_price')
        .eq('order_id', order.id);

      return { ...order, items: items || [] } as CustomerOrder;
    },
    enabled: !!orderId,
  });

  return {
    order: orderQuery.data || null,
    isLoading: orderQuery.isLoading,
    error: orderQuery.error,
    isMockMode: mockMode,
  };
}

// Get status label and color
export function getOrderStatusInfo(status: CustomerOrder['status']) {
  const statusMap: Record<CustomerOrder['status'], { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
    awaiting_payment: { label: 'Aguardando pagamento', color: 'bg-yellow-100 text-yellow-800' },
    paid: { label: 'Pago', color: 'bg-green-100 text-green-800' },
    processing: { label: 'Em separação', color: 'bg-blue-100 text-blue-800' },
    shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
    in_transit: { label: 'Em trânsito', color: 'bg-purple-100 text-purple-800' },
    delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
    returned: { label: 'Devolvido', color: 'bg-gray-100 text-gray-800' },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
}
