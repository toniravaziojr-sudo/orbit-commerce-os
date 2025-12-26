import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get nested value from object using dot-path
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  
  return current;
}

// Generate stable hash for dedupe_key
async function generateDedupeKey(parts: string[]): Promise<string> {
  const input = parts.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 48);
}

interface NotificationRuleV2 {
  id: string;
  tenant_id: string;
  name: string;
  is_enabled: boolean;
  rule_type: string; // payment, shipping, abandoned_checkout, post_sale
  trigger_condition: string | null;
  trigger_event_type: string;
  channels: string[] | null; // ['whatsapp', 'email']
  whatsapp_message: string | null;
  email_subject: string | null;
  email_body: string | null;
  delay_seconds: number | null;
  delay_unit: string | null; // 'seconds', 'minutes', 'hours', 'days'
  product_scope: string | null; // 'all', 'specific'
  product_ids: string[] | null;
  attachments: Record<string, unknown>[] | null;
  dedupe_scope: string | null;
  priority: number;
  effective_from: string; // Rules are not retroactive - only match events after this date
  created_at: string;
  // Legacy fields for backward compatibility
  filters: Array<{ path: string; op: string; value: unknown }> | null;
  actions: Array<{ type: string; channel?: string; recipient_path?: string; template_key?: string; delay_seconds?: number }> | null;
}

interface EventInbox {
  id: string;
  tenant_id: string;
  event_type: string;
  payload_normalized: Record<string, unknown> | null;
  payload_raw: Record<string, unknown> | null;
  status: string;
  occurred_at: string;
}

// Map rule_type to expected event types (supports multiple formats)
function getExpectedEventTypes(ruleType: string): string[] {
  switch (ruleType) {
    case 'payment': 
      return ['payment_status_changed', 'payment.status_changed', 'order.paid', 'order.payment_updated'];
    case 'shipping': 
      return ['shipping_status_changed', 'shipment.status_changed', 'shipment_status_changed'];
    case 'abandoned_checkout': 
      return ['checkout.abandoned', 'checkout_abandoned'];
    case 'post_sale': 
      return ['customer_first_order', 'customer.first_order'];
    default: 
      return [];
  }
}

// Check if rule matches event based on rule_type and trigger_condition
function ruleMatchesEventV2(rule: NotificationRuleV2, eventType: string, payload: Record<string, unknown>): boolean {
  const { rule_type, trigger_condition } = rule;

  // For V2 rules with rule_type
  if (rule_type) {
    const expectedEventTypes = getExpectedEventTypes(rule_type);
    
    // Check if event type matches any expected type
    const normalizedEventType = eventType.replace('.', '_').toLowerCase();
    const eventMatches = expectedEventTypes.some(expected => 
      eventType === expected || 
      normalizedEventType === expected.replace('.', '_').toLowerCase()
    );
    
    if (!eventMatches) return false;

    // For payment rules, check the condition matches the status
    if (rule_type === 'payment' && trigger_condition) {
      const newStatus = payload.new_status as string || payload.payment_status as string;
      const paymentMethod = payload.payment_method as string;

      switch (trigger_condition) {
        case 'paid':
        case 'approved':
        case 'payment_approved': // UI sends this value
          return newStatus === 'paid' || newStatus === 'approved';
        case 'pix_generated':
          // Accept both direct status or legacy pending + pix method
          return newStatus === 'pix_generated' || 
                 ((newStatus === 'pending' || newStatus === 'awaiting_payment') && paymentMethod === 'pix');
        case 'boleto_generated':
          // Accept both direct status or legacy pending + boleto method
          return newStatus === 'boleto_generated' || 
                 ((newStatus === 'pending' || newStatus === 'awaiting_payment') && paymentMethod === 'boleto');
        case 'declined':
        case 'payment_declined':
          return newStatus === 'failed' || newStatus === 'declined';
        case 'expired':
        case 'canceled':
        case 'payment_expired':
          return newStatus === 'canceled' || newStatus === 'expired' || newStatus === 'refunded';
        default:
          return false;
      }
    }

    // For shipping rules, check the condition matches the status
    if (rule_type === 'shipping' && trigger_condition) {
      const newStatus = payload.new_status as string || payload.shipping_status as string;

      switch (trigger_condition) {
        case 'posted':
          return newStatus === 'posted' || newStatus === 'label_created' || newStatus === 'shipped';
        case 'in_transit':
          return newStatus === 'in_transit';
        case 'out_for_delivery':
          return newStatus === 'out_for_delivery';
        case 'awaiting_pickup':
          return newStatus === 'awaiting_pickup';
        case 'returned':
        case 'returning': // UI sends 'returning', status might be 'returned' or 'returning'
          return newStatus === 'returned' || newStatus === 'returning';
        case 'issue':
          return newStatus === 'failed' || newStatus === 'unknown' || newStatus === 'exception' || newStatus === 'lost';
        case 'delivered':
          return newStatus === 'delivered';
        default:
          return false;
      }
    }

    // For abandoned_checkout and post_sale, no condition matching needed
    if (rule_type === 'abandoned_checkout' || rule_type === 'post_sale') {
      return true;
    }
  }

  // Legacy: check trigger_event_type matches
  if (rule.trigger_event_type === eventType) {
    return true;
  }

  return false;
}

