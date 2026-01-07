// ============================================
// CHECKOUT SESSION HEARTBEAT - Updates last_seen_at and session data
// Accepts text/plain to avoid CORS preflight
// Resolves tenant from store_host in body (primary) or headers (fallback)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Resolve tenant from hostname (custom domain or platform subdomain)
 */
async function resolveTenantFromHost(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  hostname: string
): Promise<string | null> {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '').split(':')[0];
  
  // Check for platform subdomain pattern: {slug}.shops.comandocentral.com.br
  const platformPattern = /^([a-z0-9-]+)\.shops\.comandocentral\.com\.br$/;
  const platformMatch = normalizedHost.match(platformPattern);
  
  if (platformMatch) {
    const slug = platformMatch[1];
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();
    return tenant?.id || null;
  }
  
  // Check tenant_domains table for custom domains
  const { data: domainRecord } = await supabase
    .from('tenant_domains')
    .select('tenant_id')
    .eq('domain', normalizedHost)
    .in('status', ['verified', 'active'])
    .maybeSingle();
  
  if (domainRecord?.tenant_id) {
    return domainRecord.tenant_id;
  }
  
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body - accept both JSON and text/plain
    let body: Record<string, unknown> = {};
    const rawBody = await req.text();
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[checkout-session-heartbeat] Failed to parse body');
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      session_id,
      tenant_slug,
      store_host,
      tenant_id: legacyTenantId,
      customer_email,
      customer_phone,
      customer_name,
      region,
      total_estimated,
      items_snapshot,
      step,
    } = body as Record<string, any>;

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tenant in order of reliability
    let tenantId: string | null = null;
    const originHeader = req.headers.get('origin') || req.headers.get('referer');
    
    // 1. Primary: store_host from body
    if (store_host) {
      tenantId = await resolveTenantFromHost(supabase, store_host);
    }
    
    // 2. Fallback: Origin header
    if (!tenantId && originHeader) {
      try {
        const originUrl = new URL(originHeader);
        tenantId = await resolveTenantFromHost(supabase, originUrl.hostname);
      } catch (e) {
        // Invalid origin
      }
    }
    
    // 3. Fallback: resolve from tenant_slug
    if (!tenantId && tenant_slug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenant_slug)
        .single();
      if (tenant) tenantId = tenant.id;
    }
    
    // 4. Last fallback: use legacy tenant_id
    if (!tenantId && legacyTenantId) {
      tenantId = legacyTenantId;
    }

    if (!tenantId) {
      console.error('[checkout-session-heartbeat] Could not resolve tenant', { store_host, origin: originHeader });
      return new Response(JSON.stringify({ error: 'Could not resolve tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Primeiro, verificar se a sessão existe e seu status atual
    const { data: existingSession } = await supabase
      .from('checkout_sessions')
      .select('id, status, abandoned_at')
      .eq('id', session_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existingSession) {
      return new Response(JSON.stringify({ 
        success: false, 
        session_id,
        reason: 'session_not_found',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // REATIVAÇÃO: Se sessão estava abandonada, heartbeat reativa para active
    const wasAbandoned = existingSession.status === 'abandoned';
    
    const updateData: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
    };

    if (wasAbandoned) {
      updateData.status = 'active';
      updateData.metadata = {
        reopened_at: new Date().toISOString(),
        reopened_by: 'heartbeat',
        previous_status: 'abandoned',
        previous_abandoned_at: existingSession.abandoned_at,
      };
      console.log(`[checkout-session-heartbeat] REACTIVATING abandoned session ${session_id}`);
    }

    // Atualizar campos opcionais se fornecidos
    if (customer_email) updateData.customer_email = customer_email;
    if (customer_phone) updateData.customer_phone = customer_phone;
    if (customer_name) updateData.customer_name = customer_name;
    if (region) updateData.region = region;
    if (total_estimated !== undefined) updateData.total_estimated = total_estimated;
    if (items_snapshot) updateData.items_snapshot = items_snapshot;
    if (step && !wasAbandoned) updateData.metadata = { step };

    // Só atualiza se status é 'active' OU se estava 'abandoned' (para reativar)
    const { data, error } = await supabase
      .from('checkout_sessions')
      .update(updateData)
      .eq('id', session_id)
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'abandoned'])
      .select('id, status')
      .single();

    if (error) {
      console.error('[checkout-session-heartbeat] Update error:', error);
      return new Response(JSON.stringify({ 
        success: false, 
        session_id,
        reason: 'update_failed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: data.id,
      status: data.status,
      was_reactivated: wasAbandoned,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-heartbeat] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
