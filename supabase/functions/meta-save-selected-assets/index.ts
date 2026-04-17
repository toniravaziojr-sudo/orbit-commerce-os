import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";
import { revalidateStorefrontAfterTrackingChange } from "../_shared/storefront-revalidation.ts";

const VERSION = "v1.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Save Selected Assets
 *
 * Recebe os ativos selecionados pelo usuário após o OAuth e sincroniza os efeitos colaterais.
 */
Deno.serve(async (req) => {
  console.log(`[meta-save-selected-assets][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tenantId, selectedAssets } = body;

    if (!tenantId || !selectedAssets) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros ausentes" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaConn = await getMetaConnectionForTenant(supabase, tenantId, "save-assets");
    if (!metaConn) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão Meta não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const oauthAccessToken = metaConn.access_token;

    const { data: activeGrant } = await supabase
      .from("tenant_meta_auth_grants")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeGrant) {
      const integrationMappings = buildIntegrationMappings(selectedAssets);
      for (const mapping of integrationMappings) {
        const { error: upsertIntError } = await supabase
          .from("tenant_meta_integrations")
          .upsert({
            tenant_id: tenantId,
            integration_id: mapping.integrationId,
            auth_grant_id: activeGrant.id,
            status: "active",
            selected_assets: mapping.assets,
            updated_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,integration_id" });

        if (upsertIntError) {
          console.warn(`[meta-save-selected-assets] Erro ao salvar integração ${mapping.integrationId}:`, upsertIntError.message);
        }
      }
      console.log(`[meta-save-selected-assets] ${integrationMappings.length} integrações V4 atualizadas`);
    } else {
      console.warn("[meta-save-selected-assets] Nenhum grant V4 ativo encontrado, integrações V4 não atualizadas");
    }

    const activationResults: Record<string, string> = {};

    const pixelId = selectedAssets.pixels?.[0]?.id || null;
    const upsertData: Record<string, unknown> = {
      tenant_id: tenantId,
      meta_enabled: !!pixelId,
      meta_status: pixelId ? 'active' : 'inactive',
      meta_pixel_id: pixelId,
      meta_access_token: oauthAccessToken && pixelId ? oauthAccessToken : null,
      meta_capi_enabled: !!(oauthAccessToken && pixelId),
      updated_at: new Date().toISOString(),
    };

    const { error: miError } = await supabase
      .from("marketing_integrations")
      .upsert(upsertData, { onConflict: "tenant_id" });

    if (miError) {
      console.warn("[meta-save-selected-assets] Aviso: Erro ao sincronizar pixel/CAPI:", miError);
      activationResults.pixel_capi = "error";
    } else {
      activationResults.pixel_capi = pixelId ? "active" : "skipped";
      console.log(`[meta-save-selected-assets] Pixel ${pixelId || 'none'} + CAPI sincronizados`);
    }

    const selectedPhone = selectedAssets.selected_phone_number;
    if (selectedPhone && selectedPhone.id && selectedPhone.waba_id) {
      try {
        const { error: waError } = await supabase
          .from("whatsapp_configs")
          .upsert({
            tenant_id: tenantId,
            provider: "meta",
            phone_number_id: selectedPhone.id,
            phone_number: selectedPhone.display_phone_number || null,
            display_phone_number: selectedPhone.display_phone_number || null,
            verified_name: selectedPhone.verified_name || null,
            waba_id: selectedPhone.waba_id,
            access_token: oauthAccessToken,
            connection_status: "connected",
            is_enabled: true,
            last_connected_at: new Date().toISOString(),
            last_error: null,
          }, {
            onConflict: "tenant_id,provider",
          });

        if (waError) {
          console.warn("[meta-save-selected-assets] Erro ao configurar WhatsApp:", waError);
          activationResults.whatsapp = "error";
        } else {
          activationResults.whatsapp = "active";
          console.log(`[meta-save-selected-assets] WhatsApp configurado: ${selectedPhone.display_phone_number}`);
        }
      } catch (waEx) {
        console.warn("[meta-save-selected-assets] Exceção ao configurar WhatsApp:", waEx);
        activationResults.whatsapp = "error";
      }
    } else {
      activationResults.whatsapp = "skipped";
    }

    if (oauthAccessToken) {
      try {
        const { data: existingCatInteg } = await supabase
          .from("tenant_meta_integrations")
          .select("selected_assets")
          .eq("tenant_id", tenantId)
          .eq("integration_id", "catalogo_meta")
          .maybeSingle();

        const existingCatalogId = existingCatInteg?.selected_assets?.catalog_id || null;
        const selectedBusinessId = selectedAssets.business_id || null;

        const catalogResult = await createOrReuseCatalog(
          supabase, tenantId, oauthAccessToken, selectedBusinessId, existingCatalogId
        );
        activationResults.catalog = catalogResult.success ? "active" : "error";
        if (catalogResult.catalogId && activeGrant) {
          await supabase
            .from("tenant_meta_integrations")
            .upsert({
              tenant_id: tenantId,
              integration_id: "catalogos",
              auth_grant_id: activeGrant.id,
              status: "active",
              selected_assets: {
                catalog_id: catalogResult.catalogId,
                catalogs: [{ id: catalogResult.catalogId, name: catalogResult.catalogName || "Catálogo da Loja" }],
              },
              updated_at: new Date().toISOString(),
            }, { onConflict: "tenant_id,integration_id" });
        }
      } catch (catEx) {
        console.warn("[meta-save-selected-assets] Exceção ao criar catálogo:", catEx);
        activationResults.catalog = "error";
      }
    } else {
      activationResults.catalog = "skipped";
    }

    let storefrontSync = null;
    try {
      storefrontSync = await revalidateStorefrontAfterTrackingChange({
        supabase,
        supabaseUrl,
        supabaseServiceKey,
        tenantId,
        reason: "meta-save-selected-assets",
      });
    } catch (revalidationErr) {
      console.warn("[meta-save-selected-assets] Storefront revalidation failed:", (revalidationErr as Error).message);
      storefrontSync = {
        staleCount: 0,
        cachePurged: false,
        prerenderTriggered: false,
        purgeStatus: null,
        prerenderStatus: null,
      };
    }

    console.log(`[meta-save-selected-assets] Ativos salvos para tenant ${tenantId}. Ativações:`, activationResults);

    return new Response(
      JSON.stringify({ success: true, activations: activationResults, storefrontSync }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[meta-save-selected-assets] Erro:", error);
    return errorResponse(error, corsHeaders, { module: 'meta-save-assets' });
  }
});

function buildIntegrationMappings(selectedAssets: any): Array<{ integrationId: string; assets: any }> {
  const mappings: Array<{ integrationId: string; assets: any }> = [];

  const primaryBusiness = selectedAssets.businesses?.[0] || selectedAssets.business || null;
  const primaryPage = selectedAssets.pages?.[0] || null;
  const primaryInstagram = selectedAssets.instagram_accounts?.[0] || null;
  const primaryPhone = selectedAssets.selected_phone_number || null;
  const primaryPixel = selectedAssets.pixels?.[0] || null;

  if (primaryPixel) {
    mappings.push({
      integrationId: 'pixel_facebook',
      assets: {
        business: primaryBusiness,
        pixel: primaryPixel,
      },
    });
    mappings.push({
      integrationId: 'conversions_api',
      assets: {
        business: primaryBusiness,
        pixel: primaryPixel,
      },
    });
  }

  if (primaryPage) {
    mappings.push({
      integrationId: 'facebook_publicacoes',
      assets: {
        business: primaryBusiness,
        page: primaryPage,
      },
    });
  }

  if (primaryInstagram) {
    mappings.push({
      integrationId: 'instagram_publicacoes',
      assets: {
        business: primaryBusiness,
        instagram_account: primaryInstagram,
        page: primaryPage,
      },
    });
  }

  if (primaryPhone) {
    mappings.push({
      integrationId: 'whatsapp_notificacoes',
      assets: {
        business: primaryBusiness,
        phone: primaryPhone,
      },
    });
  }

  return mappings;
}

async function createOrReuseCatalog(
  supabase: any,
  tenantId: string,
  accessToken: string,
  selectedBusinessId: string | null,
  existingCatalogId: string | null
): Promise<{ success: boolean; catalogId?: string; catalogName?: string; isReused?: boolean; error?: string }> {
  const graphVersion = "v21.0";

  try {
    const { data: storeSettings } = await supabase
      .from("store_settings")
      .select("store_name")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    const storeName = storeSettings?.store_name || tenant?.name || "Minha Loja";
    const catalogName = `${storeName} - Catálogo`;

    if (existingCatalogId) {
      try {
        const checkResp = await fetch(
          `https://graph.facebook.com/${graphVersion}/${existingCatalogId}?fields=id,name&access_token=${accessToken}`
        );
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          console.log(`[meta-save-selected-assets] Catálogo existente encontrado: ${checkData.id} (${checkData.name}). Reutilizando.`);

          await syncProductsToCatalog(supabase, tenantId, existingCatalogId, accessToken, graphVersion);

          return { success: true, catalogId: existingCatalogId, catalogName: checkData.name || catalogName, isReused: true };
        } else {
          console.warn(`[meta-save-selected-assets] Catálogo ${existingCatalogId} não encontrado na Meta. Criando novo.`);
        }
      } catch (e) {
        console.warn(`[meta-save-selected-assets] Erro ao verificar catálogo existente:`, e);
      }
    }

    let businessId = selectedBusinessId;

    if (!businessId || businessId === "personal") {
      const businessResponse = await fetch(
        `https://graph.facebook.com/${graphVersion}/me/businesses?access_token=${accessToken}`
      );
      if (businessResponse.ok) {
        const businessData = await businessResponse.json();
        businessId = businessData.data?.[0]?.id || null;
      }
    }

    if (!businessId) {
      console.warn("[meta-save-selected-assets] Nenhum business encontrado para criar catálogo");
      return { success: false, error: "Nenhum Gerenciador de Negócios encontrado" };
    }

    const createResp = await fetch(
      `https://graph.facebook.com/${graphVersion}/${businessId}/owned_product_catalogs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          name: catalogName,
          vertical: 'commerce',
          access_token: accessToken,
        }),
      }
    );

    const createData = await createResp.json();
    if (!createResp.ok || !createData.id) {
      console.warn('[meta-save-selected-assets] Falha ao criar catálogo:', createData);
      return { success: false, error: createData?.error?.message || 'Falha ao criar catálogo' };
    }

    await syncProductsToCatalog(supabase, tenantId, createData.id, accessToken, graphVersion);

    return { success: true, catalogId: createData.id, catalogName };
  } catch (error) {
    console.warn('[meta-save-selected-assets] Erro createOrReuseCatalog:', error);
    return { success: false, error: (error as Error).message };
  }
}

async function syncProductsToCatalog(
  supabase: any,
  tenantId: string,
  catalogId: string,
  accessToken: string,
  graphVersion: string,
) {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, slug, description, price, compare_at_price, sku, brand, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .limit(500);

  if (!products?.length) return;

  const { data: domainRow } = await supabase
    .from('tenant_domains')
    .select('domain')
    .eq('tenant_id', tenantId)
    .eq('is_primary', true)
    .in('status', ['verified', 'active'])
    .maybeSingle();

  const host = domainRow?.domain || null;

  for (const product of products) {
    const productUrl = host
      ? `https://${host}/produto/${product.slug}`
      : undefined;

    const payload = {
      retailer_id: product.sku || product.id,
      name: product.name,
      description: product.description || product.name,
      availability: 'in stock',
      condition: 'new',
      price: `${Number(product.price || 0).toFixed(2)} BRL`,
      url: productUrl,
      brand: product.brand || 'Sem marca',
    };

    await fetch(
      `https://graph.facebook.com/${graphVersion}/${catalogId}/products?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
  }
}
