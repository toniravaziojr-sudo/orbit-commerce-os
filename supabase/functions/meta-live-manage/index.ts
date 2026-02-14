import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial release — gerenciar lives (go_live, end, status)
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Meta Live Manage
 * 
 * Gerencia transmissões ao vivo: iniciar, encerrar, verificar status.
 * 
 * Ações:
 * - go_live: Iniciar transmissão (muda status para LIVE_NOW)
 * - end: Encerrar transmissão
 * - status: Verificar status atual + métricas
 */

serve(async (req) => {
  console.log(`[meta-live-manage][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, tenantId, streamId } = body;

    if (!tenantId || !streamId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId e streamId obrigatórios", code: "MISSING_PARAMS" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar stream
    const { data: stream } = await supabase
      .from("meta_live_streams")
      .select("*")
      .eq("id", streamId)
      .eq("tenant_id", tenantId)
      .single();

    if (!stream) {
      return new Response(
        JSON.stringify({ success: false, error: "Transmissão não encontrada", code: "NOT_FOUND" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar page token
    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("metadata")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta")
      .eq("is_active", true)
      .single();

    const metadata = connection?.metadata as any;
    const page = metadata?.assets?.pages?.find((p: any) => p.id === stream.page_id);
    if (!page?.access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Página sem token", code: "NO_TOKEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const graphVersion = (await getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION")) || "v21.0";
    const liveVideoId = stream.live_video_id;

    if (action === "go_live") {
      // Mudar status para LIVE_NOW
      const graphUrl = `https://graph.facebook.com/${graphVersion}/${liveVideoId}`;
      const response = await fetch(graphUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          access_token: page.access_token,
          status: "LIVE_NOW",
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        console.error(`[meta-live-manage] go_live error: ${responseText}`);
        let errorMsg = "Erro ao iniciar transmissão";
        try { errorMsg = JSON.parse(responseText)?.error?.message || errorMsg; } catch {}
        return new Response(
          JSON.stringify({ success: false, error: errorMsg, code: "GRAPH_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("meta_live_streams")
        .update({ status: "live", started_at: new Date().toISOString() })
        .eq("id", streamId);

      return new Response(
        JSON.stringify({ success: true, data: { status: "live" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "end") {
      const graphUrl = `https://graph.facebook.com/${graphVersion}/${liveVideoId}`;
      const response = await fetch(graphUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          access_token: page.access_token,
          end_live_video: "true",
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        console.error(`[meta-live-manage] end error: ${responseText}`);
      }

      await supabase
        .from("meta_live_streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", streamId);

      return new Response(
        JSON.stringify({ success: true, data: { status: "ended" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      // Buscar status + métricas do Graph API
      const graphUrl = `https://graph.facebook.com/${graphVersion}/${liveVideoId}?fields=status,live_views,embed_html&access_token=${page.access_token}`;
      const response = await fetch(graphUrl);
      const responseText = await response.text();

      if (!response.ok) {
        console.error(`[meta-live-manage] status error: ${responseText}`);
        return new Response(
          JSON.stringify({ success: true, data: stream }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const graphData = JSON.parse(responseText);

      // Atualizar viewer count
      if (graphData.live_views !== undefined) {
        await supabase
          .from("meta_live_streams")
          .update({ 
            viewer_count: graphData.live_views,
            metadata: { ...((stream.metadata as any) || {}), embed_html: graphData.embed_html },
          })
          .eq("id", streamId);
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ...stream,
            live_views: graphData.live_views || 0,
            graph_status: graphData.status,
            embed_html: graphData.embed_html,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida. Use 'go_live', 'end' ou 'status'", code: "INVALID_ACTION" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[meta-live-manage] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
