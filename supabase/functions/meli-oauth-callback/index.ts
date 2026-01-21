import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

/**
 * Mercado Livre OAuth Callback
 * 
 * Recebe o code do ML, troca por tokens e salva no banco.
 * Redireciona de volta para o app com status.
 */
serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // URL base do app para redirect
  const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Se usuário cancelou ou erro do ML
    if (error) {
      console.log(`[meli-oauth-callback] Erro do ML: ${error}`);
      return Response.redirect(
        `${appBaseUrl}/marketplaces?meli_error=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!code || !state) {
      console.log("[meli-oauth-callback] Code ou state ausente");
      return Response.redirect(
        `${appBaseUrl}/marketplaces?meli_error=missing_params`,
        302
      );
    }

    // Decodificar state
    let stateData: { tenant_id: string; user_id: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      console.error("[meli-oauth-callback] State inválido");
      return Response.redirect(
        `${appBaseUrl}/marketplaces?meli_error=invalid_state`,
        302
      );
    }

    const { tenant_id, user_id } = stateData;
    console.log(`[meli-oauth-callback] Processando para tenant ${tenant_id}`);

    // Buscar credenciais do app
    const clientId = await getCredential(supabaseUrl, supabaseServiceKey, "MELI_APP_ID");
    const clientSecret = await getCredential(supabaseUrl, supabaseServiceKey, "MELI_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("[meli-oauth-callback] Credenciais ML não configuradas");
      return Response.redirect(
        `${appBaseUrl}/marketplaces?meli_error=not_configured`,
        302
      );
    }

    // Construir redirect URI (deve ser igual ao cadastrado no app - via Cloudflare proxy)
    const redirectUri = `https://app.comandocentral.com.br/integrations/meli/callback`;

    // Trocar code por tokens
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
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[meli-oauth-callback] Erro ao trocar token:", errorData);
      return Response.redirect(
        `${appBaseUrl}/marketplaces?meli_error=token_exchange_failed`,
        302
      );
    }

    const tokenData = await tokenResponse.json();
    console.log(`[meli-oauth-callback] Token obtido para user_id ML: ${tokenData.user_id}`);

    // Buscar informações do usuário ML
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

    // Calcular expires_at
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

    // Upsert na tabela marketplace_connections
    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert({
        tenant_id: tenant_id,
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
      return Response.redirect(
        `${appBaseUrl}/marketplaces?meli_error=save_failed`,
        302
      );
    }

    console.log(`[meli-oauth-callback] Conexão salva com sucesso para tenant ${tenant_id}`);

    // Redirect com sucesso
    return Response.redirect(
      `${appBaseUrl}/marketplaces?meli_connected=true`,
      302
    );

  } catch (error) {
    console.error("[meli-oauth-callback] Erro:", error);
    return Response.redirect(
      `${appBaseUrl}/marketplaces?meli_error=internal_error`,
      302
    );
  }
});
