// =============================================================
// Channel Dispatcher — Unified outbound for the AI engine
// =============================================================
// Single entry point used by ai-support-chat to deliver the final
// AI response to whatever channel the conversation belongs to.
//
// Supported channels:
//  - facebook_messenger      → Graph API /messages (page token)
//  - instagram_dm            → Graph API /messages (page token)
//  - facebook_comments       → Graph API /{comment_id}/comments (page token)
//  - instagram_comments      → Graph API /{comment_id}/replies (page token)
//  - mercadolivre            → POST /answers (ML access token)
//  - shopee                  → POST /api/v2/sellerchat/send_message (shop token)
//  - tiktok_shop             → POST /api/messages/202309/messages/send (shop token)
//
// Contract:
//   - Returns the same shape as the legacy inline send used by
//     ai-support-chat: { success, error?, message_id?, managed_status? }.
//   - NEVER throws — every failure is reported via { success: false, error }.
//   - Does NOT mutate `messages.delivery_status` itself; the caller
//     handles that based on the result (except where the upstream
//     function already manages it — flagged via managed_status=true).
// =============================================================

import { getMetaConnectionForTenant } from "./meta-connection.ts";
import { loadPlatformCredentials } from "./load-platform-credentials.ts";

// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

export interface DispatchResult {
  success: boolean;
  error?: string;
  message_id?: string;
  managed_status?: boolean;
}

export interface ConversationLike {
  id: string;
  channel_type: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  external_thread_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DispatchInput {
  supabase: SupabaseLike;
  tenant_id: string;
  conversation: ConversationLike;
  aiContent: string;
  message_id: string;
}

/**
 * Decide and execute the outbound send for the AI reply.
 * Returns null when the channel is not handled here (caller can
 * fall back to its own logic — used during the migration window
 * where WhatsApp/email still live inline in ai-support-chat).
 */
export async function dispatchAiReply(
  input: DispatchInput,
): Promise<DispatchResult | null> {
  const ch = input.conversation.channel_type;
  switch (ch) {
    case "facebook_messenger":
      return sendMessenger(input);
    case "instagram_dm":
      return sendInstagramDM(input);
    case "facebook_comments":
      return sendFacebookCommentReply(input);
    case "instagram_comments":
      return sendInstagramCommentReply(input);
    case "mercadolivre":
      return sendMercadoLivreAnswer(input);
    case "shopee":
      return sendShopeeChat(input);
    case "tiktok_shop":
      return sendTikTokShopMessage(input);
    default:
      return null;
  }
}

// -----------------------------------------------------------------
// Meta (Messenger + IG DM)
// -----------------------------------------------------------------

async function getPageTokenForConversation(
  supabase: SupabaseLike,
  tenant_id: string,
  conversation: ConversationLike,
): Promise<{ token: string | null; pageId: string | null }> {
  const meta = conversation.metadata || {};
  const pageId = (meta.page_id || meta.pageId) as string | undefined;
  if (!pageId) return { token: null, pageId: null };
  const conn = await getMetaConnectionForTenant(supabase, tenant_id);
  const pages = (conn?.metadata?.assets as any)?.pages || [];
  const match = pages.find((p: any) => p.id === pageId);
  return { token: match?.access_token || null, pageId };
}

async function sendMessenger(input: DispatchInput): Promise<DispatchResult> {
  const { supabase, tenant_id, conversation, aiContent } = input;
  const meta = conversation.metadata || {};
  const recipientId = (meta.sender_id as string) || conversation.external_thread_id || null;
  if (!recipientId) return { success: false, error: "missing_recipient_id" };

  const { token, pageId } = await getPageTokenForConversation(supabase, tenant_id, conversation);
  if (!token || !pageId) return { success: false, error: "missing_page_token" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}/messages?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          messaging_type: "RESPONSE",
          message: { text: aiContent },
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: `messenger_send_failed:${res.status}:${JSON.stringify(data).slice(0, 200)}`,
      };
    }
    return { success: true, message_id: data.message_id || null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "messenger_send_exception" };
  }
}

