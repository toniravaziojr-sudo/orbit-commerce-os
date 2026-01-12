// =============================================
// CORE-CUSTOMERS: Canonical API for Customer Operations
// All writes to customers table must go through this API
// Implements: validation, audit, events
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

        // Soft delete: set status to inactive or use deleted_at
        const { error: deleteError } = await supabase
          .from('customers')
          .update({ status: 'inactive', deleted_at: new Date().toISOString() })
          .eq('id', customer_id);

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
          action: 'delete',
          before_json: customer,
          after_json: { status: 'inactive', deleted_at: new Date().toISOString() },
          changed_fields: ['status', 'deleted_at'],
          actor_user_id: userId,
          source: 'core-customers',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: { customer_id } }),
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

        const { label, street, number, complement, neighborhood, city, state, postal_code, is_default } = payload;

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
            created_by: userId,
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
