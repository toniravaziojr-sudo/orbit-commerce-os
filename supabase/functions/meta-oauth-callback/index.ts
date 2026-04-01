import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta OAuth Callback — V4 (Lote B: Legacy removed)
 * 
 * Recebe o code do Meta via POST (do frontend), valida state (anti-CSRF), 
 * troca por tokens, cria grant V4 (criptografado) e descobre portfólios.
 * 
 * V4 Changes:
 * - Cria grant em tenant_meta_auth_grants com tokens criptografados
 * - Chama supersede_meta_grant para substituir grant anterior
 *
 * Contrato:
 * - Erro de negócio = HTTP 200 + { success: false, error, code }
 * - Sucesso = HTTP 200 + { success: true, ... }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";

  try {
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

    const { tenant_id, user_id, auth_profile_key, return_path } = stateRecord;
    // V4: auth_profile_key vem do state (definido no start)
    const profileKey = auth_profile_key || "meta_auth_external";
    
    console.log(`[meta-oauth-callback] Processando para tenant ${tenant_id}, profile=${profileKey}`);

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

    const redirectUri = `${appBaseUrl}/integrations/meta/callback`;
    const graphVersion = await getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION") || "v21.0";
    
    // Trocar code por access_token (short-lived)
    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
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
    const longLivedUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", accessToken);

    const longLivedResponse = await fetch(longLivedUrl.toString());
    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json();
      accessToken = longLivedData.access_token;
      expiresIn = longLivedData.expires_in || 5184000;
      console.log("[meta-oauth-callback] Long-lived token obtido");
    } else {
      console.warn("[meta-oauth-callback] Não foi possível obter long-lived token, usando short-lived");
    }

    // Buscar informações do usuário Meta
    const meResponse = await fetch(`https://graph.facebook.com/${graphVersion}/me?fields=id,name,email&access_token=${accessToken}`);
    let metaUserId = "";
    let metaUserName = "";
    if (meResponse.ok) {
      const meData = await meResponse.json();
      metaUserId = meData.id;
      metaUserName = meData.name;
    }

    const expiresAt = new Date(Date.now() + (expiresIn * 1000)).toISOString();

    // Buscar escopos concedidos (debug_token ou do perfil)
    let grantedScopes: string[] = [];
    try {
      const debugUrl = `https://graph.facebook.com/${graphVersion}/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`;
      const debugResp = await fetch(debugUrl);
      if (debugResp.ok) {
        const debugData = await debugResp.json();
        grantedScopes = debugData.data?.scopes || [];
      }
    } catch (e) {
      console.warn("[meta-oauth-callback] Erro ao obter scopes via debug_token:", e);
    }

    // ================================================================
    // V4: CRIAR GRANT NO MODELO NOVO (tenant_meta_auth_grants)
    // Tokens criptografados via save_meta_grant_token
    // ================================================================

    // 1. Criar registro do grant
    const { data: newGrant, error: grantError } = await supabase
      .from("tenant_meta_auth_grants")
      .insert({
        tenant_id: tenant_id,
        auth_profile_key: profileKey,
        status: "active",
        meta_user_id: metaUserId,
        meta_user_name: metaUserName,
        granted_scopes: grantedScopes,
        granted_at: new Date().toISOString(),
        granted_by: user_id,
        token_expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (grantError) {
      console.error("[meta-oauth-callback] Erro ao criar grant V4:", grantError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar autorização", code: "GRANT_CREATE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const grantId = newGrant.id;
    console.log(`[meta-oauth-callback] Grant V4 criado: ${grantId}`);

    // 2. Salvar tokens criptografados via helper
    const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const { error: saveTokenError } = await supabase.rpc("save_meta_grant_token", {
      p_grant_id: grantId,
      p_access_token: accessToken,
      p_refresh_token: null,
      p_encryption_key: encryptionKey,
      p_expires_at: expiresAt,
    });

    if (saveTokenError) {
      console.error("[meta-oauth-callback] Erro ao criptografar tokens:", saveTokenError);
      // Grant já foi criado mas sem tokens — marcar como erro
      await supabase
        .from("tenant_meta_auth_grants")
        .update({ status: "revoked", last_error: "Falha ao criptografar tokens" })
        .eq("id", grantId);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao proteger tokens de acesso", code: "TOKEN_ENCRYPT_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Superseder grant anterior (V4: 1 grant ativo por tenant)
    const { data: supersededCount } = await supabase.rpc("supersede_meta_grant", {
      p_tenant_id: tenant_id,
      p_new_grant_id: grantId,
    });

    if (supersededCount && supersededCount > 0) {
      console.log(`[meta-oauth-callback] ${supersededCount} grant(s) anterior(es) superseded`);

      // V4.2: Disconnect ALL integrations from previous grants — new connection = clean slate
      const { error: deactivateError } = await supabase
        .from("tenant_meta_integrations")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenant_id)
        .neq("auth_grant_id", grantId);

      if (deactivateError) {
        console.warn(`[meta-oauth-callback] Erro ao desativar integrações antigas:`, deactivateError.message);
      } else {
        console.log(`[meta-oauth-callback] Integrações de grants anteriores desativadas para tenant ${tenant_id}`);
      }
    }

    // 4. Phase 6: Save discovered_assets in the grant (raw discovery from OAuth)
    const discovery = await discoverBusinessPortfolios(accessToken, grantedScopes, graphVersion);

    const { error: discoveryError } = await supabase
      .from("tenant_meta_auth_grants")
      .update({ discovered_assets: { businesses: discovery.businesses } })
      .eq("id", grantId);

    if (discoveryError) {
      console.warn("[meta-oauth-callback] Erro ao salvar discovered_assets no grant:", discoveryError.message);
    } else {
      console.log(`[meta-oauth-callback] discovered_assets saved in grant ${grantId} (${discovery.businesses.length} portfolios)`);
    }

    // 5. Determinar se precisa de seleção interna de ativos
    // Se o perfil tem config_id (FLB), o Facebook já fez a seleção → pular seleção interna
    // Se o perfil NÃO tem config_id (escopos diretos), precisa seleção interna
    const { data: authProfileData } = await supabase
      .from("meta_auth_profiles")
      .select("config_id")
      .eq("profile_key", profileKey)
      .single();

    const hasConfigId = !!authProfileData?.config_id;
    const requiresAssetSelection = !hasConfigId;

    console.log(`[meta-oauth-callback] profile=${profileKey}, config_id=${authProfileData?.config_id || 'NULL'}, requiresAssetSelection=${requiresAssetSelection}`);

    console.log(`[meta-oauth-callback] Conexão Meta salva para tenant ${tenant_id} — grant V4: ${grantId}`);

    return new Response(
      JSON.stringify({
        success: true,
        requiresAssetSelection,
        returnPath: return_path || "/integrations",
        grantId,
        authProfile: profileKey,
        connection: {
          externalUserId: metaUserId,
          externalUsername: metaUserName,
          expiresAt,
          grantedScopes,
          businesses: discovery.businesses,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meta-oauth-callback] Erro:", error);
    return errorResponse(error, corsHeaders, { module: 'meta-oauth-callback' });
  }
});

// ================================================================
// DISCOVERY HELPERS
// ================================================================

interface BusinessPortfolio {
  id: string;
  name: string;
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string; phone_numbers: Array<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }> }>;
  ad_accounts: Array<{ id: string; name: string }>;
  pixels: Array<{ id: string; name: string; ad_account_id: string }>;
}

/**
 * Descobrir portfólios empresariais e seus assets agrupados.
 * V4: Usa granted_scopes para decidir quais assets buscar.
 */
async function discoverBusinessPortfolios(accessToken: string, grantedScopes: string[], graphVersion: string) {
  const businesses: BusinessPortfolio[] = [];
  const hasScope = (s: string) => grantedScopes.includes(s);

  try {
    const businessResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/me/businesses?fields=id,name&access_token=${accessToken}`
    );

    if (!businessResponse.ok) {
      console.warn("[meta-oauth-callback] Não foi possível buscar businesses");
      const fallback = await discoverPersonalAssets(accessToken, grantedScopes, graphVersion);
      businesses.push(fallback);
      return { businesses };
    }

    const businessData = await businessResponse.json();
    
    if (!businessData.data || businessData.data.length === 0) {
      const fallback = await discoverPersonalAssets(accessToken, grantedScopes, graphVersion);
      businesses.push(fallback);
      return { businesses };
    }

    for (const biz of businessData.data) {
      const portfolio: BusinessPortfolio = {
        id: biz.id,
        name: biz.name || `Portfólio ${biz.id}`,
        pages: [],
        instagram_accounts: [],
        whatsapp_business_accounts: [],
        ad_accounts: [],
        pixels: [],
      };

      // Buscar páginas do portfólio
      try {
        const pagesResp = await fetch(
          `https://graph.facebook.com/${graphVersion}/${biz.id}/owned_pages?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
        );
        if (pagesResp.ok) {
          const pagesData = await pagesResp.json();
          if (pagesData.data) {
            for (const page of pagesData.data) {
              portfolio.pages.push({
                id: page.id,
                name: page.name,
                access_token: page.access_token,
              });

              if (page.instagram_business_account && hasScope("instagram_basic")) {
                try {
                  const igResp = await fetch(
                    `https://graph.facebook.com/${graphVersion}/${page.instagram_business_account.id}?fields=id,username&access_token=${accessToken}`
                  );
                  if (igResp.ok) {
                    const igData = await igResp.json();
                    portfolio.instagram_accounts.push({
                      id: igData.id,
                      username: igData.username || igData.id,
                      page_id: page.id,
                    });
                  }
                } catch (e) {
                  console.warn(`[meta-oauth-callback] Erro IG de página ${page.id}:`, e);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[meta-oauth-callback] Erro páginas do portfólio ${biz.id}:`, e);
      }

      // Buscar WABAs do portfólio + phone numbers
      if (hasScope("whatsapp_business_management")) {
        try {
          const wabaResp = await fetch(
            `https://graph.facebook.com/${graphVersion}/${biz.id}/owned_whatsapp_business_accounts?access_token=${accessToken}`
          );
          if (wabaResp.ok) {
            const wabaData = await wabaResp.json();
            if (wabaData.data) {
              for (const waba of wabaData.data) {
                const phoneNumbers: Array<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }> = [];
                try {
                  const phonesResp = await fetch(
                    `https://graph.facebook.com/${graphVersion}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating&access_token=${accessToken}`
                  );
                  if (phonesResp.ok) {
                    const phonesData = await phonesResp.json();
                    if (phonesData.data) {
                      for (const phone of phonesData.data) {
                        phoneNumbers.push({
                          id: phone.id,
                          display_phone_number: phone.display_phone_number || phone.id,
                          verified_name: phone.verified_name || "",
                          quality_rating: phone.quality_rating,
                        });
                      }
                    }
                  }
                } catch (e) {
                  console.warn(`[meta-oauth-callback] Erro phones WABA ${waba.id}:`, e);
                }
                portfolio.whatsapp_business_accounts.push({
                  id: waba.id,
                  name: waba.name || `WABA ${waba.id}`,
                  phone_numbers: phoneNumbers,
                });
              }
            }
          }
        } catch (e) {
          console.warn(`[meta-oauth-callback] Erro WABAs do portfólio ${biz.id}:`, e);
        }
      }

      // Buscar Ad Accounts do portfólio
      if (hasScope("ads_management") || hasScope("ads_read")) {
        try {
          const adResp = await fetch(
            `https://graph.facebook.com/${graphVersion}/${biz.id}/owned_ad_accounts?fields=id,name&access_token=${accessToken}`
          );
          if (adResp.ok) {
            const adData = await adResp.json();
            if (adData.data) {
              for (const acc of adData.data) {
                portfolio.ad_accounts.push({
                  id: acc.id,
                  name: acc.name || `Ad Account ${acc.id}`,
                });
              }
            }
          }
        } catch (e) {
          console.warn(`[meta-oauth-callback] Erro ad accounts do portfólio ${biz.id}:`, e);
        }

        // Buscar Pixels de cada Ad Account (com deduplicação por pixel_id)
        const seenPixelIds = new Set<string>();
        for (const acc of portfolio.ad_accounts) {
          try {
            const pixResp = await fetch(
              `https://graph.facebook.com/${graphVersion}/${acc.id}/adspixels?fields=id,name&access_token=${accessToken}`
            );
            if (pixResp.ok) {
              const pixData = await pixResp.json();
              if (pixData.data) {
                for (const pixel of pixData.data) {
                  if (!seenPixelIds.has(pixel.id)) {
                    seenPixelIds.add(pixel.id);
                    portfolio.pixels.push({
                      id: pixel.id,
                      name: pixel.name || `Pixel ${pixel.id}`,
                      ad_account_id: acc.id,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.warn(`[meta-oauth-callback] Erro pixels de ${acc.id}:`, e);
          }
        }
      }

      businesses.push(portfolio);
    }

  } catch (error) {
    console.error("[meta-oauth-callback] Erro ao descobrir portfólios:", error);
  }

  return { businesses };
}

/**
 * Fallback: quando não há portfólios empresariais, buscar assets pessoais do /me
 */
async function discoverPersonalAssets(accessToken: string, grantedScopes: string[], graphVersion: string): Promise<BusinessPortfolio> {
  const portfolio: BusinessPortfolio = {
    id: "personal",
    name: "Conta Pessoal",
    pages: [],
    instagram_accounts: [],
    whatsapp_business_accounts: [],
    ad_accounts: [],
    pixels: [],
  };
  const hasScope = (s: string) => grantedScopes.includes(s);

  try {
    const pagesResp = await fetch(
      `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
    );
    if (pagesResp.ok) {
      const pagesData = await pagesResp.json();
      if (pagesData.data) {
        for (const page of pagesData.data) {
          portfolio.pages.push({ id: page.id, name: page.name, access_token: page.access_token });
          if (page.instagram_business_account && hasScope("instagram_basic")) {
            try {
              const igResp = await fetch(
                `https://graph.facebook.com/${graphVersion}/${page.instagram_business_account.id}?fields=id,username&access_token=${accessToken}`
              );
              if (igResp.ok) {
                const igData = await igResp.json();
                portfolio.instagram_accounts.push({ id: igData.id, username: igData.username || igData.id, page_id: page.id });
              }
            } catch {}
          }
        }
      }
    }

    if (hasScope("ads_management") || hasScope("ads_read")) {
      try {
        const adResp = await fetch(
          `https://graph.facebook.com/${graphVersion}/me/adaccounts?fields=id,name&access_token=${accessToken}`
        );
        if (adResp.ok) {
          const adData = await adResp.json();
          if (adData.data) {
            for (const acc of adData.data) {
              portfolio.ad_accounts.push({ id: acc.id, name: acc.name || `Ad Account ${acc.id}` });
            }
          }
        }
      } catch {}

      const seenPixelIds = new Set<string>();
      for (const acc of portfolio.ad_accounts) {
        try {
          const pixResp = await fetch(
            `https://graph.facebook.com/${graphVersion}/${acc.id}/adspixels?fields=id,name&access_token=${accessToken}`
          );
          if (pixResp.ok) {
            const pixData = await pixResp.json();
            if (pixData.data) {
              for (const pixel of pixData.data) {
                if (!seenPixelIds.has(pixel.id)) {
                  seenPixelIds.add(pixel.id);
                  portfolio.pixels.push({ id: pixel.id, name: pixel.name || `Pixel ${pixel.id}`, ad_account_id: acc.id });
                }
              }
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error("[meta-oauth-callback] Erro assets pessoais:", e);
  }

  return portfolio;
}