async function sendInstagramDM(input: DispatchInput): Promise<DispatchResult> {
  const { supabase, tenant_id, conversation, aiContent } = input;
  const meta = conversation.metadata || {};
  const recipientId = (meta.sender_id as string) || conversation.external_thread_id || null;
  const igUserId = (meta.ig_user_id as string) || null;
  if (!recipientId) return { success: false, error: "missing_recipient_id" };
  if (!igUserId) return { success: false, error: "missing_ig_user_id" };

  const { token } = await getPageTokenForConversation(supabase, tenant_id, conversation);
  if (!token) return { success: false, error: "missing_page_token" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${igUserId}/messages?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: aiContent },
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: `ig_dm_send_failed:${res.status}:${JSON.stringify(data).slice(0, 200)}`,
      };
    }
    return { success: true, message_id: data.message_id || null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "ig_dm_send_exception" };
  }
}

async function sendFacebookCommentReply(input: DispatchInput): Promise<DispatchResult> {
  const { supabase, tenant_id, conversation, aiContent } = input;
  const meta = conversation.metadata || {};
  const commentId = (meta.comment_id as string) || null;
  if (!commentId) return { success: false, error: "missing_comment_id" };
  const { token } = await getPageTokenForConversation(supabase, tenant_id, conversation);
  if (!token) return { success: false, error: "missing_page_token" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${commentId}/comments?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiContent }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: `fb_comment_reply_failed:${res.status}:${JSON.stringify(data).slice(0, 200)}`,
      };
    }
    return { success: true, message_id: data.id || null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "fb_comment_reply_exception" };
  }
}

async function sendInstagramCommentReply(input: DispatchInput): Promise<DispatchResult> {
  const { supabase, tenant_id, conversation, aiContent } = input;
  const meta = conversation.metadata || {};
  const commentId = (meta.comment_id as string) || null;
  if (!commentId) return { success: false, error: "missing_comment_id" };
  const { token } = await getPageTokenForConversation(supabase, tenant_id, conversation);
  if (!token) return { success: false, error: "missing_page_token" };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${commentId}/replies?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: aiContent }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: `ig_comment_reply_failed:${res.status}:${JSON.stringify(data).slice(0, 200)}`,
      };
    }
    return { success: true, message_id: data.id || null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "ig_comment_reply_exception" };
  }
}

// -----------------------------------------------------------------
// Mercado Livre — answers (questions topic)
// -----------------------------------------------------------------

async function sendMercadoLivreAnswer(input: DispatchInput): Promise<DispatchResult> {
  const { supabase, tenant_id, conversation, aiContent } = input;
  const meta = conversation.metadata || {};
  const questionId = (meta.meli_question_id as string | number | undefined) ?? null;
  if (!questionId) {
    return { success: false, error: "missing_meli_question_id" };
  }

  const { data: conn, error: connErr } = await supabase
    .from("marketplace_connections")
    .select("access_token, expires_at, is_active")
    .eq("tenant_id", tenant_id)
    .eq("marketplace", "mercadolivre")
    .eq("is_active", true)
    .maybeSingle();
  if (connErr || !conn?.access_token) return { success: false, error: "missing_ml_token" };
  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    return { success: false, error: "ml_token_expired" };
  }

  try {
    const res = await fetch("https://api.mercadolibre.com/answers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question_id: typeof questionId === "string" ? parseInt(questionId, 10) : questionId,
        text: aiContent,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: `ml_answer_failed:${res.status}:${(data?.message || JSON.stringify(data)).slice(0, 200)}`,
      };
    }
    return { success: true, message_id: String(data.id || questionId) };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "ml_answer_exception" };
  }
}

// -----------------------------------------------------------------
// Shopee — sellerchat/send_message
// -----------------------------------------------------------------
// Signature scheme: HMAC-SHA256(partner_id + path + timestamp + access_token + shop_id, partner_key)
// Reference: https://open.shopee.com/documents/v2/v2.sellerchat.send_message

