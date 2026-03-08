import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Save Selected Assets
 * 
 * Recebe os ativos selecionados pelo usuário após o OAuth e:
 * 1. Atualiza a conexão Meta com os ativos escolhidos
 * 2. Auto-configura WhatsApp (whatsapp_configs)
 * 3. Cria catálogo novo na Meta Commerce e sincroniza produtos
 * 4. Sincroniza Pixel + CAPI com marketing_integrations
 * 5. Ativa todas as integrações automaticamente
 * 
 * Contrato:
 * - POST { tenantId, selectedAssets: { pages, instagram_accounts, whatsapp_business_accounts, ad_accounts, catalogs, threads_profile, selected_phone_number } }
 * - selected_phone_number: { id, display_phone_number, verified_name, waba_id }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verificar autenticação
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

    // Verificar que o usuário tem acesso ao tenant
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

    // Buscar conexão existente (inclui access_token para CAPI)
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("metadata, access_token")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta")
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão Meta não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = connection.metadata as Record<string, unknown>;
    const oauthAccessToken = connection.access_token || null;

    // Atualizar metadata com ativos selecionados e remover flag de pendência
    const updatedMetadata = {
      ...metadata,
      assets: selectedAssets,
      pending_asset_selection: false,
      asset_selection_completed_at: new Date().toISOString(),
      asset_selection_by: user.id,
    };

    const { error: updateError } = await supabase
      .from("marketplace_connections")
      .update({ metadata: updatedMetadata })
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta");

    if (updateError) {
      console.error("[meta-save-selected-assets] Erro ao atualizar:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar seleção" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========== AUTO-ATIVAÇÕES ==========

    const activationResults: Record<string, string> = {};

    // 1. Sync Pixel + CAPI para marketing_integrations
    const pixelId = selectedAssets.pixels?.[0]?.id || null;
    const upsertData: Record<string, unknown> = {
      tenant_id: tenantId,
      meta_enabled: !!pixelId,
      meta_status: pixelId ? 'active' : 'inactive',
    };

    if (pixelId) {
      upsertData.meta_pixel_id = pixelId;
    }

    if (oauthAccessToken && pixelId) {
      upsertData.meta_access_token = oauthAccessToken;
      upsertData.meta_capi_enabled = true;
    }

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

    // 2. Auto-configurar WhatsApp (se phone number selecionado)
    const selectedPhone = selectedAssets.selected_phone_number;
    if (selectedPhone && selectedPhone.id && selectedPhone.waba_id) {
      try {
        // Upsert whatsapp_configs para este tenant com provider=meta
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

    // 3. Criar ou reutilizar catálogo na Meta Commerce Manager
    // Usa o business_id do portfólio selecionado pelo usuário
    if (oauthAccessToken) {
      try {
        // Verificar se já existe catálogo criado pelo nosso sistema
        const existingCatalogId = (metadata as any)?.meta_catalog_id || null;
        const selectedBusinessId = selectedAssets.business_id || null;

        const catalogResult = await createOrReuseCatalog(
          supabase, tenantId, oauthAccessToken, selectedBusinessId, existingCatalogId
        );
        activationResults.catalog = catalogResult.success ? "active" : "error";
        if (catalogResult.catalogId) {
          // Salvar o catalogId nos assets da conexão
          const { error: catUpdateError } = await supabase
            .from("marketplace_connections")
            .update({
              metadata: {
                ...updatedMetadata,
                assets: {
                  ...selectedAssets,
                  catalogs: [{ id: catalogResult.catalogId, name: catalogResult.catalogName || "Catálogo da Loja" }],
                },
                meta_catalog_id: catalogResult.catalogId,
                meta_catalog_created_by_system: true,
                meta_catalog_created_at: catalogResult.isReused
                  ? (metadata as any)?.meta_catalog_created_at || new Date().toISOString()
                  : new Date().toISOString(),
              },
            })
            .eq("tenant_id", tenantId)
            .eq("marketplace", "meta");

          if (catUpdateError) {
            console.warn("[meta-save-selected-assets] Erro ao salvar catalogId na metadata:", catUpdateError);
          }
        }
      } catch (catEx) {
        console.warn("[meta-save-selected-assets] Exceção ao criar catálogo:", catEx);
        activationResults.catalog = "error";
      }
    } else {
      activationResults.catalog = "skipped";
    }

    console.log(`[meta-save-selected-assets] Ativos salvos para tenant ${tenantId}. Ativações:`, activationResults);

    return new Response(
      JSON.stringify({ success: true, activations: activationResults }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meta-save-selected-assets] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Criar ou reutilizar catálogo na Meta Commerce Manager.
 * 
 * Regra:
 * 1. Se existingCatalogId (criado pelo nosso sistema antes), verificar se ainda existe na Meta
 * 2. Se existir, apenas atualizar os produtos — não cria novo
 * 3. Se não existir (ou nunca criou), criar novo catálogo
 * 
 * Usa o business_id do portfólio selecionado pelo usuário, não /me/businesses[0]
 */
async function createOrReuseCatalog(
  supabase: any,
  tenantId: string,
  accessToken: string,
  selectedBusinessId: string | null,
  existingCatalogId: string | null
): Promise<{ success: boolean; catalogId?: string; catalogName?: string; isReused?: boolean; error?: string }> {
  const graphVersion = "v21.0";

  try {
    // Buscar dados da loja
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

    // === REUSO: Verificar se catálogo existente ainda existe na Meta ===
    if (existingCatalogId) {
      try {
        const checkResp = await fetch(
          `https://graph.facebook.com/${graphVersion}/${existingCatalogId}?fields=id,name&access_token=${accessToken}`
        );
        if (checkResp.ok) {
          const checkData = await checkResp.json();
          console.log(`[meta-save-selected-assets] Catálogo existente encontrado: ${checkData.id} (${checkData.name}). Reutilizando.`);
          
          // Sincronizar produtos no catálogo existente
          await syncProductsToCatalog(supabase, tenantId, existingCatalogId, accessToken, graphVersion);
          
          return { success: true, catalogId: existingCatalogId, catalogName: checkData.name || catalogName, isReused: true };
        } else {
          console.warn(`[meta-save-selected-assets] Catálogo ${existingCatalogId} não encontrado na Meta. Criando novo.`);
        }
      } catch (e) {
        console.warn(`[meta-save-selected-assets] Erro ao verificar catálogo existente:`, e);
      }
    }

    // === CRIAÇÃO: Determinar business_id ===
    let businessId = selectedBusinessId;

    if (!businessId || businessId === "personal") {
      // Fallback: buscar primeiro business do /me
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

    // Criar catálogo via Graph API usando o business_id correto
    const createResponse = await fetch(
      `https://graph.facebook.com/${graphVersion}/${businessId}/owned_product_catalogs`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catalogName,
          access_token: accessToken,
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[meta-save-selected-assets] Erro ao criar catálogo:", errorText);
      return { success: false, error: "Erro ao criar catálogo na Meta" };
    }

    const createData = await createResponse.json();
    const catalogId = createData.id;

    console.log(`[meta-save-selected-assets] Catálogo criado: ${catalogId} (${catalogName})`);

    // Sincronizar produtos
    await syncProductsToCatalog(supabase, tenantId, catalogId, accessToken, graphVersion);

    return { success: true, catalogId, catalogName, isReused: false };

  } catch (error) {
    console.error("[meta-save-selected-assets] Erro ao criar/reutilizar catálogo:", error);
    return { success: false, error: error instanceof Error ? error.message : "Erro interno" };
  }
}

/**
 * Sincronizar produtos da loja para o catálogo Meta
 * Envia em batch usando a API de Product Feed
 */
async function syncProductsToCatalog(
  supabase: any,
  tenantId: string,
  catalogId: string,
  accessToken: string,
  graphVersion: string
) {
  try {
    // Buscar produtos ativos (limit 1000 para primeira sync)
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("id, name, description, short_description, price, compare_at_price, sku, status, slug, brand, gtin, barcode")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .is("deleted_at", null)
      .limit(1000);

    if (prodError) {
      console.error("[meta-save-selected-assets] Erro ao buscar produtos:", prodError);
      return;
    }

    if (!products || products.length === 0) {
      console.log("[meta-save-selected-assets] Nenhum produto ativo para sincronizar ao catálogo");
      return;
    }

    console.log(`[meta-save-selected-assets] ${products.length} produtos ativos encontrados para sincronizar`);

    // Buscar imagens dos produtos
    const productIds = products.map((p: any) => p.id);
    const { data: allImages } = await supabase
      .from("product_images")
      .select("product_id, url, is_primary, position")
      .in("product_id", productIds)
      .order("position", { ascending: true });

    // Mapear imagem principal por produto
    const imageMap: Record<string, string> = {};
    for (const img of allImages || []) {
      if (img.is_primary || !imageMap[img.product_id]) {
        imageMap[img.product_id] = img.url;
      }
    }

    // Buscar domínio da loja para URLs
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("slug, custom_domain")
      .eq("id", tenantId)
      .single();

    const baseUrl = tenantData?.custom_domain 
      ? `https://${tenantData.custom_domain}` 
      : `https://${tenantData?.slug || 'loja'}.shops.comandocentral.com.br`;

    // Enviar produtos em batch via Graph API Batch Requests
    const batchRequests = [];
    for (const product of products) {
      const imageUrl = imageMap[product.id] || null;
      const productUrl = `${baseUrl}/produto/${product.slug || product.id}`;
      const priceCents = Math.round((product.price || 0) * 100);
      const description = (product.description || product.short_description || product.name || "Produto").substring(0, 5000);

      const bodyParams: Record<string, string> = {
        retailer_id: product.sku || product.id,
        name: product.name || "Produto",
        description,
        url: productUrl,
        image_url: imageUrl || `${baseUrl}/placeholder.svg`,
        price: String(priceCents),
        currency: "BRL",
        availability: "in stock",
        condition: "new",
        brand: product.brand || tenantData?.slug || "loja",
      };

      if (product.compare_at_price && product.compare_at_price > product.price) {
        bodyParams.price = String(Math.round(product.compare_at_price * 100));
        bodyParams.sale_price = String(priceCents);
      }

      if (product.gtin || product.barcode) {
        bodyParams.gtin = product.gtin || product.barcode;
      }

      batchRequests.push({
        method: "POST",
        relative_url: `${catalogId}/products`,
        body: new URLSearchParams(bodyParams).toString(),
      });
    }

    // Enviar em batches de 50
    const BATCH_SIZE = 50;
    let totalSent = 0;
    let totalErrors = 0;
    
    for (let i = 0; i < batchRequests.length; i += BATCH_SIZE) {
      const batch = batchRequests.slice(i, i + BATCH_SIZE);
      
      try {
        const batchResponse = await fetch(`https://graph.facebook.com/${graphVersion}/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            access_token: accessToken,
            batch: JSON.stringify(batch),
          }).toString(),
        });

        if (batchResponse.ok) {
          const batchResults = await batchResponse.json();
          for (const result of batchResults || []) {
            if (result && result.code >= 200 && result.code < 300) {
              totalSent++;
            } else {
              totalErrors++;
              console.warn(`[meta-save-selected-assets] Produto falhou no batch:`, result?.body?.substring(0, 200));
            }
          }
        } else {
          const errText = await batchResponse.text();
          totalErrors += batch.length;
          console.warn(`[meta-save-selected-assets] Erro no batch ${i}-${i + batch.length}:`, errText.substring(0, 300));
        }
      } catch (batchErr) {
        totalErrors += batch.length;
        console.warn(`[meta-save-selected-assets] Exceção no batch ${i}:`, batchErr);
      }
    }

    console.log(`[meta-save-selected-assets] Sync catálogo: ${totalSent} OK, ${totalErrors} erros de ${products.length} produtos para catálogo ${catalogId}`);

  } catch (error) {
    console.error("[meta-save-selected-assets] Erro ao sincronizar produtos:", error);
  }
}
