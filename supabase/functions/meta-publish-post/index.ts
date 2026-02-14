import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "2.4.0"; // Fix: use target_platforms to publish to both Instagram AND Facebook

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Publish Post v${VERSION}
 * 
 * Publica ou agenda conteúdo no Facebook Pages e Instagram via Graph API.
 * Suporta: Feed (imagem/vídeo/texto/link), Stories, Reels, Carousels.
 * Suporta agendamento futuro via scheduled_publish_time (Facebook) e cron (Instagram).
 * 
 * Fluxos:
 * - Facebook: POST /{page_id}/feed ou /{page_id}/photos ou /{page_id}/videos
 *   - Agendamento: published=false + scheduled_publish_time
 * - Instagram: POST /{ig_id}/media (container) → POST /{ig_id}/media_publish
 *   - Agendamento: Salva como 'scheduled' no social_posts, cron publica no horário
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

    // Check scope packs include publicacao
    const scopePacks = (metaConn.metadata as any)?.scope_packs || [];
    if (!scopePacks.includes("publicacao")) {
      return jsonResponse({ 
        success: false, 
        error: "Permissão de publicação não concedida. Reconecte a Meta em Integrações com a permissão 'Publicação' habilitada." 
      });
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

    // Sort items by scheduled_date + scheduled_time (chronological order)
    const sortedItems = [...items].sort((a, b) => {
      const dateA = `${a.scheduled_date}T${a.scheduled_time || "10:00:00"}`;
      const dateB = `${b.scheduled_date}T${b.scheduled_time || "10:00:00"}`;
      return dateA.localeCompare(dateB);
    });

    let published = 0;
    let scheduled = 0;
    let failed = 0;
    const errors: string[] = [];
    const STAGGER_INTERVAL_MS = 30_000; // 30 seconds between immediate publishes
    let immediatePublishIndex = 0;

    console.log(`[meta-publish-post][${VERSION}] Processing ${sortedItems.length} items for tenant ${tenant_id}`);

    for (const item of sortedItems) {
      try {
        const targetChannel = item.target_channel || "facebook";
        const targetPlatforms = (item.target_platforms as string[]) || [];
        const contentType = item.content_type || "image";
        
        // Determine which platforms to publish to based on target_platforms array
        // target_platforms contains entries like "feed_instagram", "feed_facebook", "story_instagram", "story_facebook"
        const shouldPublishInstagram = targetChannel === "instagram" || targetChannel === "all" ||
          targetPlatforms.some((p: string) => p.includes("instagram"));
        const shouldPublishFacebook = targetChannel === "facebook" || targetChannel === "all" ||
          targetPlatforms.some((p: string) => p.includes("facebook"));
        
        // Build scheduled datetime from item
        const scheduledAt = buildScheduledAt(item.scheduled_date, item.scheduled_time);
        const now = new Date();
        const scheduledDate = scheduledAt ? new Date(scheduledAt) : now;
        // Any item scheduled in the future (>2min buffer) should NOT be published immediately
        const isFutureSchedule = scheduledDate > new Date(now.getTime() + 2 * 60 * 1000);
        // Facebook requires at least 10min in future for native scheduling
        const isFacebookSchedulable = scheduledDate > new Date(now.getTime() + 10 * 60 * 1000);
        
        const page = assets.pages[0];
        const pageAccessToken = page.access_token || userAccessToken;
        
        let result: any = null;
        let finalStatus = "published";

        // For past items, stagger with 30s interval to avoid API rate limits
        if (!isFutureSchedule && immediatePublishIndex > 0) {
          const waitMs = STAGGER_INTERVAL_MS * immediatePublishIndex;
          console.log(`[meta-publish-post] Staggering item ${item.id}: waiting ${waitMs / 1000}s before publishing`);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        }

        let igResult: any = null;
        let fbResult: any = null;

        if (shouldPublishInstagram) {
          const igAccount = assets.instagram_accounts?.[0];
          if (igAccount) {
            if (isFutureSchedule) {
              finalStatus = "scheduled";
              igResult = { scheduled: true, scheduled_at: scheduledAt };
            } else {
              igResult = await publishToInstagram(
                igAccount.id,
                userAccessToken,
                item,
                contentType
              );
              immediatePublishIndex++;
            }
          } else {
            console.warn(`[meta-publish-post] No Instagram account connected, skipping IG for item ${item.id}`);
          }
        }
        
        if (shouldPublishFacebook) {
          if (isFutureSchedule && isFacebookSchedulable) {
            fbResult = await scheduleToFacebook(
              page.id,
              pageAccessToken,
              item,
              contentType,
              scheduledAt!
            );
            finalStatus = "scheduled";
          } else if (isFutureSchedule && !isFacebookSchedulable) {
            finalStatus = "scheduled";
            fbResult = { scheduled: true, scheduled_at: scheduledAt, reason: "facebook_too_close_for_native" };
          } else {
            fbResult = await publishToFacebook(
              page.id,
              pageAccessToken,
              item,
              contentType
            );
            if (!shouldPublishInstagram) immediatePublishIndex++;
          }
        }

        // Combine results
        result = {
          instagram: igResult,
          facebook: fbResult,
          ...(igResult?.id ? { id: igResult.id } : {}),
          ...(igResult?.container_id ? { container_id: igResult.container_id } : {}),
          ...(fbResult?.id ? { fb_id: fbResult.id } : {}),
          ...(fbResult?.post_id ? { fb_post_id: fbResult.post_id } : {}),
        };

        // Save Instagram social_post
        if (shouldPublishInstagram && igResult) {
          await supabase.from("social_posts").insert({
            tenant_id,
            calendar_item_id: item.id,
            platform: "instagram",
            post_type: mapContentType(contentType),
            page_id: page.id,
            page_name: page.name,
            instagram_account_id: assets.instagram_accounts?.[0]?.id || null,
            caption: item.copy || item.title,
            media_urls: item.asset_url ? [item.asset_url] : null,
            hashtags: item.hashtags,
            meta_post_id: igResult?.id || null,
            meta_container_id: igResult?.container_id || null,
            status: finalStatus,
            scheduled_at: isFutureSchedule ? scheduledAt : null,
            published_at: finalStatus === "published" ? new Date().toISOString() : null,
            api_response: igResult,
            created_by: user.id,
          });
        }

        // Save Facebook social_post
        if (shouldPublishFacebook && fbResult) {
          await supabase.from("social_posts").insert({
            tenant_id,
            calendar_item_id: item.id,
            platform: "facebook",
            post_type: mapContentType(contentType),
            page_id: page.id,
            page_name: page.name,
            instagram_account_id: null,
            caption: item.copy || item.title,
            media_urls: item.asset_url ? [item.asset_url] : null,
            hashtags: item.hashtags,
            meta_post_id: fbResult?.id || fbResult?.post_id || null,
            meta_container_id: null,
            status: finalStatus,
            scheduled_at: isFutureSchedule ? scheduledAt : null,
            published_at: finalStatus === "published" ? new Date().toISOString() : null,
            api_response: fbResult,
            created_by: user.id,
          });
        }

        // Update calendar item status + published_at
        const updateData: Record<string, any> = { status: finalStatus };
        if (finalStatus === "published") {
          updateData.published_at = new Date().toISOString();
        }
        await supabase
          .from("media_calendar_items")
          .update(updateData)
          .eq("id", item.id);

        if (finalStatus === "scheduled") {
          scheduled++;
          console.log(`[meta-publish-post] Item ${item.id} scheduled for ${scheduledAt}`);
        } else {
          published++;
          console.log(`[meta-publish-post] Item ${item.id} published immediately`);
        }
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
          api_response: { error: errMsg },
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
      published,
      scheduled,
      failed,
      total: items.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error("[meta-publish-post] Error:", error);
    return jsonResponse({ success: false, error: error.message || "Erro interno" });
  }
});

