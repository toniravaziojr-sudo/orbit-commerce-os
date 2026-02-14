import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: create Meta Commerce catalog
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req) => {
  console.log(`[meta-catalog-create][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { tenantId, action = "create" } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Meta connection
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta")
      .eq("is_active", true)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectada", code: "NOT_CONNECTED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "Token Meta expirado", code: "TOKEN_EXPIRED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = connection.access_token;
    const metadata = connection.metadata as any;

    if (action === "list") {
      // List existing catalogs from the business
      const businessId = metadata?.assets?.whatsapp_business_accounts?.[0]?.id;
      
      // Try listing catalogs via user's businesses
      const catalogsUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/businesses?fields=id,name,owned_product_catalogs{id,name,product_count}&access_token=${accessToken}`;
      const bizResp = await fetch(catalogsUrl);
      const bizText = await bizResp.text();
      let bizData: any;
      try { bizData = JSON.parse(bizText); } catch { bizData = { error: { message: bizText } }; }

      if (bizData.error) {
        // Fallback: try listing via connected pages
        const catalogs = metadata?.assets?.catalogs || [];
        return new Response(
          JSON.stringify({ success: true, data: { catalogs } }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allCatalogs: Array<{ id: string; name: string; product_count?: number }> = [];
      for (const biz of bizData.data || []) {
        for (const cat of biz.owned_product_catalogs?.data || []) {
          allCatalogs.push({
            id: cat.id,
            name: cat.name,
            product_count: cat.product_count,
          });
        }
      }

      // Update assets in connection
      if (allCatalogs.length > 0) {
        const updatedAssets = { ...metadata?.assets, catalogs: allCatalogs };
        await supabase
          .from("marketplace_connections")
          .update({ metadata: { ...metadata, assets: updatedAssets } })
          .eq("id", connection.id);
      }

      return new Response(
        JSON.stringify({ success: true, data: { catalogs: allCatalogs } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      const { name } = body;
      if (!name) {
        return new Response(
          JSON.stringify({ success: false, error: "name is required for create" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get user's first business
      const bizUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/me/businesses?fields=id,name&access_token=${accessToken}`;
      const bizResp = await fetch(bizUrl);
      const bizText = await bizResp.text();
      let bizData: any;
      try { bizData = JSON.parse(bizText); } catch { bizData = { error: { message: bizText } }; }

      if (bizData.error || !bizData.data?.length) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhum Business encontrado na conta Meta. Crie um Business Manager primeiro.", code: "NO_BUSINESS" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const businessId = bizData.data[0].id;

      // Create catalog
      const createUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${businessId}/owned_product_catalogs`;
      const createResp = await fetch(createUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name }),
      });

      const createText = await createResp.text();
      let createData: any;
      try { createData = JSON.parse(createText); } catch { createData = { error: { message: createText } }; }

      if (createData.error) {
        console.error(`[meta-catalog-create] Error creating catalog:`, createData.error);
        return new Response(
          JSON.stringify({ success: false, error: createData.error.message || "Erro ao criar catálogo" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newCatalog = { id: createData.id, name };
      console.log(`[meta-catalog-create] Catalog created: ${newCatalog.id}`);

      // Update assets with new catalog
      const existingCatalogs = metadata?.assets?.catalogs || [];
      const updatedAssets = {
        ...metadata?.assets,
        catalogs: [...existingCatalogs, newCatalog],
      };
      await supabase
        .from("marketplace_connections")
        .update({ metadata: { ...metadata, assets: updatedAssets } })
        .eq("id", connection.id);

      return new Response(
        JSON.stringify({ success: true, data: { catalog: newCatalog } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Action '${action}' not supported. Use 'create' or 'list'.` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(`[meta-catalog-create] Fatal error:`, err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