// Calculate delay in seconds
function calculateTotalDelaySeconds(delaySeconds: number | null, delayUnit: string | null): number {
  const seconds = delaySeconds || 0;
  if (!delayUnit || delayUnit === 'seconds') return seconds;
  if (delayUnit === 'minutes') return seconds * 60;
  if (delayUnit === 'hours') return seconds * 3600;
  if (delayUnit === 'days') return seconds * 86400;
  return seconds;
}

// Render template with variables
function renderTemplate(template: string | null, variables: Record<string, unknown>): string {
  if (!template) return '';
  
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = variables[key];
    if (value === undefined || value === null) return match;
    return String(value);
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 50;
    const tenantFilter = body.tenant_id || null;

    console.log(`[process-events] Starting with limit=${limit}, tenant_id=${tenantFilter || 'all'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Stats tracking
    const stats = {
      events_fetched: 0,
      events_processed: 0,
      events_ignored: 0,
      rules_matched: 0,
      notifications_created: 0,
      logs_created: 0,
      ledger_conflicts: 0,
      errors: 0,
    };

    // 1. Fetch pending events
    let eventsQuery = supabase
      .from('events_inbox')
      .select('id, tenant_id, event_type, payload_normalized, payload_raw, status, occurred_at')
      .in('status', ['new', 'pending'])
      .order('received_at', { ascending: true })
      .limit(limit);

    if (tenantFilter) {
      eventsQuery = eventsQuery.eq('tenant_id', tenantFilter);
    }

    const { data: pendingEvents, error: eventsError } = await eventsQuery;

    if (eventsError) {
      console.error('[process-events] Error fetching events:', eventsError);
      throw eventsError;
    }

    stats.events_fetched = pendingEvents?.length || 0;
    console.log(`[process-events] Found ${stats.events_fetched} pending events`);

    if (!pendingEvents || pendingEvents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, stats, message: 'No pending events' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark events as processing
    const eventIds = pendingEvents.map(e => e.id);
    await supabase
      .from('events_inbox')
      .update({ status: 'processing' })
      .in('id', eventIds);

    // 2. Fetch all enabled rules (both V2 and legacy)
    const { data: allRules, error: rulesError } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('[process-events] Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log(`[process-events] Found ${allRules?.length || 0} enabled rules`);

    // 3. Process each event
    for (const event of pendingEvents as EventInbox[]) {
      console.log(`[process-events] Processing event: ${event.id} (${event.event_type})`);
      
      const payload = event.payload_normalized || event.payload_raw || {};
      const tenantRules = (allRules || []).filter(r => r.tenant_id === event.tenant_id) as NotificationRuleV2[];
      let hasMatchedAny = false;

      for (const rule of tenantRules) {
        // Check if rule matches event
        const matches = ruleMatchesEventV2(rule, event.event_type, payload);
        
        if (!matches) continue;

        // CRITICAL: Check effective_from - rules are NOT retroactive
        // Events that occurred before the rule was created should be skipped
        const eventOccurredAt = new Date(event.occurred_at);
        const ruleEffectiveFrom = new Date(rule.effective_from || rule.created_at);
        
        if (eventOccurredAt < ruleEffectiveFrom) {
          console.log(`[process-events] Skipping rule ${rule.id} - event occurred ${event.occurred_at} before rule effective_from ${rule.effective_from}`);
          continue;
        }

        console.log(`[process-events] Rule ${rule.id} (${rule.name}) matched event ${event.event_type}`);
        stats.rules_matched++;
        hasMatchedAny = true;

        // For abandoned_checkout, check if customer already has an order
        if (rule.rule_type === 'abandoned_checkout') {
          const customerEmail = (payload.customer_email as string) || '';
          if (customerEmail) {
            const { data: existingOrder } = await supabase
              .from('orders')
              .select('id')
              .eq('tenant_id', event.tenant_id)
              .ilike('customer_email', customerEmail)
              .limit(1);

            if (existingOrder && existingOrder.length > 0) {
              console.log(`[process-events] Skipping abandoned checkout - customer ${customerEmail} already has an order`);
              continue;
            }
          }
        }

        // Determine entity IDs for logging and deduplication
        let orderId: string | null = null;
        let customerId: string | null = null;
        let checkoutSessionId: string | null = null;
        let entityId = '';
        let entityType = 'event';

        if (rule.rule_type === 'payment' || rule.rule_type === 'shipping') {
          orderId = (payload.order_id as string) || (getValueByPath(payload, 'subject.id') as string) || null;
          entityId = orderId || event.id;
          entityType = 'order';
        } else if (rule.rule_type === 'abandoned_checkout') {
          checkoutSessionId = (payload.session_id as string) || (payload.checkout_session_id as string) || null;
          customerId = (payload.customer_id as string) || null;
          entityId = checkoutSessionId || event.id;
          entityType = 'checkout';
        } else if (rule.rule_type === 'post_sale') {
          customerId = (payload.customer_id as string) || (getValueByPath(payload, 'subject.id') as string) || null;
          entityId = customerId || event.id;
          entityType = 'customer';
        } else {
          // Legacy fallback
          const subject = payload.subject as { type?: string; id?: string } | undefined;
          if (subject?.id) {
            entityId = subject.id;
            entityType = subject.type || 'unknown';
          } else {
            entityId = event.id;
          }
        }

        // Get recipient info
        const customerEmail = (payload.customer_email as string) || '';
        const customerPhone = (payload.customer_phone as string) || '';
        const customerName = (payload.customer_name as string) || '';

        // Check for deduplication
        const dedupeScope = rule.dedupe_scope || rule.rule_type || 'none';
        if (dedupeScope !== 'none') {
          const { data: existingLedger } = await supabase
            .from('notification_dedup_ledger')
            .select('id')
            .eq('tenant_id', event.tenant_id)
            .eq('rule_id', rule.id)
            .eq('entity_id', entityId)
            .limit(1);

          if (existingLedger && existingLedger.length > 0) {
            console.log(`[process-events] Ledger conflict for rule ${rule.id}, entity ${entityId} - skipping`);
            stats.ledger_conflicts++;
            continue;
          }

          // Insert ledger entry
          await supabase
            .from('notification_dedup_ledger')
            .insert({
              tenant_id: event.tenant_id,
              rule_id: rule.id,
              entity_type: entityType,
              entity_id: entityId,
            });
        }

        // Calculate scheduled time
        const delaySeconds = calculateTotalDelaySeconds(rule.delay_seconds, rule.delay_unit);
        const scheduledFor = new Date(Date.now() + delaySeconds * 1000).toISOString();

        // Prepare template variables
        const templateVars: Record<string, unknown> = {
          customer_name: customerName,
          customer_first_name: customerName.split(' ')[0] || customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          order_number: payload.order_number || '',
          order_total: payload.order_total || payload.total || '',
          payment_status: payload.new_status || payload.payment_status || '',
          payment_method: payload.payment_method || '',
          shipping_status: payload.new_status || payload.shipping_status || '',
          tracking_code: payload.tracking_code || '',
          tracking_url: payload.tracking_url || '',
          pix_link: payload.pix_link || '',
          boleto_link: payload.boleto_link || '',
          store_name: payload.store_name || '',
          product_names: payload.product_names || '',
        };

        // Process V2 channels
        const channels = rule.channels || [];
        
        // Fallback to legacy actions if no V2 channels
        if (channels.length === 0 && rule.actions) {
          for (const action of rule.actions) {
            if (action.type === 'enqueue_notification' && action.channel) {
              channels.push(action.channel);
            }
          }
        }

        // Default to whatsapp if no channels specified
        if (channels.length === 0) {
          channels.push('whatsapp');
        }

        for (const channel of channels) {
          const recipient = channel === 'email' ? customerEmail : customerPhone;
          
          if (!recipient) {
            console.log(`[process-events] No ${channel} recipient for rule ${rule.id}, skipping`);
            continue;
          }

          // Generate dedupe key
          const dedupeKey = await generateDedupeKey([
            event.tenant_id,
            rule.id,
            entityId,
            channel,
            rule.trigger_condition || '',
          ]);

          // Check if notification already exists
          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('dedupe_key', dedupeKey)
            .limit(1);

          if (existingNotif && existingNotif.length > 0) {
            console.log(`[process-events] Notification already exists for dedupe_key ${dedupeKey}`);
            continue;
          }

          // Render messages
          const whatsappMessage = renderTemplate(rule.whatsapp_message, templateVars);
          const emailSubject = renderTemplate(rule.email_subject, templateVars);
          const emailBody = renderTemplate(rule.email_body, templateVars);

          const contentPreview = channel === 'whatsapp' 
            ? whatsappMessage.substring(0, 200)
            : `${emailSubject}: ${emailBody.substring(0, 150)}`;

          // Create notification
          const { data: notification, error: notifError } = await supabase
            .from('notifications')
            .insert({
              tenant_id: event.tenant_id,
              event_id: event.id,
              rule_id: rule.id,
              channel,
              recipient,
              template_key: null,
              payload: {
                ...templateVars,
                whatsapp_message: whatsappMessage,
                email_subject: emailSubject,
                email_body: emailBody,
                attachments: rule.attachments,
              },
              status: 'scheduled',
              scheduled_for: scheduledFor,
              next_attempt_at: scheduledFor,
              dedupe_key: dedupeKey,
              max_attempts: 3,
            })
            .select('id')
            .single();

          if (notifError) {
            console.error(`[process-events] Error creating notification:`, notifError);
            stats.errors++;
            continue;
          }

          stats.notifications_created++;
          console.log(`[process-events] Created notification ${notification.id} for ${channel} to ${recipient}`);

          // Create notification log
          const { error: logError } = await supabase
            .from('notification_logs')
            .insert({
              tenant_id: event.tenant_id,
              notification_id: notification.id,
              rule_id: rule.id,
              order_id: orderId,
              customer_id: customerId,
              checkout_session_id: checkoutSessionId,
              rule_type: rule.rule_type || 'legacy',
              channel,
              status: 'pending',
              recipient,
              content_preview: contentPreview,
              attachments: rule.attachments,
              scheduled_for: scheduledFor,
            });

          if (logError) {
            console.error(`[process-events] Error creating notification log:`, logError);
          } else {
            stats.logs_created++;
          }
        }
      }

      // Mark event as processed or ignored
      const newStatus = hasMatchedAny ? 'processed' : 'ignored';
      await supabase
        .from('events_inbox')
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      if (hasMatchedAny) {
        stats.events_processed++;
      } else {
        stats.events_ignored++;
      }

      console.log(`[process-events] Event ${event.id} marked as ${newStatus}`);
    }

    console.log(`[process-events] Processing complete. Stats:`, stats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats,
        processed_count: stats.events_processed,
        ignored_count: stats.events_ignored,
        notifications_created: stats.notifications_created,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[process-events] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
