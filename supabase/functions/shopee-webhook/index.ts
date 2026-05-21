import { createClient } from "npm:@supabase/supabase-js@2";
import { shouldAiRespond, invokeAiSupportChat } from "../_shared/should-ai-respond.ts";

const VERSION = "v2.0.0"; // Now ingests webchat_message into AI engine

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { code, shop_id, timestamp, data } = body;
    console.log(`[shopee-webhook][${VERSION}] code=${code} shop=${shop_id}`);

    if (!shop_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing shop_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("id, tenant_id, access_token")
      .eq("marketplace", "shopee")
      .eq("external_user_id", String(shop_id))
      .eq("is_active", true)
      .single();

    if (!connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pushTypeMap: Record<number, string> = {
      0: "shop_authorization", 1: "shop_deauthorization", 2: "item_promotion",
      3: "order_status_update", 4: "order_trackingno", 5: "shop_update",
      6: "add_item", 7: "delete_item", 8: "update_item", 9: "promotion_update",
      10: "reserved_stock_change", 11: "webchat_message", 12: "buyer_cancel_order",
      13: "seller_cancel_order", 14: "return_creation", 15: "return_update",
    };
    const syncType = pushTypeMap[code] || `unknown_${code}`;

    await supabase.from("marketplace_sync_logs").insert({
      connection_id: connection.id,
      tenant_id: connection.tenant_id,
      sync_type: `webhook_${syncType}`,
      status: "pending",
      processed_count: 0,
      details: { push_code: code, push_type: syncType, shop_id, timestamp, data, received_at: new Date().toISOString() },
    });

    if (code === 11) { // webchat_message
      try {
        await ingestShopeeChat(supabase, supabaseUrl, supabaseServiceKey, connection, shop_id, data);
      } catch (e) {
        console.error("[shopee-webhook] ingestShopeeChat error:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification received" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[shopee-webhook] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function ingestShopeeChat(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  connection: any,
  shopId: string | number,
  data: any,
) {
  if (!data) return;
  const fromId = data.from_id || data.sender_id;
  const fromName = data.from_user_name || data.sender_name || `Comprador Shopee ${fromId}`;
  const content = data.content?.text || data.message || data.content || "";
  const messageId = data.message_id || `${shopId}_${Date.now()}`;
  // Shopee notifies on every message — skip echoes from the seller side
  if (data.from_shop_id && String(data.from_shop_id) === String(shopId)) {
    console.log("[shopee-webhook] skipping seller-side echo");
    return;
  }
  if (!fromId || !content) return;

  const tenantId = connection.tenant_id;
  const externalConvId = `shopee_chat_${fromId}_${shopId}`;

  const { data: existingConv } = await supabase
    .from("conversations")
    .select("id, status, assigned_to")
    .eq("tenant_id", tenantId)
    .eq("external_conversation_id", externalConvId)
    .not("status", "in", "(resolved,spam)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const decision = await shouldAiRespond({
    supabase,
    tenant_id: tenantId,
    channel_type: "shopee",
    conversation: existingConv ?? null,
  });

  let conversationId: string;
  let snapshot: any;

  if (existingConv) {
    conversationId = existingConv.id;
    snapshot = existingConv;
  } else {
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        channel_type: "shopee",
        customer_name: fromName,
        external_conversation_id: externalConvId,
        external_thread_id: String(fromId),
        status: decision.initial_status_for_new_conversation,
        priority: 2,
        subject: `Chat Shopee - ${fromName}`,
        last_message_at: new Date().toISOString(),
        metadata: { shopee_buyer_id: fromId, shopee_shop_id: shopId },
      })
      .select("id, status, assigned_to")
      .single();
    if (error || !newConv) {
      console.error("[shopee-webhook] Failed to create conversation:", error);
      return;
    }
    conversationId = newConv.id;
    snapshot = newConv;
  }

  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("external_message_id", String(messageId))
    .maybeSingle();

  if (!existingMsg) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: "inbound",
      sender_type: "customer",
      sender_name: fromName,
      content,
      content_type: "text",
      delivery_status: "delivered",
      external_message_id: String(messageId),
      is_ai_generated: false,
      is_internal: false,
      is_note: false,
    });

    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_customer_message_at: new Date().toISOString(),
      })
      .eq("id", conversationId);
  }

  const finalDecision = await shouldAiRespond({
    supabase,
    tenant_id: tenantId,
    channel_type: "shopee",
    conversation: snapshot,
  });

  if (finalDecision.should_respond) {
    const res = await invokeAiSupportChat(supabaseUrl, serviceKey, {
      conversation_id: conversationId,
      tenant_id: tenantId,
    });
    console.log(`[shopee-webhook] AI invoke (${res.status}):`, res.bodyText);
  } else {
    console.log(`[shopee-webhook] AI gate blocked: ${finalDecision.reason}`);
  }
}
