import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Request received: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Handle GET (redirect from Meta) or POST (frontend call)
    let code: string | null = null;
    let state: string | null = null;

    if (req.method === "GET") {
      // Redirect from Meta OAuth
      const url = new URL(req.url);
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
      
      // Check for error
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");
      
      if (error) {
        console.error(`[meta-whatsapp-onboarding-callback][${traceId}] OAuth error: ${error} - ${errorDescription}`);
        // Redirect to frontend with error (using public domain)
        const frontendUrl = "https://app.comandocentral.com.br";
        return Response.redirect(`${frontendUrl}/integrations?whatsapp_error=${encodeURIComponent(errorDescription || error)}`, 302);
      }
    } else if (req.method === "POST") {
      // Frontend call with code
      const body = await req.json();
      code = body.code;
      state = body.state;
    }

    if (!code || !state) {
      console.error(`[meta-whatsapp-onboarding-callback][${traceId}] Missing code or state`);
      return new Response(JSON.stringify({ success: false, error: "Parâmetros inválidos" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Processing callback - state: ${state.substring(0, 8)}...`);

    // Validate state token
    const { data: stateData, error: stateError } = await supabase
      .from("meta_whatsapp_onboarding_states")
      .select("*")
      .eq("state_token", state)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateData) {
      console.error(`[meta-whatsapp-onboarding-callback][${traceId}] Invalid or expired state token`);
      return new Response(JSON.stringify({ success: false, error: "Token de estado inválido ou expirado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = stateData.tenant_id;
    console.log(`[meta-whatsapp-onboarding-callback][${traceId}] State validated for tenant: ${tenantId}`);

    // Mark state as used
    await supabase
      .from("meta_whatsapp_onboarding_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateData.id);

    // Get Meta app credentials
    const { data: credentials } = await supabase
      .from("platform_credentials")
      .select("credential_key, credential_value")
      .in("credential_key", ["META_APP_ID", "META_APP_SECRET", "META_GRAPH_API_VERSION"])
      .eq("is_active", true);

    const credMap: Record<string, string> = {};
    credentials?.forEach((c) => {
      credMap[c.credential_key] = c.credential_value;
    });

    const metaAppId = credMap["META_APP_ID"];
    const metaAppSecret = credMap["META_APP_SECRET"];
    const graphApiVersion = credMap["META_GRAPH_API_VERSION"] || "v21.0";

    if (!metaAppId || !metaAppSecret) {
      console.error(`[meta-whatsapp-onboarding-callback][${traceId}] Missing Meta credentials`);
      return new Response(JSON.stringify({ success: false, error: "Credenciais do Meta não configuradas" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `https://app.comandocentral.com.br/integrations/meta/whatsapp-callback`;

    // Exchange code for access token
    const tokenUrl = `https://graph.facebook.com/${graphApiVersion}/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: metaAppId,
      client_secret: metaAppSecret,
      code,
      redirect_uri: redirectUri,
    });

    console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Exchanging code for token...`);
    
    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams}`);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error(`[meta-whatsapp-onboarding-callback][${traceId}] Token exchange error:`, tokenData.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: tokenData.error.message || "Erro ao obter token de acesso" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in; // Usually 60 days for long-lived tokens
    const tokenExpiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000);

    console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Token obtained, expires in ${expiresIn}s`);

    // Get shared WABA info from the Embedded Signup response
    // The token should give us access to the WABA that was shared
    const debugTokenUrl = `https://graph.facebook.com/${graphApiVersion}/debug_token?input_token=${accessToken}&access_token=${metaAppId}|${metaAppSecret}`;
    const debugResponse = await fetch(debugTokenUrl);
    const debugData = await debugResponse.json();

    console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Token debug:`, JSON.stringify(debugData).substring(0, 500));

    // Get WABA ID from the shared WABAs
    // Try to get the WABA from the debug token or from direct API call
    let wabaId: string | null = null;
    let phoneNumberId: string | null = null;
    let displayPhoneNumber: string | null = null;
    let verifiedName: string | null = null;
    let businessId: string | null = null;

    // Try getting WABA from shared_wabas in debug token
    const sharedWabas = debugData.data?.granular_scopes?.find(
      (s: any) => s.scope === "whatsapp_business_management"
    )?.target_ids;

    if (sharedWabas && sharedWabas.length > 0) {
      wabaId = sharedWabas[0];
      console.log(`[meta-whatsapp-onboarding-callback][${traceId}] WABA ID from debug: ${wabaId}`);
    }

    // If we have WABA ID, get phone numbers
    if (wabaId) {
      const phoneNumbersUrl = `https://graph.facebook.com/${graphApiVersion}/${wabaId}/phone_numbers?access_token=${accessToken}`;
      const phoneResponse = await fetch(phoneNumbersUrl);
      const phoneData = await phoneResponse.json();

      console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Phone numbers:`, JSON.stringify(phoneData).substring(0, 500));

      if (phoneData.data && phoneData.data.length > 0) {
        const phoneInfo = phoneData.data[0];
        phoneNumberId = phoneInfo.id;
        displayPhoneNumber = phoneInfo.display_phone_number;
        verifiedName = phoneInfo.verified_name;
      }

      // Get business ID
      const wabaInfoUrl = `https://graph.facebook.com/${graphApiVersion}/${wabaId}?fields=owner_business_info&access_token=${accessToken}`;
      const wabaInfoResponse = await fetch(wabaInfoUrl);
      const wabaInfo = await wabaInfoResponse.json();
      businessId = wabaInfo.owner_business_info?.id || null;
    }

    if (!phoneNumberId) {
      console.error(`[meta-whatsapp-onboarding-callback][${traceId}] No phone number found`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Nenhum número de telefone encontrado. Complete a configuração no Meta Business Suite." 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Saving config - WABA: ${wabaId}, Phone: ${phoneNumberId}`);

    // Check if tenant already has a Meta connection
    const { data: existingConfig } = await supabase
      .from("whatsapp_configs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("provider", "meta")
      .single();

    if (existingConfig) {
      // Update existing
      const { error: updateError } = await supabase
        .from("whatsapp_configs")
        .update({
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          business_id: businessId,
          access_token: accessToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          display_phone_number: displayPhoneNumber,
          verified_name: verifiedName,
          phone_number: displayPhoneNumber,
          connection_status: "connected",
          last_connected_at: new Date().toISOString(),
          last_error: null,
          is_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConfig.id);

      if (updateError) {
        console.error(`[meta-whatsapp-onboarding-callback][${traceId}] Update error:`, updateError);
        throw updateError;
      }
    } else {
      // Create new
      const { error: insertError } = await supabase
        .from("whatsapp_configs")
        .insert({
          tenant_id: tenantId,
          provider: "meta",
          waba_id: wabaId,
          phone_number_id: phoneNumberId,
          business_id: businessId,
          access_token: accessToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          display_phone_number: displayPhoneNumber,
          verified_name: verifiedName,
          phone_number: displayPhoneNumber,
          connection_status: "connected",
          last_connected_at: new Date().toISOString(),
          is_enabled: true,
        });

      if (insertError) {
        console.error(`[meta-whatsapp-onboarding-callback][${traceId}] Insert error:`, insertError);
        throw insertError;
      }
    }

    console.log(`[meta-whatsapp-onboarding-callback][${traceId}] Config saved successfully`);

    // If GET request (redirect from Meta), redirect to frontend
    if (req.method === "GET") {
      const frontendUrl = "https://app.comandocentral.com.br";
      return Response.redirect(`${frontendUrl}/integrations?whatsapp_connected=true`, 302);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        waba_id: wabaId,
        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,
        verified_name: verifiedName,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[meta-whatsapp-onboarding-callback][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno do servidor" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
