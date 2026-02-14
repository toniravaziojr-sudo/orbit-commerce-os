import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Creatives sync + list
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-ads-creatives][${VERSION}][${traceId}] ${req.method}`);

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
    // SYNC — Pull creatives from Meta
    // ========================
    if (action === "sync") {
      const { data: conn } = await supabase
        .from("marketplace_connections")
        .select("access_token, metadata")
        .eq("tenant_id", tenantId)
        .eq("platform", "meta")
        .eq("status", "active")
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

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${adAccountId.replace("act_", "")}/adcreatives?fields=id,name,title,body,call_to_action_type,link_url,image_url,video_id,thumbnail_url,object_story_spec&limit=100&access_token=${conn.access_token}`
      );
      const result = await res.json();

      if (result.error) {
        return new Response(
          JSON.stringify({ success: false, error: result.error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let synced = 0;
      for (const c of (result.data || [])) {
        const { error } = await supabase
          .from("meta_ad_creatives")
          .upsert({
            tenant_id: tenantId,
            meta_creative_id: c.id,
            ad_account_id: adAccountId,
            name: c.name || `Creative ${c.id}`,
            title: c.title,
            body: c.body,
            call_to_action_type: c.call_to_action_type,
            link_url: c.link_url,
            image_url: c.image_url,
            thumbnail_url: c.thumbnail_url,
            object_story_spec: c.object_story_spec || null,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,meta_creative_id" });

        if (!error) synced++;
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: (result.data || []).length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const { data, error } = await supabase
        .from("meta_ad_creatives")
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
    console.error(`[meta-ads-creatives][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
