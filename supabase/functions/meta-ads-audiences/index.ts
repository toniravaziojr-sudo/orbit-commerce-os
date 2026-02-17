import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Audiences CRUD + sync
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-ads-audiences][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action") || "list";
    const tenantId = body.tenant_id || url.searchParams.get("tenant_id");

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // SYNC — Pull audiences from Meta
    // ========================
    if (action === "sync") {
      const { data: conn } = await supabase
        .from("marketplace_connections")
        .select("access_token, metadata")
        .eq("tenant_id", tenantId)
        .eq("marketplace", "meta")
        .eq("is_active", true)
        .maybeSingle();

      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "Meta não conectada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adAccounts = conn.metadata?.assets?.ad_accounts || [];
      const adAccountId = body.ad_account_id || adAccounts[0]?.id;
      if (!adAccountId) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma conta de anúncios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch in batches with reduced fields to avoid "reduce the amount of data" error
      let allAudiences: any[] = [];
      let nextUrl: string | null = `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${adAccountId.replace("act_", "")}/customaudiences?fields=id,name,subtype,description&limit=50&access_token=${conn.access_token}`;
      
      while (nextUrl) {
        const res = await fetch(nextUrl);
        const result = await res.json();
        
        if (result.error) {
          return new Response(
            JSON.stringify({ success: false, error: result.error.message }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        allAudiences = allAudiences.concat(result.data || []);
        nextUrl = result.paging?.next || null;
        
        // Safety: max 500 audiences
        if (allAudiences.length >= 500) break;
      }

      let synced = 0;
      for (const a of allAudiences) {
        const { error } = await supabase
          .from("meta_ad_audiences")
          .upsert({
            tenant_id: tenantId,
            meta_audience_id: a.id,
            ad_account_id: adAccountId,
            name: a.name,
            audience_type: "custom",
            subtype: a.subtype,
            description: a.description,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,meta_audience_id" });

        if (!error) synced++;
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: allAudiences.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const { data, error } = await supabase
        .from("meta_ad_audiences")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[meta-ads-audiences][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
