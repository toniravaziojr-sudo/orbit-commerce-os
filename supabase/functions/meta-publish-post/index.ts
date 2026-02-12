import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Publish Post v${VERSION}
 * 
 * Publica conteúdo no Facebook Pages e Instagram via Graph API.
 * Suporta: Feed (imagem/vídeo/texto/link), Stories, Reels, Carousels.
 * 
 * Fluxos:
 * - Facebook: POST /{page_id}/feed ou /{page_id}/photos ou /{page_id}/videos
 * - Instagram: POST /{ig_id}/media (container) → POST /{ig_id}/media_publish
 * 
 * Contrato: HTTP 200 + { success: true/false }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Não autorizado" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "Sessão inválida" });
    }

    const body = await req.json();
    const { calendar_item_ids, tenant_id } = body;

    if (!tenant_id || !calendar_item_ids?.length) {
      return jsonResponse({ success: false, error: "Parâmetros inválidos" });
    }

    // Verify user has access to tenant
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!userRole) {
      return jsonResponse({ success: false, error: "Sem acesso ao tenant" });
    }

    // Get Meta connection
    const { data: metaConn } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("marketplace", "meta")
      .eq("is_active", true)
      .single();

    if (!metaConn?.access_token) {
      return jsonResponse({ success: false, error: "Meta não conectado. Conecte sua conta em Integrações." });
    }

    // Check token expiry
    if (metaConn.expires_at && new Date(metaConn.expires_at) < new Date()) {
      return jsonResponse({ success: false, error: "Token Meta expirado. Reconecte em Integrações." });
    }

    const userAccessToken = metaConn.access_token;
    const metadata = metaConn.metadata as any;
    const assets = metadata?.assets || { pages: [], instagram_accounts: [] };

    if (!assets.pages?.length) {
      return jsonResponse({ success: false, error: "Nenhuma página Facebook conectada." });
    }

    // Get calendar items
    const { data: items } = await supabase
      .from("media_calendar_items")
      .select("*")
      .in("id", calendar_item_ids)
      .eq("status", "approved");

    if (!items?.length) {
      return jsonResponse({ success: false, error: "Nenhum item aprovado encontrado." });
    }

    let scheduled = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const item of items) {
      try {
        // Determine target based on content_type and target_channel
        const targetChannel = item.target_channel || "facebook";
        const contentType = item.content_type || "image";
        
        // Use first page by default
        const page = assets.pages[0];
        const pageAccessToken = page.access_token || userAccessToken;
        
        let result: any = null;

        if (targetChannel === "instagram" || targetChannel === "all") {
          // Instagram publishing via container flow
          const igAccount = assets.instagram_accounts?.[0];
          if (igAccount) {
            result = await publishToInstagram(
              igAccount.id,
              userAccessToken,
              item,
              contentType
            );
          } else {
            throw new Error("Nenhuma conta Instagram conectada");
          }
        }
        
        if (targetChannel === "facebook" || targetChannel === "all") {
          // Facebook publishing
          result = await publishToFacebook(
            page.id,
            pageAccessToken,
            item,
            contentType
          );
        }

        // Save to social_posts for audit/App Review
        await supabase.from("social_posts").insert({
          tenant_id,
          calendar_item_id: item.id,
          platform: targetChannel === "all" ? "facebook" : targetChannel,
          post_type: mapContentType(contentType),
          page_id: page.id,
          page_name: page.name,
          instagram_account_id: assets.instagram_accounts?.[0]?.id || null,
          caption: item.copy || item.title,
          media_urls: item.asset_url ? [item.asset_url] : null,
          hashtags: item.hashtags,
          meta_post_id: result?.id || result?.post_id || null,
          status: "published",
          published_at: new Date().toISOString(),
          api_response: result,
          created_by: user.id,
        });

        // Update calendar item status
        await supabase
          .from("media_calendar_items")
          .update({ status: "published" })
          .eq("id", item.id);

        scheduled++;
      } catch (itemError: any) {
        failed++;
        const errMsg = itemError?.message || "Erro desconhecido";
        errors.push(`Item ${item.title || item.id}: ${errMsg}`);
        console.error(`[meta-publish-post] Error publishing item ${item.id}:`, errMsg);

        // Save failed attempt
        await supabase.from("social_posts").insert({
          tenant_id,
          calendar_item_id: item.id,
          platform: item.target_channel || "facebook",
          post_type: mapContentType(item.content_type || "image"),
          page_id: assets.pages[0]?.id || "",
          caption: item.copy || item.title,
          status: "failed",
          error_message: errMsg,
          created_by: user.id,
        });

        // Update calendar item
        await supabase
          .from("media_calendar_items")
          .update({ status: "failed" })
          .eq("id", item.id);
      }
    }

    return jsonResponse({
      success: true,
      scheduled,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error("[meta-publish-post] Error:", error);
    return jsonResponse({ success: false, error: error.message || "Erro interno" });
  }
});

