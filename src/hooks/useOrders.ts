import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  OrderStatus, 
  PaymentStatus, 
  ShippingStatus,
  ORDER_STATUS_CONFIG,
  PAYMENT_STATUS_CONFIG,
  SHIPPING_STATUS_CONFIG,
  normalizeOrderStatus,
  normalizePaymentStatus,
  normalizeShippingStatus,
} from '@/types/orderStatus';
import { coreOrdersApi, type CreateOrderData } from '@/lib/coreApi';

// Re-export types for backward compatibility
export type { OrderStatus, PaymentStatus, ShippingStatus };
export { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, SHIPPING_STATUS_CONFIG };

export type PaymentMethod = 
  | 'pix' 
  | 'credit_card' 
  | 'debit_card' 
  | 'boleto' 
  | 'mercado_pago' 
  | 'pagarme';

export interface Order {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  order_number: string;
  status: OrderStatus;
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  payment_gateway: string | null;
  payment_gateway_id: string | null;
  paid_at: string | null;
  shipping_status: ShippingStatus;
  shipping_carrier: string | null;
  shipping_service_code: string | null;
  shipping_service_name: string | null;
  shipping_estimated_days: number | null;
  tracking_code: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  billing_street: string | null;
  billing_number: string | null;
  billing_complement: string | null;
  billing_neighborhood: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  customer_notes: string | null;
  internal_notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  // Marketplace fields
  source_order_number: string | null;
  source_platform: string | null;
  marketplace_source: string | null;
  marketplace_order_id: string | null;
  marketplace_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // New canonical fields
  currency: string | null;
  fx_rate: number | null;
  shipping_method_name: string | null;
  shipping_method_code: string | null;
  tracking_url: string | null;
  gateway_payload: Record<string, unknown> | null;
  source_hash: string | null;
  customer_cpf: string | null;
  installments: number | null;
  installment_value: number | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  product_name: string;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  created_at: string;
  // New canonical fields
  product_slug: string | null;
  variant_id: string | null;
  variant_name: string | null;
  image_file_id: string | null;
  weight: number | null;
  tax_amount: number | null;
  cost_price: number | null;
  barcode: string | null;
  ncm: string | null;
  tenant_id: string | null;
}

export interface OrderHistory {
  id: string;
  order_id: string;
  author_id: string | null;
  action: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items?: OrderItem[];
}

// Re-export CreateOrderData from coreApi
export type { CreateOrderData };

export function useOrders(options?: { 
  page?: number; 
  pageSize?: number; 
  search?: string; 
  status?: string;
  paymentStatus?: string;
  shippingStatus?: string;
  startDate?: Date;
  endDate?: Date;
  dateField?: string;
}) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const search = options?.search ?? '';
  const status = options?.status ?? 'all';
  const paymentStatus = options?.paymentStatus ?? 'all';
  const shippingStatus = options?.shippingStatus ?? 'all';
  const startDate = options?.startDate;
  const endDate = options?.endDate;
  const dateField = options?.dateField ?? 'created_at';

  const ordersQuery = useQuery({
    queryKey: ['orders', currentTenant?.id, page, pageSize, search, status, paymentStatus, shippingStatus, startDate?.toISOString(), endDate?.toISOString(), dateField],
    queryFn: async () => {
      if (!currentTenant?.id) return { data: [], count: 0 };
      
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('tenant_id', currentTenant.id);

      // Apply filters - using 'as any' to bypass strict typing from generated Supabase types
      // The actual DB columns accept string values
      if (search) {
        query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status as any);
      }
      if (paymentStatus && paymentStatus !== 'all') {
        query = query.eq('payment_status', paymentStatus as any);
      }
      if (shippingStatus && shippingStatus !== 'all') {
        query = query.eq('shipping_status', shippingStatus as any);
      }

      // Date filters
      if (startDate) {
        const startIso = startDate.toISOString();
        query = query.gte(dateField, startIso);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte(dateField, endOfDay.toISOString());
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await query
        .order('order_number', { ascending: true })
        .range(from, to);

      if (error) throw error;
      return { data: data as Order[], count: count ?? 0 };
    },
    enabled: !!currentTenant?.id,
  });

  // ===== CREATE ORDER VIA CORE API =====
  const createOrder = useMutation({
    mutationFn: async (formData: CreateOrderData) => {
      const result = await coreOrdersApi.createOrder(formData);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar pedido');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', currentTenant?.id] });
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar pedido:', error);
      toast.error(error.message || 'Erro ao criar pedido');
    },
  });

  // ===== UPDATE ORDER STATUS VIA CORE API =====
  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status, reason }: { orderId: string; status: OrderStatus; reason?: string }) => {
      const result = await coreOrdersApi.setOrderStatus(orderId, status, reason);
      
      if (!result.success) {
        if (result.code === 'INVALID_TRANSITION') {
          throw new Error('Transição de status inválida');
        }
        throw new Error(result.error || 'Erro ao atualizar status');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', currentTenant?.id] });
      toast.success('Status atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error(error.message || 'Erro ao atualizar status');
    },
  });

  // ===== DELETE ORDER VIA CORE API =====
  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const result = await coreOrdersApi.deleteOrder(id);
      
      if (!result.success) {
        if (result.code === 'CANNOT_DELETE') {
          throw new Error('Apenas pedidos pendentes ou cancelados podem ser excluídos');
        }
        throw new Error(result.error || 'Erro ao remover pedido');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', currentTenant?.id] });
      toast.success('Pedido removido!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover pedido:', error);
      toast.error(error.message || 'Erro ao remover pedido');
    },
  });

  return {
    orders: ordersQuery.data?.data ?? [],
    totalCount: ordersQuery.data?.count ?? 0,
    isLoading: ordersQuery.isLoading,
    error: ordersQuery.error,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    refetch: ordersQuery.refetch,
  };
}

