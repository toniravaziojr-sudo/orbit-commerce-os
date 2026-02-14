import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial release — criar e agendar lives
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Meta Live Create
 * 
 * Cria transmissão ao vivo via Facebook Live Video API.
 * 
 * Ações:
 * - create: Cria live video e retorna stream URL/key
 * - list: Lista lives do tenant
 * 
 * Contrato:
 * - Sucesso = HTTP 200 + { success: true, data }
 * - Erro = HTTP 200 + { success: false, error, code }
 */

serve(async (req) => {
  console.log(`[meta-live-create][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, tenantId } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso ao tenant
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso ao tenant", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data: streams, error } = await supabase
        .from("meta_live_streams")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: streams }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      const { pageId, title, description, plannedStartTime } = body;

      if (!pageId) {
        return new Response(
          JSON.stringify({ success: false, error: "pageId obrigatório", code: "MISSING_PAGE" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar page access token
      const { data: connection } = await supabase
        .from("marketplace_connections")
        .select("metadata")
        .eq("tenant_id", tenantId)
        .eq("marketplace", "meta")
        .eq("is_active", true)
        .single();

      if (!connection) {
        return new Response(
          JSON.stringify({ success: false, error: "Conta Meta não conectada", code: "NOT_CONNECTED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metadata = connection.metadata as any;
      const page = metadata?.assets?.pages?.find((p: any) => p.id === pageId);
      if (!page?.access_token) {
        return new Response(
          JSON.stringify({ success: false, error: "Página sem access token", code: "NO_PAGE_TOKEN" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const graphVersion = (await getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION")) || "v21.0";

      // Criar live video via Graph API
      const params: Record<string, string> = {
        access_token: page.access_token,
        status: "UNPUBLISHED",
      };
      if (title) params.title = title;
      if (description) params.description = description;
      if (plannedStartTime) params.planned_start_time = String(Math.floor(new Date(plannedStartTime).getTime() / 1000));

      const graphUrl = `https://graph.facebook.com/${graphVersion}/${pageId}/live_videos`;
      const graphResponse = await fetch(graphUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params),
      });

      const responseText = await graphResponse.text();
      if (!graphResponse.ok) {
        console.error(`[meta-live-create] Graph API error: ${responseText}`);
        let errorMsg = "Erro ao criar transmissão";
        try { errorMsg = JSON.parse(responseText)?.error?.message || errorMsg; } catch {}
        return new Response(
          JSON.stringify({ success: false, error: errorMsg, code: "GRAPH_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const graphData = JSON.parse(responseText);
      console.log(`[meta-live-create] Live created: ${graphData.id}`);

      // Salvar no banco
      const { data: stream, error: insertError } = await supabase
        .from("meta_live_streams")
        .insert({
          tenant_id: tenantId,
          page_id: pageId,
          live_video_id: graphData.id,
          stream_url: graphData.stream_url || null,
          secure_stream_url: graphData.secure_stream_url || null,
          title: title || null,
          description: description || null,
          status: "scheduled",
          planned_start_time: plannedStartTime || null,
          metadata: { embed_html: graphData.embed_html || null },
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[meta-live-create] Insert error:`, insertError);
        throw insertError;
      }

      return new Response(
        JSON.stringify({ success: true, data: stream }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação inválida. Use 'create' ou 'list'", code: "INVALID_ACTION" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[meta-live-create] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno", code: "INTERNAL_ERROR" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
