import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { shouldAiRespond, invokeAiSupportChat } from "../_shared/should-ai-respond.ts";

const VERSION = "v2.0.0"; // Now ingests questions into AI engine

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const notification = await req.json();
    console.log(`[meli-webhook][${VERSION}] Received:`, JSON.stringify(notification));

    const { resource, user_id, topic } = notification;
    if (!resource || !user_id || !topic) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid notification format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("marketplace", "mercadolivre")
      .eq("external_account_id", String(user_id))
      .eq("status", "active")
      .single();

    if (connError || !connection) {
      console.error("[meli-webhook] Connection not found for user_id:", user_id);
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Always log
    await supabase.from("marketplace_sync_logs").insert({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      marketplace: "mercadolivre",
      sync_type: `webhook_${topic}`,
      status: "pending",
      details: { notification, resource, topic },
    });

    // Ingest chat-style events into the AI engine
    if (topic === "questions") {
      try {
        await ingestQuestion(supabase, supabaseUrl, supabaseKey, connection, resource);
      } catch (e) {
        console.error("[meli-webhook] ingestQuestion error:", e);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Notification received" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[meli-webhook] Error:", error);
    return errorResponse(error, corsHeaders, { module: "mercadolivre", action: "webhook" });
  }
});

async function ingestQuestion(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  connection: any,
  resource: string,
) {
  // resource example: "/questions/123456789"
  const questionId = resource.split("/").pop();
  if (!questionId) return;

  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    console.warn(`[meli-webhook] ML token expired for tenant ${connection.tenant_id}`);
    return;
  }

  const qRes = await fetch(`https://api.mercadolibre.com/questions/${questionId}`, {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });
  if (!qRes.ok) {
    console.error(`[meli-webhook] Failed to fetch question ${questionId}: ${qRes.status}`);
    return;
  }
  const q = await qRes.json();

  // Ignore already-answered questions to avoid double posting
  if (q.status !== "UNANSWERED") {
    console.log(`[meli-webhook] Question ${questionId} already answered, skipping AI.`);
    return;
  }

  const tenantId = connection.tenant_id;
  let itemTitle = "";
  if (q.item_id) {
    try {
      const itemRes = await fetch(`https://api.mercadolibre.com/items/${q.item_id}`, {
        headers: { Authorization: `Bearer ${connection.access_token}` },
      });
      if (itemRes.ok) {
        const item = await itemRes.json();
        itemTitle = item.title || "";
      }
    } catch { /* ignore */ }
  }

  const externalConvId = `meli_question_${q.id}`;
  const senderName = q.from?.nickname || `Comprador ${q.from?.id || "ML"}`;

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
    channel_type: "mercadolivre",
    conversation: existingConv ?? null,
  });

  let conversationId: string;
  let conversationSnapshot: any;

  if (existingConv) {
    conversationId = existingConv.id;
    conversationSnapshot = existingConv;
  } else {
    const { data: newConv, error: convError } = await supabase
      .from("conversations")
      .insert({
        tenant_id: tenantId,
        channel_type: "mercadolivre",
        customer_name: senderName,
        external_conversation_id: externalConvId,
        external_thread_id: String(q.id),
        status: decision.initial_status_for_new_conversation,
        priority: 2,
        subject: itemTitle
          ? `Pergunta ML: ${itemTitle.substring(0, 60)}`
          : "Pergunta no Mercado Livre",
        last_message_at: new Date().toISOString(),
        metadata: {
          meli_question_id: q.id,
          meli_item_id: q.item_id,
          meli_buyer_id: q.from?.id,
          item_title: itemTitle,
        },
      })
      .select("id, status, assigned_to")
      .single();
    if (convError || !newConv) {
      console.error("[meli-webhook] Failed to create conversation:", convError);
      return;
    }
    conversationId = newConv.id;
    conversationSnapshot = newConv;
  }

  // Avoid duplicate inbound when the same question fires multiple webhooks
  const externalMsgId = `meli_q_${q.id}`;
  const { data: existingMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("external_message_id", externalMsgId)
    .maybeSingle();

  if (!existingMsg) {
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      direction: "inbound",
      sender_type: "customer",
      sender_name: senderName,
      content: q.text || "",
      content_type: "text",
      delivery_status: "delivered",
      external_message_id: externalMsgId,
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
    channel_type: "mercadolivre",
    conversation: conversationSnapshot,
  });

  console.log(
    `[meli-webhook] AI gate: should_respond=${finalDecision.should_respond} reason=${finalDecision.reason}`,
  );

  if (finalDecision.should_respond) {
    const res = await invokeAiSupportChat(supabaseUrl, serviceKey, {
      conversation_id: conversationId,
      tenant_id: tenantId,
    });
    console.log(`[meli-webhook] AI invoke (${res.status}):`, res.bodyText);
  }
}
