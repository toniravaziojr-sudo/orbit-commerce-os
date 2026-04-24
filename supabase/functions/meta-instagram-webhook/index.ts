import { createClient } from "npm:@supabase/supabase-js@2";
import { getMetaConnectionForTenant, findTenantByPageIdV4, PAGE_BEARING_INTEGRATIONS } from "../_shared/meta-connection.ts";
import { shouldAiRespond, invokeAiSupportChat } from "../_shared/should-ai-respond.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.0.0"; // Phase 7: V4-first tenant resolution + helper for token/assets
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// Integration IDs that may contain instagram_accounts in selected_assets
const IG_BEARING_INTEGRATIONS = [
  "instagram_publicacoes",
  "instagram_comentarios",
  "instagram_direct",
] as const;

/**
 * Meta Instagram Webhook — V4 + Legacy fallback
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-instagram-webhook][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET: Webhook verification
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      const { data: credential } = await supabase
        .from("platform_credentials")
        .select("credential_value")
        .eq("credential_key", "META_WEBHOOK_VERIFY_TOKEN")
        .eq("is_active", true)
        .single();

      if (mode === "subscribe" && token === credential?.credential_value) {
        console.log(`[meta-instagram-webhook][${traceId}] Verification OK`);
        return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // POST: Receive events
    if (req.method === "POST") {
      const payload = await req.json();
      console.log(`[meta-instagram-webhook][${traceId}] object=${payload.object}, entries=${payload.entry?.length}`);

      if (payload.object !== "instagram") {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      for (const entry of payload.entry || []) {
        const igUserId = entry.id;

        // V4-first tenant resolution
        const tenantData = await findTenantByIgUserIdV4(supabase, igUserId);
        if (!tenantData) {
          console.warn(`[meta-instagram-webhook][${traceId}] No tenant for IG user ${igUserId}`);
          continue;
        }

        const { tenantId, pageId } = tenantData;

        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message) {
              await handleInstagramDM(supabase, traceId, tenantId, igUserId, pageId, event);
            }
          }
        }

        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "comments") {
              await handleInstagramComment(supabase, traceId, tenantId, igUserId, change.value);
            }
          }
        }
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error(`[meta-instagram-webhook][${traceId}] Error:`, error);
    return new Response("OK", { status: 200, headers: corsHeaders });
  }
});

/**
 * findTenantByIgUserIdV4
 * 
 * Resolves tenant_id + page_id from an Instagram User ID.
 * V4: Searches tenant_meta_integrations.selected_assets
 */
async function findTenantByIgUserIdV4(
  supabase: any,
  igUserId: string
): Promise<{ tenantId: string; pageId: string } | null> {
  // V4: Search in tenant_meta_integrations
  const { data: integrations } = await supabase
    .from("tenant_meta_integrations")
    .select("tenant_id, integration_id, selected_assets")
    .in("integration_id", IG_BEARING_INTEGRATIONS as unknown as string[])
    .eq("status", "active");

  if (integrations) {
    for (const integ of integrations) {
      const assets = integ.selected_assets;
      if (!assets) continue;

      const igAccounts = assets.instagram_accounts || [];
      const match = igAccounts.find((ig: any) => ig.id === igUserId);
      if (match) {
        return { tenantId: integ.tenant_id, pageId: match.page_id || "" };
      }
    }
  }

  return null;
}

/**
 * Get Page Access Token (needed for IG DM API via linked page)
 * Uses centralized helper (V4 with legacy fallback)
 */
async function getPageAccessToken(supabase: any, tenantId: string, pageId: string): Promise<string | null> {
  const metaConn = await getMetaConnectionForTenant(supabase, tenantId);
  if (!metaConn?.metadata?.assets?.pages) return null;
  const page = (metaConn.metadata.assets as any).pages.find((p: any) => p.id === pageId);
  return page?.access_token || null;
}

/**
 * Handle Instagram DM
 */
