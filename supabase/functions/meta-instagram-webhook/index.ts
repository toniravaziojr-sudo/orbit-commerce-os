import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Instagram DMs + comments
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Meta Instagram Webhook
 * 
 * Handles:
 * - Instagram DMs (field: "messages")
 * - Instagram comments (field: "comments")
 * 
 * Routing: Uses IG User ID → marketplace_connections → tenant_id
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

        // Route to tenant
        const tenantData = await findTenantByIgUserId(supabase, igUserId);
        if (!tenantData) {
          console.warn(`[meta-instagram-webhook][${traceId}] No tenant for IG user ${igUserId}`);
          continue;
        }

        const { tenantId, pageId } = tenantData;

        // Instagram DMs (messaging field)
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message) {
              await handleInstagramDM(supabase, traceId, tenantId, igUserId, pageId, event);
            }
          }
        }

        // Instagram comments (changes field)
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
 * Find tenant and linked page by Instagram User ID
 */
async function findTenantByIgUserId(
  supabase: any,
  igUserId: string
): Promise<{ tenantId: string; pageId: string } | null> {
  const { data: connections } = await supabase
    .from("marketplace_connections")
    .select("tenant_id, metadata")
    .eq("marketplace", "meta")
    .eq("is_active", true);

  if (!connections) return null;

  for (const conn of connections) {
    const igAccounts = conn.metadata?.assets?.instagram_accounts || [];
    const match = igAccounts.find((ig: any) => ig.id === igUserId);
    if (match) {
      return { tenantId: conn.tenant_id, pageId: match.page_id };
    }
  }
  return null;
}

/**
 * Get Page Access Token (needed for IG DM API via linked page)
 */
async function getPageAccessToken(supabase: any, tenantId: string, pageId: string): Promise<string | null> {
  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .single();

  if (!conn?.metadata?.assets?.pages) return null;
  const page = conn.metadata.assets.pages.find((p: any) => p.id === pageId);
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

  // Ignore messages sent by the IG account itself (echo)
  if (!senderId || senderId === igUserId) return;

  let content = messageText;
  let contentType = "text";

  if (attachments.length > 0 && !messageText) {
    const att = attachments[0];
    contentType = att.type || "text";
    content = att.payload?.url || `[${att.type}]`;
  }

  console.log(`[meta-instagram-webhook][${traceId}] IG DM from ${senderId}: ${content.substring(0, 100)}`);

  // Get sender username
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
  } catch (e) {
    console.warn(`[meta-instagram-webhook][${traceId}] Could not fetch IG sender profile`);
  }

  // Find or create conversation
  const externalConvId = `ig_dm_${senderId}_${igUserId}`;

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
        external_thread_id: senderId,
        status: "new",
        priority: 1,
        subject: `Instagram DM - ${senderName}`,
        last_message_at: new Date().toISOString(),
        metadata: { ig_user_id: igUserId, sender_id: senderId, page_id: pageId },
      })
      .select("id")
      .single();

    if (convError) {
      console.error(`[meta-instagram-webhook][${traceId}] Failed to create conversation:`, convError);
      return;
    }
    conversationId = newConv.id;
  }

  // Insert message
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

  // Update conversation
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), status: "new" })
    .eq("id", conversationId);

  // Trigger AI
  await triggerAiIfEnabled(supabase, traceId, tenantId, conversationId, "instagram_dm");
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

  // Ignore comments from the IG account itself
  if (from.id === igUserId) return;

  const senderName = from.username || from.id;
  const mediaId = media?.id;
  const content = text;

  console.log(`[meta-instagram-webhook][${traceId}] IG comment from ${senderName}: ${content.substring(0, 100)}`);

  // Group comments by media post
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
        channel_type: "instagram_dm", // Uses instagram_dm channel for IG interactions
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
    content,
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

/**
 * Trigger AI support if enabled
 */
async function triggerAiIfEnabled(
  supabase: any,
  traceId: string,
  tenantId: string,
  conversationId: string,
  channelType: string
) {
  const { data: aiConfig } = await supabase
    .from("ai_support_config")
    .select("is_enabled")
    .eq("tenant_id", tenantId)
    .single();

  const { data: channelAiConfig } = await supabase
    .from("ai_channel_config")
    .select("is_enabled")
    .eq("tenant_id", tenantId)
    .eq("channel_type", channelType)
    .single();

  const aiEnabled = aiConfig?.is_enabled && (channelAiConfig?.is_enabled !== false);

  if (aiEnabled) {
    console.log(`[meta-instagram-webhook][${traceId}] AI enabled, invoking...`);
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/ai-support-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ conversation_id: conversationId, tenant_id: tenantId }),
      });
    } catch (e) {
      console.error(`[meta-instagram-webhook][${traceId}] AI error:`, e);
    }
  }
}
