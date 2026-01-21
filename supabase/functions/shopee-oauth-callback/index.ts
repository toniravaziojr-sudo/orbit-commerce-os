import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

/**
 * Shopee OAuth Callback
 * 
 * Recebe o code e shop_id da Shopee, troca por tokens e salva no banco.
 * Redireciona de volta para o app com status.
 * 
 * Docs: https://open.shopee.com/documents/v2/v2.auth.token.get
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
    const shopId = url.searchParams.get("shop_id");
    const error = url.searchParams.get("error");
    const mainAccountId = url.searchParams.get("main_account_id"); // Para sub-accounts

    // Se usuário cancelou ou erro da Shopee
    if (error) {
      console.log(`[shopee-oauth-callback] Erro da Shopee: ${error}`);
      return Response.redirect(
        `${appBaseUrl}/marketplaces/shopee?shopee_error=${encodeURIComponent(error)}`,
        302
      );
    }

    if (!code || !shopId) {
      console.log("[shopee-oauth-callback] Code ou shop_id ausente");
      return Response.redirect(
        `${appBaseUrl}/marketplaces/shopee?shopee_error=missing_params`,
        302
      );
    }

    // Tentar recuperar state da sessão (cookies ou query param customizado)
    // Para Shopee, o state precisa ser passado de outra forma já que não retorna automaticamente
    // Vamos buscar o tenant_id do shop_id já conectado ou usar sessão temporária
    
    // Buscar credenciais do app
    const partnerId = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_ID");
    const partnerKey = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_KEY");

    if (!partnerId || !partnerKey) {
      console.error("[shopee-oauth-callback] Credenciais Shopee não configuradas");
      return Response.redirect(
        `${appBaseUrl}/marketplaces/shopee?shopee_error=not_configured`,
        302
      );
    }

    // Gerar timestamp e assinatura para a API
    const timestamp = Math.floor(Date.now() / 1000);
    const path = "/api/v2/auth/token/get";
    
    // Base string para token/get: partner_id + path + timestamp
    const baseString = `${partnerId}${path}${timestamp}`;
    const hmac = createHmac("sha256", partnerKey);
    hmac.update(baseString);
    const sign = hmac.digest("hex");

    // Host da Shopee (produção)
    const shopeeHost = "https://partner.shopeemobile.com";

    // Trocar code por tokens
    const tokenUrl = `${shopeeHost}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
    
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: code,
        shop_id: parseInt(shopId),
        partner_id: parseInt(partnerId),
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[shopee-oauth-callback] Erro ao trocar token:", errorData);
      return Response.redirect(
        `${appBaseUrl}/marketplaces/shopee?shopee_error=token_exchange_failed`,
        302
      );
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error("[shopee-oauth-callback] Erro da API Shopee:", tokenData.error, tokenData.message);
      return Response.redirect(
        `${appBaseUrl}/marketplaces/shopee?shopee_error=${encodeURIComponent(tokenData.error)}`,
        302
      );
    }

    console.log(`[shopee-oauth-callback] Token obtido para shop_id: ${shopId}`);

    // Buscar informações da loja
    const shopPath = "/api/v2/shop/get_shop_info";
    const shopTimestamp = Math.floor(Date.now() / 1000);
    const shopBaseString = `${partnerId}${shopPath}${shopTimestamp}${tokenData.access_token}${shopId}`;
    const shopHmac = createHmac("sha256", partnerKey);
    shopHmac.update(shopBaseString);
    const shopSign = shopHmac.digest("hex");

    const shopInfoUrl = `${shopeeHost}${shopPath}?partner_id=${partnerId}&timestamp=${shopTimestamp}&sign=${shopSign}&shop_id=${shopId}&access_token=${tokenData.access_token}`;
    
    const shopResponse = await fetch(shopInfoUrl);
    let shopName = null;
    
    if (shopResponse.ok) {
      const shopData = await shopResponse.json();
      if (shopData.response) {
        shopName = shopData.response.shop_name;
      }
    }

    // Calcular expires_at (Shopee retorna expire_in em segundos)
    const expiresAt = new Date(Date.now() + (tokenData.expire_in * 1000)).toISOString();
    const refreshExpiresAt = new Date(Date.now() + (tokenData.refresh_expire_in || 30 * 24 * 60 * 60) * 1000).toISOString();

    // Buscar tenant_id da sessão pendente mais recente
    // Como a Shopee não retorna state, precisamos buscar a sessão pendente mais recente
    const { data: pendingSession } = await supabase
      .from("marketplace_oauth_sessions")
      .select("tenant_id, user_id, region")
      .eq("marketplace", "shopee")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!pendingSession) {
      console.error("[shopee-oauth-callback] Sessão OAuth pendente não encontrada");
      return Response.redirect(
        `${appBaseUrl}/marketplaces/shopee?shopee_error=session_not_found`,
        302
      );
    }

    const { tenant_id, user_id, region } = pendingSession;

    // Atualizar sessão para completa
    await supabase
      .from("marketplace_oauth_sessions")
      .update({ status: "completed" })
      .eq("tenant_id", tenant_id)
      .eq("marketplace", "shopee")
      .eq("status", "pending");

    // Upsert na tabela marketplace_connections
    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert({
        tenant_id: tenant_id,
        marketplace: "shopee",
        external_user_id: shopId,
        external_username: shopName,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: "Bearer",
        expires_at: expiresAt,
        scopes: [],
        is_active: true,
        last_error: null,
        metadata: {
          connected_by: user_id,
          connected_at: new Date().toISOString(),
          shop_id: parseInt(shopId),
          region: region || "BR",
          main_account_id: mainAccountId ? parseInt(mainAccountId) : null,
          refresh_expires_at: refreshExpiresAt,
        },
      }, {
        onConflict: "tenant_id,marketplace",
      });

    if (upsertError) {
      console.error("[shopee-oauth-callback] Erro ao salvar conexão:", upsertError);
      return Response.redirect(
        `${appBaseUrl}/marketplaces/shopee?shopee_error=save_failed`,
        302
      );
    }

    console.log(`[shopee-oauth-callback] Conexão salva com sucesso para tenant ${tenant_id}`);

    // Redirect com sucesso
    return Response.redirect(
      `${appBaseUrl}/marketplaces/shopee?shopee_connected=true`,
      302
    );

  } catch (error) {
    console.error("[shopee-oauth-callback] Erro:", error);
    return Response.redirect(
      `${appBaseUrl}/marketplaces/shopee?shopee_error=internal_error`,
      302
    );
  }
});
