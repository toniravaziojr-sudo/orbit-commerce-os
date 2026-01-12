// =============================================
// CORE-ORDERS: Canonical API for Order Operations
// All writes to orders table must go through this API
// Implements: validation, state machine, audit, events
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ===== STATUS DEFINITIONS (Canonical) =====
const ORDER_STATUSES = ['pending', 'approved', 'dispatched', 'shipping', 'completed', 'cancelled', 'returned', 'refunded'] as const;
const PAYMENT_STATUSES = ['awaiting_payment', 'paid', 'declined', 'cancelled', 'refunded'] as const;
const SHIPPING_STATUSES = ['awaiting_shipment', 'label_generated', 'shipped', 'in_transit', 'arriving', 'delivered', 'problem', 'awaiting_pickup', 'returning', 'returned'] as const;

type OrderStatus = typeof ORDER_STATUSES[number];
type PaymentStatus = typeof PAYMENT_STATUSES[number];
type ShippingStatus = typeof SHIPPING_STATUSES[number];

// ===== STATE MACHINE TRANSITIONS =====
const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['dispatched', 'cancelled', 'refunded'],
  dispatched: ['shipping', 'cancelled'],
  shipping: ['completed', 'returned'],
  completed: ['returned', 'refunded'],
  cancelled: [],
  returned: ['refunded'],
  refunded: [],
};

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  awaiting_payment: ['paid', 'declined', 'cancelled'],
  paid: ['refunded'],
  declined: ['awaiting_payment', 'cancelled'],
  cancelled: [],
  refunded: [],
};

const SHIPPING_TRANSITIONS: Record<ShippingStatus, ShippingStatus[]> = {
  awaiting_shipment: ['label_generated', 'problem'],
  label_generated: ['shipped', 'problem'],
  shipped: ['in_transit', 'problem'],
  in_transit: ['arriving', 'delivered', 'problem', 'awaiting_pickup'],
  arriving: ['delivered', 'problem'],
  delivered: ['returning'],
  problem: ['awaiting_shipment', 'returning', 'returned'],
  awaiting_pickup: ['delivered', 'returning'],
  returning: ['returned'],
  returned: [],
};

// ===== HELPER FUNCTIONS =====
function isValidTransition<T extends string>(
  transitions: Record<T, T[]>,
  from: T,
  to: T
): boolean {
  if (from === to) return true; // Same status is allowed
  const allowed = transitions[from];
  return allowed ? allowed.includes(to) : false;
}

interface AuditEntry {
  tenant_id: string;
  entity_type: 'order';
  entity_id: string;
  action: string;
  before_json: Record<string, any> | null;
  after_json: Record<string, any>;
  changed_fields: string[];
  actor_user_id: string | null;
  source: string;
  correlation_id: string | null;
}

async function createAuditLog(
  supabase: any,
  entry: AuditEntry
): Promise<void> {
  try {
    await supabase.from('core_audit_log').insert(entry);
  } catch (err) {
    console.error('[core-orders] Audit log error:', err);
  }
}

async function emitEvent(
  supabase: any,
  tenantId: string,
  eventType: string,
  subject: string,
  payload: Record<string, any>,
  idempotencyKey: string
): Promise<void> {
  try {
    await supabase.from('events_inbox').insert({
      tenant_id: tenantId,
      event_type: eventType,
      subject,
      payload,
      idempotency_key: idempotencyKey,
      status: 'new',
    });
  } catch (err) {
    console.error('[core-orders] Event emit error:', err);
  }
}