export function useOrderDetails(orderId: string | undefined) {
  const queryClient = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as Order;
    },
    enabled: !!orderId,
  });

  const itemsQuery = useQuery({
    queryKey: ['order-items', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);

      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!orderId,
  });

  const historyQuery = useQuery({
    queryKey: ['order-history', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from('order_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderHistory[];
    },
    enabled: !!orderId,
  });

  // ===== ADD NOTE VIA CORE API =====
  const addNote = useMutation({
    mutationFn: async ({ orderId, note }: { orderId: string; note: string }) => {
      const result = await coreOrdersApi.addNote(orderId, note);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao adicionar nota');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      toast.success('Nota adicionada!');
    },
    onError: (error: Error) => {
      console.error('Erro ao adicionar nota:', error);
      toast.error(error.message || 'Erro ao adicionar nota');
    },
  });

  // ===== UPDATE TRACKING VIA CORE API =====
  const updateTrackingCode = useMutation({
    mutationFn: async ({ orderId, trackingCode, carrier }: { orderId: string; trackingCode: string; carrier?: string }) => {
      const result = await coreOrdersApi.updateTracking(orderId, trackingCode, carrier);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar código de rastreio');
      }

      // Also call shipment-ingest for backwards compatibility
      try {
        await supabase.functions.invoke('shipment-ingest', {
          body: {
            order_id: orderId,
            tracking_code: trackingCode,
            carrier: carrier || null,
            source: 'admin_manual',
          }
        });
      } catch (ingestErr) {
        console.error('Exception ingesting shipment:', ingestErr);
        // Don't fail the whole operation
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast.success('Código de rastreio atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar código de rastreio:', error);
      toast.error(error.message || 'Erro ao atualizar código de rastreio');
    },
  });

  // ===== UPDATE PAYMENT STATUS VIA CORE API =====
  const updatePaymentStatus = useMutation({
    mutationFn: async ({ orderId, paymentStatus }: { orderId: string; paymentStatus: PaymentStatus }) => {
      const result = await coreOrdersApi.setPaymentStatus(orderId, paymentStatus);
      
      if (!result.success) {
        if (result.code === 'INVALID_TRANSITION') {
          throw new Error('Transição de status de pagamento inválida');
        }
        throw new Error(result.error || 'Erro ao atualizar status de pagamento');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      toast.success('Status de pagamento atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar status de pagamento:', error);
      toast.error(error.message || 'Erro ao atualizar status de pagamento');
    },
  });

  // ===== UPDATE SHIPPING ADDRESS VIA CORE API =====
  const updateShippingAddress = useMutation({
    mutationFn: async ({ orderId, address }: { 
      orderId: string; 
      address: {
        shipping_street: string;
        shipping_number: string;
        shipping_complement?: string;
        shipping_neighborhood?: string;
        shipping_city: string;
        shipping_state: string;
        shipping_postal_code: string;
      }
    }) => {
      const result = await coreOrdersApi.updateShippingAddress(orderId, address);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao atualizar endereço');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      toast.success('Endereço atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar endereço:', error);
      toast.error(error.message || 'Erro ao atualizar endereço');
    },
  });

  // ===== UPDATE SHIPPING STATUS VIA CORE API =====
  const updateShippingStatus = useMutation({
    mutationFn: async ({ orderId, shippingStatus, trackingCode, carrier }: { 
      orderId: string; 
      shippingStatus: ShippingStatus;
      trackingCode?: string;
      carrier?: string;
    }) => {
      const result = await coreOrdersApi.setShippingStatus(orderId, shippingStatus, {
        tracking_code: trackingCode,
        shipping_carrier: carrier,
      });
      
      if (!result.success) {
        if (result.code === 'INVALID_TRANSITION') {
          throw new Error('Transição de status de envio inválida');
        }
        throw new Error(result.error || 'Erro ao atualizar status de envio');
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      toast.success('Status de envio atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar status de envio:', error);
      toast.error(error.message || 'Erro ao atualizar status de envio');
    },
  });

  return {
    order: orderQuery.data,
    items: itemsQuery.data ?? [],
    history: historyQuery.data ?? [],
    isLoading: orderQuery.isLoading || itemsQuery.isLoading,
    addNote,
    updateTrackingCode,
    updatePaymentStatus,
    updateShippingAddress,
    updateShippingStatus,
  };
}

// Hook to create a test order for tracking validation
export function useCreateTestOrder() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('admin-create-test-order', {});
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data as {
        success: boolean;
        order: { id: string; order_number: string };
        shipment: { id: string } | null;
        message: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['orders', currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      toast.success(data.message || 'Pedido de teste criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar pedido de teste:', error);
      toast.error(error.message || 'Erro ao criar pedido de teste');
    },
  });
}
