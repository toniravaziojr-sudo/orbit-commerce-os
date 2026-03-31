import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "3.0.0"; // Phase 7: Use centralized meta-connection helper instead of direct marketplace_connections

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Retry backoff intervals in ms: 1min, 5min, 15min
const RETRY_BACKOFF_MS = [60_000, 300_000, 900_000];
const MAX_ATTEMPTS = 3;
const STALE_LOCK_MINUTES = 10;

// Error codes classified as retryable (transient)
const RETRYABLE_ERROR_PATTERNS = [
  "timeout", "rate limit", "too many", "unexpected error",
  "please retry", "temporarily unavailable", "ETIMEDOUT",
  "ECONNRESET", "503", "429", "500",
];

// Error codes classified as permanent
const PERMANENT_ERROR_PATTERNS = [
  "not connected", "token expired", "permission denied",
  "invalid token", "OAuthException", "not authorized",
  "does not exist", "not found",
];

/**
 * media-social-publish-worker v2.0.0
 * 
 * Phase 1A refactor:
 * - Uses payload_snapshot as source of truth for execution
 * - Retry with exponential backoff for transient errors (max 3 attempts)
 * - Locking to prevent duplicate processing
 * - Calls media-normalize-asset before Instagram publishing
 * - Tracks normalization results and error details per post
 * - Cleans lock on success, failure, and stale timeout
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const now = new Date();
    const nowISO = now.toISOString();
    const staleLockCutoff = new Date(now.getTime() - STALE_LOCK_MINUTES * 60 * 1000).toISOString();

    // Release stale locks first
    await supabase
      .from("social_posts")
      .update({ processing_started_at: null, lock_token: null })
      .lt("processing_started_at", staleLockCutoff)
      .not("processing_started_at", "is", null);

    // Query 1: Scheduled posts due now
    const { data: scheduledPosts, error: err1 } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", nowISO)
      .is("processing_started_at", null)
      .order("scheduled_at", { ascending: true })
      .limit(15);

    // Query 2: Failed posts eligible for retry
    const { data: retryPosts, error: err2 } = await supabase
      .from("social_posts")
      .select("*")
      .eq("status", "failed")
      .lt("attempt_count", MAX_ATTEMPTS)
      .lte("next_retry_at", nowISO)
      .is("processing_started_at", null)
      .order("next_retry_at", { ascending: true })
      .limit(5);

    if (err1 || err2) {
      console.error(`[worker][${VERSION}] Fetch error:`, err1 || err2);
      return jsonResponse({ success: false, error: "Erro ao buscar posts" });
    }

    const allPosts = [...(scheduledPosts || []), ...(retryPosts || [])];

    if (!allPosts.length) {
      return jsonResponse({ success: true, processed: 0, message: "Nenhum post para publicar" });
    }

    console.log(`[worker][${VERSION}] Found ${scheduledPosts?.length || 0} scheduled + ${retryPosts?.length || 0} retry = ${allPosts.length} posts`);

    // Group by tenant for Meta connection lookup (V4 helper)
    const tenantIds = [...new Set(allPosts.map(p => p.tenant_id))];
    const metaConnections: Record<string, any> = {};
    const tenantActiveIntegrations: Record<string, Set<string>> = {};

    for (const tid of tenantIds) {
      const metaConn = await getMetaConnectionForTenant(supabase, tid);
      if (metaConn) {
        metaConnections[tid] = {
          access_token: metaConn.access_token,
          metadata: metaConn.metadata,
          expires_at: null, // V4 handles expiration via grant status
          source: metaConn.source,
        };
      }

      // Check which publishing integrations are active for this tenant
      const { data: activeIntegrations } = await supabase
        .from("tenant_meta_integrations")
        .select("integration_id")
        .eq("tenant_id", tid)
        .eq("status", "active")
        .in("integration_id", ["facebook_publicacoes", "instagram_publicacoes"]);

      tenantActiveIntegrations[tid] = new Set(
        (activeIntegrations || []).map(i => i.integration_id)
      );
    }

    let published = 0;
    let failed = 0;
    let skipped = 0;
    let retried = 0;

    for (const post of allPosts) {
      const lockToken = crypto.randomUUID();

      // Acquire lock
      const { data: locked, error: lockErr } = await supabase
        .from("social_posts")
        .update({ processing_started_at: nowISO, lock_token: lockToken })
        .eq("id", post.id)
        .is("processing_started_at", null)
        .select("id")
        .maybeSingle();

      if (lockErr || !locked) {
        console.log(`[worker] Could not acquire lock for post ${post.id}, skipping`);
        skipped++;
        continue;
      }

      try {
        const conn = metaConnections[post.tenant_id];
        if (!conn) {
          await markPermanentFailure(supabase, post, "no_connection", "Meta não conectado", lockToken);
          failed++;
          continue;
        }

        // Validate that the corresponding publishing integration is active
        const activeIntegrations = tenantActiveIntegrations[post.tenant_id] || new Set();
        const requiredIntegration = post.platform === "instagram" ? "instagram_publicacoes" : "facebook_publicacoes";
        if (!activeIntegrations.has(requiredIntegration)) {
          await markPermanentFailure(supabase, post, "integration_inactive", `Integração ${post.platform} não está ativa`, lockToken);
          failed++;
          continue;
        }

        const metadata = conn.metadata as any;
        const assets = metadata?.assets || {};
        const userAccessToken = conn.access_token;

        // Use payload_snapshot as source of truth (fallback to calendar item)
        const snapshot = (post.payload_snapshot && Object.keys(post.payload_snapshot).length > 0)
          ? post.payload_snapshot
          : null;

        let item: any;
        if (snapshot) {
          item = snapshot;
        } else if (post.calendar_item_id) {
          const { data: calItem } = await supabase
            .from("media_calendar_items")
            .select("*")
            .eq("id", post.calendar_item_id)
            .single();
          item = calItem || buildItemFromPost(post);
        } else {
          item = buildItemFromPost(post);
        }

        const contentType = item.content_type || "image";

        if (post.platform === "instagram") {
          const igAccount = assets.instagram_accounts?.[0];
          if (!igAccount) {
            await markPermanentFailure(supabase, post, "no_ig_account", "Conta Instagram não conectada", lockToken);
            failed++;
            continue;
          }

          // Normalize asset before Instagram publish
          let assetUrl = item.asset_url;
          let normalizationResult: any = null;

          if (assetUrl && contentType !== "video" && contentType !== "reel") {
            try {
              const normalizeRes = await fetch(`${supabaseUrl}/functions/v1/media-normalize-asset`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  asset_url: assetUrl,
                  platform: "instagram",
                  content_type: contentType,
                  tenant_id: post.tenant_id,
                }),
              });
              normalizationResult = await normalizeRes.json();

              if (normalizationResult.success && normalizationResult.normalized_url) {
                assetUrl = normalizationResult.normalized_url;
                console.log(`[worker] Asset normalized for IG: ${normalizationResult.was_converted ? 'converted' : 'accepted'}`);
              } else if (!normalizationResult.success) {
                if (normalizationResult.rejection_reason === "incompatible_video_format" ||
                    normalizationResult.rejection_reason === "unconvertible_format") {
                  await markPermanentFailure(supabase, post, `media_${normalizationResult.rejection_reason}`,
                    normalizationResult.error || "Formato de mídia incompatível", lockToken, normalizationResult);
                  failed++;
                  continue;
                }
                // Other normalization failures are retryable (download_failed, upload_failed)
                throw new Error(normalizationResult.error || "Falha na normalização de mídia");
              }
            } catch (normErr: any) {
              // Normalization service error — retryable
              console.error(`[worker] Normalization error for post ${post.id}:`, normErr.message);
              throw normErr;
            }
          }

          // Use normalized asset
          const itemForPublish = { ...item, asset_url: assetUrl };

          console.log(`[worker] Publishing Instagram post ${post.id} (attempt ${(post.attempt_count || 0) + 1})`);
          const result = await publishToInstagram(igAccount.id, userAccessToken, itemForPublish, contentType);

          const igAttempt = (post.attempt_count || 0) + 1;
          const igLogEntry = {
            timestamp: nowISO,
            attempt: igAttempt,
            platform: "instagram",
            action: "publish",
            result: "success",
            meta_post_id: result.id,
            normalization: normalizationResult ? {
              was_converted: normalizationResult.was_converted,
              original_mime: normalizationResult.original_mime,
              final_mime: normalizationResult.mime_type,
            } : null,
          };

          await supabase.from("social_posts").update({
            status: "published",
            published_at: nowISO,
            meta_post_id: result.id,
            meta_container_id: result.container_id,
            api_response: result,
            attempt_count: igAttempt,
            last_error_code: null,
            last_error_message: null,
            next_retry_at: null,
            processing_started_at: null,
            lock_token: null,
            normalization_result: normalizationResult,
            execution_log: [...(post.execution_log || []), igLogEntry],
          }).eq("id", post.id).eq("lock_token", lockToken);

          published++;

        } else if (post.platform === "facebook") {
          if (post.meta_post_id) {
            // Natively scheduled — check if published
            try {
              const checkRes = await fetch(
                `https://graph.facebook.com/v21.0/${post.meta_post_id}?fields=is_published,created_time,full_picture,attachments&access_token=${userAccessToken}`
              );
              const checkData = await checkRes.json();

              const fbAttempt = (post.attempt_count || 0) + 1;
              const warningFlags: any[] = [...(post.warning_flags || [])];

              // Validate media presence if item required asset
              if (item.asset_url && !checkData.full_picture && !checkData.attachments?.data?.length) {
                console.warn(`[worker] FB post ${post.meta_post_id} published WITHOUT expected media — marking degraded`);
                warningFlags.push({
                  type: "media_missing_on_platform",
                  message: "Post publicado sem a mídia esperada",
                  detected_at: nowISO,
                });
              }

              const fbLogEntry = {
                timestamp: nowISO,
                attempt: fbAttempt,
                platform: "facebook",
                action: "verify_scheduled",
                result: "success",
                meta_post_id: post.meta_post_id,
                warnings: warningFlags.length > 0 ? warningFlags : null,
              };

              await supabase.from("social_posts").update({
                status: "published",
                published_at: checkData.created_time || nowISO,
                processing_started_at: null,
                lock_token: null,
                attempt_count: fbAttempt,
                execution_log: [...(post.execution_log || []), fbLogEntry],
                warning_flags: warningFlags,
              }).eq("id", post.id).eq("lock_token", lockToken);

              published++;
            } catch {
              await releaseLock(supabase, post.id, lockToken);
              throw new Error("Erro de rede ao verificar post do Facebook");
            }
          } else {
            // Direct publish
            const page = assets.pages?.[0];
            if (!page) {
              await markPermanentFailure(supabase, post, "no_fb_page", "Página Facebook não conectada", lockToken);
              failed++;
              continue;
            }

            const pageAccessToken = page.access_token || userAccessToken;
            const fbAttempt = (post.attempt_count || 0) + 1;
            console.log(`[worker] Publishing Facebook post ${post.id} (attempt ${fbAttempt})`);
            const result = await publishToFacebook(page.id, pageAccessToken, item, contentType);

            const fbLogEntry = {
              timestamp: nowISO,
              attempt: fbAttempt,
              platform: "facebook",
              action: "publish",
              result: "success",
              meta_post_id: result.id || result.post_id,
            };

            await supabase.from("social_posts").update({
              status: "published",
              published_at: nowISO,
              meta_post_id: result.id || result.post_id,
              api_response: result,
              attempt_count: fbAttempt,
              last_error_code: null,
              last_error_message: null,
              next_retry_at: null,
              processing_started_at: null,
              lock_token: null,
              execution_log: [...(post.execution_log || []), fbLogEntry],
            }).eq("id", post.id).eq("lock_token", lockToken);

            published++;
          }
        }

        // Update calendar item aggregate
        if (post.calendar_item_id) {
          await maybeUpdateCalendarItem(supabase, post.calendar_item_id);
        }

      } catch (postError: any) {
        const errMsg = postError?.message || "Erro desconhecido";
        const errorCode = classifyError(errMsg);
        const attemptCount = (post.attempt_count || 0) + 1;
        const isRetryable = errorCode === "retryable" && attemptCount < MAX_ATTEMPTS;

        console.error(`[worker] Error post ${post.id} (attempt ${attemptCount}): [${errorCode}] ${errMsg}`);

        const errorLogEntry = {
          timestamp: nowISO,
          attempt: attemptCount,
          platform: post.platform,
          action: "publish",
          result: isRetryable ? "retryable_error" : "permanent_error",
          error_code: errorCode,
          error_message: errMsg,
          will_retry: isRetryable,
        };

        if (isRetryable) {
          const backoffMs = RETRY_BACKOFF_MS[Math.min(attemptCount - 1, RETRY_BACKOFF_MS.length - 1)];
          const nextRetry = new Date(Date.now() + backoffMs).toISOString();

          await supabase.from("social_posts").update({
            status: "failed",
            attempt_count: attemptCount,
            last_error_code: "retryable",
            last_error_message: errMsg,
            next_retry_at: nextRetry,
            processing_started_at: null,
            lock_token: null,
            execution_log: [...(post.execution_log || []), errorLogEntry],
          }).eq("id", post.id).eq("lock_token", lockToken);

          retried++;
          console.log(`[worker] Post ${post.id} scheduled for retry at ${nextRetry} (attempt ${attemptCount}/${MAX_ATTEMPTS})`);
        } else {
          await supabase.from("social_posts").update({
            status: "failed",
            attempt_count: attemptCount,
            last_error_code: errorCode === "retryable" ? "max_retries_exceeded" : "permanent",
            last_error_message: errMsg,
            error_message: errMsg,
            next_retry_at: null,
            processing_started_at: null,
            lock_token: null,
            execution_log: [...(post.execution_log || []), errorLogEntry],
          }).eq("id", post.id).eq("lock_token", lockToken);

          failed++;
        }

        // Trigger fires automatically via DB trigger now
      }
    }

    console.log(`[worker][${VERSION}] Done: ${published} published, ${failed} failed, ${retried} retried, ${skipped} skipped`);

    return jsonResponse({
      success: true,
      processed: allPosts.length,
      published,
      failed,
      retried,
      skipped,
    });

  } catch (error: any) {
    console.error(`[worker][${VERSION}] Fatal error:`, error);
    return jsonResponse({ success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte." });
  }
});

// ========== Error Classification ==========

function classifyError(message: string): "retryable" | "permanent" {
  const lower = message.toLowerCase();
  for (const pattern of PERMANENT_ERROR_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) return "permanent";
  }
  for (const pattern of RETRYABLE_ERROR_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) return "retryable";
  }
  // Default: treat unknown errors as retryable (safer)
  return "retryable";
}

// ========== Lock Management ==========

async function releaseLock(supabase: any, postId: string, lockToken: string) {
  await supabase.from("social_posts").update({
    processing_started_at: null,
    lock_token: null,
  }).eq("id", postId).eq("lock_token", lockToken);
}

async function markPermanentFailure(
  supabase: any, post: any, errorCode: string, errorMessage: string,
  lockToken: string, normalizationResult?: any
) {
  const update: any = {
    status: "failed",
    attempt_count: (post.attempt_count || 0) + 1,
    last_error_code: errorCode,
    last_error_message: errorMessage,
    error_message: errorMessage,
    next_retry_at: null,
    processing_started_at: null,
    lock_token: null,
  };
  if (normalizationResult) update.normalization_result = normalizationResult;
  await supabase.from("social_posts").update(update).eq("id", post.id).eq("lock_token", lockToken);

  if (post.calendar_item_id) {
    await maybeUpdateCalendarItem(supabase, post.calendar_item_id);
  }
}

// ========== Calendar Item Aggregation ==========
// Phase 1B: Aggregate status is now computed by DB trigger (sync_calendar_item_status)
// This function is kept as a no-op for backwards compatibility with call sites
async function maybeUpdateCalendarItem(_supabase: any, _calendarItemId: string) {
  // DB trigger handles this automatically now
}

// ========== Helpers ==========

function buildItemFromPost(post: any): any {
  return {
    asset_url: post.media_urls?.[0],
    copy: post.caption,
    title: post.caption,
    cta: null,
    hashtags: post.hashtags,
    content_type: post.post_type === "feed" ? "image" : post.post_type,
  };
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
      console.log(`[worker] Container retry ${attempt}/3...`);
      await new Promise(r => setTimeout(r, 3000 * attempt));
      continue;
    }

    throw new Error("Erro interno. Se o problema persistir, entre em contato com o suporte.");
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
  if (publishData.error) throw new Error("Erro interno. Se o problema persistir, entre em contato com o suporte.");

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