// ===== MAIN HANDLER =====
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let tenantId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        // Get current tenant from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_tenant_id')
          .eq('id', user.id)
          .single();
        tenantId = profile?.current_tenant_id;
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant not found', code: 'NO_TENANT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to tenant
    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied', code: 'ACCESS_DENIED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, order_id, ...payload } = body;

    const correlationId = crypto.randomUUID();

    switch (action) {
      // ===== CREATE ORDER =====
      case 'create_order': {
        const { 
          customer_id, customer_name, customer_email, customer_phone, customer_cpf,
          payment_method, shipping_street, shipping_number, shipping_complement,
          shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code,
          customer_notes, internal_notes, items
        } = payload;

        if (!customer_name || !customer_email || !items || items.length === 0) {
          return new Response(
            JSON.stringify({ success: false, error: 'customer_name, customer_email and items are required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate order number
        const { data: orderNumber, error: numberError } = await supabase
          .rpc('generate_order_number', { p_tenant_id: tenantId });

        if (numberError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to generate order number', code: 'ORDER_NUMBER_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Calculate totals
        const subtotal = items.reduce((sum: number, item: any) => 
          sum + (item.unit_price * item.quantity), 0);
        const discountTotal = items.reduce((sum: number, item: any) => 
          sum + ((item.discount_amount || 0) * item.quantity), 0);
        const total = subtotal - discountTotal;

        // Create order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            tenant_id: tenantId,
            order_number: orderNumber,
            customer_id,
            customer_name,
            customer_email: customer_email.toLowerCase().trim(),
            customer_phone,
            customer_cpf,
            payment_method,
            shipping_street,
            shipping_number,
            shipping_complement,
            shipping_neighborhood,
            shipping_city,
            shipping_state,
            shipping_postal_code,
            customer_notes,
            internal_notes,
            subtotal,
            discount_total: discountTotal,
            total,
            status: 'pending',
            payment_status: 'awaiting_payment',
            shipping_status: 'awaiting_shipment',
          })
          .select()
          .single();

        if (orderError) {
          return new Response(
            JSON.stringify({ success: false, error: orderError.message, code: 'CREATE_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create order items
        const orderItems = items.map((item: any) => ({
          order_id: order.id,
          tenant_id: tenantId,
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
          .insert(orderItems);

        if (itemsError) {
          // Rollback order
          await supabase.from('orders').delete().eq('id', order.id);
          return new Response(
            JSON.stringify({ success: false, error: itemsError.message, code: 'ITEMS_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create history entry
        await supabase.from('order_history').insert({
          order_id: order.id,
          action: 'order_created',
          description: `Pedido ${orderNumber} criado`,
          new_value: { status: 'pending' },
          created_by: userId,
        });

        // Audit log
        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order.id,
          action: 'create_order',
          before_json: null,
          after_json: order,
          changed_fields: Object.keys(order),
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        // Emit event
        await emitEvent(supabase, tenantId, 'order.created', order.id, {
          order_id: order.id,
          order_number: orderNumber,
          customer_email: customer_email.toLowerCase().trim(),
          customer_name,
          total,
          items_count: items.length,
        }, `order_created_${order.id}`);

        return new Response(
          JSON.stringify({ success: true, data: { order_id: order.id, order_number: orderNumber, order } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ===== DELETE ORDER =====
      case 'delete_order': {
        // Get order first
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if order can be deleted (only pending/cancelled orders)
        if (!['pending', 'cancelled'].includes(order.status)) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Only pending or cancelled orders can be deleted', 
              code: 'CANNOT_DELETE' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Delete related data first
        await supabase.from('order_items').delete().eq('order_id', order_id);
        await supabase.from('order_history').delete().eq('order_id', order_id);

        // Delete the order
        const { error: deleteError } = await supabase
          .from('orders')
          .delete()
          .eq('id', order_id);

        if (deleteError) {
          return new Response(
            JSON.stringify({ success: false, error: deleteError.message, code: 'DELETE_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Audit log
        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'delete_order',
          before_json: order,
          after_json: { deleted: true },
          changed_fields: ['deleted'],
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        // Emit event
        await emitEvent(supabase, tenantId, 'order.deleted', order_id, {
          order_id,
          order_number: order.order_number,
        }, `order_deleted_${order_id}`);

        return new Response(
          JSON.stringify({ success: true, data: { order_id, deleted: true } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ===== ADD NOTE =====
      case 'add_note': {
        const { note } = payload;

        if (!note?.trim()) {
          return new Response(
            JSON.stringify({ success: false, error: 'Note is required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('internal_notes, order_number')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Append note with timestamp
        const existingNotes = order.internal_notes || '';
        const timestamp = new Date().toLocaleString('pt-BR');
        const newNotes = existingNotes 
          ? `${existingNotes}\n\n[${timestamp}]\n${note}`
          : `[${timestamp}]\n${note}`;

        // Update order
        const { error: updateError } = await supabase
          .from('orders')
          .update({ internal_notes: newNotes })
          .eq('id', order_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Add history
        await supabase.from('order_history').insert({
          order_id,
          author_id: userId,
          action: 'note_added',
          description: note,
          created_by: userId,
        });

        // Audit log
        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'add_note',
          before_json: { internal_notes: existingNotes },
          after_json: { internal_notes: newNotes },
          changed_fields: ['internal_notes'],
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: { order_id, note_added: true } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ===== UPDATE TRACKING =====
      case 'update_tracking': {
        const { tracking_code, carrier } = payload;

        if (!tracking_code?.trim()) {
          return new Response(
            JSON.stringify({ success: false, error: 'Tracking code is required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('tracking_code, shipping_carrier, order_number')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, any> = { tracking_code };
        if (carrier) updateData.shipping_carrier = carrier;

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Add history
        await supabase.from('order_history').insert({
          order_id,
          author_id: userId,
          action: 'tracking_updated',
          description: `Código de rastreio atualizado: ${tracking_code}${carrier ? ` (${carrier})` : ''}`,
          new_value: { tracking_code, shipping_carrier: carrier },
          created_by: userId,
        });

        // Audit log
        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'update_tracking',
          before_json: { tracking_code: order.tracking_code, shipping_carrier: order.shipping_carrier },
          after_json: updateData,
          changed_fields: Object.keys(updateData),
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        // Emit event
        await emitEvent(supabase, tenantId, 'order.tracking_updated', order_id, {
          order_id,
          order_number: order.order_number,
          tracking_code,
          carrier,
        }, `tracking_${order_id}_${Date.now()}`);

        return new Response(
          JSON.stringify({ success: true, data: { order_id, tracking_code, carrier } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ===== UPDATE SHIPPING ADDRESS =====
      case 'update_shipping_address': {
        const { 
          shipping_street, shipping_number, shipping_complement,
          shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code
        } = payload;

        if (!shipping_street || !shipping_number || !shipping_city || !shipping_state || !shipping_postal_code) {
          return new Response(
            JSON.stringify({ success: false, error: 'Required address fields missing', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('shipping_street, shipping_number, shipping_complement, shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code, order_number')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData = {
          shipping_street,
          shipping_number,
          shipping_complement: shipping_complement || null,
          shipping_neighborhood: shipping_neighborhood || null,
          shipping_city,
          shipping_state,
          shipping_postal_code,
        };

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Add history
        await supabase.from('order_history').insert({
          order_id,
          author_id: userId,
          action: 'address_updated',
          description: `Endereço atualizado: ${shipping_street}, ${shipping_number} - ${shipping_city}/${shipping_state}`,
          new_value: updateData,
          created_by: userId,
        });

        // Audit log
        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'update_shipping_address',
          before_json: {
            shipping_street: order.shipping_street,
            shipping_number: order.shipping_number,
            shipping_complement: order.shipping_complement,
            shipping_neighborhood: order.shipping_neighborhood,
            shipping_city: order.shipping_city,
            shipping_state: order.shipping_state,
            shipping_postal_code: order.shipping_postal_code,
          },
          after_json: updateData,
          changed_fields: Object.keys(updateData),
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: { order_id, address_updated: true } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set_order_status': {
        const { new_status, notes } = payload;
        
        if (!ORDER_STATUSES.includes(new_status)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid order status', code: 'INVALID_STATUS' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentStatus = order.status as OrderStatus;
        
        // Validate transition
        if (!isValidTransition(ORDER_TRANSITIONS, currentStatus, new_status)) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Cannot transition from ${currentStatus} to ${new_status}`, 
              code: 'INVALID_TRANSITION' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update order
        const updateData: Record<string, any> = { status: new_status };
        
        // Set timestamps based on status
        if (new_status === 'completed') updateData.delivered_at = new Date().toISOString();
        if (new_status === 'cancelled') updateData.cancelled_at = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create order history entry
        await supabase.from('order_history').insert({
          order_id,
          status: new_status,
          description: notes || `Status alterado de ${currentStatus} para ${new_status}`,
          created_by: userId,
        });

        // Audit log
        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'set_order_status',
          before_json: { status: currentStatus },
          after_json: { status: new_status },
          changed_fields: ['status'],
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        // Emit event
        await emitEvent(supabase, tenantId, 'order.status_changed', order_id, {
          order_id,
          order_number: order.order_number,
          from_status: currentStatus,
          to_status: new_status,
        }, `order_status_${order_id}_${new_status}_${Date.now()}`);

        return new Response(
          JSON.stringify({ success: true, data: { order_id, status: new_status } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set_payment_status': {
        const { new_status, notes } = payload;
        
        if (!PAYMENT_STATUSES.includes(new_status)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid payment status', code: 'INVALID_STATUS' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentStatus = order.payment_status as PaymentStatus;
        
        if (!isValidTransition(PAYMENT_TRANSITIONS, currentStatus, new_status)) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Cannot transition payment from ${currentStatus} to ${new_status}`, 
              code: 'INVALID_TRANSITION' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, any> = { payment_status: new_status };
        if (new_status === 'paid') updateData.paid_at = new Date().toISOString();

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from('order_history').insert({
          order_id,
          status: order.status,
          description: notes || `Pagamento: ${currentStatus} → ${new_status}`,
          created_by: userId,
        });

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'set_payment_status',
          before_json: { payment_status: currentStatus },
          after_json: { payment_status: new_status },
          changed_fields: ['payment_status'],
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        await emitEvent(supabase, tenantId, 'order.payment_status_changed', order_id, {
          order_id,
          order_number: order.order_number,
          from_status: currentStatus,
          to_status: new_status,
        }, `payment_status_${order_id}_${new_status}_${Date.now()}`);

        return new Response(
          JSON.stringify({ success: true, data: { order_id, payment_status: new_status } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'set_shipping_status': {
        const { new_status, notes, tracking_code, shipping_carrier } = payload;
        
        if (!SHIPPING_STATUSES.includes(new_status)) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid shipping status', code: 'INVALID_STATUS' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const currentStatus = order.shipping_status as ShippingStatus;
        
        if (!isValidTransition(SHIPPING_TRANSITIONS, currentStatus, new_status)) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Cannot transition shipping from ${currentStatus} to ${new_status}`, 
              code: 'INVALID_TRANSITION' 
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: Record<string, any> = { shipping_status: new_status };
        if (new_status === 'shipped') updateData.shipped_at = new Date().toISOString();
        if (new_status === 'delivered') updateData.delivered_at = new Date().toISOString();
        if (tracking_code) updateData.tracking_code = tracking_code;
        if (shipping_carrier) updateData.shipping_carrier = shipping_carrier;

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from('order_history').insert({
          order_id,
          status: order.status,
          description: notes || `Envio: ${currentStatus} → ${new_status}`,
          created_by: userId,
        });

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'set_shipping_status',
          before_json: { shipping_status: currentStatus },
          after_json: { shipping_status: new_status, tracking_code, shipping_carrier },
          changed_fields: ['shipping_status', ...(tracking_code ? ['tracking_code'] : []), ...(shipping_carrier ? ['shipping_carrier'] : [])],
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        await emitEvent(supabase, tenantId, 'order.shipping_status_changed', order_id, {
          order_id,
          order_number: order.order_number,
          from_status: currentStatus,
          to_status: new_status,
          tracking_code,
        }, `shipping_status_${order_id}_${new_status}_${Date.now()}`);

        return new Response(
          JSON.stringify({ success: true, data: { order_id, shipping_status: new_status } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_order': {
        // General order update (for non-status fields)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', order_id)
          .eq('tenant_id', tenantId)
          .single();

        if (orderError || !order) {
          return new Response(
            JSON.stringify({ success: false, error: 'Order not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Only allow updating specific fields
        const allowedFields = [
          'customer_cpf', 'customer_cnpj', 'notes', 'internal_notes',
          'shipping_street', 'shipping_number', 'shipping_complement',
          'shipping_neighborhood', 'shipping_city', 'shipping_state',
          'shipping_postal_code', 'tracking_code', 'shipping_carrier',
          'payment_link_url', 'payment_link_expires_at'
        ];

        const updateData: Record<string, any> = {};
        const changedFields: string[] = [];
        const beforeJson: Record<string, any> = {};

        for (const field of allowedFields) {
          if (field in payload && payload[field] !== order[field]) {
            beforeJson[field] = order[field];
            updateData[field] = payload[field];
            changedFields.push(field);
          }
        }

        if (changedFields.length === 0) {
          return new Response(
            JSON.stringify({ success: true, data: { order_id, message: 'No changes' } }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', order_id);

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'order',
          entity_id: order_id,
          action: 'update_order',
          before_json: beforeJson,
          after_json: updateData,
          changed_fields: changedFields,
          actor_user_id: userId,
          source: 'core-orders',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: { order_id, updated_fields: changedFields } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action', code: 'UNKNOWN_ACTION' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('[core-orders] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
