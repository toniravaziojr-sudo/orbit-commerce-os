import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { shouldAiRespond, invokeAiSupportChat } from "../_shared/should-ai-respond.ts";
import { mapMeliItemToLocal, type LocalStatus } from "./status-mapper.ts";

// v3.0.0 — Sincronização bidirecional em tempo real (items + items_prices + questions)
const VERSION = "v3.0.0";

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

    const { resource, user_id, topic, sent } = notification;
    if (!resource || !user_id || !topic) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid notification format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up the active connection (real column names: external_user_id / is_active)
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("marketplace", "mercadolivre")
      .eq("external_user_id", String(user_id))
      .eq("is_active", true)
      .maybeSingle();

    if (connError || !connection) {
      console.error("[meli-webhook] Connection not found for user_id:", user_id, connError);
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Audit log
    await supabase.from("marketplace_sync_logs").insert({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      marketplace: "mercadolivre",
      sync_type: `webhook_${topic}`,
      status: "pending",
      details: { notification, resource, topic },
    });

    // Real-time signal indicator (powers the "sincronizado em tempo real" UI badge)
    await supabase
      .from("marketplace_connections")
      .update({ last_webhook_at: new Date().toISOString() })
      .eq("id", connection.id);

    // Route by topic
    if (topic === "questions") {
      try {
        await ingestQuestion(supabase, supabaseUrl, supabaseKey, connection, resource);
      } catch (e) {
        console.error("[meli-webhook] ingestQuestion error:", e);
      }
    } else if (topic === "items" || topic === "items_prices") {
      try {
        await syncItemFromWebhook(supabase, connection, resource, sent);
      } catch (e) {
        console.error("[meli-webhook] syncItemFromWebhook error:", e);
      }
    } else if (topic === "orders_v2" || topic === "orders") {
      // Entrada automática de pedidos no módulo central
      try {
        const orderId = String(resource).split("/").pop();
        if (orderId) {
          await fetch(`${supabaseUrl}/functions/v1/meli-sync-orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
            body: JSON.stringify({ tenantId: connection.tenant_id, orderId }),
          });
        }
      } catch (e) {
        console.error("[meli-webhook] orders sync trigger error:", e);
      }
    } else if (topic === "shipments") {
      // Etiqueta liberada / tracking atualizado — Logística Externa
      try {
        const shipmentId = String(resource).split("/").pop();
        if (shipmentId) {
          await fetch(`${supabaseUrl}/functions/v1/meli-fetch-shipment`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
            body: JSON.stringify({ tenantId: connection.tenant_id, shipmentId }),
          });
        }
      } catch (e) {
        console.error("[meli-webhook] shipments sync trigger error:", e);
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

// ============================================================
// items / items_prices — real-time listing sync (ML → System)
// ============================================================
async function syncItemFromWebhook(
  supabase: any,
  connection: any,
  resource: string,
  sent?: string,
) {
  const itemId = resource.split("/").pop();
  if (!itemId) return;

  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    console.warn(`[meli-webhook] ML token expired for tenant ${connection.tenant_id}; cron will reconcile`);
    return;
  }

  const { data: listing } = await supabase
    .from("meli_listings")
    .select("id, status, last_status_change_at")
    .eq("tenant_id", connection.tenant_id)
    .eq("meli_item_id", itemId)
    .maybeSingle();

  if (!listing) {
    console.log(`[meli-webhook] No local listing for ${itemId}; ignoring`);
    return;
  }

  // Out-of-order protection
  if (sent && listing.last_status_change_at) {
    const sentTs = new Date(sent).getTime();
    const localTs = new Date(listing.last_status_change_at).getTime();
    if (!Number.isNaN(sentTs) && sentTs < localTs - 1000) {
      console.log(`[meli-webhook] Stale notification (sent=${sent} < local=${listing.last_status_change_at}); skipping`);
      return;
    }
  }

  const mlRes = await fetch(
    `https://api.mercadolibre.com/items/${itemId}?attributes=id,status,sub_status,price,available_quantity,permalink,shipping`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } },
  );

  if (mlRes.status === 404) {
    const everPublished = ["published", "paused", "inactive"].includes(listing.status as LocalStatus);
    if (!everPublished) {
      await supabase.from("meli_listings").delete().eq("id", listing.id);
      console.log(`[meli-webhook] Item ${itemId} 404 + never published → deleted locally`);
    } else {
      await supabase.from("meli_listings").update({
        status: "inactive",
        inactive_reason: "Excluído no Mercado Livre",
        error_message: "Excluído no Mercado Livre",
        last_status_change_source: "meli",
      }).eq("id", listing.id);
      console.log(`[meli-webhook] Item ${itemId} 404 + was published → inactive`);
    }
    return;
  }

  if (!mlRes.ok) {
    console.error(`[meli-webhook] ML API error for ${itemId}: ${mlRes.status}`);
    return;
  }

  const mlItem = await mlRes.json();
  const mapped = mapMeliItemToLocal(mlItem, listing.status as LocalStatus);

  if (mapped.action === "delete") {
    await supabase.from("meli_listings").delete().eq("id", listing.id);
    console.log(`[meli-webhook] Item ${itemId} closed+deleted → deleted locally`);
    return;
  }

  const update: Record<string, any> = {
    status: mapped.status,
    last_status_change_source: "meli",
    updated_at: new Date().toISOString(),
  };
  if (mapped.error_message !== undefined) update.error_message = mapped.error_message;
  if (mapped.inactive_reason !== undefined) update.inactive_reason = mapped.inactive_reason;
  if (typeof mlItem.price === "number") update.price = mlItem.price;
  if (typeof mlItem.available_quantity === "number") update.available_quantity = mlItem.available_quantity;
  if (mlItem.permalink) update.meli_response = { permalink: mlItem.permalink };
  if (mlItem.shipping && typeof mlItem.shipping === "object") update.shipping = mlItem.shipping;

  await supabase.from("meli_listings").update(update).eq("id", listing.id);
  console.log(`[meli-webhook] Item ${itemId}: ${listing.status} → ${mapped.status} (ML: ${mlItem.status})`);
}


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
