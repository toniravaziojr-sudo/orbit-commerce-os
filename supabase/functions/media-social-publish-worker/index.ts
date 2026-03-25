import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * media-social-publish-worker v${VERSION}
 * 
 * Cron worker that picks up social_posts with status='scheduled' and
 * scheduled_at <= NOW(), then publishes them via Meta Graph API.
 * 
 * - Instagram: creates container + publishes (was never called at schedule time)
 * - Facebook: checks if natively scheduled post was published, updates status
 * - Updates calendar_item status after all platforms are done
 * 
 * Runs every 5 minutes via pg_cron.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Find scheduled social_posts that are due
    const { data: duePosts, error: fetchError } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(20); // Process max 20 per run to avoid timeout

    if (fetchError) {
      console.error(`[social-publish-worker][${VERSION}] Fetch error:`, fetchError);
      return jsonResponse({ success: false, error: "Erro ao buscar posts agendados" });
    }

    if (!duePosts?.length) {
      return jsonResponse({ success: true, processed: 0, message: "Nenhum post para publicar" });
    }

    console.log(`[social-publish-worker][${VERSION}] Found ${duePosts.length} due posts`);

    // Group by tenant to batch Meta connection lookups
    const tenantIds = [...new Set(duePosts.map(p => p.tenant_id))];
    const metaConnections: Record<string, any> = {};

    for (const tid of tenantIds) {
      const { data: conn } = await supabase
        .from("marketplace_connections")
        .select("*")
        .eq("tenant_id", tid)
        .eq("marketplace", "meta")
        .eq("is_active", true)
        .maybeSingle();
      if (conn?.access_token) {
        metaConnections[tid] = conn;
      }
    }

    let published = 0;
    let failed = 0;
    let skipped = 0;

    for (const post of duePosts) {
      try {
        const conn = metaConnections[post.tenant_id];
        if (!conn) {
          console.warn(`[social-publish-worker] No Meta connection for tenant ${post.tenant_id}, skipping post ${post.id}`);
          skipped++;
          continue;
        }

        // Check token expiry
        if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
          console.warn(`[social-publish-worker] Token expired for tenant ${post.tenant_id}, skipping`);
          await updatePostStatus(supabase, post.id, "failed", "Token Meta expirado");
          failed++;
          continue;
        }

        const metadata = conn.metadata as any;
        const assets = metadata?.assets || {};
        const userAccessToken = conn.access_token;

        if (post.platform === "instagram") {
          // Instagram: need to actually publish via container flow
          const igAccount = assets.instagram_accounts?.[0];
          if (!igAccount) {
            await updatePostStatus(supabase, post.id, "failed", "Conta Instagram não conectada");
            failed++;
            continue;
          }

          console.log(`[social-publish-worker] Publishing Instagram post ${post.id}`);

          // Get calendar item for asset_url and content details
          const { data: calItem } = post.calendar_item_id
            ? await supabase.from("media_calendar_items").select("*").eq("id", post.calendar_item_id).single()
            : { data: null };

          const item = calItem || {
            asset_url: post.media_urls?.[0],
            copy: post.caption,
            title: post.caption,
            cta: null,
            hashtags: post.hashtags,
            content_type: post.post_type === "feed" ? "image" : post.post_type,
          };

          const result = await publishToInstagram(
            igAccount.id,
            userAccessToken,
            item,
            item.content_type || "image"
          );

          await supabase.from("social_posts").update({
            status: "published",
            published_at: new Date().toISOString(),
            meta_post_id: result.id,
            meta_container_id: result.container_id,
            api_response: result,
          }).eq("id", post.id);

          published++;
          console.log(`[social-publish-worker] Instagram post ${post.id} published: ${result.id}`);

        } else if (post.platform === "facebook") {
          // Facebook: check if natively scheduled post was already published by Facebook
          if (post.meta_post_id) {
            // Post was natively scheduled — check if Facebook published it
            try {
              const checkRes = await fetch(
                `https://graph.facebook.com/v21.0/${post.meta_post_id}?fields=is_published,created_time&access_token=${userAccessToken}`
              );
              const checkData = await checkRes.json();

              if (checkData.error) {
                // Post may have been deleted or token issue
                console.warn(`[social-publish-worker] FB check error for ${post.meta_post_id}:`, checkData.error.message);
                await updatePostStatus(supabase, post.id, "published", null, "Publicado nativamente pelo Facebook");
                published++;
              } else if (checkData.is_published !== false) {
                // Facebook already published it
                await supabase.from("social_posts").update({
                  status: "published",
                  published_at: checkData.created_time || new Date().toISOString(),
                }).eq("id", post.id);
                published++;
                console.log(`[social-publish-worker] FB post ${post.id} already published natively`);
              } else {
                // Still not published — unusual, mark as published anyway since FB will handle
                await updatePostStatus(supabase, post.id, "published", null, "Agendado nativamente no Facebook");
                published++;
              }
            } catch {
              // Network error checking FB — assume it was published
              await updatePostStatus(supabase, post.id, "published");
              published++;
            }
          } else {
            // No meta_post_id — was marked scheduled without actual FB call
            // Need to publish now
            const page = assets.pages?.[0];
            if (!page) {
              await updatePostStatus(supabase, post.id, "failed", "Página Facebook não conectada");
              failed++;
              continue;
            }

            const pageAccessToken = page.access_token || userAccessToken;

            const { data: calItem } = post.calendar_item_id
              ? await supabase.from("media_calendar_items").select("*").eq("id", post.calendar_item_id).single()
              : { data: null };

            const item = calItem || {
              asset_url: post.media_urls?.[0],
              copy: post.caption,
              title: post.caption,
              cta: null,
              hashtags: post.hashtags,
              content_type: post.post_type === "feed" ? "image" : post.post_type,
            };

            console.log(`[social-publish-worker] Publishing Facebook post ${post.id}`);
            const result = await publishToFacebook(page.id, pageAccessToken, item, item.content_type || "image");

            await supabase.from("social_posts").update({
              status: "published",
              published_at: new Date().toISOString(),
              meta_post_id: result.id || result.post_id,
              api_response: result,
            }).eq("id", post.id);

            published++;
            console.log(`[social-publish-worker] FB post ${post.id} published: ${result.id || result.post_id}`);
          }
        }

        // Update calendar_item if all social_posts for it are published
        if (post.calendar_item_id) {
          await maybeUpdateCalendarItem(supabase, post.calendar_item_id);
        }

      } catch (postError: any) {
        const errMsg = postError?.message || "Erro desconhecido";
        console.error(`[social-publish-worker] Error publishing post ${post.id}:`, errMsg);
        await updatePostStatus(supabase, post.id, "failed", errMsg);
        failed++;

        // Update calendar item to failed
        if (post.calendar_item_id) {
          await supabase.from("media_calendar_items")
            .update({ status: "failed" })
            .eq("id", post.calendar_item_id);
        }
      }
    }

    console.log(`[social-publish-worker][${VERSION}] Done: ${published} published, ${failed} failed, ${skipped} skipped`);

    return jsonResponse({
      success: true,
      processed: duePosts.length,
      published,
      failed,
      skipped,
    });

  } catch (error: any) {
    console.error(`[social-publish-worker][${VERSION}] Fatal error:`, error);
    return jsonResponse({ success: false, error: error.message || "Erro interno" });
  }
});

