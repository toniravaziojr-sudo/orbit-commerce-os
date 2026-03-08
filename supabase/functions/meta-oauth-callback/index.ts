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
 * troca por tokens, descobre portfólios empresariais e assets agrupados por portfólio.
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

    // Verificar se já existe conexão com ativos selecionados (reconexão)
    let mergedScopePacks = [...scope_packs];
    const { data: existingConnection } = await supabase
      .from("marketplace_connections")
      .select("metadata")
      .eq("tenant_id", tenant_id)
      .eq("marketplace", "meta")
      .maybeSingle();

    const existingMeta = existingConnection?.metadata as {
      scope_packs?: string[];
      assets?: Record<string, unknown>;
      pending_asset_selection?: boolean;
      meta_catalog_id?: string;
      meta_catalog_created_by_system?: boolean;
      [key: string]: unknown;
    } | null;

    if (existingMeta?.scope_packs) {
      mergedScopePacks = [...new Set([...existingMeta.scope_packs, ...scope_packs])];
    }

    // Sempre descobrir portfólios e permitir (re)seleção de ativos
    // Na reconexão, preservamos metadata de catálogo para reuso no meta-save-selected-assets
    const isReconnection = !!(existingMeta && existingMeta.assets && existingMeta.pending_asset_selection !== true);
    console.log(`[meta-oauth-callback] ${isReconnection ? 'RECONEXÃO' : 'Primeira conexão'} para tenant ${tenant_id} — descobrindo portfólios`);
    const discovery = await discoverBusinessPortfolios(accessToken, scope_packs, graphVersion);

    // Salvar conexão com status pendente de seleção de ativos
    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert({
        tenant_id: tenant_id,
        marketplace: "meta",
        external_user_id: metaUserId,
        external_username: metaUserName,
        access_token: accessToken,
        refresh_token: null,
        token_type: "Bearer",
        expires_at: expiresAt,
        scopes: mergedScopePacks,
        is_active: true,
        last_error: null,
        metadata: {
          // Preservar metadados de catálogo na reconexão para reuso
          ...(isReconnection ? {
            meta_catalog_id: existingMeta?.meta_catalog_id,
            meta_catalog_created_by_system: existingMeta?.meta_catalog_created_by_system,
          } : {}),
          connected_by: user_id,
          connected_at: new Date().toISOString(),
          scope_packs: mergedScopePacks,
          businesses: discovery.businesses,
          pending_asset_selection: true,
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

    console.log(`[meta-oauth-callback] Conexão Meta salva com sucesso para tenant ${tenant_id} — aguardando seleção de portfólio e ativos`);

    // Buscar threads profile (não pertence a portfólio)
    let threadsProfile: { id: string; username: string } | null = null;
    if (scope_packs.includes("threads")) {
      try {
        const threadsResponse = await fetch(
          `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken}`
        );
        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json();
          if (threadsData.id) {
            threadsProfile = { id: threadsData.id, username: threadsData.username || threadsData.id };
          }
        }
      } catch (e) {
        console.warn("[meta-oauth-callback] Erro ao buscar Threads profile:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        requiresAssetSelection: true,
        returnPath: return_path || "/integrations",
        connection: {
          externalUserId: metaUserId,
          externalUsername: metaUserName,
          expiresAt,
          scopePacks: scope_packs,
          businesses: discovery.businesses,
          threads_profile: threadsProfile,
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
 * Cada portfólio contém apenas os ativos que pertencem a ele.
 */
async function discoverBusinessPortfolios(accessToken: string, scopePacks: string[], graphVersion: string) {
  const businesses: BusinessPortfolio[] = [];

  try {
    // 1. Buscar portfólios empresariais (businesses)
    const businessResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/me/businesses?fields=id,name&access_token=${accessToken}`
    );

    if (!businessResponse.ok) {
      console.warn("[meta-oauth-callback] Não foi possível buscar businesses");
      // Fallback: criar portfólio "pessoal" com assets do /me
      const fallback = await discoverPersonalAssets(accessToken, scopePacks, graphVersion);
      businesses.push(fallback);
      return { businesses };
    }

    const businessData = await businessResponse.json();
    
    if (!businessData.data || businessData.data.length === 0) {
      // Sem portfólios: usar assets pessoais
      const fallback = await discoverPersonalAssets(accessToken, scopePacks, graphVersion);
      businesses.push(fallback);
      return { businesses };
    }

    // 2. Para cada portfólio, buscar seus assets
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

              // IG Business conectado à página
              if (page.instagram_business_account) {
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
      if (scopePacks.includes("whatsapp")) {
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
      if (scopePacks.includes("ads")) {
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

        // Buscar Pixels de cada Ad Account
        for (const acc of portfolio.ad_accounts) {
          try {
            const pixResp = await fetch(
              `https://graph.facebook.com/${graphVersion}/${acc.id}/adspixels?fields=id,name&access_token=${accessToken}`
            );
            if (pixResp.ok) {
              const pixData = await pixResp.json();
              if (pixData.data) {
                for (const pixel of pixData.data) {
                  portfolio.pixels.push({
                    id: pixel.id,
                    name: pixel.name || `Pixel ${pixel.id}`,
                    ad_account_id: acc.id,
                  });
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
async function discoverPersonalAssets(accessToken: string, scopePacks: string[], graphVersion: string): Promise<BusinessPortfolio> {
  const portfolio: BusinessPortfolio = {
    id: "personal",
    name: "Conta Pessoal",
    pages: [],
    instagram_accounts: [],
    whatsapp_business_accounts: [],
    ad_accounts: [],
    pixels: [],
  };

  try {
    const pagesResp = await fetch(
      `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`
    );
    if (pagesResp.ok) {
      const pagesData = await pagesResp.json();
      if (pagesData.data) {
        for (const page of pagesData.data) {
          portfolio.pages.push({ id: page.id, name: page.name, access_token: page.access_token });
          if (page.instagram_business_account) {
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

    if (scopePacks.includes("ads")) {
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

      for (const acc of portfolio.ad_accounts) {
        try {
          const pixResp = await fetch(
            `https://graph.facebook.com/${graphVersion}/${acc.id}/adspixels?fields=id,name&access_token=${accessToken}`
          );
          if (pixResp.ok) {
            const pixData = await pixResp.json();
            if (pixData.data) {
              for (const pixel of pixData.data) {
                portfolio.pixels.push({ id: pixel.id, name: pixel.name || `Pixel ${pixel.id}`, ad_account_id: acc.id });
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
