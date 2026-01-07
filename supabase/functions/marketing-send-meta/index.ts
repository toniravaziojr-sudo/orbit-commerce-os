import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash value for Meta CAPI (SHA-256, lowercase, trimmed)
async function hashForMeta(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (!normalized) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize phone for Meta (digits only, with country code)
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  // Add Brazil country code if not present
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  return digits;
}

// Extract client IP from request headers
function getClientIp(req: Request): string | null {
  // Check various headers in order of preference
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) return cfConnectingIp;
  
  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Take the first IP if there are multiple
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp) return xRealIp;
  
  return null;
}

// Extract user agent from request headers
function getUserAgent(req: Request): string | null {
  return req.headers.get('user-agent') || null;
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
      event_name = 'PageView',
      event_id,
      event_time,
      event_source_url,
      user,
      user_data: legacyUserData, // Support old format
      custom_data,
      action_source = 'website',
      test_event_code,
      // Optional: fbp/fbc from body (when cookies can't be read)
      fbp,
      fbc,
    } = body;

    // Merge user and legacyUserData
    const userData = user || legacyUserData || {};

    if (!tenant_id) {
      return new Response(JSON.stringify({ 
        error: 'tenant_id é obrigatório',
        code: 'MISSING_TENANT_ID' 
      }), {
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
      console.error('[marketing-send-meta] Config not found:', configError);
      return new Response(JSON.stringify({ 
        error: 'Configuração de marketing não encontrada',
        code: 'CONFIG_NOT_FOUND'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.meta_enabled || !config.meta_capi_enabled) {
      return new Response(JSON.stringify({ 
        skipped: true, 
        reason: 'Meta CAPI não está habilitado' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.meta_pixel_id || !config.meta_access_token) {
      return new Response(JSON.stringify({ 
        error: 'Meta Pixel ID ou Access Token não configurados',
        code: 'MISSING_CREDENTIALS'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract IP and User-Agent from request headers
    const clientIpAddress = getClientIp(req) || userData.client_ip_address || null;
    const clientUserAgent = getUserAgent(req) || userData.client_user_agent || null;

    // Validate: need at least email OR phone OR external_id for meaningful matching
    const hasEmail = !!(userData.email || userData.em);
    const hasPhone = !!(userData.phone || userData.ph);
    const hasExternalId = !!(userData.external_id);
    
    if (!hasEmail && !hasPhone && !hasExternalId) {
      return new Response(JSON.stringify({ 
        error: 'Informe pelo menos email, telefone ou external_id para correspondência de usuário',
        code: 'MISSING_USER_DATA',
        required: ['email', 'phone', 'external_id'],
        message: 'O Meta CAPI requer dados do cliente para correspondência. Forneça email, telefone ou ID externo.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build user_data with maximum signals
    const hashedUserData: Record<string, any> = {};
    
    // Email (em) - hash required
    const emailValue = userData.email || userData.em;
    if (emailValue) {
      const hashedEmail = await hashForMeta(emailValue);
      if (hashedEmail) hashedUserData.em = [hashedEmail];
    }
    
    // Phone (ph) - normalize and hash
    const phoneValue = userData.phone || userData.ph;
    if (phoneValue) {
      const normalizedPhone = normalizePhone(phoneValue);
      if (normalizedPhone) {
        const hashedPhone = await hashForMeta(normalizedPhone);
        if (hashedPhone) hashedUserData.ph = [hashedPhone];
      }
    }
    
    // First name (fn)
    const fnValue = userData.first_name || userData.fn;
    if (fnValue) {
      const hashedFn = await hashForMeta(fnValue);
      if (hashedFn) hashedUserData.fn = [hashedFn];
    }
    
    // Last name (ln)
    const lnValue = userData.last_name || userData.ln;
    if (lnValue) {
      const hashedLn = await hashForMeta(lnValue);
      if (hashedLn) hashedUserData.ln = [hashedLn];
    }
    
    // City (ct)
    const cityValue = userData.city || userData.ct;
    if (cityValue) {
      const hashedCity = await hashForMeta(cityValue);
      if (hashedCity) hashedUserData.ct = [hashedCity];
    }
    
    // State (st)
    const stateValue = userData.state || userData.st;
    if (stateValue) {
      const hashedState = await hashForMeta(stateValue);
      if (hashedState) hashedUserData.st = [hashedState];
    }
    
    // Zip/Postal code (zp)
    const zipValue = userData.zip || userData.zp || userData.postal_code;
    if (zipValue) {
      const hashedZip = await hashForMeta(zipValue.replace(/\D/g, ''));
      if (hashedZip) hashedUserData.zp = [hashedZip];
    }
    
    // Country (country)
    const countryValue = userData.country;
    if (countryValue) {
      const hashedCountry = await hashForMeta(countryValue);
      if (hashedCountry) hashedUserData.country = [hashedCountry];
    }
    
    // External ID
    if (userData.external_id) {
      const hashedExtId = await hashForMeta(userData.external_id);
      if (hashedExtId) hashedUserData.external_id = [hashedExtId];
    }
    
    // Client IP address (not hashed)
    if (clientIpAddress) {
      hashedUserData.client_ip_address = clientIpAddress;
    }
    
    // Client User Agent (not hashed)
    if (clientUserAgent) {
      hashedUserData.client_user_agent = clientUserAgent;
    }
    
    // Facebook click ID (fbc) - not hashed
    const fbcValue = fbc || userData.fbc;
    if (fbcValue) {
      hashedUserData.fbc = fbcValue;
    }
    
    // Facebook browser ID (fbp) - not hashed
    const fbpValue = fbp || userData.fbp;
    if (fbpValue) {
      hashedUserData.fbp = fbpValue;
    }

    // Generate event_id if not provided
    const finalEventId = event_id || crypto.randomUUID();
    
    // Build event payload
    const eventPayload: Record<string, any> = {
      event_name,
      event_time: event_time || Math.floor(Date.now() / 1000),
      event_id: finalEventId,
      action_source,
      user_data: hashedUserData,
    };

    if (event_source_url) {
      eventPayload.event_source_url = event_source_url;
    }
    
    if (custom_data && Object.keys(custom_data).length > 0) {
      eventPayload.custom_data = custom_data;
    }

    const requestBody: Record<string, any> = {
      data: [eventPayload],
    };

    if (test_event_code) {
      requestBody.test_event_code = test_event_code;
    }

    // Send to Meta Conversions API
    const metaUrl = `https://graph.facebook.com/v18.0/${config.meta_pixel_id}/events?access_token=${config.meta_access_token}`;
    
    console.log(`[marketing-send-meta] Sending ${event_name} to Meta CAPI for tenant ${tenant_id}`);
    console.log(`[marketing-send-meta] user_data keys:`, Object.keys(hashedUserData));

    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    // Log the event (without PII)
    const logData = {
      tenant_id,
      provider: 'meta',
      event_name,
      event_id: finalEventId,
      event_source: 'server',
      event_data: { 
        custom_data: custom_data || null, 
        action_source,
        user_data_keys: Object.keys(hashedUserData),
        has_test_code: !!test_event_code,
      },
      provider_status: response.ok ? 'sent' : 'failed',
      provider_response: responseData,
      provider_error: response.ok ? null : JSON.stringify(responseData),
      sent_at: new Date().toISOString(),
    };

    await supabase.from('marketing_events_log').insert(logData);

    if (!response.ok) {
      console.error('[marketing-send-meta] Error from Meta:', responseData);
      
      // Parse Meta error for better message
      let errorMessage = 'Erro desconhecido';
      let errorUserMsg = '';
      
      if (responseData?.error) {
        errorMessage = responseData.error.message || errorMessage;
        errorUserMsg = responseData.error.error_user_msg || '';
      }
      
      // Update last_error
      await supabase
        .from('marketing_integrations')
        .update({ 
          meta_last_error: errorUserMsg || errorMessage,
          meta_status: 'error',
        })
        .eq('tenant_id', tenant_id);

      return new Response(JSON.stringify({ 
        error: errorMessage,
        error_user_msg: errorUserMsg,
        meta_response: responseData,
        event_id: finalEventId,
      }), {
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

    return new Response(JSON.stringify({ 
      success: true, 
      event_id: finalEventId,
      events_received: responseData.events_received,
      fbtrace_id: responseData.fbtrace_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[marketing-send-meta] Exception:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: message,
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
