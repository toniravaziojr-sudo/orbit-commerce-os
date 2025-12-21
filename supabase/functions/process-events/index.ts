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

// Evaluate a single filter condition
function evaluateCondition(
  payload: Record<string, unknown>,
  condition: { path: string; op: string; value: unknown }
): boolean {
  const actualValue = getValueByPath(payload, condition.path);
  
  switch (condition.op) {
    case 'eq':
      return actualValue === condition.value;
    case 'neq':
      return actualValue !== condition.value;
    case 'exists':
      return condition.value ? actualValue !== undefined && actualValue !== null : actualValue === undefined || actualValue === null;
    case 'gte':
      return typeof actualValue === 'number' && typeof condition.value === 'number' && actualValue >= condition.value;
    case 'lte':
      return typeof actualValue === 'number' && typeof condition.value === 'number' && actualValue <= condition.value;
    case 'contains':
      if (typeof actualValue === 'string' && typeof condition.value === 'string') {
        return actualValue.includes(condition.value);
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(condition.value);
      }
      return false;
    default:
      console.warn(`[process-events] Unknown operator: ${condition.op}`);
      return false;
  }
}

// Evaluate all filters (AND logic)
function evaluateFilters(
  payload: Record<string, unknown>,
  filters: Array<{ path: string; op: string; value: unknown }> | null
): boolean {
  if (!filters || filters.length === 0) return true;
  return filters.every(condition => evaluateCondition(payload, condition));
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

interface RuleAction {
  type: string;
  channel?: string;
  recipient_path?: string;
  template_key?: string;
  delay_seconds?: number;
  payload_override?: Record<string, unknown>;
}

interface NotificationRule {
  id: string;
  tenant_id: string;
  name: string;
  trigger_event_type: string;
  filters: Array<{ path: string; op: string; value: unknown }> | null;
  actions: RuleAction[] | null;
  dedupe_scope: string | null;
  priority: number;
  is_enabled: boolean;
}

interface EventInbox {
  id: string;
  tenant_id: string;
  event_type: string;
  payload_normalized: Record<string, unknown> | null;
  payload_raw: Record<string, unknown> | null;
  status: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, limit = 50 } = await req.json().catch(() => ({}));

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-events] Starting processing for tenant: ${tenant_id}, limit: ${limit}`);

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
      ledger_conflicts: 0,
    };

    // 1. Fetch pending events
    const { data: pendingEvents, error: eventsError } = await supabase
      .from('events_inbox')
      .select('id, tenant_id, event_type, payload_normalized, payload_raw, status')
      .eq('tenant_id', tenant_id)
      .eq('status', 'new')
      .order('received_at', { ascending: true })
      .limit(limit);

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

    // 2. Fetch enabled rules for tenant
    const { data: allRules, error: rulesError } = await supabase
      .from('notification_rules')
      .select('id, tenant_id, name, trigger_event_type, filters, actions, dedupe_scope, priority, is_enabled')
      .eq('tenant_id', tenant_id)
      .eq('is_enabled', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('[process-events] Error fetching rules:', rulesError);
      throw rulesError;
    }

    console.log(`[process-events] Found ${allRules?.length || 0} enabled rules`);

    // Group rules by trigger_event_type for efficient lookup
    const rulesByEventType: Record<string, NotificationRule[]> = {};
    for (const rule of (allRules || [])) {
      const eventType = rule.trigger_event_type;
      if (!rulesByEventType[eventType]) {
        rulesByEventType[eventType] = [];
      }
      rulesByEventType[eventType].push(rule as NotificationRule);
    }

    // 3. Process each event
    for (const event of pendingEvents as EventInbox[]) {
      console.log(`[process-events] Processing event: ${event.id} (${event.event_type})`);
      
      const matchingRules = rulesByEventType[event.event_type] || [];
      let hasMatchedAny = false;
      const payload = event.payload_normalized || event.payload_raw || {};

      for (const rule of matchingRules) {
        // Evaluate filters
        const filtersMatch = evaluateFilters(payload, rule.filters);
        
        if (!filtersMatch) {
          console.log(`[process-events] Rule ${rule.id} (${rule.name}): filters did not match`);
          continue;
        }

        console.log(`[process-events] Rule ${rule.id} (${rule.name}): filters matched!`);
        stats.rules_matched++;
        hasMatchedAny = true;

        // Determine entity for dedupe
        const dedupeScope = rule.dedupe_scope || 'none';
        let entityType = dedupeScope;
        let entityId = '';
        const scopeKey = '';

        // Extract entity_id based on dedupe_scope
        if (dedupeScope !== 'none') {
          const subject = payload.subject as { type?: string; id?: string } | undefined;
          if (subject?.id) {
            entityId = subject.id;
            entityType = subject.type || dedupeScope;
          } else {
            // Fallback: try common paths
            const orderId = getValueByPath(payload, 'order_id') || getValueByPath(payload, 'order.id');
            const customerId = getValueByPath(payload, 'customer_id') || getValueByPath(payload, 'customer.id');
            const cartId = getValueByPath(payload, 'cart_id') || getValueByPath(payload, 'cart.id');

            if (dedupeScope === 'order' && orderId) {
              entityId = String(orderId);
            } else if (dedupeScope === 'customer' && customerId) {
              entityId = String(customerId);
            } else if (dedupeScope === 'cart' && cartId) {
              entityId = String(cartId);
            } else {
              // Ultimate fallback: use event.id
              entityId = event.id;
              console.log(`[process-events] Using event.id as entity_id fallback for rule ${rule.id}`);
            }
          }
        }

        // Try to insert into dedup ledger (if not 'none')
        let ledgerBlocked = false;
        if (dedupeScope !== 'none') {
          const { error: ledgerError } = await supabase
            .from('notification_dedup_ledger')
            .insert({
              tenant_id: tenant_id,
              rule_id: rule.id,
              entity_type: entityType,
              entity_id: entityId,
              scope_key: scopeKey,
            });

          if (ledgerError) {
            if (ledgerError.code === '23505') { // unique_violation
              console.log(`[process-events] Ledger conflict for rule ${rule.id}, entity ${entityType}:${entityId} - already processed`);
              stats.ledger_conflicts++;
              ledgerBlocked = true;
            } else {
              console.error(`[process-events] Ledger insert error:`, ledgerError);
              throw ledgerError;
            }
          } else {
            console.log(`[process-events] Ledger entry created for rule ${rule.id}, entity ${entityType}:${entityId}`);
          }
        }

        if (ledgerBlocked) continue;

        // Process actions
        const actions = rule.actions || [];
        for (const action of actions as RuleAction[]) {
          if (action.type !== 'enqueue_notification') {
            console.log(`[process-events] Skipping unknown action type: ${action.type}`);
            continue;
          }

          const channel = action.channel || 'whatsapp';
          const templateKey = action.template_key || 'default';
          const delaySeconds = action.delay_seconds || 0;
          
          // Extract recipient
          let recipient = '';
          if (action.recipient_path) {
            const recipientValue = getValueByPath(payload, action.recipient_path);
            recipient = recipientValue ? String(recipientValue) : '';
          }
          if (!recipient) {
            // Fallback: try common paths
            recipient = String(
              getValueByPath(payload, 'customer.phone') ||
              getValueByPath(payload, 'customer_phone') ||
              getValueByPath(payload, 'phone') ||
              'unknown'
            );
          }

          // Generate dedupe_key
          const dedupeKey = await generateDedupeKey([
            tenant_id,
            rule.id,
            entityType,
            entityId,
            channel,
            templateKey,
            scopeKey,
          ]);

          // Calculate scheduled time
          const scheduledFor = new Date(Date.now() + delaySeconds * 1000).toISOString();

          // Insert notification
          const { data: notification, error: notifError } = await supabase
            .from('notifications')
            .insert({
              tenant_id: tenant_id,
              event_id: event.id,
              rule_id: rule.id,
              channel: channel,
              recipient: recipient,
              template_key: templateKey,
              payload: action.payload_override || payload,
              status: 'scheduled',
              scheduled_for: scheduledFor,
              next_attempt_at: scheduledFor,
              dedupe_key: dedupeKey,
              max_attempts: 3,
            })
            .select('id')
            .maybeSingle();

          if (notifError) {
            if (notifError.code === '23505') { // unique_violation on dedupe_key
              console.log(`[process-events] Notification already exists (dedupe_key collision): ${dedupeKey}`);
            } else {
              console.error(`[process-events] Notification insert error:`, notifError);
              throw notifError;
            }
          } else if (notification) {
            console.log(`[process-events] Notification created: ${notification.id}, channel=${channel}, scheduled=${scheduledFor}`);
            stats.notifications_created++;
          }
        }
      }

      // Mark event as processed or ignored
      const newStatus = hasMatchedAny ? 'processed' : 'ignored';
      const { error: updateError } = await supabase
        .from('events_inbox')
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      if (updateError) {
        console.error(`[process-events] Error updating event ${event.id}:`, updateError);
        throw updateError;
      }

      if (hasMatchedAny) {
        stats.events_processed++;
      } else {
        stats.events_ignored++;
      }

      console.log(`[process-events] Event ${event.id} marked as ${newStatus}`);
    }

    console.log(`[process-events] Processing complete. Stats:`, stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
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
