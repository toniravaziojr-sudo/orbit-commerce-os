import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ViolationPayload {
  store_host: string;
  violation_type: string;
  path: string;
  details?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body: ViolationPayload = await req.json();
    const { store_host, violation_type, path, details } = body;

    if (!store_host || !violation_type || !path) {
      return new Response(JSON.stringify({ error: 'Missing required fields: store_host, violation_type, path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[report-runtime-violation] Received violation: ${violation_type} at ${path} from ${store_host}`);

    // Resolve tenant from store_host
    const { data: domainData, error: domainError } = await supabase
      .from('tenant_domains')
      .select('tenant_id')
      .eq('domain', store_host)
      .single();

    let tenantId: string | null = null;

    if (domainData) {
      tenantId = domainData.tenant_id;
    } else {
      // Try to extract tenant from shops subdomain
      const shopsMatch = store_host.match(/^([^.]+)\.shops\./);
      if (shopsMatch) {
        const tenantSlug = shopsMatch[1];
        const { data: tenantData } = await supabase
          .from('tenants')
          .select('id')
          .eq('slug', tenantSlug)
          .single();
        
        if (tenantData) {
          tenantId = tenantData.id;
        }
      }
    }

    if (!tenantId) {
      console.warn(`[report-runtime-violation] Could not resolve tenant for host: ${store_host}`);
      return new Response(JSON.stringify({ error: 'Could not resolve tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Insert violation record
    const { error: insertError } = await supabase
      .from('storefront_runtime_violations')
      .insert({
        tenant_id: tenantId,
        host: store_host,
        path,
        violation_type,
        details: details || {},
        is_resolved: false
      });

    if (insertError) {
      console.error('[report-runtime-violation] Error inserting violation:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to record violation' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[report-runtime-violation] Violation recorded for tenant ${tenantId}`);

    // Check if we have accumulated too many unresolved violations (threshold: 10)
    const { count, error: countError } = await supabase
      .from('storefront_runtime_violations')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_resolved', false)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!countError && count && count >= 10) {
      console.log(`[report-runtime-violation] High violation count (${count}) for tenant ${tenantId}, emitting alert event`);
      
      // Emit alert event (idempotency by hour to avoid spam)
      await supabase.from('events_inbox').insert({
        tenant_id: tenantId,
        provider: 'internal',
        event_type: 'system.violations.threshold',
        idempotency_key: `violations-threshold-${tenantId}-${Math.floor(Date.now() / (60 * 60 * 1000))}`,
        payload_raw: {
          violation_count: count,
          latest_violation: {
            type: violation_type,
            path,
            host: store_host
          }
        }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[report-runtime-violation] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
