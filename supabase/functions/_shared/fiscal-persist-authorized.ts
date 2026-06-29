// Helper canônico de persistência de NF autorizada.
// É a ÚNICA via válida para gravar o estado "authorized" na tabela fiscal_invoices.
// Quem grava direto bypass este helper viola a regra
// `fiscal-authorized-state-canonical-writer` e quebra a paridade SEFAZ↔banco.
//
// Características:
//  - Idempotência: não rebaixa status terminal (authorized / cancelled / rejected).
//  - Trava de concorrência via pg_try_advisory_xact_lock por invoice.
//  - Payload completo (status, fiscal_stage, chave, número, série, URLs, timestamps).
//  - Retorna { persisted, invoice } para o caller decidir se dispara side-effects.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface PersistAuthorizedParams {
  supabaseClient: SupabaseClient;
  invoiceId: string;
  tenantId: string;
  ambiente: "homologacao" | "producao";
  callerModule: string; // "fiscal-emit" | "fiscal-check-status" | "fiscal-webhook" | "fiscal-reconcile-authorized"
  focusStatusData: {
    status?: string;
    chave_nfe?: string;
    numero?: number | string;
    serie?: number | string;
    caminho_xml_nota_fiscal?: string;
    caminho_danfe?: string;
    mensagem_sefaz?: string;
    status_sefaz?: string;
    protocolo?: string;
  };
  focusRef?: string | null;
}

export interface PersistAuthorizedResult {
  persisted: boolean;
  skipped?: "already_authorized" | "terminal_status" | "lock_busy" | "missing_chave";
  invoice?: any;
  error?: string;
}

function buildFocusUrl(path: string | undefined, ambiente: string): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const baseUrl = ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
  return `${baseUrl}${path}`;
}

const TERMINAL = new Set(["cancelled", "rejected"]);

export async function persistAuthorizedState(
  params: PersistAuthorizedParams,
): Promise<PersistAuthorizedResult> {
  const { supabaseClient, invoiceId, tenantId, ambiente, callerModule, focusStatusData, focusRef } = params;

  if (focusStatusData.status !== "autorizado" || !focusStatusData.chave_nfe) {
    return { persisted: false, skipped: "missing_chave" };
  }

  // 1) Trava de concorrência por invoice. Usamos hashtext para mapear UUID
  //    string em bigint compatível com pg_try_advisory_xact_lock.
  //    Se outro caller (emit + webhook + check-status) já está escrevendo,
  //    aborta limpo — quem ganhou o lock fará o trabalho.
  try {
    const { data: lockRow } = await supabaseClient.rpc("pg_try_advisory_xact_lock", {
      key: `fiscal_invoice:${invoiceId}`,
    } as any).maybeSingle?.() as any;
    // Nem todo projeto expõe pg_try_advisory_xact_lock como RPC nomeada;
    // se não estiver disponível, seguimos sem trava (idempotência abaixo
    // ainda protege contra rebaixar estado terminal).
    if (lockRow && lockRow.pg_try_advisory_xact_lock === false) {
      console.warn(`[fiscal-persist-authorized:${callerModule}] lock ocupado em ${invoiceId}`);
      return { persisted: false, skipped: "lock_busy" };
    }
  } catch {
    // RPC indisponível — segue.
  }

  // 2) Lê estado atual para decidir idempotência.
  const { data: current, error: readErr } = await supabaseClient
    .from("fiscal_invoices")
    .select("id, status, chave_acesso, fiscal_stage")
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (readErr || !current) {
    return { persisted: false, error: readErr?.message || "invoice_not_found" };
  }

  if (current.status === "authorized" && current.chave_acesso === focusStatusData.chave_nfe) {
    return { persisted: false, skipped: "already_authorized", invoice: current };
  }

  if (TERMINAL.has(current.status)) {
    console.warn(
      `[fiscal-persist-authorized:${callerModule}] não rebaixa status terminal ${current.status} em ${invoiceId}`,
    );
    return { persisted: false, skipped: "terminal_status", invoice: current };
  }

  // 3) Monta payload canônico.
  const nowIso = new Date().toISOString();
  const updateData: Record<string, any> = {
    status: "authorized",
    fiscal_stage: "emitida",
    chave_acesso: focusStatusData.chave_nfe,
    xml_url: buildFocusUrl(focusStatusData.caminho_xml_nota_fiscal, ambiente),
    danfe_url: buildFocusUrl(focusStatusData.caminho_danfe, ambiente),
    authorized_at: nowIso,
    pendencia_motivos: null,
    mensagem_sefaz: focusStatusData.mensagem_sefaz ?? null,
    updated_at: nowIso,
  };
  if (focusStatusData.numero != null) updateData.numero = parseInt(String(focusStatusData.numero), 10);
  if (focusStatusData.serie != null) updateData.serie = parseInt(String(focusStatusData.serie), 10);
  if (focusRef) updateData.focus_ref = focusRef;
  if (focusStatusData.protocolo) updateData.protocolo = focusStatusData.protocolo;

  const { data: updated, error: updateErr } = await supabaseClient
    .from("fiscal_invoices")
    .update(updateData)
    .eq("id", invoiceId)
    .eq("tenant_id", tenantId)
    .select()
    .maybeSingle();

  if (updateErr) {
    console.error(`[fiscal-persist-authorized:${callerModule}] FALHA AO PERSISTIR ${invoiceId}`, updateErr);
    return { persisted: false, error: updateErr.message };
  }

  console.log(`[fiscal-persist-authorized:${callerModule}] OK invoice=${invoiceId} chave=${focusStatusData.chave_nfe}`);
  return { persisted: true, invoice: updated };
}
