import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TikTok OAuth Callback
 * 
 * Recebe o auth_code do TikTok via POST (do frontend), valida state (anti-CSRF), 
 * troca por tokens, descobre advertiser accounts e salva no banco por tenant.
 * 
 * Contrato:
 * - Erro de negócio = HTTP 200 + { success: false, error, code }
 * - Sucesso = HTTP 200 + { success: true, ... }
 * 
 * TikTok Token Exchange Docs: https://business-api.tiktok.com/portal/docs?id=1738373164380162
 */
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Espera body JSON com auth_code e state
    const body = await req.json();
    const { auth_code, state } = body;

    if (!auth_code || !state) {
      console.log("[tiktok-oauth-callback] auth_code ou state ausente no body");
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros ausentes", code: "MISSING_PARAMS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar state no banco (anti-CSRF)
    const { data: stateRecord, error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .select("*")
      .eq("state_hash", state)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      console.error("[tiktok-oauth-callback] State inválido ou expirado:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Sessão de autorização expirada ou inválida", code: "INVALID_STATE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Marcar state como usado
    await supabase
      .from("tiktok_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRecord.id);

    const { tenant_id, user_id, return_path } = stateRecord;
    console.log(`[tiktok-oauth-callback] Processando para tenant ${tenant_id}`);

    // Buscar credenciais do app TikTok
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_ID");
    const appSecret = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_APP_SECRET");

    if (!appId || !appSecret) {
      console.error("[tiktok-oauth-callback] Credenciais TikTok não configuradas");
      return new Response(
        JSON.stringify({ success: false, error: "Integração TikTok não configurada", code: "NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trocar auth_code por access_token
    // Docs: https://business-api.tiktok.com/portal/docs?id=1738373164380162
    const tokenResponse = await fetch("https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: appId,
        secret: appSecret,
        auth_code: auth_code,
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[tiktok-oauth-callback] Erro ao trocar token:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao obter tokens de acesso", code: "TOKEN_EXCHANGE_FAILED", details: errorData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    
    // TikTok retorna: { code: 0, message: "OK", data: { access_token, advertiser_ids, scope } }
    if (tokenData.code !== 0) {
      console.error("[tiktok-oauth-callback] Erro da API TikTok:", tokenData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: tokenData.message || "Erro ao autorizar conta TikTok", 
          code: "TIKTOK_API_ERROR" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.data.access_token;
    const advertiserIds = tokenData.data.advertiser_ids || [];
    const scopes = tokenData.data.scope || [];

    // Calcular expiração (TikTok tokens expiram em 24 horas, mas podem ser refreshed)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Buscar detalhes dos advertisers
    let advertiserName = "";
    let advertiserId = "";
    
    if (advertiserIds.length > 0) {
      advertiserId = advertiserIds[0]; // Usar o primeiro advertiser
      
      try {
        const advertiserResponse = await fetch(
          `https://business-api.tiktok.com/open_api/v1.3/advertiser/info/?advertiser_ids=["${advertiserId}"]`,
          {
            method: "GET",
            headers: {
              "Access-Token": accessToken,
            },
          }
        );
        
        if (advertiserResponse.ok) {
          const advertiserData = await advertiserResponse.json();
          if (advertiserData.code === 0 && advertiserData.data?.list?.length > 0) {
            advertiserName = advertiserData.data.list[0].advertiser_name || advertiserData.data.list[0].name || "";
          }
        }
      } catch (advError) {
        console.warn("[tiktok-oauth-callback] Erro ao buscar detalhes do advertiser:", advError);
      }
    }

    // Upsert na tabela marketing_integrations
    // Primeiro, verificar se já existe um registro
    const { data: existingConfig } = await supabase
      .from("marketing_integrations")
      .select("id")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const updateData = {
      tiktok_access_token: accessToken,
      tiktok_token_expires_at: expiresAt,
      tiktok_advertiser_id: advertiserId,
      tiktok_advertiser_name: advertiserName,
      tiktok_connected_at: new Date().toISOString(),
      tiktok_connected_by: user_id,
      tiktok_enabled: true,
      tiktok_events_api_enabled: true,
      tiktok_status: "active",
      tiktok_last_error: null,
    };

    let upsertError;
    if (existingConfig?.id) {
      const { error } = await supabase
        .from("marketing_integrations")
        .update(updateData)
        .eq("id", existingConfig.id);
      upsertError = error;
    } else {
      const { error } = await supabase
        .from("marketing_integrations")
        .insert({
          tenant_id,
          ...updateData,
        });
      upsertError = error;
    }

    if (upsertError) {
      console.error("[tiktok-oauth-callback] Erro ao salvar conexão:", upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar a conexão", code: "SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[tiktok-oauth-callback] Conexão TikTok salva com sucesso para tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        returnPath: return_path || "/marketing",
        connection: {
          advertiserId,
          advertiserName,
          expiresAt,
          scopes,
          advertiserCount: advertiserIds.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[tiktok-oauth-callback] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
