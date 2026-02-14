import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Messenger messages + Facebook comments
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Meta Page Webhook
 * 
 * Handles:
 * - Messenger messages (field: "messages")
 * - Facebook Page comments (field: "feed")
 * 
 * Routing: Uses Page ID → marketplace_connections → tenant_id
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-page-webhook][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET: Webhook verification (Meta challenge)
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
        console.log(`[meta-page-webhook][${traceId}] Verification OK`);
        return new Response(challenge, { status: 200, headers: { ...corsHeaders, "Content-Type": "text/plain" } });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // POST: Receive events
    if (req.method === "POST") {
      const payload = await req.json();
      console.log(`[meta-page-webhook][${traceId}] object=${payload.object}, entries=${payload.entry?.length}`);

      if (payload.object !== "page") {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      for (const entry of payload.entry || []) {
        const pageId = entry.id;

        // Route to tenant by Page ID (stored in marketplace_connections metadata.assets.pages)
        const tenantId = await findTenantByPageId(supabase, pageId);
        if (!tenantId) {
          console.warn(`[meta-page-webhook][${traceId}] No tenant for page ${pageId}`);
          continue;
        }

        // Process messaging events (Messenger)
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (event.message) {
              await handleMessengerMessage(supabase, traceId, tenantId, pageId, event);
            }
          }
        }

        // Process feed changes (comments)
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.field === "feed" && change.value?.item === "comment") {
              await handleFacebookComment(supabase, traceId, tenantId, pageId, change.value);
            }
          }
        }
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error(`[meta-page-webhook][${traceId}] Error:`, error);
    return new Response("OK", { status: 200, headers: corsHeaders }); // Always 200 for Meta
  }
});

/**
 * Find tenant by Facebook Page ID
 */
async function findTenantByPageId(supabase: any, pageId: string): Promise<string | null> {
  const { data: connections } = await supabase
    .from("marketplace_connections")
    .select("tenant_id, metadata")
    .eq("marketplace", "meta")
    .eq("is_active", true);

  if (!connections) return null;

  for (const conn of connections) {
    const pages = conn.metadata?.assets?.pages || [];
    if (pages.some((p: any) => p.id === pageId)) {
      return conn.tenant_id;
    }
  }
  return null;
}

/**
 * Get Page Access Token for a specific page
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
 * Handle incoming Messenger message
 */
async function handleMessengerMessage(
  supabase: any,
  traceId: string,
  tenantId: string,
  pageId: string,
  event: any
) {
  const senderId = event.sender?.id;
  const messageText = event.message?.text || "";
  const messageId = event.message?.mid;
  const attachments = event.message?.attachments || [];

  if (!senderId || senderId === pageId) return; // Ignore echo from page itself

  let content = messageText;
  let contentType = "text";

  // Handle attachments
  if (attachments.length > 0 && !messageText) {
    const att = attachments[0];
    contentType = att.type || "text";
    content = att.payload?.url || `[${att.type}]`;
  }

  console.log(`[meta-page-webhook][${traceId}] Messenger msg from ${senderId}: ${content.substring(0, 100)}`);

  // Get sender profile
  let senderName = senderId;
  try {
    const pageToken = await getPageAccessToken(supabase, tenantId, pageId);
    if (pageToken) {
      const profileRes = await fetch(
        `https://graph.facebook.com/v21.0/${senderId}?fields=first_name,last_name&access_token=${pageToken}`
      );
      if (profileRes.ok) {
        const profile = await profileRes.json();
        senderName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || senderId;
      }
    }
  } catch (e) {
    console.warn(`[meta-page-webhook][${traceId}] Could not fetch sender profile`);
  }

  // Find or create conversation
  const externalConvId = `messenger_${senderId}_${pageId}`;
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
        channel_type: "facebook_messenger",
        customer_name: senderName,
        external_conversation_id: externalConvId,
        external_thread_id: senderId,
        status: "new",
        priority: 1,
        subject: `Messenger - ${senderName}`,
        last_message_at: new Date().toISOString(),
        metadata: { page_id: pageId, sender_id: senderId },
      })
      .select("id")
      .single();

    if (convError) {
      console.error(`[meta-page-webhook][${traceId}] Failed to create conversation:`, convError);
      return;
    }
    conversationId = newConv.id;
  }

  // Insert message
  const { error: msgError } = await supabase.from("messages").insert({
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

  if (msgError) {
    console.error(`[meta-page-webhook][${traceId}] Failed to create message:`, msgError);
    return;
  }

  // Update conversation timestamp
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), status: "new" })
    .eq("id", conversationId);

  // Trigger AI if enabled
  await triggerAiIfEnabled(supabase, traceId, tenantId, conversationId, "facebook_messenger");
}

/**
 * Handle Facebook Page comment
 */
async function handleFacebookComment(
  supabase: any,
  traceId: string,
  tenantId: string,
  pageId: string,
  value: any
) {
  const { comment_id, from, message, post_id, parent_id, created_time, verb } = value;

  // Only process "add" verb (new comments)
  if (verb !== "add") return;
  // Ignore comments from the page itself
  if (from?.id === pageId) return;

  const senderName = from?.name || "Desconhecido";
  const senderId = from?.id;
  const content = message || "[Comentário sem texto]";

  console.log(`[meta-page-webhook][${traceId}] FB comment from ${senderName}: ${content.substring(0, 100)}`);

  // Use post as conversation grouping
  const externalConvId = `fb_comment_${post_id}`;

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
        channel_type: "facebook_messenger", // Uses messenger channel for FB comments (same API)
        customer_name: senderName,
        external_conversation_id: externalConvId,
        external_thread_id: post_id,
        status: "new",
        priority: 1,
        subject: `Comentário FB - ${senderName}`,
        last_message_at: new Date().toISOString(),
        metadata: { page_id: pageId, post_id, comment_id, is_comment: true },
      })
      .select("id")
      .single();

    if (convError) {
      console.error(`[meta-page-webhook][${traceId}] Failed to create comment conversation:`, convError);
      return;
    }
    conversationId = newConv.id;
  }

  // Insert comment as message
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
    external_message_id: comment_id,
    metadata: { post_id, parent_id, sender_id: senderId, is_comment: true },
  });

  // Update conversation
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString(), status: "new" })
    .eq("id", conversationId);
}

/**
 * Trigger AI support chat if enabled for tenant/channel
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
    console.log(`[meta-page-webhook][${traceId}] AI enabled, invoking ai-support-chat...`);
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
      console.error(`[meta-page-webhook][${traceId}] AI invocation error:`, e);
    }
  }
}
