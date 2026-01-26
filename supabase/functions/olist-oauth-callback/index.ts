import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

/**
 * Olist OAuth Callback - Partners API
 * 
 * Recebe o code do Olist, troca por tokens (access_token, refresh_token, id_token)
 * e salva no banco. O id_token é usado nas chamadas da API com Authorization: JWT {id_token}.
 * 
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
    const errorDescription = url.searchParams.get("error_description");

    // Se usuário cancelou ou erro do Olist
    if (error) {
      console.log(`[olist-oauth-callback] Erro do Olist: ${error} - ${errorDescription}`);
      return Response.redirect(
        `${appBaseUrl}/marketplaces/olist?olist_error=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!code || !state) {
      console.log("[olist-oauth-callback] Code ou state ausente");
      return Response.redirect(
        `${appBaseUrl}/marketplaces/olist?olist_error=missing_params`,
        302
      );
    }

    // Decodificar state
    let stateData: { tenant_id: string; user_id: string; environment: string; timestamp: number };
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      console.error("[olist-oauth-callback] State inválido");
      return Response.redirect(
        `${appBaseUrl}/marketplaces/olist?olist_error=invalid_state`,
        302
      );
    }

    const { tenant_id, user_id, environment = "production" } = stateData;
    console.log(`[olist-oauth-callback] Processando para tenant ${tenant_id} (env: ${environment})`);

    // Buscar credenciais do app
    const clientId = await getCredential(supabaseUrl, supabaseServiceKey, "OLIST_CLIENT_ID");
    const clientSecret = await getCredential(supabaseUrl, supabaseServiceKey, "OLIST_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("[olist-oauth-callback] Credenciais Olist não configuradas");
      return Response.redirect(
        `${appBaseUrl}/marketplaces/olist?olist_error=not_configured`,
        302
      );
    }

    // Definir URLs baseado no ambiente
    const isSandbox = environment === "sandbox";
    const tokenUrl = isSandbox 
      ? "https://auth-engine.olist.com/realms/3rd-party-sandbox/protocol/openid-connect/token"
      : "https://id.olist.com/protocol/openid-connect/token";

    // Construir redirect URI (deve ser igual ao cadastrado no app)
    const redirectUri = `https://app.comandocentral.com.br/integrations/olist/callback`;

    // Trocar code por tokens
    const tokenResponse = await fetch(tokenUrl, {
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
      console.error("[olist-oauth-callback] Erro ao trocar token:", errorData);
      return Response.redirect(
        `${appBaseUrl}/marketplaces/olist?olist_error=token_exchange_failed`,
        302
      );
    }

    const tokenData = await tokenResponse.json();
    console.log(`[olist-oauth-callback] Tokens obtidos`);

    // Extrair informações do id_token (JWT)
    // O id_token contém claims sobre o seller
    let sellerId: string | null = null;
    let sellerName: string | null = null;
    
    if (tokenData.id_token) {
      try {
        // Decodificar o payload do JWT (parte do meio)
        const parts = tokenData.id_token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          sellerId = payload.sub || payload.seller_id || null;
          sellerName = payload.name || payload.preferred_username || null;
          console.log(`[olist-oauth-callback] Seller ID: ${sellerId}, Name: ${sellerName}`);
        }
      } catch (err) {
        console.warn("[olist-oauth-callback] Não foi possível decodificar id_token:", err);
      }
    }

    // Se não conseguiu do id_token, tentar buscar via API
    if (!sellerId || !sellerName) {
      const apiBaseUrl = isSandbox 
        ? "https://partners-sandbox-api.olist.com/v1"
        : "https://partners-api.olist.com/v1";

      try {
        const sellerResponse = await fetch(`${apiBaseUrl}/sellers/me`, {
          headers: {
            "Authorization": `JWT ${tokenData.id_token}`,
            "Accept": "application/json",
          },
        });

        if (sellerResponse.ok) {
          const sellerData = await sellerResponse.json();
          sellerId = sellerId || sellerData.id?.toString() || sellerData.seller_id?.toString();
          sellerName = sellerName || sellerData.name || sellerData.company_name;
          console.log(`[olist-oauth-callback] Seller via API: ${sellerId} - ${sellerName}`);
        }
      } catch (err) {
        console.warn("[olist-oauth-callback] Não foi possível buscar seller via API:", err);
      }
    }

    // Calcular expires_at
    const expiresIn = tokenData.expires_in || 3600; // default 1 hora
    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();

    // Calcular refresh_expires_at se disponível
    const refreshExpiresIn = tokenData.refresh_expires_in || 2592000; // default 30 dias
    const refreshExpiresAt = new Date(Date.now() + (refreshExpiresIn * 1000)).toISOString();

    // Upsert na tabela marketplace_connections
    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert({
        tenant_id: tenant_id,
        marketplace: "olist",
        external_user_id: sellerId || "unknown",
        external_username: sellerName || "Conta Olist",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        // Armazenar id_token em metadata (usado para chamadas API)
        metadata: { 
          id_token: tokenData.id_token,
          environment,
          refresh_expires_at: refreshExpiresAt,
        },
        expires_at: expiresAt,
        is_active: true,
        connected_at: new Date().toISOString(),
        last_error: null,
      }, {
        onConflict: "tenant_id,marketplace",
      });

    if (upsertError) {
      console.error("[olist-oauth-callback] Erro ao salvar conexão:", upsertError);
      return Response.redirect(
        `${appBaseUrl}/marketplaces/olist?olist_error=save_failed`,
        302
      );
    }

    console.log(`[olist-oauth-callback] Conexão salva para tenant ${tenant_id}`);

    // Redirecionar com sucesso
    return Response.redirect(
      `${appBaseUrl}/marketplaces/olist?olist_connected=true`,
      302
    );

  } catch (error) {
    console.error("[olist-oauth-callback] Erro:", error);
    return Response.redirect(
      `${appBaseUrl}/marketplaces/olist?olist_error=internal_error`,
      302
    );
  }
});
