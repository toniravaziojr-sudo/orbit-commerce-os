import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash email/phone for Meta CAPI (SHA-256, lowercase, trimmed)
async function hashForMeta(value: string | null): Promise<string | null> {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const {
      tenant_id,
      event_name,
      event_id,
      event_time,
      event_source_url,
      user_data,
      custom_data,
      action_source = 'website',
      test_event_code,
    } = body;

    if (!tenant_id || !event_name) {
      return new Response(JSON.stringify({ error: 'tenant_id and event_name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get marketing config with access token
    const { data: config, error: configError } = await supabase
      .from('marketing_integrations')
      .select('meta_pixel_id, meta_access_token, meta_capi_enabled, meta_enabled')
      .eq('tenant_id', tenant_id)
      .single();

    if (configError || !config) {
      console.error('Config not found:', configError);
      return new Response(JSON.stringify({ error: 'Marketing config not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.meta_enabled || !config.meta_capi_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Meta CAPI not enabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.meta_pixel_id || !config.meta_access_token) {
      return new Response(JSON.stringify({ error: 'Meta Pixel ID or Access Token not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash user data for privacy
    const hashedUserData: Record<string, any> = {};
    if (user_data) {
      if (user_data.em) hashedUserData.em = [await hashForMeta(user_data.em)];
      if (user_data.ph) hashedUserData.ph = [await hashForMeta(user_data.ph)];
      if (user_data.fn) hashedUserData.fn = [await hashForMeta(user_data.fn)];
      if (user_data.ln) hashedUserData.ln = [await hashForMeta(user_data.ln)];
      if (user_data.client_ip_address) hashedUserData.client_ip_address = user_data.client_ip_address;
      if (user_data.client_user_agent) hashedUserData.client_user_agent = user_data.client_user_agent;
      if (user_data.fbc) hashedUserData.fbc = user_data.fbc;
      if (user_data.fbp) hashedUserData.fbp = user_data.fbp;
      if (user_data.external_id) hashedUserData.external_id = [await hashForMeta(user_data.external_id)];
    }

    // Build event payload
    const eventPayload: Record<string, any> = {
      event_name,
      event_time: event_time || Math.floor(Date.now() / 1000),
      action_source,
      user_data: hashedUserData,
    };

    if (event_id) eventPayload.event_id = event_id;
    if (event_source_url) eventPayload.event_source_url = event_source_url;
    if (custom_data) eventPayload.custom_data = custom_data;

    const requestBody: Record<string, any> = {
      data: [eventPayload],
    };

    if (test_event_code) {
      requestBody.test_event_code = test_event_code;
    }

    // Send to Meta Conversions API
    const metaUrl = `https://graph.facebook.com/v18.0/${config.meta_pixel_id}/events?access_token=${config.meta_access_token}`;
    
    console.log(`[marketing-send-meta] Sending ${event_name} to Meta CAPI for tenant ${tenant_id}`);

    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    // Log the event
    await supabase.from('marketing_events_log').insert({
      tenant_id,
      provider: 'meta',
      event_name,
      event_id: event_id || crypto.randomUUID(),
      event_source: 'server',
      event_data: { custom_data, action_source },
      provider_status: response.ok ? 'sent' : 'failed',
      provider_response: responseData,
      provider_error: response.ok ? null : JSON.stringify(responseData),
      sent_at: new Date().toISOString(),
    });

    if (!response.ok) {
      console.error('[marketing-send-meta] Error:', responseData);
      
      // Update last_error
      await supabase
        .from('marketing_integrations')
        .update({ 
          meta_last_error: JSON.stringify(responseData),
          meta_status: 'error',
        })
        .eq('tenant_id', tenant_id);

      return new Response(JSON.stringify({ error: responseData }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update success status
    await supabase
      .from('marketing_integrations')
      .update({ 
        meta_last_error: null,
        meta_status: 'active',
        meta_last_test_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant_id);

    console.log(`[marketing-send-meta] Success:`, responseData);

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[marketing-send-meta] Exception:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