// ========== Helpers ==========

async function updatePostStatus(
  supabase: any,
  postId: string,
  status: string,
  errorMessage?: string | null,
  note?: string
) {
  const update: any = { status };
  if (status === "published") update.published_at = new Date().toISOString();
  if (errorMessage) update.error_message = errorMessage;
  if (note) update.api_response = { worker_note: note };
  await supabase.from("social_posts").update(update).eq("id", postId);
}

async function maybeUpdateCalendarItem(supabase: any, calendarItemId: string) {
  // Check if ALL social_posts for this calendar_item are published
  const { data: allPosts } = await supabase
    .from("social_posts")
    .select("status")
    .eq("calendar_item_id", calendarItemId);

  if (!allPosts?.length) return;

  const allPublished = allPosts.every((p: any) => p.status === "published");
  const anyFailed = allPosts.some((p: any) => p.status === "failed");

  if (allPublished) {
    await supabase.from("media_calendar_items")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", calendarItemId);
  } else if (anyFailed && !allPosts.some((p: any) => p.status === "scheduled")) {
    // All processed but some failed
    await supabase.from("media_calendar_items")
      .update({ status: "failed" })
      .eq("id", calendarItemId);
  }
}

// ========== Instagram Publishing ==========

async function publishToInstagram(
  igAccountId: string,
  accessToken: string,
  item: any,
  contentType: string
): Promise<any> {
  const caption = buildCaption(item);

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
  } else {
    if (!item.asset_url) throw new Error("URL da imagem é obrigatória para Instagram");
    containerBody.image_url = item.asset_url;
  }

  // Create container with retry
  let containerData: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${igAccountId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(containerBody),
      }
    );
    containerData = await containerRes.json();

    if (!containerData.error) break;

    const isTransient = containerData.error?.is_transient === true ||
      containerData.error?.message?.includes("unexpected error");

    if (isTransient && attempt < 3) {
      console.log(`[social-publish-worker] Container retry ${attempt}/3...`);
      await new Promise(r => setTimeout(r, 3000 * attempt));
      continue;
    }

    throw new Error(`Container: ${containerData.error.message}`);
  }

  const containerId = containerData.id;
  if (!containerId) throw new Error("Container ID não retornado");

  // Wait for container ready
  for (let i = 0; i < 30; i++) {
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
    );
    const statusData = await statusRes.json();

    if (statusData.status_code === "FINISHED") break;
    if (statusData.status_code === "ERROR") {
      throw new Error(`Container error: ${statusData.status || "Processamento falhou"}`);
    }

    await new Promise(r => setTimeout(r, 3000));
  }

  // Publish
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
  if (publishData.error) throw new Error(`Publish: ${publishData.error.message}`);

  return { ...publishData, container_id: containerId };
}

// ========== Facebook Publishing ==========

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

// ========== Caption Builder ==========

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

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