async function handleInstagramDM(
  supabase: any,
  traceId: string,
  tenantId: string,
  igUserId: string,
  pageId: string,
  event: any
) {
  const senderId = event.sender?.id;
  const messageText = event.message?.text || "";
  const messageId = event.message?.mid;
  const attachments = event.message?.attachments || [];

  if (!senderId || senderId === igUserId) return;

  let content = messageText;
  let contentType = "text";

  if (attachments.length > 0 && !messageText) {
    const att = attachments[0];
    contentType = att.type || "text";
    content = att.payload?.url || `[${att.type}]`;
  }

  console.log(`[meta-instagram-webhook][${traceId}] IG DM from ${senderId}: ${content.substring(0, 100)}`);

  let senderName = senderId;
  try {
    const pageToken = await getPageAccessToken(supabase, tenantId, pageId);
    if (pageToken) {
      const profileRes = await fetch(
        `https://graph.facebook.com/v21.0/${senderId}?fields=username,name&access_token=${pageToken}`
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        senderName = profile.username || profile.name || senderId;
      }
    }
  } catch {
    console.warn(`[meta-instagram-webhook][${traceId}] Could not fetch IG sender profile`);
  }

  const externalConvId = `ig_dm_${senderId}_${igUserId}`;

  // Phase 1: localizar conversa SEM filtrar por status (evita re-criar quando aberta)
  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id, status, assigned_to")
    .eq("tenant_id", tenantId)
    .eq("external_conversation_id", externalConvId)
    .not("status", "in", "(resolved,spam)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId: string;
  let convStatus: string | null = null;
  let convAssigned: string | null = null;

  if (existingConv) {
    conversationId = existingConv.id;
    convStatus = existingConv.status;
    convAssigned = existingConv.assigned_to;
  } else {
    const initialDecision = await shouldAiRespond({ supabase, tenant_id: tenantId, channel_type: "instagram_dm" });
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        channel_type: "instagram_dm",
        customer_name: senderName,
        external_conversation_id: externalConvId,
        external_thread_id: senderId,
        status: initialDecision.initial_status_for_new_conversation,
        priority: 1,
        subject: `Instagram DM - ${senderName}`,
        last_message_at: new Date().toISOString(),
        metadata: { ig_user_id: igUserId, sender_id: senderId, page_id: pageId },
      })
      .select("id, status")
      .single();

    if (convError) {
      console.error(`[meta-instagram-webhook][${traceId}] Failed to create conversation:`, convError);
      return;
    }
    conversationId = newConv.id;
    convStatus = newConv.status;
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    direction: "inbound",
    sender_type: "customer",
    sender_name: senderName,
    content,
    content_type: contentType,
    delivery_status: "delivered",
    is_ai_generated: false,
    is_internal: false,
    is_note: false,
    external_message_id: messageId,
  });

  // CRITICAL (Phase 1): NEVER overwrite status. Only update timestamps.
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), last_customer_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  await triggerAiIfEnabled(supabase, traceId, tenantId, conversationId, "instagram_dm", convStatus, convAssigned);
}

/**
 * Handle Instagram comment
 */
async function handleInstagramComment(
  supabase: any,
  traceId: string,
  tenantId: string,
  igUserId: string,
  value: any
) {
  const { id: commentId, text, from, media } = value;
  if (!text || !from) return;
  if (from.id === igUserId) return;

  const senderName = from.username || from.id;
  const mediaId = media?.id;

  console.log(`[meta-instagram-webhook][${traceId}] IG comment from ${senderName}: ${text.substring(0, 100)}`);

  const externalConvId = `ig_comment_${mediaId || commentId}`;

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("external_conversation_id", externalConvId)
    .in("status", ["new", "open", "waiting_customer", "waiting_agent", "bot"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId: string;

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        channel_type: "instagram_dm",
        customer_name: senderName,
        external_conversation_id: externalConvId,
        external_thread_id: mediaId || commentId,
        status: "new",
        priority: 1,
        subject: `Comentário IG - ${senderName}`,
        last_message_at: new Date().toISOString(),
        metadata: { ig_user_id: igUserId, media_id: mediaId, comment_id: commentId, is_comment: true },
      })
      .select("id")
      .single();

    if (convError) {
      console.error(`[meta-instagram-webhook][${traceId}] Failed to create comment conv:`, convError);
      return;
    }
    conversationId = newConv.id;
  }

  await supabase.from("messages").insert({
    conversation_id: conversationId,
    tenant_id: tenantId,
    direction: "inbound",
    sender_type: "customer",
    sender_name: senderName,
    content: text,
    content_type: "text",
    delivery_status: "delivered",
    is_ai_generated: false,
    is_internal: false,
    is_note: false,
    external_message_id: commentId,
    metadata: { media_id: mediaId, is_comment: true },
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), status: "new" })
    .eq("id", conversationId);
}

async function triggerAiIfEnabled(
  supabase: any,
  traceId: string,
  tenantId: string,
  conversationId: string,
  channelType: string,
  convStatus: string | null = null,
  convAssigned: string | null = null,
) {
  const decision = await shouldAiRespond({
    supabase,
    tenant_id: tenantId,
    channel_type: channelType,
    conversation: { id: conversationId, status: convStatus, assigned_to: convAssigned },
  });

  if (!decision.should_respond) {
    console.log(`[meta-instagram-webhook][${traceId}] AI gate=BLOCKED (${decision.reason})`);
    return;
  }

  console.log(`[meta-instagram-webhook][${traceId}] AI gate=GREEN, invoking...`);
  const res = await invokeAiSupportChat(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { conversation_id: conversationId, tenant_id: tenantId },
  );
  console.log(`[meta-instagram-webhook][${traceId}] AI response (${res.status}):`, res.bodyText);
}
