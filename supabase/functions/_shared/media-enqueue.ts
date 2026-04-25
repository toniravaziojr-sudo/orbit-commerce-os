// ============================================================
// media-enqueue — Utilitário compartilhado de enfileiramento de mídia
//
// Responsabilidades:
//  1. Resolver URL real (WhatsApp Graph API quando necessário).
//  2. Registrar anexo em message_attachments com dedup estável.
//  3. Enfileirar em ai_media_queue apenas para tipos suportados:
//       - image/* -> vision
//       - audio/* -> transcription
//       - video/* -> NÃO enfileira (apenas anexo, marcado unsupported_for_ai)
//       - application/* (documento) -> NÃO enfileira (idem)
//  4. Marcar a mensagem como pending_media_processing=true em metadata.
//  5. Disparar processador da fila em fire-and-forget.
//  6. Logar todas as etapas com prefixo [media-enqueue].
//
// Tudo non-throw: nunca derruba o webhook que chama.
// ============================================================
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type SupportedProcessType = "vision" | "transcription";

export interface MediaEnqueueInput {
  tenant_id: string;
  message_id: string;
  /** ID estável da mídia para dedup (ex: WhatsApp media id, ou hash da URL para IG). */
  external_media_id: string;
  /** mime_type cru recebido (ex: "image/jpeg"). */
  mime_type: string;
  /** Nome do arquivo, opcional. */
  file_name?: string;
  /** URL pública (Instagram já entrega; WhatsApp precisa resolver via Graph). */
  file_url?: string;
  /** Para WhatsApp: ID interno da Graph API para resolver URL. */
  whatsapp_media_id?: string;
  /** Token da Graph API (somente WhatsApp). */
  whatsapp_access_token?: string;
}

export interface MediaEnqueueResult {
  ok: boolean;
  attachment_id?: string;
  queue_id?: string;
  process_type?: SupportedProcessType | null;
  unsupported_for_ai?: boolean;
  reason?: string;
}

/**
 * Mapeia mime_type -> process_type. null = não enfileirar.
 */
export function classifyMime(mime: string): SupportedProcessType | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "vision";
  if (m.startsWith("audio/")) return "transcription";
  return null; // video/*, application/*, etc -> apenas registra anexo
}

/**
 * Resolve URL pública de mídia do WhatsApp via Graph API.
 * Retorna null em qualquer falha.
 */
