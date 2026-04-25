// ============================================================
// d7-media-harness — Harness técnico ISOLADO para D7
//
// Fases:
//  A. Cria mensagem+anexo (image+audio), enfileira na ai_media_queue,
//     processa, e valida persistência do resultado.
//  B. Cria nova mensagem com pending_media_processing=true e simula
//     o gate de mídia do ai-support-chat (waitAndCollectMediaContext)
//     para validar que o resultado entra no contexto e a flag de
//     pendência é limpa.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { waitAndCollectMediaContext } from "../_shared/media-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TENANT_ID = "d1a4d0ed-8842-495e-b741-540a9a345b25";
const CONVERSATION_ID = "00000d10-d10d-d10d-d10d-d10d10d10d10";

// URLs estáveis e aceitas pela OpenAI Vision/Whisper
const TEST_IMAGE_URL = "https://picsum.photos/id/237/400/300.jpg";
const TEST_AUDIO_URL = "https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const out: Record<string, unknown> = {};

  // ============================================================
  // FASE A — Pipeline básico: queue + processamento + persistência
  // ============================================================

  // ===== A1. Mensagem com IMAGEM =====
  const { data: msgImg, error: e1 } = await supabase.from("messages").insert({
    conversation_id: CONVERSATION_ID,
    tenant_id: TENANT_ID,
    direction: "inbound",
    sender_type: "customer",
    sender_name: "Tester D7",
    content: "[imagem]",
    content_type: "image",
  }).select("id").single();
  if (e1) return new Response(JSON.stringify({ step: "msg_img", error: e1.message }), { status: 500 });
  out.message_id_image = msgImg.id;

  const { data: attImg, error: e2 } = await supabase.from("message_attachments").insert({
    message_id: msgImg.id,
    tenant_id: TENANT_ID,
    file_name: "test.jpg",
    file_path: `harness/d7/${crypto.randomUUID()}.jpg`,
    file_url: TEST_IMAGE_URL,
    mime_type: "image/jpeg",
  }).select("id").single();
  if (e2) return new Response(JSON.stringify({ step: "att_img", error: e2.message }), { status: 500 });
  out.attachment_id_image = attImg.id;

  const { data: qImg, error: e3 } = await supabase.from("ai_media_queue").insert({
    tenant_id: TENANT_ID,
    message_id: msgImg.id,
    attachment_id: attImg.id,
    process_type: "vision",
    status: "queued",
    next_retry_at: new Date().toISOString(),
  }).select("id").single();
  if (e3) return new Response(JSON.stringify({ step: "queue_img", error: e3.message }), { status: 500 });
  out.queue_id_image = qImg.id;

  // ===== A2. Mensagem com ÁUDIO =====
  const { data: msgAud, error: e4 } = await supabase.from("messages").insert({
    conversation_id: CONVERSATION_ID,
    tenant_id: TENANT_ID,
    direction: "inbound",
    sender_type: "customer",
    sender_name: "Tester D7",
    content: "[audio]",
    content_type: "audio",
  }).select("id").single();
  if (e4) return new Response(JSON.stringify({ step: "msg_aud", error: e4.message }), { status: 500 });
  out.message_id_audio = msgAud.id;

  const { data: attAud, error: e5 } = await supabase.from("message_attachments").insert({
    message_id: msgAud.id,
    tenant_id: TENANT_ID,
    file_name: "example.ogg",
    file_path: `harness/d7/${crypto.randomUUID()}.ogg`,
    file_url: TEST_AUDIO_URL,
    mime_type: "audio/ogg",
  }).select("id").single();
  if (e5) return new Response(JSON.stringify({ step: "att_aud", error: e5.message }), { status: 500 });
  out.attachment_id_audio = attAud.id;

  const { data: qAud, error: e6 } = await supabase.from("ai_media_queue").insert({
    tenant_id: TENANT_ID,
    message_id: msgAud.id,
    attachment_id: attAud.id,
    process_type: "transcription",
    status: "queued",
    next_retry_at: new Date().toISOString(),
  }).select("id").single();
  if (e6) return new Response(JSON.stringify({ step: "queue_aud", error: e6.message }), { status: 500 });
  out.queue_id_audio = qAud.id;

  // ===== A3. Dispara o processador =====
  const { data: procResult, error: procErr } = await supabase.functions.invoke("ai-media-queue-process", {
    body: { limit: 5 },
  });
  out.processor_result = procErr ? { error: procErr.message } : procResult;

  // ============================================================
  // FASE B — Gate do chat: prova de consumo no contexto + anti-loop
  // ============================================================

  // B1. Cria uma mensagem NOVA marcada como pending_media_processing,
  //     reaproveitando os anexos já processados (status=done na fila).
  const pendingMediaPayload = [
    { attachment_id: attImg.id, process_type: "vision", enqueued_at: new Date().toISOString() },
    { attachment_id: attAud.id, process_type: "transcription", enqueued_at: new Date().toISOString() },
  ];

  const { data: msgGate, error: e7 } = await supabase.from("messages").insert({
    conversation_id: CONVERSATION_ID,
    tenant_id: TENANT_ID,
    direction: "inbound",
    sender_type: "customer",
    sender_name: "Tester D7 Gate",
    content: "Olha essa imagem e esse áudio",
    content_type: "text",
    metadata: {
      pending_media_processing: true,
      pending_media: pendingMediaPayload,
    },
  }).select("id, metadata").single();
  if (e7) return new Response(JSON.stringify({ step: "msg_gate", error: e7.message }), { status: 500 });
  out.message_id_gate = msgGate.id;

  // B2. PRIMEIRA chamada ao gate — fila já está done → deve retornar context_block populado e limpar pending.
  const gate1 = await waitAndCollectMediaContext(supabase, {
    id: msgGate.id,
    metadata: msgGate.metadata as Record<string, unknown>,
  });
  out.gate_first_call = {
    had_pending: gate1.had_pending,
    all_ready: gate1.all_ready,
    context_block: gate1.context_block,
    wait_reply: gate1.wait_reply ?? null,
    attachment_count: gate1.attachment_ids.length,
  };

  // B3. Verifica que pending_media_processing foi limpo (ponto 6).
  const { data: msgAfter } = await supabase
    .from("messages")
    .select("metadata")
    .eq("id", msgGate.id)
    .single();
  out.message_after_gate = msgAfter?.metadata ?? null;

  // B4. Cria uma SEGUNDA mensagem para testar o anti-loop com timeout.
  //     Usa attachment_id fake (não existe na fila) → gate vai dar timeout.
  const fakeAttachmentId = crypto.randomUUID();
  const { data: msgLoop, error: e8 } = await supabase.from("messages").insert({
    conversation_id: CONVERSATION_ID,
    tenant_id: TENANT_ID,
    direction: "inbound",
    sender_type: "customer",
    sender_name: "Tester D7 Loop",
    content: "Mídia que nunca chega",
    content_type: "text",
    metadata: {
      pending_media_processing: true,
      pending_media: [
        { attachment_id: fakeAttachmentId, process_type: "vision", enqueued_at: new Date().toISOString() },
      ],
    },
  }).select("id, metadata").single();
  if (e8) return new Response(JSON.stringify({ step: "msg_loop", error: e8.message }), { status: 500 });
  out.message_id_loop = msgLoop.id;

  // 1ª chamada → deve retornar wait_reply (mídia não pronta)
  const loop1 = await waitAndCollectMediaContext(supabase, {
    id: msgLoop.id,
    metadata: msgLoop.metadata as Record<string, unknown>,
  });
  out.loop_first_call = {
    had_pending: loop1.had_pending,
    all_ready: loop1.all_ready,
    wait_reply_sent: loop1.wait_reply !== null && loop1.wait_reply !== undefined,
    wait_already_sent: loop1.wait_already_sent === true,
  };

  // 2ª chamada → deve detectar wait_already_sent e NÃO mandar de novo
  const { data: msgLoopAfter } = await supabase
    .from("messages")
    .select("metadata")
    .eq("id", msgLoop.id)
    .single();
  const loop2 = await waitAndCollectMediaContext(supabase, {
    id: msgLoop.id,
    metadata: msgLoopAfter?.metadata as Record<string, unknown>,
  });
  out.loop_second_call = {
    had_pending: loop2.had_pending,
    wait_reply_returned_again: loop2.wait_reply !== null && loop2.wait_reply !== undefined,
    wait_already_sent: loop2.wait_already_sent === true,
  };
  out.message_loop_after = msgLoopAfter?.metadata ?? null;

  // ============================================================
  // RESUMO FINAL — checklist explícito dos 6 pontos
  // ============================================================
  const { data: finalQueueState } = await supabase
    .from("ai_media_queue")
    .select("id, process_type, status, processed_at, result")
    .in("id", [qImg.id, qAud.id]);

  const visionRow = finalQueueState?.find((r) => r.process_type === "vision");
  const audioRow = finalQueueState?.find((r) => r.process_type === "transcription");

  const point1 = !!msgImg.id && !!attImg.id && !!msgAud.id && !!attAud.id;
  const point2 = !!qImg.id && !!qAud.id;
  const point3 =
    visionRow?.status === "done" && !!visionRow.processed_at && !!visionRow.result &&
    audioRow?.status === "done" && !!audioRow.processed_at && !!audioRow.result;
  const point4 =
    gate1.all_ready === true &&
    gate1.context_block.includes("[ANEXO IMAGEM") &&
    gate1.context_block.includes("[ANEXO ÁUDIO TRANSCRITO");
  const point5 =
    loop1.wait_reply !== null && loop1.wait_reply !== undefined &&
    loop2.wait_reply == null &&
    loop2.wait_already_sent === true;
  const point6 =
    (msgAfter?.metadata as any)?.pending_media_processing === false &&
    !!(msgAfter?.metadata as any)?.pending_media_consumed_at;

  out.D7_CHECKLIST = {
    "1_media_entered_flow": point1,
    "2_queue_correct_type": point2,
    "3_consumer_processed_persisted": point3,
    "4_chat_consumed_in_context": point4,
    "5_anti_loop_single_wait": point5,
    "6_state_cleanup": point6,
    ALL_PASSED: point1 && point2 && point3 && point4 && point5 && point6,
  };

  return new Response(JSON.stringify({ ok: true, ...out }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
