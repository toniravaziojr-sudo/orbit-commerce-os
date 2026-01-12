// =============================================
// CORE-CUSTOMERS: Canonical API for Customer Operations
// All writes to customers table must go through this API
// Implements: validation, audit, events, HARD DELETE
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AuditEntry {
  tenant_id: string;
  entity_type: 'customer';
  entity_id: string;
  action: string;
  before_json: Record<string, any> | null;
  after_json: Record<string, any>;
  changed_fields: string[];
  actor_user_id: string | null;
  source: string;
  correlation_id: string | null;
}

async function createAuditLog(supabase: any, entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('core_audit_log').insert(entry);
  } catch (err) {
    console.error('[core-customers] Audit log error:', err);
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
    console.error('[core-customers] Event emit error:', err);
  }
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

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
    const { action, customer_id, ...payload } = body;
    const correlationId = crypto.randomUUID();

    switch (action) {
      // ===== CHECK DEPENDENCIES (for UI warning before delete) =====
      case 'check_dependencies': {
        if (!customer_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for orders linked to this customer
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number, created_at, total')
          .eq('customer_id', customer_id)
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(10);

        const { count: orderCount } = await supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer_id)
          .eq('tenant_id', tenantId);

        // Check for conversations
        const { count: conversationCount } = await supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer_id)
          .eq('tenant_id', tenantId);

        // Check for addresses
        const { count: addressCount } = await supabase
          .from('customer_addresses')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer_id);

        // Check for notes
        const { count: noteCount } = await supabase
          .from('customer_notes')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer_id);

        // Check for tags
        const { count: tagCount } = await supabase
          .from('customer_tag_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('customer_id', customer_id);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              customer_id,
              has_dependencies: (orderCount || 0) > 0,
              orders: {
                count: orderCount || 0,
                sample: orders || [],
              },
              conversations: { count: conversationCount || 0 },
              addresses: { count: addressCount || 0 },
              notes: { count: noteCount || 0 },
              tags: { count: tagCount || 0 },
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        const { email, full_name, phone, cpf, cnpj, person_type, status, ...rest } = payload;

        if (!email || !full_name) {
          return new Response(
            JSON.stringify({ success: false, error: 'Email and name are required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const normalizedEmail = normalizeEmail(email);

        // Check for existing customer
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('email', normalizedEmail)
          .single();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer with this email already exists', code: 'DUPLICATE_EMAIL' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const customerData = {
          tenant_id: tenantId,
          email: normalizedEmail,
          full_name,
          phone: phone || null,
          cpf: cpf || null,
          cnpj: cnpj || null,
          person_type: person_type || 'pf',
          status: status || 'active',
          ...rest,
        };

        const { data: newCustomer, error: insertError } = await supabase
          .from('customers')
          .insert(customerData)
          .select()
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: insertError.message, code: 'INSERT_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'customer',
          entity_id: newCustomer.id,
          action: 'create',
          before_json: null,
          after_json: customerData,
          changed_fields: Object.keys(customerData),
          actor_user_id: userId,
          source: 'core-customers',
          correlation_id: correlationId,
        });

        await emitEvent(supabase, tenantId, 'customer.created', newCustomer.id, {
          customer_id: newCustomer.id,
          email: normalizedEmail,
          full_name,
        }, `customer_created_${newCustomer.id}`);

        return new Response(
          JSON.stringify({ success: true, data: newCustomer }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!customer_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: customer, error: fetchError } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customer_id)
          .eq('tenant_id', tenantId)
          .single();

        if (fetchError || !customer) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const allowedFields = [
          'full_name', 'email', 'phone', 'cpf', 'cnpj', 'person_type',
          'company_name', 'ie', 'state_registration_is_exempt', 'birth_date', 'gender',
          'status', 'notes', 'accepts_marketing', 'accepts_email_marketing',
          'accepts_sms_marketing', 'accepts_whatsapp_marketing', 'loyalty_tier'
        ];

        const updateData: Record<string, any> = {};
        const changedFields: string[] = [];
        const beforeJson: Record<string, any> = {};

        for (const field of allowedFields) {
          if (field in payload && payload[field] !== customer[field]) {
            beforeJson[field] = customer[field];
            updateData[field] = field === 'email' ? normalizeEmail(payload[field]) : payload[field];
            changedFields.push(field);
          }
        }

        if (changedFields.length === 0) {
          return new Response(
            JSON.stringify({ success: true, data: customer }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: updated, error: updateError } = await supabase
          .from('customers')
          .update(updateData)
          .eq('id', customer_id)
          .select()
          .single();

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'customer',
          entity_id: customer_id,
          action: 'update',
          before_json: beforeJson,
          after_json: updateData,
          changed_fields: changedFields,
          actor_user_id: userId,
          source: 'core-customers',
          correlation_id: correlationId,
        });

        await emitEvent(supabase, tenantId, 'customer.updated', customer_id, {
          customer_id,
          changed_fields: changedFields,
        }, `customer_updated_${customer_id}_${Date.now()}`);

        return new Response(
          JSON.stringify({ success: true, data: updated }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ===== HARD DELETE: Physically removes customer and all related data =====
      case 'delete': {
        if (!customer_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customer_id)
          .eq('tenant_id', tenantId)
          .single();

        if (!customer) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // ===== CASCADE DELETE IN ORDER =====

        // 1. Delete order_items for orders of this customer
        const { data: customerOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('customer_id', customer_id)
          .eq('tenant_id', tenantId);

        if (customerOrders && customerOrders.length > 0) {
          const orderIds = customerOrders.map((o: any) => o.id);
          
          // Delete order_items
          await supabase
            .from('order_items')
            .delete()
            .in('order_id', orderIds);
          
          // Delete order_history
          await supabase
            .from('order_history')
            .delete()
            .in('order_id', orderIds);
          
          // Delete orders
          await supabase
            .from('orders')
            .delete()
            .eq('customer_id', customer_id)
            .eq('tenant_id', tenantId);
        }

        // 2. Delete customer_addresses
        await supabase
          .from('customer_addresses')
          .delete()
          .eq('customer_id', customer_id);

        // 3. Delete customer_notes
        await supabase
          .from('customer_notes')
          .delete()
          .eq('customer_id', customer_id);

        // 4. Delete customer_tag_assignments
        await supabase
          .from('customer_tag_assignments')
          .delete()
          .eq('customer_id', customer_id);

        // 5. Delete customer_notifications
        await supabase
          .from('customer_notifications')
          .delete()
          .eq('customer_id', customer_id);

        // 6. Update conversations to remove customer reference (don't delete conversations)
        await supabase
          .from('conversations')
          .update({ customer_id: null, customer_name: `[Excluído] ${customer.full_name}` })
          .eq('customer_id', customer_id);

        // 7. Finally, delete the customer
        const { error: deleteError } = await supabase
          .from('customers')
          .delete()
          .eq('id', customer_id)
          .eq('tenant_id', tenantId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ success: false, error: deleteError.message, code: 'DELETE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'customer',
          entity_id: customer_id,
          action: 'hard_delete',
          before_json: customer,
          after_json: { deleted: true, deleted_orders: customerOrders?.length || 0 },
          changed_fields: ['deleted'],
          actor_user_id: userId,
          source: 'core-customers',
          correlation_id: correlationId,
        });

        await emitEvent(supabase, tenantId, 'customer.deleted', customer_id, {
          customer_id,
          email: customer.email,
          full_name: customer.full_name,
          deleted_orders_count: customerOrders?.length || 0,
        }, `customer_deleted_${customer_id}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            data: { 
              customer_id,
              deleted_orders: customerOrders?.length || 0,
            } 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add_address': {
        if (!customer_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { label, street, number, complement, neighborhood, city, state, postal_code, is_default, recipient_name } = payload;

        // Verify customer exists
        const { data: customer } = await supabase
          .from('customers')
          .select('id, full_name')
          .eq('id', customer_id)
          .eq('tenant_id', tenantId)
          .single();

        if (!customer) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const addressData = {
          customer_id,
          label: label || 'Principal',
          street,
          number,
          complement,
          neighborhood,
          city,
          state,
          postal_code,
          country: 'Brasil',
          is_default: is_default || false,
          recipient_name: recipient_name || customer.full_name,
        };

        // If this is default, unset other defaults
        if (is_default) {
          await supabase
            .from('customer_addresses')
            .update({ is_default: false })
            .eq('customer_id', customer_id);
        }

        const { data: newAddress, error: insertError } = await supabase
          .from('customer_addresses')
          .insert(addressData)
          .select()
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: insertError.message, code: 'INSERT_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'customer',
          entity_id: customer_id,
          action: 'add_address',
          before_json: null,
          after_json: addressData,
          changed_fields: ['addresses'],
          actor_user_id: userId,
          source: 'core-customers',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: newAddress }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_tags': {
        if (!customer_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { tag_ids } = payload;

        // Delete existing assignments
        await supabase
          .from('customer_tag_assignments')
          .delete()
          .eq('customer_id', customer_id);

        // Insert new assignments
        if (tag_ids && tag_ids.length > 0) {
          const assignments = tag_ids.map((tagId: string) => ({
            customer_id,
            tag_id: tagId,
          }));

          await supabase.from('customer_tag_assignments').insert(assignments);
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'customer',
          entity_id: customer_id,
          action: 'update_tags',
          before_json: null,
          after_json: { tag_ids },
          changed_fields: ['tags'],
          actor_user_id: userId,
          source: 'core-customers',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: { customer_id, tag_ids } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add_note': {
        if (!customer_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Customer ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { content } = payload;

        if (!content?.trim()) {
          return new Response(
            JSON.stringify({ success: false, error: 'Note content required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: newNote, error: insertError } = await supabase
          .from('customer_notes')
          .insert({
            customer_id,
            content,
            author_id: userId,
          })
          .select()
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: insertError.message, code: 'INSERT_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: newNote }),
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
    console.error('[core-customers] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