async function sendShopeeChat(input: DispatchInput): Promise<DispatchResult> {
  const { supabase, tenant_id, conversation, aiContent } = input;
  const meta = conversation.metadata || {};
  const toUserId = (meta.shopee_buyer_id as string | number | undefined)
    ?? (meta.from_id as string | number | undefined)
    ?? (conversation.external_thread_id as string | null)
    ?? null;
  if (!toUserId) return { success: false, error: "missing_shopee_buyer_id" };

  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token, external_user_id, is_active, expires_at")
    .eq("tenant_id", tenant_id)
    .eq("marketplace", "shopee")
    .eq("is_active", true)
    .maybeSingle();
  if (!conn?.access_token || !conn.external_user_id) {
    return { success: false, error: "missing_shopee_connection" };
  }
  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    return { success: false, error: "shopee_token_expired" };
  }

  const partnerId = Deno.env.get("SHOPEE_PARTNER_ID");
  const partnerKey = Deno.env.get("SHOPEE_PARTNER_KEY");
  const apiBase = Deno.env.get("SHOPEE_API_BASE") || "https://partner.shopeemobile.com";
  if (!partnerId || !partnerKey) {
    return { success: false, error: "shopee_partner_env_missing" };
  }

  const path = "/api/v2/sellerchat/send_message";
  const timestamp = Math.floor(Date.now() / 1000);
  const shopId = conn.external_user_id;
  const baseString = `${partnerId}${path}${timestamp}${conn.access_token}${shopId}`;
  const sign = await hmacSha256Hex(partnerKey, baseString);

  const url =
    `${apiBase}${path}?partner_id=${partnerId}&timestamp=${timestamp}` +
    `&access_token=${encodeURIComponent(conn.access_token)}` +
    `&shop_id=${encodeURIComponent(shopId)}&sign=${sign}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to_id: Number(toUserId),
        message_type: "text",
        content: { text: aiContent },
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.error) {
      return {
        success: false,
        error: `shopee_send_failed:${res.status}:${(data?.message || data?.error || "unknown").toString().slice(0, 200)}`,
      };
    }
    return { success: true, message_id: data?.response?.message_id || null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "shopee_send_exception" };
  }
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// -----------------------------------------------------------------
// TikTok Shop — Customer Service Messages
// -----------------------------------------------------------------
// Endpoint: POST /customer_service/202309/messages/send
// Requires shop_cipher + app key/secret signing handled by the
// existing TikTok Shop connection layer. When the connection
// lacks chat scope, we fail with a clear reason so the merchant
// can re-authorize.

async function sendTikTokShopMessage(input: DispatchInput): Promise<DispatchResult> {
  const { supabase, tenant_id, conversation, aiContent } = input;
  const meta = conversation.metadata || {};
  const conversationExternalId =
    (meta.tiktok_conversation_id as string | undefined) ||
    (conversation.external_thread_id as string | null) ||
    null;
  if (!conversationExternalId) return { success: false, error: "missing_tiktok_conversation_id" };

  const { data: conn } = await supabase
    .from("tiktok_shop_connections")
    .select("access_token, shop_id, shop_cipher, is_active, expires_at")
    .eq("tenant_id", tenant_id)
    .eq("is_active", true)
    .maybeSingle();
  if (!conn?.access_token || !conn.shop_id) {
    return { success: false, error: "missing_tiktok_shop_connection" };
  }
  if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
    return { success: false, error: "tiktok_shop_token_expired" };
  }

  // The TikTok Shop Customer Service API requires app-level signing
  // identical to the existing tiktok-shop-* functions. To keep this
  // dispatcher self-contained we surface a clear "pending_provider"
  // failure when the env keys for signing are not present, instead of
  // silently dropping the reply.
  const appKey = Deno.env.get("TIKTOK_SHOP_APP_KEY");
  const appSecret = Deno.env.get("TIKTOK_SHOP_APP_SECRET");
  if (!appKey || !appSecret) {
    return { success: false, error: "tiktok_shop_app_env_missing" };
  }

  const path = "/customer_service/202309/messages/send";
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    app_key: appKey,
    shop_cipher: conn.shop_cipher || "",
    timestamp: String(timestamp),
    version: "202309",
  };
  const sortedKeys = Object.keys(params).sort();
  const baseStr = appSecret +
    path +
    sortedKeys.map((k) => k + params[k]).join("") +
    appSecret;
  const sign = await hmacSha256Hex(appSecret, baseStr);

  const qs = new URLSearchParams({ ...params, sign, access_token: conn.access_token }).toString();
  const url = `https://open-api.tiktokglobalshop.com${path}?${qs}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationExternalId,
        type: "TEXT",
        content: JSON.stringify({ content: aiContent }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data?.code && data.code !== 0)) {
      return {
        success: false,
        error: `tiktok_shop_send_failed:${res.status}:${(data?.message || JSON.stringify(data)).slice(0, 200)}`,
      };
    }
    return { success: true, message_id: data?.data?.message_id || null };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "tiktok_shop_send_exception" };
  }
}