// ===================== Publishing Functions =====================

/**
 * Publish to Facebook Page
 */
async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  item: any,
  contentType: string
): Promise<any> {
  const caption = buildCaption(item);

  if (contentType === "video" || contentType === "reel") {
    // Video post
    if (!item.asset_url) throw new Error("URL do vídeo é obrigatória");
    
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: item.asset_url,
        description: caption,
        access_token: pageAccessToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  if (contentType === "image" && item.asset_url) {
    // Photo post
    const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: item.asset_url,
        message: caption,
        access_token: pageAccessToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  // Text/link post
  const body: any = {
    message: caption,
    access_token: pageAccessToken,
  };
  if (item.link_url) body.link = item.link_url;

  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

/**
 * Publish to Instagram via Container flow
 * Step 1: Create container → Step 2: Publish container
 */
async function publishToInstagram(
  igAccountId: string,
  accessToken: string,
  item: any,
  contentType: string
): Promise<any> {
  const caption = buildCaption(item);

  // Step 1: Create media container
  let containerBody: any = {
    caption,
    access_token: accessToken,
  };

  if (contentType === "reel" || contentType === "video") {
    if (!item.asset_url) throw new Error("URL do vídeo é obrigatória para Reels");
    containerBody.media_type = "REELS";
    containerBody.video_url = item.asset_url;
  } else if (contentType === "story") {
    if (!item.asset_url) throw new Error("URL da mídia é obrigatória para Stories");
    // Stories can be image or video
    if (item.asset_url.match(/\.(mp4|mov|avi)$/i)) {
      containerBody.media_type = "STORIES";
      containerBody.video_url = item.asset_url;
    } else {
      containerBody.media_type = "STORIES";
      containerBody.image_url = item.asset_url;
    }
  } else if (contentType === "carousel") {
    // Carousel requires multiple images
    // For now, treat as single image
    if (!item.asset_url) throw new Error("URL da imagem é obrigatória");
    containerBody.image_url = item.asset_url;
  } else {
    // Image post (default)
    if (!item.asset_url) throw new Error("URL da imagem é obrigatória para Instagram");
    containerBody.image_url = item.asset_url;
  }

  const containerRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(containerBody),
    }
  );
  const containerData = await containerRes.json();
  if (containerData.error) {
    throw new Error(`Container: ${containerData.error.message}`);
  }

  const containerId = containerData.id;
  if (!containerId) throw new Error("Container ID não retornado");

  // For video/reel, we need to wait for processing
  if (contentType === "reel" || contentType === "video" || 
      (contentType === "story" && item.asset_url?.match(/\.(mp4|mov|avi)$/i))) {
    await waitForContainerReady(igAccountId, containerId, accessToken);
  }

  // Step 2: Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );
  const publishData = await publishRes.json();
  if (publishData.error) {
    throw new Error(`Publish: ${publishData.error.message}`);
  }

  return { ...publishData, container_id: containerId };
}

/**
 * Wait for Instagram container to finish processing (for videos/reels)
 */
async function waitForContainerReady(
  igAccountId: string,
  containerId: string,
  accessToken: string,
  maxAttempts = 30,
  intervalMs = 5000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    
    if (statusData.status_code === "FINISHED") return;
    if (statusData.status_code === "ERROR") {
      throw new Error("Processamento do vídeo falhou no Instagram");
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timeout aguardando processamento do vídeo");
}

// ===================== Helpers =====================

function buildCaption(item: any): string {
  let caption = item.copy || item.title || "";
  if (item.cta) caption += `\n\n${item.cta}`;
  if (item.hashtags?.length) {
    caption += "\n\n" + item.hashtags.map((h: string) => 
      h.startsWith("#") ? h : `#${h}`
    ).join(" ");
  }
  return caption;
}

function mapContentType(type: string): string {
  switch (type) {
    case "story": return "story";
    case "reel": return "reel";
    case "carousel": return "carousel";
    default: return "feed";
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
