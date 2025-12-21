// ============================================
// CHECKOUT SESSION START - Creates/updates checkout session
// Resolves tenant by Origin header (custom domain) or slug (platform)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, origin, referer',
};

/**
 * Resolve tenant from hostname (custom domain or platform subdomain)
 */
async function resolveTenantFromHost(
  supabase: any,
  hostname: string
): Promise<string | null> {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '');
  
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
  
  // Fallback: check if the host itself is a slug
  const { data: tenantBySlug } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', normalizedHost.split('.')[0])
    .maybeSingle();
  
  return tenantBySlug?.id || null;
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
    } = body;

    // Validação obrigatória
    if (!session_id) {
      console.error('[checkout-session-start] Missing session_id');
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Try to resolve tenant from Origin/Referer headers (most reliable for custom domains)
    let tenantId: string | null = null;
    
    const originHeader = req.headers.get('origin') || req.headers.get('referer') || clientOrigin;
    
    if (originHeader) {
      try {
        const originUrl = new URL(originHeader);
        tenantId = await resolveTenantFromHost(supabase, originUrl.hostname);
        if (tenantId) {
          console.log(`[checkout-session-start] Tenant resolved from Origin header: ${tenantId}`);
        }
      } catch (e) {
        console.log(`[checkout-session-start] Invalid origin header: ${originHeader}`);
      }
    }
    
    // 2. Fallback: resolve from tenant_slug
    if (!tenantId && tenant_slug) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenant_slug)
        .single();

      if (!tenantError && tenant) {
        tenantId = tenant.id;
        console.log(`[checkout-session-start] Tenant resolved from slug: ${tenantId}`);
      }
    }
    
    // 3. Last fallback: use legacy tenant_id
    if (!tenantId && legacyTenantId) {
      tenantId = legacyTenantId;
      console.log(`[checkout-session-start] Using legacy tenant_id: ${tenantId}`);
    }

    if (!tenantId) {
      console.error('[checkout-session-start] Could not resolve tenant. Origin:', originHeader, 'Slug:', tenant_slug);
      return new Response(JSON.stringify({ 
        error: 'Could not resolve tenant',
        debug: { origin: originHeader, slug: tenant_slug }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[checkout-session-start] Processing session ${session_id} for tenant ${tenantId}`);

    // Verificar se sessão já existe
    const { data: existing } = await supabase
      .from('checkout_sessions')
      .select('id, status')
      .eq('id', session_id)
      .eq('tenant_id', tenantId)
      .single();

    if (existing) {
      // Se já existe, atualizar last_seen_at e dados do cliente
      const updateData: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      };

      // Atualizar campos opcionais se fornecidos
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

      console.log(`[checkout-session-start] Session ${session_id} updated`);
      return new Response(JSON.stringify({ 
        success: true, 
        session_id, 
        action: 'updated',
        status: existing.status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar nova sessão
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
        metadata: metadata || {},
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

    console.log(`[checkout-session-start] Session ${session_id} created successfully`);

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
