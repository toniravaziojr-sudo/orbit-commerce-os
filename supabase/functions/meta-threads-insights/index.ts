import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 6 — Insights de posts do Threads
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req) => {
  console.log(`[meta-threads-insights][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenantId, action, postId, since, until } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId obrigatório" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar conexão Meta do tenant
    const { data: connection, error: connError } = await supabaseAdmin
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta")
      .eq("is_active", true)
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conta Meta não conectada" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = connection.access_token;
    const metadata = connection.metadata as any;
    const threadsProfile = metadata?.assets?.threads_profile;

    if (!threadsProfile?.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Perfil do Threads não encontrado" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const threadsUserId = threadsProfile.id;

    // ========== ACTION: post_insights — métricas de um post ==========
    if (action === "post_insights" && postId) {
      const metrics = "views,likes,replies,reposts,quotes";
      const url = `https://graph.threads.net/${GRAPH_API_VERSION}/${postId}/insights?metric=${metrics}&access_token=${accessToken}`;

      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        console.error(`[meta-threads-insights][${VERSION}] Post insights error:`, data.error);
        return new Response(
          JSON.stringify({ success: false, error: data.error.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normalizar resposta
      const insights: Record<string, number> = {};
      for (const metric of data.data || []) {
        insights[metric.name] = metric.values?.[0]?.value ?? 0;
      }

      return new Response(
        JSON.stringify({ success: true, data: insights }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ACTION: profile_insights — métricas do perfil ==========
    if (action === "profile_insights") {
      const metrics = "views,likes,replies,reposts,quotes,followers_count";
      let url = `https://graph.threads.net/${GRAPH_API_VERSION}/${threadsUserId}/threads_insights?metric=${metrics}&access_token=${accessToken}`;
      
      if (since) url += `&since=${since}`;
      if (until) url += `&until=${until}`;

      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        console.error(`[meta-threads-insights][${VERSION}] Profile insights error:`, data.error);
        return new Response(
          JSON.stringify({ success: false, error: data.error.message }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const insights: Record<string, any> = {};
      for (const metric of data.data || []) {
        if (metric.total_value !== undefined) {
          insights[metric.name] = metric.total_value.value;
        } else if (metric.values) {
          insights[metric.name] = metric.values;
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: insights }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Action inválida. Use: post_insights, profile_insights" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[meta-threads-insights][${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
