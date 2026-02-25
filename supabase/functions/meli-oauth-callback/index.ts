import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const VERSION = "v2.0.0"; // JSON mode + redirect fix to integrations

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function jsonResponse(payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function redirectToIntegrations(
  appBaseUrl: string,
  params: Record<string, string>,
) {
  const redirectUrl = new URL("/integrations", appBaseUrl);
  redirectUrl.searchParams.set("tab", "marketplaces");

  Object.entries(params).forEach(([key, value]) => {
    redirectUrl.searchParams.set(key, value);
  });

  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: redirectUrl.toString(),
    },
  });
}

/**
 * Mercado Livre OAuth Callback
 *
 * Recebe code/state, troca por tokens e salva no banco.
 * - Modo JSON (POST): usado pelo popup callback do frontend
 * - Modo Redirect (GET): fallback para navegação direta
 */
serve(async (req) => {
  console.log(`[meli-oauth-callback][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";
  const wantsJson = req.method === "POST" || req.headers.get("accept")?.includes("application/json");

  const respondError = (code: string) => {
    if (wantsJson) {
      return jsonResponse({ success: false, error: code });
    }
    return redirectToIntegrations(appBaseUrl, { meli_error: code });
  };

  const respondSuccess = () => {
    if (wantsJson) {
      return jsonResponse({ success: true });
    }
    return redirectToIntegrations(appBaseUrl, { meli_connected: "true" });
  };

  try {
    let code: string | null = null;
    let state: string | null = null;
    let error: string | null = null;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      code = body?.code || null;
      state = body?.state || null;
      error = body?.error || null;
    } else {
      const url = new URL(req.url);
      code = url.searchParams.get("code");
      state = url.searchParams.get("state");
      error = url.searchParams.get("error");
    }

    if (error) {
      console.log(`[meli-oauth-callback] Erro do ML: ${error}`);
      return respondError(error);
    }

    if (!code || !state) {
      console.log("[meli-oauth-callback] Code ou state ausente");
      return respondError("missing_params");
    }

    let stateData: { tenant_id: string; user_id: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      console.error("[meli-oauth-callback] State inválido");
      return respondError("invalid_state");
    }

    const { tenant_id, user_id } = stateData;
    console.log(`[meli-oauth-callback] Processando para tenant ${tenant_id}`);

    const clientId = await getCredential(supabaseUrl, supabaseServiceKey, "MELI_APP_ID");
    const clientSecret = await getCredential(supabaseUrl, supabaseServiceKey, "MELI_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("[meli-oauth-callback] Credenciais ML não configuradas");
      return respondError("not_configured");
    }

    const redirectUri = "https://app.comandocentral.com.br/integrations/meli/callback";

    const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[meli-oauth-callback] Erro ao trocar token:", errorData);
      return respondError("token_exchange_failed");
    }

    const tokenData = await tokenResponse.json();
    console.log(`[meli-oauth-callback] Token obtido para user_id ML: ${tokenData.user_id}`);

    const userResponse = await fetch(`https://api.mercadolibre.com/users/${tokenData.user_id}`, {
      headers: {
        "Authorization": `Bearer ${tokenData.access_token}`,
      },
    });

    let meliUsername = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      meliUsername = userData.nickname || userData.first_name;
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert({
        tenant_id,
        marketplace: "mercadolivre",
        external_user_id: String(tokenData.user_id),
        external_username: meliUsername,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type || "Bearer",
        expires_at: expiresAt,
        scopes: tokenData.scope ? tokenData.scope.split(" ") : ["read", "write", "offline_access"],
        is_active: true,
        last_error: null,
        metadata: {
          connected_by: user_id,
          connected_at: new Date().toISOString(),
        },
      }, {
        onConflict: "tenant_id,marketplace",
      });

    if (upsertError) {
      console.error("[meli-oauth-callback] Erro ao salvar conexão:", upsertError);
      return respondError("save_failed");
    }

    console.log(`[meli-oauth-callback] Conexão salva com sucesso para tenant ${tenant_id}`);
    return respondSuccess();
  } catch (error) {
    console.error("[meli-oauth-callback] Erro:", error);
    return respondError("internal_error");
  }
});

