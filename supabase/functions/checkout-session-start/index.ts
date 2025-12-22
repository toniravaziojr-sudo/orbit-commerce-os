// ============================================
// CHECKOUT SESSION START - Creates/updates checkout session
// Accepts text/plain to avoid CORS preflight
// Resolves tenant from store_host in body (primary) or headers (fallback)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  
  console.log(`[checkout-session-start] Resolving tenant from host: ${normalizedHost}`);
  
  // Check for platform subdomain pattern: {slug}.shops.comandocentral.com.br
  const platformPattern = /^([a-z0-9-]+)\.shops\.comandocentral\.com\.br$/;
  const platformMatch = normalizedHost.match(platformPattern);
  
  if (platformMatch) {
    const slug = platformMatch[1];
    console.log(`[checkout-session-start] Platform subdomain detected, slug: ${slug}`);
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
    console.log(`[checkout-session-start] Custom domain found, tenant_id: ${domainRecord.tenant_id}`);
    return domainRecord.tenant_id;
  }
  
  // Fallback: check if the host itself matches a slug
  const hostParts = normalizedHost.split('.');
  if (hostParts.length > 0) {
    const { data: tenantBySlug } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', hostParts[0])
      .maybeSingle();
    
    if (tenantBySlug?.id) {
      console.log(`[checkout-session-start] Tenant found by slug from host: ${tenantBySlug.id}`);
      return tenantBySlug.id;
    }
  }
  
  return null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body - accept both JSON and text/plain
    let body: Record<string, unknown> = {};
    const contentType = req.headers.get('content-type') || '';
    const rawBody = await req.text();
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[checkout-session-start] Failed to parse body:', rawBody.substring(0, 100));
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      session_id,
      tenant_slug,
      store_host,
      cart_id,
      customer_id,
      customer_email,
      customer_phone,
      customer_name,
      region,
      total_estimated,
      items_snapshot,
      utm,
      metadata,
    } = body as Record<string, any>;

    // Log all incoming data for debugging
    const originHeader = req.headers.get('origin');
    const refererHeader = req.headers.get('referer');
    
    console.log(`[checkout-session-start] Request received:`, {
      session_id,
      store_host,
      tenant_slug,
      origin: originHeader,
      referer: refererHeader,
      content_type: contentType,
    });

    // Validação obrigatória
    if (!session_id) {
      console.error('[checkout-session-start] Missing session_id');
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tenant in order of reliability:
    let tenantId: string | null = null;
    
    // 1. Primary: store_host from body (most reliable, no CORS issues)
    if (store_host) {
      tenantId = await resolveTenantFromHost(supabase, store_host);
      if (tenantId) {
        console.log(`[checkout-session-start] Tenant resolved from store_host: ${tenantId}`);
      }
    }
    
    // 2. Fallback: resolve from Origin header
    if (!tenantId && originHeader) {
      try {
        const originUrl = new URL(originHeader);
        tenantId = await resolveTenantFromHost(supabase, originUrl.hostname);
        if (tenantId) {
          console.log(`[checkout-session-start] Tenant resolved from Origin: ${tenantId}`);
        }
      } catch (e) {
        console.log(`[checkout-session-start] Invalid origin header: ${originHeader}`);
      }
    }
    
    // 3. Fallback: resolve from Referer header
    if (!tenantId && refererHeader) {
      try {
        const refererUrl = new URL(refererHeader);
        tenantId = await resolveTenantFromHost(supabase, refererUrl.hostname);
        if (tenantId) {
          console.log(`[checkout-session-start] Tenant resolved from Referer: ${tenantId}`);
        }
      } catch (e) {
        console.log(`[checkout-session-start] Invalid referer header: ${refererHeader}`);
      }
    }
    
    // 4. Fallback: resolve from tenant_slug body param
    if (!tenantId && tenant_slug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenant_slug)
        .single();

      if (tenant) {
        tenantId = tenant.id;
        console.log(`[checkout-session-start] Tenant resolved from slug param: ${tenantId}`);
      }
    }

    if (!tenantId) {
      console.error('[checkout-session-start] Could not resolve tenant', {
        store_host,
        origin: originHeader,
        referer: refererHeader,
        slug: tenant_slug,
      });
      return new Response(JSON.stringify({ 
        error: 'Could not resolve tenant',
        debug: { store_host, origin: originHeader, slug: tenant_slug }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[checkout-session-start] Processing session ${session_id} for tenant ${tenantId}`);

    // Check if session already exists
    const { data: existing } = await supabase
      .from('checkout_sessions')
      .select('id, status, abandoned_at')
      .eq('id', session_id)
      .eq('tenant_id', tenantId)
      .single();

    if (existing) {
      // Update existing session
      const updateData: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      };

      // REATIVAÇÃO: Se sessão estava abandonada, reativar para active
      const wasAbandoned = existing.status === 'abandoned';
      if (wasAbandoned) {
        updateData.status = 'active';
        // Registrar reabertura em metadata (preservando histórico)
        updateData.metadata = {
          reopened_at: new Date().toISOString(),
          previous_status: 'abandoned',
          previous_abandoned_at: existing.abandoned_at,
        };
        console.log(`[checkout-session-start] REACTIVATING abandoned session ${session_id}`);
      }

      if (customer_email) updateData.customer_email = customer_email;
      if (customer_phone) updateData.customer_phone = customer_phone;
      if (customer_name) updateData.customer_name = customer_name;
      if (customer_id) updateData.customer_id = customer_id;
      if (region) updateData.region = region;
      if (total_estimated !== undefined) updateData.total_estimated = total_estimated;
      if (items_snapshot) updateData.items_snapshot = items_snapshot;

      const { error: updateError } = await supabase
        .from('checkout_sessions')
        .update(updateData)
        .eq('id', session_id);

      if (updateError) {
        console.error('[checkout-session-start] Update error:', updateError);
        throw updateError;
      }

      const newStatus = wasAbandoned ? 'active' : existing.status;
      console.log(`[checkout-session-start] Session ${session_id} updated (status: ${newStatus}, reactivated: ${wasAbandoned})`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        session_id, 
        action: wasAbandoned ? 'reactivated' : 'updated',
        status: newStatus,
        was_abandoned: wasAbandoned,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new session
    const { data: newSession, error: insertError } = await supabase
      .from('checkout_sessions')
      .insert({
        id: session_id,
        tenant_id: tenantId,
        cart_id,
        customer_id,
        customer_email,
        customer_phone,
        customer_name,
        region,
        total_estimated,
        items_snapshot: items_snapshot || [],
        utm: utm || {},
        metadata: { ...(metadata || {}), store_host },
        status: 'active',
        started_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[checkout-session-start] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[checkout-session-start] Session ${session_id} created successfully for tenant ${tenantId}`);

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: newSession.id,
      action: 'created',
      status: 'active',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-start] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
