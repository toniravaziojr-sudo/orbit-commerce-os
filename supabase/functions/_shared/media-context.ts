// ============================================================
// media-context — Espera curta e injeção de mídia no contexto da IA
//
// Usado pelo ai-support-chat para:
//  1. Detectar mídia pendente na última mensagem do cliente.
//  2. Esperar até N segundos pela conclusão na ai_media_queue.
//  3. Injetar resultado (vision/transcription) no contexto do prompt.
//  4. Aplicar trava anti-loop da resposta de espera.
//  5. Marcar a mensagem para reprocesso único quando estourar o tempo.
// ============================================================
import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface PendingMediaEntry {
  attachment_id: string;
  process_type: "vision" | "transcription";
  enqueued_at: string;
}

export interface MediaContextResult {
  /** true se havia mídia pendente nesta mensagem (independente do desfecho). */
  had_pending: boolean;
  /** true se TODA a mídia pendente ficou pronta dentro do tempo. */
  all_ready: boolean;
  /** Texto adicional pronto para concatenar ao contexto do cliente. */
  context_block: string;
  /** Resposta de espera sugerida (ou null se não deve enviar). */
  wait_reply?: string | null;
  /** true se já havia uma resposta de espera enviada antes (anti-loop). */
  wait_already_sent?: boolean;
  /** Lista de attachments aguardados. */
  attachment_ids: string[];
}

const POLL_TIMEOUT_MS = 8000;
const POLL_INTERVAL_MS = 1000;

const WAIT_REPLY_TEXT =
  "Recebi sua mídia, só um instante enquanto eu analiso e já te respondo.";

/**
 * Verifica e aguarda mídia pendente da última mensagem do cliente.
 * Não lança; sempre retorna um resultado utilizável.
 */
export async function waitAndCollectMediaContext(
  supabase: SupabaseClient,
  lastCustomerMessage: { id: string; metadata?: Record<string, unknown> | null } | null,
): Promise<MediaContextResult> {
  const empty: MediaContextResult = {
    had_pending: false,
    all_ready: false,
    context_block: "",
    attachment_ids: [],
  };

  if (!lastCustomerMessage) return empty;
  const meta = (lastCustomerMessage.metadata ?? {}) as Record<string, unknown>;
  const pendingFlag = meta.pending_media_processing === true;
  const pending = (meta.pending_media as PendingMediaEntry[] | undefined) ?? [];

  if (!pendingFlag || pending.length === 0) return empty;

  const attachmentIds = pending.map((p) => p.attachment_id);
  const waitAlreadySent = meta.media_wait_reply_sent === true;

  console.log(
    `[media-context] msg=${lastCustomerMessage.id} pending=${pending.length} polling up to ${POLL_TIMEOUT_MS}ms`,
  );

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let queueRows: Array<{ id: string; attachment_id: string; status: string; result: any; process_type: string }> = [];

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from("ai_media_queue")
      .select("id, attachment_id, status, result, process_type")
      .in("attachment_id", attachmentIds);

    if (error) {
      console.error("[media-context] poll query error:", error);
      break;
    }
    queueRows = data ?? [];

    const allDone =
      queueRows.length === attachmentIds.length &&
      queueRows.every((r) => r.status === "done" || r.status === "failed");

    if (allDone) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  const allReady =
    queueRows.length === attachmentIds.length &&
    queueRows.every((r) => r.status === "done" || r.status === "failed");

  if (allReady) {
    // Constrói bloco de contexto com resultados.
    const blocks: string[] = [];
    for (const r of queueRows) {
      if (r.status !== "done" || !r.result) {
        blocks.push(
          r.process_type === "vision"
            ? "[ANEXO IMAGEM: não foi possível analisar a imagem]"
            : "[ANEXO ÁUDIO: não foi possível transcrever o áudio]",
        );
        continue;
      }
      if (r.process_type === "vision") {
        const desc = r.result.description || r.result.summary || "";
        const cat = r.result.category ? ` (categoria: ${r.result.category})` : "";
        blocks.push(`[ANEXO IMAGEM${cat}: ${desc}]`);
      } else if (r.process_type === "transcription") {
        const t = r.result.transcription || "";
        blocks.push(`[ANEXO ÁUDIO TRANSCRITO: ${t}]`);
      }
    }

    // Limpa a flag de pendência (mídia consumida).
    const newMeta = {
      ...meta,
      pending_media_processing: false,
      pending_media_consumed_at: new Date().toISOString(),
    };
    await supabase
      .from("messages")
      .update({ metadata: newMeta })
      .eq("id", lastCustomerMessage.id)
      .then(() => {})
      .catch((err) => console.error("[media-context] clear flag failed:", err));

    console.log(`[media-context] msg=${lastCustomerMessage.id} ALL READY (${blocks.length} blocks)`);

    return {
      had_pending: true,
      all_ready: true,
      context_block: blocks.join("\n"),
      attachment_ids: attachmentIds,
    };
  }

  // Timeout: marca para reprocesso único e devolve wait_reply (com anti-loop).
  console.log(
    `[media-context] msg=${lastCustomerMessage.id} TIMEOUT after ${POLL_TIMEOUT_MS}ms — wait_already_sent=${waitAlreadySent}`,
  );

  if (!waitAlreadySent) {
    const newMeta = {
      ...meta,
      media_wait_reply_sent: true,
      reprocess_pending: true,
      reprocess_dispatched: false,
    };
    await supabase
      .from("messages")
      .update({ metadata: newMeta })
      .eq("id", lastCustomerMessage.id)
      .then(() => {})
      .catch((err) => console.error("[media-context] mark wait failed:", err));
  }

  return {
    had_pending: true,
    all_ready: false,
    context_block: "",
    wait_reply: waitAlreadySent ? null : WAIT_REPLY_TEXT,
    wait_already_sent: waitAlreadySent,
    attachment_ids: attachmentIds,
  };
}

