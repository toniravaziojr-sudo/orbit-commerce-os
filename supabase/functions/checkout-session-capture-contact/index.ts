// ============================================
// CHECKOUT SESSION CAPTURE CONTACT - Mark when contact info captured
// Called when user completes step 1 (personal data)
// Sets contact_captured_at so session can be considered for abandoned recovery
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
 * Also handles development/preview environments
 */
async function resolveTenantFromHost(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  hostname: string
): Promise<string | null> {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, '').split(':')[0];
  
  console.log(`[checkout-session-capture-contact] Resolving tenant from host: ${normalizedHost}`);
  
  // Check for platform subdomain pattern: {slug}.shops.comandocentral.com.br
  const platformPattern = /^([a-z0-9-]+)\.shops\.comandocentral\.com\.br$/;
  const platformMatch = normalizedHost.match(platformPattern);
  
  if (platformMatch) {
    const slug = platformMatch[1];
    console.log(`[checkout-session-capture-contact] Platform subdomain detected, slug: ${slug}`);
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
    console.log(`[checkout-session-capture-contact] Custom domain found, tenant_id: ${domainRecord.tenant_id}`);
    return domainRecord.tenant_id;
  }
  
  // FALLBACK: For development/preview (lovableproject.com), get tenant from session
  // The session was created with the correct tenant_id, so we can use that
  console.log(`[checkout-session-capture-contact] No domain match, will try to get tenant from session`);
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

    // Parse body
    let body: Record<string, unknown> = {};
    const rawBody = await req.text();
    
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      session_id,
      store_host,
      customer_name,
      customer_email,
      customer_phone,
    } = body as Record<string, any>;

    console.log(`[checkout-session-capture-contact] Request:`, {
      session_id,
      store_host,
      has_email: !!customer_email,
      has_phone: !!customer_phone,
    });

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Must have at least email or phone to be considered "contact captured"
    if (!customer_email && !customer_phone) {
      return new Response(JSON.stringify({ error: 'email or phone required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tenant
    let tenantId: string | null = null;
    if (store_host) {
      tenantId = await resolveTenantFromHost(supabase, store_host);
    }

    if (!tenantId) {
      const originHeader = req.headers.get('origin');
      if (originHeader) {
        try {
          const originUrl = new URL(originHeader);
          tenantId = await resolveTenantFromHost(supabase, originUrl.hostname);
        } catch {}
      }
    }

    // FALLBACK: Get tenant from the session itself (for dev/preview environments)
    if (!tenantId && session_id) {
      console.log(`[checkout-session-capture-contact] Fallback: getting tenant from session ${session_id}`);
      const { data: session } = await supabase
        .from('checkout_sessions')
        .select('tenant_id')
        .eq('id', session_id)
        .single();
      
      if (session?.tenant_id) {
        tenantId = session.tenant_id;
        console.log(`[checkout-session-capture-contact] Got tenant from session: ${tenantId}`);
      }
    }

    if (!tenantId) {
      console.error('[checkout-session-capture-contact] Could not resolve tenant for host:', store_host);
      return new Response(JSON.stringify({ error: 'Could not resolve tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[checkout-session-capture-contact] Tenant resolved: ${tenantId}`);

    // Update session with contact info and set contact_captured_at
    const updateData: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
    };

    if (customer_name) updateData.customer_name = customer_name;
    if (customer_email) updateData.customer_email = customer_email;
    if (customer_phone) updateData.customer_phone = customer_phone;

    // First check if contact_captured_at is already set
    const { data: existing } = await supabase
      .from('checkout_sessions')
      .select('id, contact_captured_at')
      .eq('id', session_id)
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only set contact_captured_at if not already set
    if (!existing.contact_captured_at) {
      updateData.contact_captured_at = new Date().toISOString();
      console.log(`[checkout-session-capture-contact] Setting contact_captured_at for session ${session_id}`);
    }

    const { error: updateError } = await supabase
      .from('checkout_sessions')
      .update(updateData)
      .eq('id', session_id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[checkout-session-capture-contact] Update error:', updateError);
      throw updateError;
    }

    console.log(`[checkout-session-capture-contact] Session ${session_id} contact captured`);

    return new Response(JSON.stringify({ 
      success: true, 
      session_id,
      contact_captured: true,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-capture-contact] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
