import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate stable hash for dedupe_key
async function generateDedupeKey(parts: string[]): Promise<string> {
  const input = parts.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 48);
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 20; // Process 20 items per invocation

    console.log(`[post-sale-backfill-process] Starting with limit=${limit}`);

    const stats = {
      items_processed: 0,
      notifications_created: 0,
      items_skipped: 0,
      jobs_completed: 0,
      errors: 0,
    };

    // Get due items from pending backfill jobs
    const now = new Date().toISOString();
    
    const { data: dueItems, error: itemsError } = await supabase
      .from('post_sale_backfill_items')
      .select(`
        id,
        job_id,
        tenant_id,
        customer_id,
        customers!inner (
          id,
          email,
          full_name,
          phone,
          first_order_at
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(limit);

    if (itemsError) {
      console.error('[post-sale-backfill-process] Error fetching items:', itemsError);
      throw itemsError;
    }

    if (!dueItems || dueItems.length === 0) {
      console.log('[post-sale-backfill-process] No due items to process');
      return new Response(
        JSON.stringify({ success: true, stats, message: 'No items to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[post-sale-backfill-process] Found ${dueItems.length} due items`);

    // Get unique tenant IDs
    const tenantIds = [...new Set(dueItems.map(i => i.tenant_id))];

    // Fetch post_sale rules for all tenants
    const { data: allRules } = await supabase
      .from('notification_rules')
      .select('*')
      .in('tenant_id', tenantIds)
      .eq('rule_type', 'post_sale')
      .eq('is_enabled', true)
      .order('delay_seconds', { ascending: true });

    const rulesByTenant = new Map<string, typeof allRules>();
    for (const rule of (allRules || [])) {
      if (!rulesByTenant.has(rule.tenant_id)) {
        rulesByTenant.set(rule.tenant_id, []);
      }
      rulesByTenant.get(rule.tenant_id)!.push(rule);
    }

    // Process each item
    for (const item of dueItems) {
      const customer = (item as any).customers;
      if (!customer) {
        // Mark as skipped
        await supabase
          .from('post_sale_backfill_items')
          .update({ status: 'skipped', processed_at: now, error_message: 'Customer not found' })
          .eq('id', item.id);
        stats.items_skipped++;
        continue;
      }

      const tenantRules = rulesByTenant.get(item.tenant_id) || [];
      if (tenantRules.length === 0) {
        await supabase
          .from('post_sale_backfill_items')
          .update({ status: 'skipped', processed_at: now, error_message: 'No post_sale rules' })
          .eq('id', item.id);
        stats.items_skipped++;
        continue;
      }

      // Get the base delay (smallest delay in the sequence)
      const baseDelay = calculateTotalDelaySeconds(tenantRules[0].delay_seconds, tenantRules[0].delay_unit);

      // Schedule notifications for each rule
      for (const rule of tenantRules) {
        // Check ledger first
        const { data: existingLedger } = await supabase
          .from('notification_dedup_ledger')
          .select('id')
          .eq('tenant_id', item.tenant_id)
          .eq('rule_id', rule.id)
          .eq('entity_id', customer.id)
          .limit(1);

        if (existingLedger && existingLedger.length > 0) {
          console.log(`[post-sale-backfill-process] Ledger conflict for customer ${customer.id}, rule ${rule.id}`);
          continue;
        }

        // Insert ledger entry
        await supabase
          .from('notification_dedup_ledger')
          .insert({
            tenant_id: item.tenant_id,
            rule_id: rule.id,
            entity_type: 'customer',
            entity_id: customer.id,
            scope_key: `backfill_${item.job_id}`,
          });

        // Calculate scheduled time: now + (rule delay - base delay)
        const ruleDelay = calculateTotalDelaySeconds(rule.delay_seconds, rule.delay_unit);
        const relativeDelay = Math.max(0, ruleDelay - baseDelay);
        const scheduledFor = new Date(Date.now() + relativeDelay * 1000).toISOString();

        // Prepare template variables
        const templateVars: Record<string, unknown> = {
          customer_name: customer.full_name,
          customer_first_name: customer.full_name?.split(' ')[0] || customer.full_name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          first_order_date: customer.first_order_at ? new Date(customer.first_order_at).toLocaleDateString('pt-BR') : '',
        };

        // Process channels
        const channels = rule.channels || ['email'];

        for (const channel of channels) {
          const recipient = channel === 'email' ? customer.email : customer.phone;
          if (!recipient) continue;

          const dedupeKey = await generateDedupeKey([
            item.tenant_id,
            rule.id,
            customer.id,
            channel,
            'backfill',
          ]);

          // Check if notification exists
          const { data: existingNotif } = await supabase
            .from('notifications')
            .select('id')
            .eq('dedupe_key', dedupeKey)
            .limit(1);

          if (existingNotif && existingNotif.length > 0) continue;

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
              tenant_id: item.tenant_id,
              rule_id: rule.id,
              channel,
              recipient,
              payload: {
                ...templateVars,
                whatsapp_message: whatsappMessage,
                email_subject: emailSubject,
                email_body: emailBody,
                attachments: rule.attachments,
                source: 'post_sale_backfill',
                job_id: item.job_id,
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
            console.error(`[post-sale-backfill-process] Error creating notification:`, notifError);
            stats.errors++;
            continue;
          }

          stats.notifications_created++;

          // Create notification log
          await supabase
            .from('notification_logs')
            .insert({
              tenant_id: item.tenant_id,
              notification_id: notification.id,
              rule_id: rule.id,
              customer_id: customer.id,
              rule_type: 'post_sale',
              channel,
              status: 'pending',
              recipient,
              content_preview: contentPreview,
              scheduled_for: scheduledFor,
            });
        }
      }

      // Mark item as completed
      await supabase
        .from('post_sale_backfill_items')
        .update({ status: 'completed', processed_at: now })
        .eq('id', item.id);

      stats.items_processed++;

      // Update job progress
      await supabase
        .from('post_sale_backfill_jobs')
        .update({ 
          processed_customers: supabase.rpc('increment_processed', { job_id: item.job_id }),
        })
        .eq('id', item.job_id);
    }

    // Check for completed jobs
    const jobIds = [...new Set(dueItems.map(i => i.job_id))];
    for (const jobId of jobIds) {
      const { data: job } = await supabase
        .from('post_sale_backfill_jobs')
        .select('id, total_customers')
        .eq('id', jobId)
        .single();

      if (!job) continue;

      // Count remaining pending items
      const { count: remainingCount } = await supabase
        .from('post_sale_backfill_items')
        .select('id', { count: 'exact', head: true })
        .eq('job_id', jobId)
        .eq('status', 'pending');

      if (remainingCount === 0) {
        await supabase
          .from('post_sale_backfill_jobs')
          .update({ 
            status: 'completed', 
            completed_at: now,
            processed_customers: job.total_customers,
          })
          .eq('id', jobId);
        stats.jobs_completed++;
        console.log(`[post-sale-backfill-process] Job ${jobId} completed`);
      }
    }

    console.log(`[post-sale-backfill-process] Complete. Stats:`, stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[post-sale-backfill-process] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
