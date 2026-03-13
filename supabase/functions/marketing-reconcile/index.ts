// =============================================
// MARKETING RECONCILE
// Phase 7: Reconciliation endpoint for tracking events
// Compares browser vs server events per tenant, detects gaps
// =============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    const days = body.days || 7;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceIso = since.toISOString();

    // 1. Count events by source (browser vs server) and event_name
    const { data: logs, error: logsError } = await supabase
      .from('marketing_events_log')
      .select('event_name, event_source, provider, provider_status, event_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (logsError) throw logsError;

    // 2. Build reconciliation report
    const eventCounts: Record<string, { browser: number; server: number; failed: number }> = {};
    const purchaseEventIds = new Set<string>();
    const serverPurchaseEventIds = new Set<string>();

    for (const log of logs || []) {
      const name = log.event_name || 'unknown';
      if (!eventCounts[name]) {
        eventCounts[name] = { browser: 0, server: 0, failed: 0 };
      }

      if (log.event_source === 'browser' || log.event_source === 'client') {
        eventCounts[name].browser++;
      } else {
        eventCounts[name].server++;
      }

      if (log.provider_status === 'failed' || log.provider_status === 'error') {
        eventCounts[name].failed++;
      }

      // Track Purchase event_ids for dedup analysis
      if (name === 'Purchase' && log.event_id) {
        if (log.event_source === 'browser' || log.event_source === 'client') {
          purchaseEventIds.add(log.event_id);
        } else {
          serverPurchaseEventIds.add(log.event_id);
        }
      }
    }

    // 3. Detect issues
    const issues: string[] = [];

    // Check for Purchase events without server pair
    const browserOnlyPurchases = [...purchaseEventIds].filter(id => !serverPurchaseEventIds.has(id));
    const serverOnlyPurchases = [...serverPurchaseEventIds].filter(id => !purchaseEventIds.has(id));

    if (browserOnlyPurchases.length > 0) {
      issues.push(`${browserOnlyPurchases.length} Purchase events fired only in browser (no CAPI pair)`);
    }
    if (serverOnlyPurchases.length > 0) {
      issues.push(`${serverOnlyPurchases.length} Purchase events fired only server-side (webhook/process-events)`);
    }

    // Check for high failure rate
    for (const [name, counts] of Object.entries(eventCounts)) {
      const total = counts.browser + counts.server;
      if (total > 0 && counts.failed / total > 0.1) {
        issues.push(`${name}: ${counts.failed}/${total} events failed (${Math.round(counts.failed / total * 100)}%)`);
      }
    }

    // 4. Count orders without Purchase event (for paid_only gap detection)
    const { data: recentOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, payment_status')
      .eq('tenant_id', tenantId)
      .gte('created_at', sinceIso)
      .in('payment_status', ['approved', 'paid'])
      .limit(500);

    if (!ordersError && recentOrders) {
      const orderNumbers = new Set(recentOrders.map(o => (o.order_number || '').replace(/^#/, '')));
      const trackedOrderNumbers = new Set<string>();

      for (const log of logs || []) {
        if (log.event_name === 'Purchase' && log.event_id) {
          // Extract order number from event_id: purchase_paid_XXXX or purchase_created_XXXX
          const match = log.event_id.match(/^purchase_(?:paid|created)_(.+)$/);
          if (match) trackedOrderNumbers.add(match[1]);
        }
      }

      const untrackedOrders = [...orderNumbers].filter(n => !trackedOrderNumbers.has(n));
      if (untrackedOrders.length > 0) {
        issues.push(`${untrackedOrders.length} paid orders have no Purchase tracking event`);
      }
    }

    const report = {
      tenant_id: tenantId,
      period_days: days,
      since: sinceIso,
      total_events: (logs || []).length,
      event_counts: eventCounts,
      purchase_dedup: {
        browser_only: browserOnlyPurchases.length,
        server_only: serverOnlyPurchases.length,
        paired: [...purchaseEventIds].filter(id => serverPurchaseEventIds.has(id)).length,
      },
      issues,
      health: issues.length === 0 ? 'healthy' : issues.length <= 2 ? 'warning' : 'critical',
    };

    return new Response(
      JSON.stringify({ success: true, report }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[marketing-reconcile] Error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