async function resolveWhatsAppMediaUrl(
  mediaId: string,
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error(`[media-enqueue] WhatsApp media lookup failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data?.url || null;
  } catch (err) {
    console.error("[media-enqueue] WhatsApp media lookup threw:", err);
    return null;
  }
}

/**
 * Marca a mensagem como aguardando processamento de mídia.
 * Idempotente: usa merge no metadata.
 */
async function markMessagePendingMedia(
  supabase: SupabaseClient,
  messageId: string,
  attachmentId: string,
  processType: SupportedProcessType,
): Promise<void> {
  try {
    const { data: msg } = await supabase
      .from("messages")
      .select("metadata")
      .eq("id", messageId)
      .single();

    const currentMeta = (msg?.metadata as Record<string, unknown>) || {};
    const currentPending = (currentMeta.pending_media as Array<Record<string, unknown>>) || [];

    // Dedup por attachment_id
    if (currentPending.some((p) => p.attachment_id === attachmentId)) {
      return;
    }

    const newMeta = {
      ...currentMeta,
      pending_media_processing: true,
      pending_media: [
        ...currentPending,
        {
          attachment_id: attachmentId,
          process_type: processType,
          enqueued_at: new Date().toISOString(),
        },
      ],
    };

    await supabase.from("messages").update({ metadata: newMeta }).eq("id", messageId);
  } catch (err) {
    console.error("[media-enqueue] markMessagePendingMedia failed (non-blocking):", err);
  }
}

/**
 * Função principal: enfileira mídia no pipeline de IA.
 * Sempre retorna; nunca lança.
 */
export async function enqueueMedia(
  input: MediaEnqueueInput,
): Promise<MediaEnqueueResult> {
  const logCtx = `msg=${input.message_id} ext=${input.external_media_id}`;
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const processType = classifyMime(input.mime_type);

    // ===== 1. Resolver URL =====
    let fileUrl = input.file_url || null;
    if (!fileUrl && input.whatsapp_media_id && input.whatsapp_access_token) {
      console.log(`[media-enqueue] Resolving WhatsApp URL for ${logCtx}`);
      fileUrl = await resolveWhatsAppMediaUrl(
        input.whatsapp_media_id,
        input.whatsapp_access_token,
      );
    }

    if (!fileUrl) {
      console.warn(`[media-enqueue] No URL resolved, skipping ${logCtx}`);
      return { ok: false, reason: "no_url_resolved" };
    }

    // ===== 2. Dedup attachment por (message_id, external_media_id) =====
    // Usa metadata.external_media_id como chave estável.
    const { data: existingAtt } = await supabase
      .from("message_attachments")
      .select("id, metadata")
      .eq("message_id", input.message_id)
      .eq("tenant_id", input.tenant_id)
      .contains("metadata", { external_media_id: input.external_media_id })
      .maybeSingle();

    let attachmentId: string;
    if (existingAtt) {
      attachmentId = existingAtt.id;
      console.log(`[media-enqueue] Attachment já existe (dedup) ${logCtx} att=${attachmentId}`);
    } else {
      const isUnsupported = processType === null;
      const { data: newAtt, error: insErr } = await supabase
        .from("message_attachments")
        .insert({
          message_id: input.message_id,
          tenant_id: input.tenant_id,
          file_name: input.file_name || `media-${input.external_media_id}`,
          file_path: `inbound/${input.tenant_id}/${input.external_media_id}`,
          file_url: fileUrl,
          mime_type: input.mime_type,
          metadata: {
            external_media_id: input.external_media_id,
            unsupported_for_ai: isUnsupported,
            source: "webhook_inbound",
          },
        })
        .select("id")
        .single();

      if (insErr || !newAtt) {
        console.error(`[media-enqueue] Failed to insert attachment ${logCtx}:`, insErr);
        return { ok: false, reason: "attachment_insert_failed" };
      }
      attachmentId = newAtt.id;
      console.log(`[media-enqueue] Attachment registrado ${logCtx} att=${attachmentId}`);
    }

    // ===== 3. Tipos não suportados: para por aqui =====
    if (processType === null) {
      console.log(`[media-enqueue] Tipo ${input.mime_type} não suportado para IA — apenas anexo registrado ${logCtx}`);
      return {
        ok: true,
        attachment_id: attachmentId,
        process_type: null,
        unsupported_for_ai: true,
        reason: "unsupported_mime_type",
      };
    }

    // ===== 4. Dedup item de fila por (attachment_id, process_type) =====
    const { data: existingQueue } = await supabase
      .from("ai_media_queue")
      .select("id, status")
      .eq("attachment_id", attachmentId)
      .eq("process_type", processType)
      .in("status", ["queued", "processing", "done"])
      .maybeSingle();

    let queueId: string;
    if (existingQueue) {
      queueId = existingQueue.id;
      console.log(`[media-enqueue] Item de fila já existe (dedup) ${logCtx} queue=${queueId} status=${existingQueue.status}`);
    } else {
      const { data: newQ, error: qErr } = await supabase
        .from("ai_media_queue")
        .insert({
          tenant_id: input.tenant_id,
          message_id: input.message_id,
          attachment_id: attachmentId,
          process_type: processType,
          status: "queued",
          next_retry_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (qErr || !newQ) {
        console.error(`[media-enqueue] Failed to enqueue ${logCtx}:`, qErr);
        return { ok: false, attachment_id: attachmentId, reason: "queue_insert_failed" };
      }
      queueId = newQ.id;
      console.log(`[media-enqueue] Item enfileirado ${logCtx} queue=${queueId} type=${processType}`);
    }

    // ===== 5. Marcar mensagem como aguardando processamento =====
    await markMessagePendingMedia(supabase, input.message_id, attachmentId, processType);

    // ===== 6. Disparar processador em fire-and-forget =====
    fetch(`${supabaseUrl}/functions/v1/ai-media-queue-process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ limit: 5 }),
    }).catch((err) => {
      console.error(`[media-enqueue] Fire-and-forget processor failed (non-blocking) ${logCtx}:`, err);
    });

    return {
      ok: true,
      attachment_id: attachmentId,
      queue_id: queueId,
      process_type: processType,
    };
  } catch (err) {
    console.error(`[media-enqueue] enqueueMedia threw (non-blocking) ${logCtx}:`, err);
    return { ok: false, reason: "exception" };
  }
}
