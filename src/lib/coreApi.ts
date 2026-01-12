// =============================================
// CORE API CLIENT: Wrapper for Core API Edge Functions
// All core entity writes should use these functions
// =============================================

import { supabase } from '@/integrations/supabase/client';
import type { OrderStatus, PaymentStatus, ShippingStatus } from '@/types/orderStatus';

// ===== RESPONSE TYPE =====
export interface CoreApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// ===== ORDERS API =====
export const coreOrdersApi = {
  setOrderStatus: async (
    orderId: string,
    newStatus: OrderStatus,
    notes?: string
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-orders', {
      body: {
        action: 'set_order_status',
        order_id: orderId,
        new_status: newStatus,
        notes,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  setPaymentStatus: async (
    orderId: string,
    newStatus: PaymentStatus,
    notes?: string
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-orders', {
      body: {
        action: 'set_payment_status',
        order_id: orderId,
        new_status: newStatus,
        notes,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  setShippingStatus: async (
    orderId: string,
    newStatus: ShippingStatus,
    options?: { notes?: string; tracking_code?: string; shipping_carrier?: string }
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-orders', {
      body: {
        action: 'set_shipping_status',
        order_id: orderId,
        new_status: newStatus,
        ...options,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  updateOrder: async (
    orderId: string,
    updates: Record<string, unknown>
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-orders', {
      body: {
        action: 'update_order',
        order_id: orderId,
        ...updates,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },
};

// ===== DEPENDENCY CHECK TYPES =====
export interface CustomerDependencies {
  customer_id: string;
  has_dependencies: boolean;
  orders: { count: number; sample: Array<{ order_number: string; created_at: string; total: number }> };
  conversations: { count: number };
  addresses: { count: number };
  notes: { count: number };
  tags: { count: number };
}

export interface ProductDependencies {
  product_id: string;
  has_dependencies: boolean;
  orders: { 
    count: number; 
    sample: Array<{ order_number: string; created_at: string; customer_name: string; quantity: number }>;
    affected_customers: number;
  };
  component_of: { count: number };
  has_components: { count: number };
  related_products: { count: number };
  buy_together: { count: number };
  categories: { count: number };
  images: { count: number };
}

// ===== CUSTOMERS API =====
export const coreCustomersApi = {
  checkDependencies: async (customerId: string): Promise<CoreApiResponse<CustomerDependencies>> => {
    const { data, error } = await supabase.functions.invoke('core-customers', {
      body: {
        action: 'check_dependencies',
        customer_id: customerId,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  create: async (customerData: Record<string, unknown>): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-customers', {
      body: {
        action: 'create',
        ...customerData,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  update: async (
    customerId: string,
    updates: Record<string, unknown>
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-customers', {
      body: {
        action: 'update',
        customer_id: customerId,
        ...updates,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  delete: async (customerId: string): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-customers', {
      body: {
        action: 'delete',
        customer_id: customerId,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  addAddress: async (
    customerId: string,
    address: Record<string, unknown>
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-customers', {
      body: {
        action: 'add_address',
        customer_id: customerId,
        ...address,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  updateTags: async (
    customerId: string,
    tagIds: string[]
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-customers', {
      body: {
        action: 'update_tags',
        customer_id: customerId,
        tag_ids: tagIds,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  addNote: async (
    customerId: string,
    content: string
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-customers', {
      body: {
        action: 'add_note',
        customer_id: customerId,
        content,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },
};

// ===== PRODUCTS API =====
export const coreProductsApi = {
  checkDependencies: async (productId: string): Promise<CoreApiResponse<ProductDependencies>> => {
    const { data, error } = await supabase.functions.invoke('core-products', {
      body: {
        action: 'check_dependencies',
        product_id: productId,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  create: async (productData: Record<string, unknown>): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-products', {
      body: {
        action: 'create',
        ...productData,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  update: async (
    productId: string,
    updates: Record<string, unknown>
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-products', {
      body: {
        action: 'update',
        product_id: productId,
        ...updates,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  delete: async (productId: string): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-products', {
      body: {
        action: 'delete',
        product_id: productId,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  addImage: async (
    productId: string,
    imageData: { url: string; alt_text?: string; is_primary?: boolean; sort_order?: number; file_id?: string }
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-products', {
      body: {
        action: 'add_image',
        product_id: productId,
        ...imageData,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  updateComponents: async (
    productId: string,
    components: Array<{ component_product_id: string; quantity: number; cost_price?: number; sale_price?: number }>
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-products', {
      body: {
        action: 'update_components',
        product_id: productId,
        components,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },

  updateRelated: async (
    productId: string,
    relatedIds: string[]
  ): Promise<CoreApiResponse> => {
    const { data, error } = await supabase.functions.invoke('core-products', {
      body: {
        action: 'update_related',
        product_id: productId,
        related_ids: relatedIds,
      },
    });
    if (error) return { success: false, error: error.message, code: 'INVOKE_ERROR' };
    return data;
  },
};
