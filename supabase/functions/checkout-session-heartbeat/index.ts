// ============================================
// CHECKOUT SESSION HEARTBEAT - Updates last_seen_at and session data
// Resolves tenant by Origin header (custom domain) or slug (platform)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, origin, referer, x-store-host',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Resolve tenant from hostname (custom domain or platform subdomain)
 */
async function resolveTenantFromHost(
  supabase: any,
  hostname: string
): Promise<string | null> {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  
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

    const body = await req.json();
    const {
      session_id,
      tenant_slug,
      tenant_id: legacyTenantId,
      origin: clientOrigin,
      customer_email,
      customer_phone,
      customer_name,
      region,
      total_estimated,
      items_snapshot,
      step,
    } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Primary: resolve from x-store-host header
    let tenantId: string | null = null;
    
    const storeHostHeader = req.headers.get('x-store-host');
    const originHeader = req.headers.get('origin') || req.headers.get('referer') || clientOrigin;
    
    if (storeHostHeader) {
      tenantId = await resolveTenantFromHost(supabase, storeHostHeader);
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
    
    // 2. Fallback: resolve from tenant_slug
    if (!tenantId && tenant_slug) {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenant_slug)
        .single();
      if (tenant) tenantId = tenant.id;
    }
    
    // 3. Last fallback: use legacy tenant_id
    if (!tenantId && legacyTenantId) {
      tenantId = legacyTenantId;
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Could not resolve tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Atualizar last_seen_at e dados do cliente
    const updateData: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
    };

    // Atualizar campos opcionais se fornecidos
    if (customer_email) updateData.customer_email = customer_email;
    if (customer_phone) updateData.customer_phone = customer_phone;
    if (customer_name) updateData.customer_name = customer_name;
    if (region) updateData.region = region;
    if (total_estimated !== undefined) updateData.total_estimated = total_estimated;
    if (items_snapshot) updateData.items_snapshot = items_snapshot;
    if (step) updateData.metadata = { step };

    const { data, error } = await supabase
      .from('checkout_sessions')
      .update(updateData)
      .eq('id', session_id)
      .eq('tenant_id', tenantId)
      .eq('status', 'active') // Só atualiza se ainda active
      .select('id, status')
      .single();

    if (error) {
      // Pode não existir ou já ter sido convertido/abandonado
      return new Response(JSON.stringify({ 
        success: false, 
        session_id,
        reason: 'session_not_active',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: data.id,
      status: data.status,
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