// ===================== Scheduling Functions =====================

/**
 * Build ISO datetime from scheduled_date + scheduled_time
 */
function buildScheduledAt(date: string | null, time: string | null): string | null {
  if (!date) return null;
  const timeStr = time || "10:00:00";
  // Assume timezone America/Sao_Paulo (UTC-3)
  return `${date}T${timeStr}-03:00`;
}

/**
 * Schedule a post to Facebook Page (native scheduling)
 * Uses published=false + scheduled_publish_time
 * scheduled_publish_time must be ≥10min in future and ≤6 months
 */
async function scheduleToFacebook(
  pageId: string,
  pageAccessToken: string,
  item: any,
  contentType: string,
  scheduledAt: string
): Promise<any> {
  const caption = buildCaption(item);
  const scheduledTimestamp = Math.floor(new Date(scheduledAt).getTime() / 1000);

  if (contentType === "image" && item.asset_url) {
    // Scheduled photo post
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: item.asset_url,
        message: caption,
        published: false,
        scheduled_publish_time: scheduledTimestamp,
        access_token: pageAccessToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  if (contentType === "video" || contentType === "reel") {
    if (!item.asset_url) throw new Error("URL do vídeo é obrigatória");
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_url: item.asset_url,
        description: caption,
        published: false,
        scheduled_publish_time: scheduledTimestamp,
        access_token: pageAccessToken,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  // Text/link scheduled post
  const body: any = {
    message: caption,
    published: false,
    scheduled_publish_time: scheduledTimestamp,
    access_token: pageAccessToken,
  };
  if (item.link_url) body.link = item.link_url;

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data;
}

// ===================== Publishing Functions =====================

/**
 * Publish to Facebook Page (immediate)
 */
async function publishToFacebook(
  pageId: string,
  pageAccessToken: string,
  item: any,
  contentType: string
): Promise<any> {
  const caption = buildCaption(item);

  if (contentType === "video" || contentType === "reel") {
    if (!item.asset_url) throw new Error("URL do vídeo é obrigatória");
    
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
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
    const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/photos`, {
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

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
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

  // Step 1: Create media container (with retry for transient errors)
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
    if (item.asset_url.match(/\.(mp4|mov|avi)$/i)) {
      containerBody.media_type = "STORIES";
      containerBody.video_url = item.asset_url;
    } else {
      containerBody.media_type = "STORIES";
      containerBody.image_url = item.asset_url;
    }
  } else if (contentType === "carousel") {
    if (!item.asset_url) throw new Error("URL da imagem é obrigatória");
    containerBody.image_url = item.asset_url;
  } else {
    if (!item.asset_url) throw new Error("URL da imagem é obrigatória para Instagram");
    containerBody.image_url = item.asset_url;
  }

  // Retry logic for container creation (transient Meta errors)
  let containerData: any = null;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      }
    );
    containerData = await containerRes.json();
    
    if (!containerData.error) break; // Success
    
    // If it's a transient error and we have retries left, wait and retry
    const isTransient = containerData.error?.is_transient === true || 
      containerData.error?.message?.includes("unexpected error") ||
      containerData.error?.message?.includes("Please retry");
    
    if (isTransient && attempt < maxRetries) {
      console.log(`[meta-publish-post] Container transient error, retry ${attempt}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 3000 * attempt)); // Backoff: 3s, 6s
      continue;
    }
    
    throw new Error(`Container: ${containerData.error.message}`);
  }

  const containerId = containerData.id;
  if (!containerId) throw new Error("Container ID não retornado");

  // ALWAYS wait for container to be ready (images AND videos need this)
  await waitForContainerReady(containerId, accessToken);

  // Step 2: Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}/media_publish`,
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
 * Wait for Instagram container to finish processing (images AND videos)
 * Images usually finish in 1-5s, videos can take up to 2-3min
 */
async function waitForContainerReady(
  containerId: string,
  accessToken: string,
  maxAttempts = 30,
  intervalMs = 3000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();
    
    console.log(`[meta-publish-post] Container ${containerId} status: ${statusData.status_code} (attempt ${i + 1}/${maxAttempts})`);
    
    if (statusData.status_code === "FINISHED") return;
    if (statusData.status_code === "ERROR") {
      const errorDetail = statusData.status || "Processamento falhou no Instagram";
      throw new Error(`Container processing error: ${errorDetail}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timeout aguardando processamento do container Instagram");
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
