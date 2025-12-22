import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type OrderStatus = 
  | 'pending' 
  | 'awaiting_payment' 
  | 'paid' 
  | 'processing' 
  | 'shipped' 
  | 'in_transit' 
  | 'delivered' 
  | 'cancelled' 
  | 'returned';

export type PaymentMethod = 
  | 'pix' 
  | 'credit_card' 
  | 'debit_card' 
  | 'boleto' 
  | 'mercado_pago' 
  | 'pagarme';

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'approved' 
  | 'declined' 
  | 'refunded' 
  | 'cancelled';

export type ShippingStatus = 
  | 'pending' 
  | 'processing' 
  | 'shipped' 
  | 'in_transit' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'returned' 
  | 'failed';

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
  created_at: string;
  updated_at: string;
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

export interface CreateOrderData {
  customer_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  payment_method?: PaymentMethod | null;
  shipping_street?: string | null;
  shipping_number?: string | null;
  shipping_complement?: string | null;
  shipping_neighborhood?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string | null;
  customer_notes?: string | null;
  items: {
    product_id: string;
    sku: string;
    product_name: string;
    product_image_url?: string | null;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }[];
}

export function useOrders(options?: { 
  page?: number; 
  pageSize?: number; 
  search?: string; 
  status?: string;
  paymentStatus?: string;
}) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const search = options?.search ?? '';
  const status = options?.status ?? 'all';
  const paymentStatus = options?.paymentStatus ?? 'all';

  const ordersQuery = useQuery({
    queryKey: ['orders', currentTenant?.id, page, pageSize, search, status, paymentStatus],
    queryFn: async () => {
      if (!currentTenant?.id) return { data: [], count: 0 };
      
      let query = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('tenant_id', currentTenant.id);

      // Apply filters
      if (search) {
        query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
      }
      if (status && status !== 'all') {
        query = query.eq('status', status as OrderStatus);
      }
      if (paymentStatus && paymentStatus !== 'all') {
        query = query.eq('payment_status', paymentStatus as PaymentStatus);
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      
      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data as Order[], count: count ?? 0 };
    },
    enabled: !!currentTenant?.id,
  });

  const createOrder = useMutation({
    mutationFn: async (formData: CreateOrderData) => {
      if (!currentTenant?.id) throw new Error('Tenant não encontrado');

      // Generate order number
      const { data: orderNumber, error: numberError } = await supabase
        .rpc('generate_order_number', { p_tenant_id: currentTenant.id });

      if (numberError) throw numberError;

      // Calculate totals
      const subtotal = formData.items.reduce((sum, item) => 
        sum + (item.unit_price * item.quantity), 0);
      const discountTotal = formData.items.reduce((sum, item) => 
        sum + ((item.discount_amount || 0) * item.quantity), 0);
      const total = subtotal - discountTotal;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: currentTenant.id,
          order_number: orderNumber,
          customer_id: formData.customer_id,
          customer_name: formData.customer_name,
          customer_email: formData.customer_email,
          customer_phone: formData.customer_phone,
          payment_method: formData.payment_method,
          shipping_street: formData.shipping_street,
          shipping_number: formData.shipping_number,
          shipping_complement: formData.shipping_complement,
          shipping_neighborhood: formData.shipping_neighborhood,
          shipping_city: formData.shipping_city,
          shipping_state: formData.shipping_state,
          shipping_postal_code: formData.shipping_postal_code,
          customer_notes: formData.customer_notes,
          subtotal,
          discount_total: discountTotal,
          total,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const items = formData.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        sku: item.sku,
        product_name: item.product_name,
        product_image_url: item.product_image_url,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount || 0,
        total_price: (item.unit_price - (item.discount_amount || 0)) * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Create history entry
      await supabase.from('order_history').insert({
        order_id: order.id,
        action: 'order_created',
        description: `Pedido ${orderNumber} criado`,
        new_value: { status: 'pending' },
      });

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', currentTenant?.id] });
      toast.success('Pedido criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar pedido:', error);
      toast.error('Erro ao criar pedido');
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status, reason }: { orderId: string; status: OrderStatus; reason?: string }) => {
      // Get current order
      const { data: currentOrder, error: fetchError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      const updateData: Record<string, unknown> = { status };
      
      if (status === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = reason;
      } else if (status === 'shipped') {
        updateData.shipped_at = new Date().toISOString();
        updateData.shipping_status = 'shipped';
      } else if (status === 'delivered') {
        updateData.delivered_at = new Date().toISOString();
        updateData.shipping_status = 'delivered';
      } else if (status === 'paid') {
        updateData.paid_at = new Date().toISOString();
        updateData.payment_status = 'approved';
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;

      // Create history entry
      await supabase.from('order_history').insert({
        order_id: orderId,
        action: 'status_changed',
        previous_value: { status: currentOrder.status },
        new_value: { status },
        description: `Status alterado de ${currentOrder.status} para ${status}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', currentTenant?.id] });
      toast.success('Status atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', currentTenant?.id] });
      toast.success('Pedido removido!');
    },
    onError: (error: Error) => {
      console.error('Erro ao remover pedido:', error);
      toast.error('Erro ao remover pedido');
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

  const addNote = useMutation({
    mutationFn: async ({ orderId, note }: { orderId: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Update internal notes
      const { data: order } = await supabase
        .from('orders')
        .select('internal_notes')
        .eq('id', orderId)
        .single();

      const existingNotes = order?.internal_notes || '';
      const newNotes = existingNotes 
        ? `${existingNotes}\n\n[${new Date().toLocaleString('pt-BR')}]\n${note}`
        : `[${new Date().toLocaleString('pt-BR')}]\n${note}`;

      const { error } = await supabase
        .from('orders')
        .update({ internal_notes: newNotes })
        .eq('id', orderId);

      if (error) throw error;

      // Add history
      await supabase.from('order_history').insert({
        order_id: orderId,
        author_id: user?.id,
        action: 'note_added',
        description: note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      toast.success('Nota adicionada!');
    },
  });

  const updateTrackingCode = useMutation({
    mutationFn: async ({ orderId, trackingCode, carrier }: { orderId: string; trackingCode: string; carrier?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();

      const updateData: Record<string, unknown> = { tracking_code: trackingCode };
      if (carrier) {
        updateData.shipping_carrier = carrier;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Add history
      await supabase.from('order_history').insert({
        order_id: orderId,
        author_id: user?.id,
        action: 'tracking_updated',
        description: `Código de rastreio atualizado: ${trackingCode}${carrier ? ` (${carrier})` : ''}`,
        new_value: { tracking_code: trackingCode, shipping_carrier: carrier },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['order-history', orderId] });
      toast.success('Código de rastreio atualizado!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar código de rastreio:', error);
      toast.error('Erro ao atualizar código de rastreio');
    },
  });

  return {
    order: orderQuery.data,
    items: itemsQuery.data ?? [],
    history: historyQuery.data ?? [],
    isLoading: orderQuery.isLoading || itemsQuery.isLoading,
    addNote,
    updateTrackingCode,
  };
}