/**
 * Chamado pelos consumidores (vision/transcribe) ao concluir.
 * Se a mensagem origem está com reprocess_pending=true E todos os anexos
 * pendentes terminaram, dispara ai-support-chat UMA vez.
 */
export async function maybeTriggerReprocessAfterMedia(
  supabase: SupabaseClient,
  messageId: string,
  tenantId: string,
): Promise<void> {
  try {
    const { data: msg } = await supabase
      .from("messages")
      .select("id, conversation_id, metadata")
      .eq("id", messageId)
      .single();

    if (!msg) return;
    const meta = (msg.metadata ?? {}) as Record<string, unknown>;
    if (meta.reprocess_pending !== true) return;
    if (meta.reprocess_dispatched === true) return;

    const pending = (meta.pending_media as PendingMediaEntry[] | undefined) ?? [];
    if (pending.length === 0) return;

    const attachmentIds = pending.map((p) => p.attachment_id);
    const { data: rows } = await supabase
      .from("ai_media_queue")
      .select("status, attachment_id")
      .in("attachment_id", attachmentIds);

    const allFinished =
      (rows ?? []).length === attachmentIds.length &&
      (rows ?? []).every((r) => r.status === "done" || r.status === "failed");

    if (!allFinished) return;

    // Marca dispatched ANTES (anti-duplicação).
    await supabase
      .from("messages")
      .update({
        metadata: {
          ...meta,
          reprocess_dispatched: true,
          reprocess_dispatched_at: new Date().toISOString(),
        },
      })
      .eq("id", messageId);

    console.log(`[media-context] dispatching reprocess for msg=${messageId} conv=${msg.conversation_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${supabaseUrl}/functions/v1/ai-support-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        conversation_id: msg.conversation_id,
        tenant_id: tenantId,
        triggered_by: "media_reprocess",
      }),
    }).catch((err) => console.error("[media-context] reprocess fire-and-forget failed:", err));
  } catch (err) {
    console.error("[media-context] maybeTriggerReprocessAfterMedia threw:", err);
  }
}
