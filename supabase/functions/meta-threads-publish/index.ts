import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, metaApiErrorResponse } from "../_shared/error-response.ts";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.1.0"; // Fase 5 Lote 3 — migração para helper central (exceção: Threads auth separado)
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req) => {
  console.log(`[meta-threads-publish][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { tenantId, text, imageUrl, videoUrl, linkAttachment, replyToId, action } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId obrigatório" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar conexão Meta via helper central (V4 + fallback legado)
    // NOTA: Threads usa auth separado mas token/metadata são lidos do mesmo modelo
    const metaConn = await getMetaConnectionForTenant(supabaseAdmin, tenantId, `threads-publish`);
    if (!metaConn) {
      return new Response(
        JSON.stringify({ success: false, error: "Conta Meta não conectada" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accessToken = metaConn.access_token;
    const threadsProfile = (metaConn.metadata?.assets as any)?.threads_profile;

    if (!threadsProfile?.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Perfil do Threads não encontrado. Reconecte com o pack 'Threads'." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const threadsUserId = threadsProfile.id;

    // ========== ACTION: list — listar posts recentes ==========
    if (action === "list") {
      const limit = 25;
      const url = `https://graph.threads.net/${GRAPH_API_VERSION}/${threadsUserId}/threads?fields=id,text,timestamp,media_type,media_url,permalink,is_quote_post&limit=${limit}&access_token=${accessToken}`;
      
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.error) {
        console.error(`[meta-threads-publish][${VERSION}] List error:`, data.error);
        return metaApiErrorResponse(data.error, corsHeaders, { module: 'threads-publish' });
      }

      return new Response(
        JSON.stringify({ success: true, data: data.data || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== ACTION: publish (default) — criar post ==========
    if (!text && !imageUrl && !videoUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Forneça text, imageUrl ou videoUrl" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Criar container de mídia
    let mediaType = "TEXT";
    const containerParams: Record<string, string> = {
      access_token: accessToken,
    };

    if (text) containerParams.text = text;

    if (imageUrl) {
      mediaType = "IMAGE";
      containerParams.media_type = "IMAGE";
      containerParams.image_url = imageUrl;
    } else if (videoUrl) {
      mediaType = "VIDEO";
      containerParams.media_type = "VIDEO";
      containerParams.video_url = videoUrl;
    } else {
      containerParams.media_type = "TEXT";
    }

    if (linkAttachment) {
      containerParams.link_attachment = linkAttachment;
    }

    if (replyToId) {
      containerParams.reply_to_id = replyToId;
    }

    console.log(`[meta-threads-publish][${VERSION}] Creating ${mediaType} container for user ${threadsUserId}`);

    const createUrl = `https://graph.threads.net/${GRAPH_API_VERSION}/${threadsUserId}/threads`;
    const createResp = await fetch(createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerParams),
    });

    const createData = await createResp.json();

    if (createData.error) {
      console.error(`[meta-threads-publish][${VERSION}] Container error:`, createData.error);
      return metaApiErrorResponse(createData.error, corsHeaders, { module: 'threads-publish' });
    }

    const containerId = createData.id;
    console.log(`[meta-threads-publish][${VERSION}] Container created: ${containerId}`);

    // Step 2: Para vídeos, aguardar processamento
    if (mediaType === "VIDEO") {
      let ready = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 3000));
        const statusResp = await fetch(
          `https://graph.threads.net/${GRAPH_API_VERSION}/${containerId}?fields=status&access_token=${accessToken}`
        );
        const statusData = await statusResp.json();
        console.log(`[meta-threads-publish][${VERSION}] Container status:`, statusData.status);
        
        if (statusData.status === "FINISHED") {
          ready = true;
          break;
        }
        if (statusData.status === "ERROR") {
          return new Response(
            JSON.stringify({ success: false, error: "Erro no processamento do vídeo pelo Threads" }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      if (!ready) {
        return new Response(
          JSON.stringify({ success: false, error: "Timeout aguardando processamento do vídeo" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Step 3: Publicar
    const publishUrl = `https://graph.threads.net/${GRAPH_API_VERSION}/${threadsUserId}/threads_publish`;
    const publishResp = await fetch(publishUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    });

    const publishData = await publishResp.json();

    if (publishData.error) {
      console.error(`[meta-threads-publish][${VERSION}] Publish error:`, publishData.error);
      return metaApiErrorResponse(publishData.error, corsHeaders, { module: 'threads-publish' });
    }

    console.log(`[meta-threads-publish][${VERSION}] Published: ${publishData.id}`);

    return new Response(
      JSON.stringify({ success: true, data: { id: publishData.id, mediaType } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[meta-threads-publish][${VERSION}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'threads-publish', action: 'publish' });
  }
});
