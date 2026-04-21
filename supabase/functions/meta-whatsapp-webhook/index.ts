import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { shouldAiRespond, invokeAiSupportChat } from "../_shared/should-ai-respond.ts";
import { canonicalizeBrazilPhone, phoneVariants } from "../_shared/phone-br.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile: { name: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string;
        id: string;
        timestamp: string;
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; sha256: string; caption?: string };
        audio?: { id: string; mime_type: string };
        video?: { id: string; mime_type: string };
        document?: { id: string; filename: string; mime_type: string };
        location?: { latitude: number; longitude: number; name?: string; address?: string };
        button?: { text: string; payload: string };
        interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
      }>;
    };
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

// Wrapper legado mantido por compatibilidade com chamadas internas
// (ex.: lookup de telefones autorizados da Agenda). Agora delega para o
// helper compartilhado, garantindo que a forma canônica brasileira seja
// usada de ponta a ponta.
function normalizePhone(phone?: string | null) {
  return canonicalizeBrazilPhone(phone);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-webhook][${traceId}] Request received: ${req.method}`);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // === RAW AUDIT (anti-regressão): registra TODO POST antes de qualquer parsing ===
  let rawBodyText: string | null = null;
  if (req.method === "POST") {
    try {
      const cloned = req.clone();
      rawBodyText = await cloned.text();
      const headersObj: Record<string, string> = {};
      req.headers.forEach((v, k) => { headersObj[k] = v; });
      const url = new URL(req.url);
      await supabase.from("whatsapp_webhook_raw_audit").insert({
        trace_id: traceId,
        method: req.method,
        remote_ip: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
        user_agent: req.headers.get("user-agent"),
        signature_header: req.headers.get("x-hub-signature-256") || req.headers.get("x-hub-signature"),
        content_length: rawBodyText.length,
        body_sha256: await sha256Hex(rawBodyText),
        body_preview: rawBodyText.substring(0, 4000),
        headers_json: headersObj,
        query_string: url.search,
      });
      console.log(`[meta-whatsapp-webhook][${traceId}] RAW AUDIT logged (${rawBodyText.length} bytes)`);
    } catch (auditErr) {
      console.error(`[meta-whatsapp-webhook][${traceId}] RAW AUDIT failed:`, auditErr);
    }
  }

  try {
    // GET request: Webhook verification (Meta challenge)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      console.log(`[meta-whatsapp-webhook][${traceId}] Verification request - mode: ${mode}, token: ${token?.substring(0, 8)}...`);

      // Get verify token from platform credentials
      const { data: credential } = await supabase
        .from("platform_credentials")
        .select("credential_value")
        .eq("credential_key", "META_WEBHOOK_VERIFY_TOKEN")
        .eq("is_active", true)
        .single();

      const verifyToken = credential?.credential_value;

      if (mode === "subscribe" && token === verifyToken) {
        console.log(`[meta-whatsapp-webhook][${traceId}] Verification successful`);
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      } else {
        console.error(`[meta-whatsapp-webhook][${traceId}] Verification failed - token mismatch`);
        return new Response("Forbidden", { status: 403, headers: corsHeaders });
      }
    }

    // POST request: Receive messages and events
    if (req.method === "POST") {
      const payload: WhatsAppWebhookPayload = await req.json();
      console.log(`[meta-whatsapp-webhook][${traceId}] Webhook payload received:`, JSON.stringify(payload).substring(0, 500));

      if (payload.object !== "whatsapp_business_account") {
        console.log(`[meta-whatsapp-webhook][${traceId}] Ignoring non-WhatsApp event`);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      for (const entry of payload.entry) {
        for (const change of entry.changes) {
          if (change.field !== "messages") continue;

          const value = change.value;
          const phoneNumberId = value.metadata?.phone_number_id;

          if (!phoneNumberId) {
            console.error(`[meta-whatsapp-webhook][${traceId}] No phone_number_id in payload`);
            continue;
          }

          // Route to tenant by phone_number_id
          let tenantId: string | null = null;

          // First try: whatsapp_configs (production connections) — only active configs
          const { data: config } = await supabase
            .from("whatsapp_configs")
            .select("tenant_id")
            .eq("phone_number_id", phoneNumberId)
            .eq("provider", "meta")
            .eq("is_enabled", true)
            .single();

          if (config) {
            tenantId = config.tenant_id;
            console.log(`[meta-whatsapp-webhook][${traceId}] Routed via whatsapp_configs to tenant: ${tenantId}`);

            // === EVIDÊNCIA OPERACIONAL CANÔNICA (Fase 1 v2) ===
            // POST real chegou e foi roteado para tenant correto -> promove last_inbound_validated_at.
            // Também fecha janela de validação manual e janela de observação pós-migração.
            try {
              const nowIso = new Date().toISOString();
              await supabase
                .from("whatsapp_configs")
                .update({
                  last_inbound_at: nowIso,
                  last_inbound_validated_at: nowIso,
                  validation_window_opened_at: null,
                  migration_observation_until: null,
                  channel_state: "operational_validated",
                })
                .eq("tenant_id", tenantId)
                .eq("provider", "meta");
              console.log(`[meta-whatsapp-webhook][${traceId}] Promoted to operational_validated for tenant ${tenantId}`);
            } catch (e) {
              console.warn(`[meta-whatsapp-webhook][${traceId}] Failed to promote channel_state`, e);
            }
          }

          // Second try: test mode - check platform_credentials for test tenant
          if (!tenantId) {
            const { data: testConfig } = await supabase
              .from("platform_credentials")
              .select("credential_value")
              .eq("credential_key", "META_WHATSAPP_TEST_TENANT_ID")
              .eq("is_active", true)
              .single();

            const { data: testPhoneConfig } = await supabase
              .from("platform_credentials")
              .select("credential_value")
              .eq("credential_key", "META_WHATSAPP_TEST_PHONE_NUMBER_ID")
              .eq("is_active", true)
              .single();

            // If this phone_number_id matches the test config, route to test tenant
            if (testConfig && testPhoneConfig && testPhoneConfig.credential_value === phoneNumberId) {
              tenantId = testConfig.credential_value;
              console.log(`[meta-whatsapp-webhook][${traceId}] Routed via TEST MODE to tenant: ${tenantId}`);
            }
          }

          if (!tenantId) {
            console.error(`[meta-whatsapp-webhook][${traceId}] No tenant found for phone_number_id: ${phoneNumberId}`);
            continue;
          }

          console.log(`[meta-whatsapp-webhook][${traceId}] Processing messages for tenant: ${tenantId}`);

          // Process messages
          if (value.messages && value.messages.length > 0) {
            for (const message of value.messages) {
              const contact = value.contacts?.[0];
              const customerPhone = normalizePhone(message.from);
              const customerName = contact?.profile?.name || customerPhone;
              const destinationPhone = normalizePhone(value.metadata.display_phone_number);
              
              let messageContent = "";
              let messageType = message.type;
              let mediaUrl = null;

              if (message.type === "text" && message.text) {
                messageContent = message.text.body;
              } else if (message.type === "button" && message.button) {
                messageContent = message.button.text;
              } else if (message.type === "interactive" && message.interactive) {
                messageContent = message.interactive.button_reply?.title || 
                                message.interactive.list_reply?.title || "";
              } else if (message.type === "image" && message.image) {
                messageContent = message.image.caption || "[Imagem]";
              } else if (message.type === "audio") {
                messageContent = "[Áudio]";
              } else if (message.type === "video") {
                messageContent = "[Vídeo]";
              } else if (message.type === "document" && message.document) {
                messageContent = `[Documento: ${message.document.filename}]`;
              } else if (message.type === "location" && message.location) {
                messageContent = `[Localização: ${message.location.latitude}, ${message.location.longitude}]`;
              }

              // Save inbound message (for audit/logs)
              const { data: inboundRow, error: insertError } = await supabase
                .from("whatsapp_inbound_messages")
                .insert({
                  tenant_id: tenantId,
                  provider: "meta",
                  external_message_id: message.id,
                  from_phone: customerPhone,
                  to_phone: destinationPhone,
                  message_type: messageType,
                  message_content: messageContent,
                  media_url: mediaUrl,
                  timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
                  raw_payload: message,
                })
                .select("id")
                .single();

              if (insertError) {
                console.error(`[meta-whatsapp-webhook][${traceId}] Failed to save inbound message:`, insertError);
              }
              const inboundId = inboundRow?.id || null;

              // ═══ ROUTING DECISION: Admin (Agenda) vs Customer (Support) ═══
              const { data: authorizedPhones } = await supabase
                .from("agenda_authorized_phones")
                .select("id, phone")
                .eq("tenant_id", tenantId)
                .eq("is_active", true);

              const authorizedPhone = (authorizedPhones || []).find(
                (phone) => normalizePhone(phone.phone) === customerPhone,
              );

              if (authorizedPhone) {
                // ── ROUTE TO AGENDA AGENT ──
                console.log(`[meta-whatsapp-webhook][${traceId}] Admin phone detected, routing to Agenda agent`);
                let agendaOk = false;
                try {
                  const agendaResponse = await fetch(
                    `${supabaseUrl}/functions/v1/agenda-process-command`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${supabaseServiceKey}`,
                      },
                      body: JSON.stringify({
                        tenant_id: tenantId,
                        from_phone: customerPhone,
                        message_content: messageContent,
                        external_message_id: message.id,
                        message_type: messageType,
                      }),
                    }
                  );
                  const agendaResult = await agendaResponse.text();
                  agendaOk = agendaResponse.ok;
                  console.log(`[meta-whatsapp-webhook][${traceId}] Agenda response (${agendaResponse.status}):`, agendaResult.substring(0, 300));
                } catch (agendaError) {
                  console.error(`[meta-whatsapp-webhook][${traceId}] Agenda invocation error:`, agendaError);
                }
                // Audit loop: mark inbound as processed so we can audit downtime
                if (inboundId) {
                  await supabase
                    .from("whatsapp_inbound_messages")
                    .update({
                      processed_at: new Date().toISOString(),
                      processed_by: agendaOk ? "agenda_agent" : "agenda_failed",
                    })
                    .eq("id", inboundId);
                }
                // Admin messages do NOT create support conversations
                continue;
              }

              // ── ROUTE TO SUPPORT FLOW (Phase 1: inbound desacoplado da IA) ──
              // Ordem: (1) localizar/criar conversa SEM sobrescrever status,
              //        (2) persistir mensagem inbound,
              //        (3) só então decidir se IA responde via shared gate.
              //
              // BUG FIX (estrutural):
              //  - Lookup agora considera variantes BR (com/sem 9º dígito)
              //    para impedir conversas duplicadas pelo mesmo cliente.
              //  - Lookup INCLUI conversas resolvidas/encerradas, porque
              //    nova mensagem do cliente DEVE reabrir a conversa em vez
              //    de criar uma nova.
              //  - Spam continua excluído (intencional: silencia o contato).
              let conversationId: string | null = null;
              let existingStatus: string | null = null;
              let existingAssignedTo: string | null = null;

              const lookupPhones = phoneVariants(message.from);
              const { data: existingConv } = await supabase
                .from("conversations")
                .select("id, status, assigned_to, customer_phone")
                .eq("tenant_id", tenantId)
                .eq("channel_type", "whatsapp")
                .in("customer_phone", lookupPhones.length ? lookupPhones : [customerPhone])
                .not("status", "in", "(spam)")
                .order("last_message_at", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (existingConv) {
                conversationId = existingConv.id;
                existingStatus = existingConv.status;
                existingAssignedTo = existingConv.assigned_to;
                console.log(`[meta-whatsapp-webhook][${traceId}] Found existing conversation: ${conversationId} status=${existingStatus} assigned=${!!existingAssignedTo} stored_phone=${existingConv.customer_phone}`);

                // Regra de reabertura: se a conversa estava resolvida ou
                // encerrada, nova mensagem do cliente reabre a conversa.
                // - bot: se a IA pode responder agora
                // - waiting_agent: caso contrário (humano assume)
                // Atualização do telefone para o canônico também ocorre
                // quando o registro estava no formato legacy.
                const isClosed = existingStatus === "resolved" || existingStatus === "closed";
                const phoneNeedsUpgrade = existingConv.customer_phone !== customerPhone;
                if (isClosed || phoneNeedsUpgrade) {
                  const reopenDecision = await shouldAiRespond({
                    supabase,
                    tenant_id: tenantId,
                    channel_type: "whatsapp",
                  });
                  const reopenStatus: "bot" | "waiting_agent" = isClosed
                    ? (reopenDecision.should_respond ? "bot" : "waiting_agent")
                    : (existingStatus as "bot" | "waiting_agent");

                  const updatePayload: Record<string, unknown> = {
                    customer_phone: customerPhone,
                  };
                  if (isClosed) {
                    updatePayload.status = reopenStatus;
                    updatePayload.assigned_to = null;
                    existingStatus = reopenStatus;
                    existingAssignedTo = null;
                  }
                  const { error: reopenErr } = await supabase
                    .from("conversations")
                    .update(updatePayload)
                    .eq("id", conversationId);
                  if (reopenErr) {
                    console.error(`[meta-whatsapp-webhook][${traceId}] Failed to reopen/upgrade conversation:`, reopenErr);
                  } else if (isClosed) {
                    console.log(`[meta-whatsapp-webhook][${traceId}] Reopened conversation ${conversationId} -> ${reopenStatus}`);
                  } else {
                    console.log(`[meta-whatsapp-webhook][${traceId}] Upgraded stored phone for ${conversationId} to canonical`);
                  }
                }
              } else {
                // Decide initial status using the shared gate (NEW conversations only)
                const initialDecision = await shouldAiRespond({
                  supabase,
                  tenant_id: tenantId,
                  channel_type: "whatsapp",
                });

                const { data: newConv, error: convError } = await supabase
                  .from("conversations")
                  .insert({
                    tenant_id: tenantId,
                    channel_type: "whatsapp",
                    customer_phone: customerPhone,
                    customer_name: customerName,
                    external_conversation_id: `meta_${customerPhone}`,
                    status: initialDecision.initial_status_for_new_conversation,
                    priority: 1,
                    subject: `WhatsApp - ${customerName}`,
                    last_message_at: new Date().toISOString(),
                  })
                  .select("id, status")
                  .single();

                if (convError) {
                  console.error(`[meta-whatsapp-webhook][${traceId}] Failed to create conversation:`, convError);
                } else {
                  conversationId = newConv.id;
                  existingStatus = newConv.status;
                  console.log(`[meta-whatsapp-webhook][${traceId}] Created new conversation: ${conversationId} status=${existingStatus}`);
                }
              }

              if (conversationId) {
                const { error: msgError } = await supabase
                  .from("messages")
                  .insert({
                    conversation_id: conversationId,
                    tenant_id: tenantId,
                    direction: "inbound",
                    sender_type: "customer",
                    sender_id: null,
                    sender_name: customerName,
                    content: messageContent,
                    content_type: messageType === "text" ? "text" : messageType,
                    delivery_status: "delivered",
                    external_message_id: message.id,
                    is_ai_generated: false,
                    is_internal: false,
                    is_note: false,
                  });

                if (msgError) {
                  console.error(`[meta-whatsapp-webhook][${traceId}] Failed to create message:`, msgError);
                } else {
                  console.log(`[meta-whatsapp-webhook][${traceId}] Message persisted in support module`);

                  // CRITICAL (Phase 1): NEVER reset status here. Only update timestamps.
                  await supabase
                    .from("conversations")
                    .update({
                      last_message_at: new Date().toISOString(),
                      last_customer_message_at: new Date().toISOString(),
                    })
                    .eq("id", conversationId);

                  // === Decisão de IA via shared gate (com snapshot da conversa) ===
                  const decision = await shouldAiRespond({
                    supabase,
                    tenant_id: tenantId,
                    channel_type: "whatsapp",
                    conversation: {
                      id: conversationId,
                      status: existingStatus,
                      assigned_to: existingAssignedTo,
                    },
                  });

                  let aiOk = false;
                  if (decision.should_respond) {
                    console.log(`[meta-whatsapp-webhook][${traceId}] AI gate=GREEN, invoking ai-support-chat...`);
                    const aiRes = await invokeAiSupportChat(
                      supabaseUrl,
                      supabaseServiceKey,
                      { conversation_id: conversationId, tenant_id: tenantId },
                    );
                    aiOk = aiRes.ok;
                    console.log(`[meta-whatsapp-webhook][${traceId}] AI response (${aiRes.status}):`, aiRes.bodyText);
                  } else {
                    console.log(`[meta-whatsapp-webhook][${traceId}] AI gate=BLOCKED (${decision.reason})`);
                  }

                  if (inboundId) {
                    await supabase
                      .from("whatsapp_inbound_messages")
                      .update({
                        processed_at: new Date().toISOString(),
                        processed_by: decision.should_respond
                          ? (aiOk ? "ai_support" : "ai_failed")
                          : `gate:${decision.reason}`,
                        conversation_id: conversationId,
                      })
                      .eq("id", inboundId);
                  }
                }
              }
            }
          }

          // Process status updates (delivery receipts)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              console.log(`[meta-whatsapp-webhook][${traceId}] Status update - id: ${status.id}, status: ${status.status}`);
              
              // Update message status in whatsapp_messages table if exists
              await supabase
                .from("whatsapp_messages")
                .update({ 
                  status: status.status,
                  updated_at: new Date().toISOString()
                })
                .eq("external_message_id", status.id)
                .eq("tenant_id", tenantId);
            }
          }
        }
      }

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error(`[meta-whatsapp-webhook][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'whatsapp-webhook', action: 'process' });
  }
});
