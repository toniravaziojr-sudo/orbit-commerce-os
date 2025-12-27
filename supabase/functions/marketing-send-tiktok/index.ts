import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash for TikTok Events API (SHA-256, lowercase)
async function hashForTikTok(value: string | null): Promise<string | null> {
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
      page_url,
      page_referrer,
      user_data,
      properties,
      test_event_code,
    } = body;

    if (!tenant_id || !event_name) {
      return new Response(JSON.stringify({ error: 'tenant_id and event_name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get marketing config
    const { data: config, error: configError } = await supabase
      .from('marketing_integrations')
      .select('tiktok_pixel_id, tiktok_access_token, tiktok_events_api_enabled, tiktok_enabled')
      .eq('tenant_id', tenant_id)
      .single();

    if (configError || !config) {
      console.error('Config not found:', configError);
      return new Response(JSON.stringify({ error: 'Marketing config not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.tiktok_enabled || !config.tiktok_events_api_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: 'TikTok Events API not enabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.tiktok_pixel_id || !config.tiktok_access_token) {
      return new Response(JSON.stringify({ error: 'TikTok Pixel ID or Access Token not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Hash user data
    const hashedUserData: Record<string, any> = {};
    if (user_data) {
      if (user_data.email) hashedUserData.email = await hashForTikTok(user_data.email);
      if (user_data.phone) hashedUserData.phone = await hashForTikTok(user_data.phone);
      if (user_data.external_id) hashedUserData.external_id = await hashForTikTok(user_data.external_id);
      if (user_data.ip) hashedUserData.ip = user_data.ip;
      if (user_data.user_agent) hashedUserData.user_agent = user_data.user_agent;
      if (user_data.ttclid) hashedUserData.ttclid = user_data.ttclid;
    }

    // Build event payload
    const eventPayload: Record<string, any> = {
      event: event_name,
      event_id: event_id || crypto.randomUUID(),
      timestamp: event_time || new Date().toISOString(),
      user: hashedUserData,
    };

    if (page_url) {
      eventPayload.page = { url: page_url };
      if (page_referrer) eventPayload.page.referrer = page_referrer;
    }

    if (properties) {
      eventPayload.properties = properties;
    }

    const requestBody = {
      pixel_code: config.tiktok_pixel_id,
      data: [eventPayload],
      test_event_code: test_event_code || undefined,
    };

    // Send to TikTok Events API
    const tiktokUrl = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
    
    console.log(`[marketing-send-tiktok] Sending ${event_name} to TikTok Events API for tenant ${tenant_id}`);

    const response = await fetch(tiktokUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': config.tiktok_access_token,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    // Log the event
    await supabase.from('marketing_events_log').insert({
      tenant_id,
      provider: 'tiktok',
      event_name,
      event_id: eventPayload.event_id,
      event_source: 'server',
      event_data: { properties },
      provider_status: responseData.code === 0 ? 'sent' : 'failed',
      provider_response: responseData,
      provider_error: responseData.code !== 0 ? JSON.stringify(responseData) : null,
      sent_at: new Date().toISOString(),
    });

    if (responseData.code !== 0) {
      console.error('[marketing-send-tiktok] Error:', responseData);
      
      await supabase
        .from('marketing_integrations')
        .update({ 
          tiktok_last_error: JSON.stringify(responseData),
          tiktok_status: 'error',
        })
        .eq('tenant_id', tenant_id);

      return new Response(JSON.stringify({ error: responseData }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update success status
    await supabase
      .from('marketing_integrations')
      .update({ 
        tiktok_last_error: null,
        tiktok_status: 'active',
        tiktok_last_test_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant_id);

    console.log(`[marketing-send-tiktok] Success:`, responseData);

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[marketing-send-tiktok] Exception:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
