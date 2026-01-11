import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta OAuth Callback
 * 
 * Recebe o code do Meta via POST (do frontend), valida state (anti-CSRF), 
 * troca por tokens, descobre assets (páginas, IG, WABA) e salva no banco por tenant.
 * 
 * Contrato:
 * - Erro de negócio = HTTP 200 + { success: false, error, code }
 * - Sucesso = HTTP 200 + { success: true, ... }
 * 
 * Fluxo:
 * 1. Validar state no banco (anti-CSRF)
 * 2. Trocar code por access_token
 * 3. Trocar por long-lived token
 * 4. Descobrir assets (páginas, Instagram, WhatsApp)
 * 5. Salvar em marketplace_connections
 * 6. Retornar sucesso/erro JSON
 */
serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // URL base do app para construir redirect_uri (deve ser igual ao cadastrado no Meta)
  const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";

  try {
    // Espera body JSON com code e state
    const body = await req.json();
    const { code, state } = body;

    if (!code || !state) {
      console.log("[meta-oauth-callback] Code ou state ausente no body");
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros ausentes", code: "MISSING_PARAMS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar state no banco (anti-CSRF)
    const { data: stateRecord, error: stateError } = await supabase
      .from("meta_oauth_states")
      .select("*")
      .eq("state_hash", state)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (stateError || !stateRecord) {
      console.error("[meta-oauth-callback] State inválido ou expirado:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Sessão de autorização expirada ou inválida", code: "INVALID_STATE" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Marcar state como usado
    await supabase
      .from("meta_oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRecord.id);

    const { tenant_id, user_id, scope_packs, return_path } = stateRecord;
    console.log(`[meta-oauth-callback] Processando para tenant ${tenant_id}`);

    // Buscar credenciais do app Meta
    const appId = await getCredential(supabaseUrl, supabaseServiceKey, "META_APP_ID");
    const appSecret = await getCredential(supabaseUrl, supabaseServiceKey, "META_APP_SECRET");

    if (!appId || !appSecret) {
      console.error("[meta-oauth-callback] Credenciais Meta não configuradas");
      return new Response(
        JSON.stringify({ success: false, error: "Integração Meta não configurada", code: "NOT_CONFIGURED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construir redirect URI (deve ser igual ao usado em meta-oauth-start e cadastrado no Meta)
    const redirectUri = `${appBaseUrl}/integrations/meta/callback`;

    // Trocar code por access_token (short-lived)
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("[meta-oauth-callback] Erro ao trocar token:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao obter tokens de acesso", code: "TOKEN_EXCHANGE_FAILED", details: errorData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    let accessToken = tokenData.access_token;
    let expiresIn = tokenData.expires_in || 3600;

    // Trocar por long-lived token (60 dias)
    const longLivedUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", accessToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json();
      accessToken = longLivedData.access_token;
      expiresIn = longLivedData.expires_in || 5184000; // 60 dias
      console.log("[meta-oauth-callback] Long-lived token obtido");
    } else {
      console.warn("[meta-oauth-callback] Não foi possível obter long-lived token, usando short-lived");
    }

    // Buscar informações do usuário Meta
    const meResponse = await fetch(`https://graph.facebook.com/v19.0/me?fields=id,name,email&access_token=${accessToken}`);
    let metaUserId = "";
    let metaUserName = "";
    if (meResponse.ok) {
      const meData = await meResponse.json();
      metaUserId = meData.id;
      metaUserName = meData.name;
    }

    // Descobrir assets disponíveis
    const assets = await discoverMetaAssets(accessToken, scope_packs);

    // Calcular expires_at
    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();

    // Upsert na tabela marketplace_connections
    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert({
        tenant_id: tenant_id,
        marketplace: "meta",
        external_user_id: metaUserId,
        external_username: metaUserName,
        access_token: accessToken,
        refresh_token: null, // Meta não usa refresh token padrão
        token_type: "Bearer",
        expires_at: expiresAt,
        scopes: scope_packs,
        is_active: true,
        last_error: null,
        metadata: {
          connected_by: user_id,
          connected_at: new Date().toISOString(),
          scope_packs: scope_packs,
          assets: assets,
        },
      }, {
        onConflict: "tenant_id,marketplace",
      });

    if (upsertError) {
      console.error("[meta-oauth-callback] Erro ao salvar conexão:", upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar a conexão", code: "SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meta-oauth-callback] Conexão Meta salva com sucesso para tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        returnPath: return_path || "/integrations",
        connection: {
          externalUserId: metaUserId,
          externalUsername: metaUserName,
          expiresAt,
          scopePacks: scope_packs,
          assets,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meta-oauth-callback] Erro:", error);
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

/**
 * Descobrir assets disponíveis na conta Meta
 */
async function discoverMetaAssets(accessToken: string, scopePacks: string[]) {
  const assets: {
    pages: Array<{ id: string; name: string; access_token?: string }>;
    instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
    whatsapp_business_accounts: Array<{ id: string; name: string }>;
    ad_accounts: Array<{ id: string; name: string }>;
  } = {
    pages: [],
    instagram_accounts: [],
    whatsapp_business_accounts: [],
    ad_accounts: [],
  };

  try {
    // Buscar páginas do usuário
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
    );
    
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();
      if (pagesData.data) {
        for (const page of pagesData.data) {
          assets.pages.push({
            id: page.id,
            name: page.name,
            access_token: page.access_token,
          });

          // Verificar se página tem IG Business conectado
          if (page.instagram_business_account) {
            const igId = page.instagram_business_account.id;
            // Buscar detalhes do IG
            const igResponse = await fetch(
              `https://graph.facebook.com/v19.0/${igId}?fields=id,username&access_token=${accessToken}`
            );
            if (igResponse.ok) {
              const igData = await igResponse.json();
              assets.instagram_accounts.push({
                id: igData.id,
                username: igData.username || igData.id,
                page_id: page.id,
              });
            }
          }
        }
      }
    }

    // Buscar WhatsApp Business Accounts (se escopo concedido)
    if (scopePacks.includes("whatsapp")) {
      try {
        // Primeiro precisamos do Business Manager ID
        const businessResponse = await fetch(
          `https://graph.facebook.com/v19.0/me/businesses?access_token=${accessToken}`
        );
        
        if (businessResponse.ok) {
          const businessData = await businessResponse.json();
          if (businessData.data) {
            for (const business of businessData.data) {
              // Buscar WABAs do business
              const wabaResponse = await fetch(
                `https://graph.facebook.com/v19.0/${business.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`
              );
              if (wabaResponse.ok) {
                const wabaData = await wabaResponse.json();
                if (wabaData.data) {
                  for (const waba of wabaData.data) {
                    assets.whatsapp_business_accounts.push({
                      id: waba.id,
                      name: waba.name || `WABA ${waba.id}`,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (wabaError) {
        console.warn("[meta-oauth-callback] Erro ao buscar WABA:", wabaError);
      }
    }

    // Buscar Ad Accounts (se escopo concedido)
    if (scopePacks.includes("ads")) {
      try {
        const adAccountsResponse = await fetch(
          `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name&access_token=${accessToken}`
        );
        
        if (adAccountsResponse.ok) {
          const adAccountsData = await adAccountsResponse.json();
          if (adAccountsData.data) {
            for (const account of adAccountsData.data) {
              assets.ad_accounts.push({
                id: account.id,
                name: account.name || `Ad Account ${account.id}`,
              });
            }
          }
        }
      } catch (adsError) {
        console.warn("[meta-oauth-callback] Erro ao buscar Ad Accounts:", adsError);
      }
    }

  } catch (error) {
    console.error("[meta-oauth-callback] Erro ao descobrir assets:", error);
  }

  return assets;
}
