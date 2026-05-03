import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { shouldAiRespond, invokeAiSupportChat } from "../_shared/should-ai-respond.ts";
import { canonicalizeBrazilPhone, phoneVariants } from "../_shared/phone-br.ts";
import {
  enqueueInboundForDebounce,
  tryClaimDebounceFlush,
  DEBOUNCE_WINDOW_MS,
  getAdaptiveDebounceMs,
  ADAPTIVE_DEBOUNCE_LOOKBACK_MS,
} from "../_shared/turn-dynamics.ts";
import { enqueueMedia } from "../_shared/media-enqueue.ts";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";
// [Reg #2.13] Fase C — Turn Orchestrator
import {
  classifyTurnCompleteness,
  enqueueTurnMessage,
  claimTurn,
  waitQuietWindow,
  type BufferedMessage,
} from "../_shared/sales-pipeline/turn-completeness.ts";
import {
  enqueueTurnMessage as enqTurn,
  claimTurn as claimT,
  waitQuietWindow as waitQ,
} from "../_shared/sales-pipeline/turn-orchestrator.ts";

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

              // Save inbound message (audit minimum, tolerante a falha).
              // Pacote 3: a escrita de auditoria NUNCA derruba o webhook.
              // Se falhar, segue processando normalmente; só registra no log.
              let inboundId: string | null = null;
              try {
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
                    processing_status: "received",
                  })
                  .select("id")
                  .single();
                if (insertError) {
                  console.error(`[meta-whatsapp-webhook][${traceId}] [AUDIT] inbound insert failed (non-blocking):`, insertError);
                } else {
                  inboundId = inboundRow?.id || null;
                }
              } catch (auditErr) {
                console.error(`[meta-whatsapp-webhook][${traceId}] [AUDIT] inbound insert threw (non-blocking):`, auditErr);
              }

              // ═══ CAMADA 6 (abr/2026): DEDUPE DE REDELIVERY DA META ═══
              // A Meta reentrega mensagens não confirmadas em <30s. A 2ª execução
              // reentra no INSERT (novo id), gasta 6s+ no debounce e 10-30s na IA,
              // e o runtime do edge function mata antes do `finally`. Resultado:
              // linha-filha fica para sempre em `received` sem desfecho.
              //
              // Solução: ANTES de qualquer processamento, checar se já existe
              // OUTRA linha com mesmo external_message_id já processada.
              // Se sim → marca esta como skipped/redelivery_dedup e pula tudo.
              if (inboundId && message.id) {
                try {
                  const { data: alreadyProcessed } = await supabase
                    .from("whatsapp_inbound_messages")
                    .select("id, processing_status, processed_by")
                    .eq("tenant_id", tenantId)
                    .eq("external_message_id", message.id)
                    .not("processed_at", "is", null)
                    .neq("id", inboundId)
                    .limit(1)
                    .maybeSingle();

                  if (alreadyProcessed) {
                    console.log(`[meta-whatsapp-webhook][${traceId}] REDELIVERY DEDUP: external_message_id=${message.id} já processado por sibling=${alreadyProcessed.id} (${alreadyProcessed.processing_status}/${alreadyProcessed.processed_by})`);
                    await supabase
                      .from("whatsapp_inbound_messages")
                      .update({
                        processed_at: new Date().toISOString(),
                        processed_by: "redelivery_dedup",
                        processing_status: "skipped",
                        processing_error: `Redelivery from Meta — original sibling=${alreadyProcessed.id} status=${alreadyProcessed.processing_status}`,
                      })
                      .eq("id", inboundId);
                    continue; // pula para próxima mensagem do loop
                  }
                } catch (dedupErr) {
                  console.warn(`[meta-whatsapp-webhook][${traceId}] dedup lookup failed (segue processando):`, dedupErr);
                }
              }

              // ═══ ANTI-REGRESSÃO (abr/2026): outcome SEMPRE registrado ═══
              // Defaults pessimistas — se nada atualizar, o desfecho fica
              // explícito como "silent_exit" e a watcher abre incidente.
              // Toda saída do processamento (sucesso, early return, exceção)
              // passa pelo `finally` no fim, que persiste o desfecho final.
              let outcomeStatus: string = "failed";
              let outcomeProcessedBy: string = "silent_exit";
              let outcomeError: string | null = "Pipeline ended without explicit outcome";
              let outcomeConversationId: string | null = null;

              try {
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
                // Outcome registrado pelo `finally` no fim do bloco.
                outcomeStatus = agendaOk ? "processed" : "failed";
                outcomeProcessedBy = agendaOk ? "agenda_agent" : "agenda_failed";
                outcomeError = agendaOk ? null : "agenda invocation failed";
                // Admin messages do NOT create support conversations
              } else {
              // (Customer flow continua abaixo)
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
                  outcomeStatus = "failed";
                  outcomeProcessedBy = "conversation_create_failed";
                  outcomeError = `convError: ${convError.message || String(convError)}`;
                } else {
                  conversationId = newConv.id;
                  existingStatus = newConv.status;
                  console.log(`[meta-whatsapp-webhook][${traceId}] Created new conversation: ${conversationId} status=${existingStatus}`);
                }
              }

              // Sincroniza outcome com a conversa identificada (mesmo se nula)
              outcomeConversationId = conversationId;

              if (!conversationId) {
                // Sem conversa: registra desfecho explícito (não é silêncio).
                if (outcomeStatus === "failed" && outcomeProcessedBy === "silent_exit") {
                  outcomeStatus = "failed";
                  outcomeProcessedBy = "no_conversation";
                  outcomeError = "Could not locate or create conversation";
                }
              } else {
                const { data: insertedMsg, error: msgError } = await supabase
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
                  })
                  .select("id")
                  .single();

                if (msgError) {
                  console.error(`[meta-whatsapp-webhook][${traceId}] Failed to create message:`, msgError);
                  outcomeStatus = "failed";
                  outcomeProcessedBy = "message_persist_failed";
                  outcomeError = `msgError: ${msgError.message || String(msgError)}`;
                } else {
                  console.log(`[meta-whatsapp-webhook][${traceId}] Message persisted in support module`);

                  // ═══ D7: Enfileira mídia (image/audio) ANTES da IA decidir ═══
                  // image -> vision; audio -> transcription;
                  // video/document -> apenas registra anexo (unsupported_for_ai).
                  const mediaCandidates: Array<{ id: string; mime: string; name?: string }> = [];
                  if (message.type === "image" && message.image) {
                    mediaCandidates.push({ id: message.image.id, mime: message.image.mime_type || "image/jpeg" });
                  } else if (message.type === "audio" && message.audio) {
                    mediaCandidates.push({ id: message.audio.id, mime: message.audio.mime_type || "audio/ogg" });
                  } else if (message.type === "video" && message.video) {
                    mediaCandidates.push({ id: message.video.id, mime: message.video.mime_type || "video/mp4" });
                  } else if (message.type === "document" && message.document) {
                    mediaCandidates.push({
                      id: message.document.id,
                      mime: message.document.mime_type || "application/octet-stream",
                      name: message.document.filename,
                    });
                  }

                  if (mediaCandidates.length > 0 && insertedMsg?.id) {
                    try {
                      const conn = await getMetaConnectionForTenant(supabase, tenantId, traceId);
                      const waToken = conn?.access_token || null;
                      for (const m of mediaCandidates) {
                        const result = await enqueueMedia({
                          tenant_id: tenantId,
                          message_id: insertedMsg.id,
                          external_media_id: m.id,
                          mime_type: m.mime,
                          file_name: m.name,
                          whatsapp_media_id: m.id,
                          whatsapp_access_token: waToken || undefined,
                        });
                        console.log(`[meta-whatsapp-webhook][${traceId}] media-enqueue result:`, JSON.stringify(result));
                      }
                    } catch (mediaErr) {
                      console.error(`[meta-whatsapp-webhook][${traceId}] media-enqueue threw (non-blocking):`, mediaErr);
                    }
                  }

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
                  let aiSkippedReason: string | null = null;
                  let debounceOwner = false;
                  let debounceMerged = 0;

                  if (decision.should_respond) {
                    // ── PACOTE A: Debounce/agrupamento ──
                    // Enfileira esta mensagem; se houver outra mensagem do mesmo
                    // cliente chegando dentro da janela, só a ÚLTIMA dispara a IA.
                    const enq = await enqueueInboundForDebounce({
                      supabase,
                      tenant_id: tenantId,
                      conversation_id: conversationId,
                      customer_phone: customerPhone,
                      message_id: null,
                      external_message_id: message.id,
                      message_content: messageContent,
                    });

                    if (enq.enqueued && enq.shouldWait && enq.rowId) {
                      // [ETAPA 1] Debounce ADAPTATIVO.
                      // Conta inbound recentes da MESMA conversa nos últimos 8s
                      // (excluindo a linha atual). 0 → 0ms (turno isolado),
                      // 1 → 3.5s, 2+ → 6s. `channel` reservado p/ evolução futura.
                      let recentInboundCount = 0;
                      try {
                        const sinceIso = new Date(
                          Date.now() - ADAPTIVE_DEBOUNCE_LOOKBACK_MS,
                        ).toISOString();
                        const { count } = await supabase
                          .from("whatsapp_inbound_debounce")
                          .select("id", { count: "exact", head: true })
                          .eq("tenant_id", tenantId)
                          .eq("customer_phone", customerPhone)
                          .neq("id", enq.rowId)
                          .gte("received_at", sinceIso);
                        recentInboundCount = count ?? 0;
                      } catch (lookupErr) {
                        console.warn(`[meta-whatsapp-webhook][${traceId}] adaptive debounce lookup failed (fallback to fixed):`, lookupErr);
                        recentInboundCount = 1; // fallback conservador → 3.5s
                      }
                      const adaptiveMs = getAdaptiveDebounceMs({
                        recentInboundCount,
                        channel: "whatsapp",
                      });
                      console.log(`[meta-whatsapp-webhook][${traceId}] DEBOUNCE adaptive: recent=${recentInboundCount} wait=${adaptiveMs}ms (was fixed ${DEBOUNCE_WINDOW_MS}ms)`);
                      if (adaptiveMs > 0) {
                        await new Promise((r) => setTimeout(r, adaptiveMs));
                      }
                      const claim = await tryClaimDebounceFlush(
                        supabase,
                        tenantId,
                        customerPhone,
                        enq.rowId,
                      );
                      debounceOwner = claim.isOwner;
                      debounceMerged = claim.mergedCount;

                      if (!claim.isOwner) {
                        aiSkippedReason = `debounce_merged(${claim.mergedCount})`;
                        console.log(`[meta-whatsapp-webhook][${traceId}] DEBOUNCE: not owner, merged into newer msg (${claim.mergedCount} msgs in window)`);
                      } else {
                        console.log(`[meta-whatsapp-webhook][${traceId}] DEBOUNCE: owner, flushing ${claim.mergedCount} msgs as 1 turn`);
                      }
                    }

                    if (aiSkippedReason === null) {
                      console.log(`[meta-whatsapp-webhook][${traceId}] AI gate=GREEN, invoking ai-support-chat...`);
                      const aiRes = await invokeAiSupportChat(
                        supabaseUrl,
                        supabaseServiceKey,
                        { conversation_id: conversationId, tenant_id: tenantId },
                      );
                      aiOk = aiRes.ok;
                      console.log(`[meta-whatsapp-webhook][${traceId}] AI response (${aiRes.status}):`, aiRes.bodyText);
                    }
                  } else {
                    console.log(`[meta-whatsapp-webhook][${traceId}] AI gate=BLOCKED (${decision.reason})`);
                  }

                  // Outcome final do customer flow — gravado pelo `finally`.
                  outcomeStatus = !decision.should_respond
                    ? "skipped"
                    : aiSkippedReason
                      ? "skipped"
                      : aiOk
                        ? "processed"
                        : "failed";
                  outcomeProcessedBy = !decision.should_respond
                    ? `gate:${decision.reason}`
                    : aiSkippedReason
                      ? aiSkippedReason
                      : aiOk
                        ? "ai_support"
                        : "ai_failed";
                  outcomeError = aiSkippedReason
                    ? `debounce_owner=${debounceOwner} merged=${debounceMerged}`
                    : (aiOk || !decision.should_respond ? null : "ai_support invocation failed");
                  outcomeConversationId = conversationId;
                }
              }
              } // fim do else (customer flow)
              } catch (pipelineErr) {
                // Captura qualquer exceção inesperada — outcome explícito.
                console.error(`[meta-whatsapp-webhook][${traceId}] [PIPELINE] unhandled exception:`, pipelineErr);
                outcomeStatus = "failed";
                outcomeProcessedBy = "pipeline_exception";
                outcomeError = `${(pipelineErr as Error)?.name || "Error"}: ${(pipelineErr as Error)?.message || String(pipelineErr)}`;
              } finally {
                // ═══ DESFECHO UNIVERSAL — anti-regressão silent_exit ═══
                // SEMPRE escreve um desfecho. Se o INSERT do inbound falhou,
                // ainda assim deixamos um log claro.
                if (inboundId) {
                  try {
                    await supabase
                      .from("whatsapp_inbound_messages")
                      .update({
                        processed_at: new Date().toISOString(),
                        processed_by: outcomeProcessedBy,
                        processing_status: outcomeStatus,
                        processing_error: outcomeError,
                        conversation_id: outcomeConversationId,
                      })
                      .eq("id", inboundId);
                  } catch (finalErr) {
                    console.error(`[meta-whatsapp-webhook][${traceId}] [AUDIT] FINAL desfecho update failed (non-blocking):`, finalErr);
                  }
                } else {
                  console.warn(`[meta-whatsapp-webhook][${traceId}] [AUDIT] sem inboundId — desfecho=${outcomeStatus}/${outcomeProcessedBy} err=${outcomeError}`);
                }
              }
            }
          }

          // Process status updates (delivery receipts)
          if (value.statuses && value.statuses.length > 0) {
            for (const status of value.statuses) {
              console.log(`[meta-whatsapp-webhook][${traceId}] Status update - id: ${status.id}, status: ${status.status}`);

              const nowIso = new Date().toISOString();
              const tsIso = status.timestamp
                ? new Date(Number(status.timestamp) * 1000).toISOString()
                : nowIso;

              // ===== Legacy table (compat) =====
              await supabase
                .from("whatsapp_messages")
                .update({
                  status: status.status,
                  updated_at: nowIso,
                })
                .eq("external_message_id", status.id)
                .eq("tenant_id", tenantId);

              // ===== Canonical table `messages` =====
              // Locate the outbound message by external_message_id within this tenant.
              const { data: msgRow, error: msgFindErr } = await supabase
                .from("messages")
                .select("id, delivery_status, metadata")
                .eq("external_message_id", status.id)
                .eq("tenant_id", tenantId)
                .maybeSingle();

              if (msgFindErr) {
                console.error(`[meta-whatsapp-webhook][${traceId}] Lookup error for status ${status.id}:`, msgFindErr.message);
                continue;
              }

              if (!msgRow) {
                console.warn(`[meta-whatsapp-webhook][${traceId}] No messages row found for external_message_id=${status.id} (tenant=${tenantId})`);
                continue;
              }

              // Status precedence: queued < sent < delivered < read ; failed is terminal.
              const PRECEDENCE: Record<string, number> = {
                queued: 0,
                sent: 1,
                delivered: 2,
                read: 3,
                failed: 99,
              };
              const currentRank = PRECEDENCE[msgRow.delivery_status as string] ?? -1;
              const incomingRank = PRECEDENCE[status.status] ?? -1;

              // Never downgrade (e.g. ignore late `sent` after `delivered`); always allow `failed` (terminal).
              if (incomingRank < currentRank && status.status !== "failed") {
                console.log(`[meta-whatsapp-webhook][${traceId}] Skipping downgrade ${msgRow.delivery_status} -> ${status.status} for ${msgRow.id}`);
                continue;
              }

              const updatePayload: Record<string, unknown> = {
                updated_at: nowIso,
              };
              const incomingMeta = (msgRow.metadata ?? {}) as Record<string, unknown>;
              const webhookEvents = Array.isArray((incomingMeta as any).webhook_events)
                ? [...((incomingMeta as any).webhook_events as unknown[])]
                : [];
              webhookEvents.push({
                status: status.status,
                at: tsIso,
                trace_id: traceId,
                recipient_id: status.recipient_id ?? null,
              });
              const newMeta = {
                ...incomingMeta,
                webhook_events: webhookEvents,
                last_webhook_at: tsIso,
                last_webhook_status: status.status,
              };
              updatePayload.metadata = newMeta;

              switch (status.status) {
                case "sent":
                  updatePayload.delivery_status = "sent";
                  break;
                case "delivered":
                  updatePayload.delivery_status = "delivered";
                  updatePayload.delivered_at = tsIso;
                  break;
                case "read":
                  updatePayload.delivery_status = "read";
                  updatePayload.read_at = tsIso;
                  break;
                case "failed":
                  updatePayload.delivery_status = "failed";
                  updatePayload.failed_at = tsIso;
                  updatePayload.failure_reason =
                    (status as any).errors?.[0]?.title ||
                    (status as any).errors?.[0]?.message ||
                    "Meta reported failed delivery";
                  break;
                default:
                  // Unknown status: only persist webhook event, no status change.
                  break;
              }

              const { error: updErr } = await supabase
                .from("messages")
                .update(updatePayload)
                .eq("id", msgRow.id);

              if (updErr) {
                console.error(`[meta-whatsapp-webhook][${traceId}] Update failed for ${msgRow.id}:`, updErr.message);
              } else {
                console.log(`[meta-whatsapp-webhook][${traceId}] messages updated: ${msgRow.id} -> ${status.status}`);
              }
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
