// ============================================================
// d7-media-harness — Harness técnico ISOLADO para D7
//
// Objetivo: provar pipeline real de mídia fim a fim:
//   1. cria message + message_attachment para image/* e audio/*
//   2. enfileira na ai_media_queue (vision + transcription)
//   3. dispara ai-media-queue-process
//   4. retorna ids para inspeção
//
// NÃO mexe em fluxo principal. Usa apenas as estruturas oficiais.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TENANT_ID = "d1a4d0ed-8842-495e-b741-540a9a345b25";
const CONVERSATION_ID = "00000d10-d10d-d10d-d10d-d10d10d10d10";

// URLs públicas estáveis e leves para teste
const TEST_IMAGE_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/200px-PNG_transparency_demonstration_1.png";
const TEST_AUDIO_URL = "https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const out: Record<string, unknown> = {};

  // ===== 1. Mensagem com IMAGEM =====
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
    file_name: "test.png",
    file_url: TEST_IMAGE_URL,
    mime_type: "image/png",
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

  // ===== 2. Mensagem com ÁUDIO =====
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

  // ===== 3. Dispara o processador =====
  const { data: procResult, error: procErr } = await supabase.functions.invoke("ai-media-queue-process", {
    body: { limit: 5 },
  });
  out.processor_result = procErr ? { error: procErr.message } : procResult;

  return new Response(JSON.stringify({ ok: true, ...out }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
