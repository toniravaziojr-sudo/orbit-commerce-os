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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const {
      tenant_id,
      event_name,
      client_id,
      user_id,
      params,
      user_properties,
      debug_mode,
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
      .select('google_measurement_id, google_api_secret, google_enabled')
      .eq('tenant_id', tenant_id)
      .single();

    if (configError || !config) {
      console.error('Config not found:', configError);
      return new Response(JSON.stringify({ error: 'Marketing config not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.google_enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Google not enabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.google_measurement_id || !config.google_api_secret) {
      return new Response(JSON.stringify({ error: 'Google Measurement ID or API Secret not configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build event payload for GA4 Measurement Protocol
    const eventPayload: Record<string, any> = {
      name: event_name,
      params: {
        ...params,
        engagement_time_msec: params?.engagement_time_msec || 100,
      },
    };

    const requestBody: Record<string, any> = {
      client_id: client_id || crypto.randomUUID(),
      events: [eventPayload],
    };

    if (user_id) {
      requestBody.user_id = user_id;
    }

    if (user_properties) {
      requestBody.user_properties = user_properties;
    }

    // Send to GA4 Measurement Protocol
    const endpoint = debug_mode 
      ? 'https://www.google-analytics.com/debug/mp/collect'
      : 'https://www.google-analytics.com/mp/collect';
    
    const googleUrl = `${endpoint}?measurement_id=${config.google_measurement_id}&api_secret=${config.google_api_secret}`;
    
    console.log(`[marketing-send-google] Sending ${event_name} to GA4 MP for tenant ${tenant_id}`);

    const response = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    // GA4 MP returns 204 No Content on success (or 200 for debug)
    let responseData: any = null;
    const responseText = await response.text();
    if (responseText) {
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }
    }

    const isSuccess = response.status === 204 || response.status === 200;

    // Log the event
    await supabase.from('marketing_events_log').insert({
      tenant_id,
      provider: 'google',
      event_name,
      event_id: crypto.randomUUID(),
      event_source: 'server',
      event_data: { params, client_id },
      provider_status: isSuccess ? 'sent' : 'failed',
      provider_response: responseData,
      provider_error: isSuccess ? null : JSON.stringify(responseData),
      sent_at: new Date().toISOString(),
    });

    if (!isSuccess) {
      console.error('[marketing-send-google] Error:', responseData);
      
      await supabase
        .from('marketing_integrations')
        .update({ 
          google_last_error: JSON.stringify(responseData || { status: response.status }),
          google_status: 'error',
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
        google_last_error: null,
        google_status: 'active',
        google_last_test_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant_id);

    console.log(`[marketing-send-google] Success for ${event_name}`);

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[marketing-send-google] Exception:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
