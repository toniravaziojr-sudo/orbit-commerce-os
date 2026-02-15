import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.0.0"; // Hub TikTok: reads from tiktok_ads_connections with fallback
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  console.log(`[marketing-send-tiktok][${VERSION}] Request received`);

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
      tenant_id, event_name, event_id, event_time,
      page_url, page_referrer, user_data, properties, test_event_code,
    } = body;

    if (!tenant_id || !event_name) {
      return new Response(JSON.stringify({ error: 'tenant_id and event_name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ========== SOURCE OF TRUTH: tiktok_ads_connections ==========
    let pixelId: string | null = null;
    let accessToken: string | null = null;
    let isEnabled = false;
    let eventsApiEnabled = false;
    let source = "unknown";

    // Try new table first
    const { data: adsConn, error: adsConnError } = await supabase
      .from('tiktok_ads_connections')
      .select('access_token, advertiser_id, is_active, connection_status, assets')
      .eq('tenant_id', tenant_id)
      .eq('connection_status', 'connected')
      .eq('is_active', true)
      .maybeSingle();

    if (!adsConnError && adsConn?.access_token) {
      accessToken = adsConn.access_token;
      // Get pixel from assets
      const pixels = (adsConn.assets as any)?.pixels || [];
      pixelId = pixels[0] || null;
      isEnabled = true;
      eventsApiEnabled = true;
      source = "tiktok_ads_connections";
    }

    // Fallback: marketing_integrations (legacy, will be removed in 30 days)
    if (!accessToken) {
      const { data: config, error: configError } = await supabase
        .from('marketing_integrations')
        .select('tiktok_pixel_id, tiktok_access_token, tiktok_events_api_enabled, tiktok_enabled')
        .eq('tenant_id', tenant_id)
        .single();

      if (!configError && config) {
        pixelId = config.tiktok_pixel_id;
        accessToken = (config as any).tiktok_access_token;
        isEnabled = config.tiktok_enabled;
        eventsApiEnabled = (config as any).tiktok_events_api_enabled || false;
        source = "marketing_integrations (legacy)";
      }
    }

    // If pixel not found in ads connection, try marketing_integrations for pixel_id
    if (!pixelId && source === "tiktok_ads_connections") {
      const { data: miConfig } = await supabase
        .from('marketing_integrations')
        .select('tiktok_pixel_id')
        .eq('tenant_id', tenant_id)
        .maybeSingle();
      
      if (miConfig?.tiktok_pixel_id) {
        pixelId = miConfig.tiktok_pixel_id;
      }
    }

    console.log(`[marketing-send-tiktok][${VERSION}] Source: ${source}, enabled: ${isEnabled}, eventsApi: ${eventsApiEnabled}`);

    if (!isEnabled || !eventsApiEnabled) {
      return new Response(JSON.stringify({ skipped: true, reason: 'TikTok Events API not enabled' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pixelId || !accessToken) {
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
      pixel_code: pixelId,
      data: [eventPayload],
      test_event_code: test_event_code || undefined,
    };

    const tiktokUrl = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
    
    console.log(`[marketing-send-tiktok][${VERSION}] Sending ${event_name} for tenant ${tenant_id}`);

    const response = await fetch(tiktokUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    // Log event
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
      console.error(`[marketing-send-tiktok][${VERSION}] Error:`, responseData);
      
      // Update error in tiktok_ads_connections
      await supabase
        .from('tiktok_ads_connections')
        .update({ 
          last_error: JSON.stringify(responseData),
          connection_status: 'error',
        })
        .eq('tenant_id', tenant_id);

      // Also update legacy
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

    // Update success in tiktok_ads_connections
    await supabase
      .from('tiktok_ads_connections')
      .update({ 
        last_error: null,
        connection_status: 'connected',
        last_sync_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant_id);

    // Also update legacy
    await supabase
      .from('marketing_integrations')
      .update({ 
        tiktok_last_error: null,
        tiktok_status: 'active',
        tiktok_last_test_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant_id);

    console.log(`[marketing-send-tiktok][${VERSION}] Success`);

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error(`[marketing-send-tiktok][${VERSION}] Exception:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
