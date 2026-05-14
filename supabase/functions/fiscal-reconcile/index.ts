// fiscal-reconcile — Lote 1.D
// Reconciliação segura de NF-e presas em pending/processing/error.
//
// MODO PADRÃO: MANUAL / DRY-RUN.
// - Não há cron ativo. Acionado sob demanda.
// - Aceita chamada por:
//   (a) usuário owner/admin do tenant — processa apenas notas do tenant atual; OU
//   (b) service_role com tenant_id explícito no body — uso interno (smoke test).
// - Default: dry_run=true. Apenas relata o que faria, sem chamar Focus NFe.
// - Para realmente consultar Focus, exige dry_run=false E (FISCAL_RECONCILE_ENABLED=true OU
//   tenant pertence a FISCAL_RECONCILE_TENANT_ALLOWLIST OU ambiente=homologacao).
// - Nunca sobrescreve status terminal (authorized/cancelled/rejected).
// - Limite: max_attempts=5 por nota; após isso fica como 'error' até intervenção manual.
// - Backoff mínimo: 60s entre tentativas para a mesma nota.

import { createClient } from "npm:@supabase/supabase-js@2";
import { requireFiscalRole } from "../_shared/fiscal-role-check.ts";
import { getNFeStatus, type FocusNFeConfig } from "../_shared/focus-nfe-client.ts";
import { mapFocusStatusToInternal } from "../_shared/focus-nfe-adapter.ts";
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const TERMINAL = new Set(["authorized", "cancelled", "rejected"]);
const RECONCILABLE = new Set(["pending", "processing", "error"]);
const MAX_ATTEMPTS = 5;
const BACKOFF_SECONDS = 60;
const HARD_LIMIT = 25; // máximo de notas por chamada

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  await loadPlatformCredentials();

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Token resolvido por tenant + ambiente abaixo (operação fiscal de NF).

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const dryRun = body.dry_run !== false; // default true
  const invoiceId: string | undefined = body.invoice_id;
  const requestedTenantId: string | undefined = body.tenant_id;
  const limit = Math.min(Math.max(Number(body.limit) || 10, 1), HARD_LIMIT);

  // ── AUTH: service_role OR owner/admin ─────────────────────────────────
  const authHeader = req.headers.get("Authorization") || "";
  const isServiceRole = authHeader === `Bearer ${SERVICE_KEY}`;

  let tenantId: string;
  let actor: string;

  if (isServiceRole) {
    if (!requestedTenantId) {
      return ok({ success: false, error: "tenant_id é obrigatório em chamadas internas" }, 200);
    }
    tenantId = requestedTenantId;
    actor = "service_role";
  } else {
    const auth = await requireFiscalRole(req, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    tenantId = auth.tenantId;
    actor = `user:${auth.user.id}`;
    // Usuário comum não pode passar tenant_id diferente do seu
    if (requestedTenantId && requestedTenantId !== tenantId) {
      return ok({ success: false, error: "Não é permitido reconciliar notas de outro tenant" }, 200);
    }
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── FEATURE FLAG / ESCOPO SEGURO ─────────────────────────────────────
  const flagEnabled = Deno.env.get("FISCAL_RECONCILE_ENABLED") === "true";
  const allowlist = (Deno.env.get("FISCAL_RECONCILE_TENANT_ALLOWLIST") || "")
    .split(",").map(s => s.trim()).filter(Boolean);
  const inAllowlist = allowlist.includes(tenantId);

  // Buscar ambiente do tenant
  const { data: settings } = await sb
    .from("fiscal_settings")
    .select("focus_ambiente, ambiente")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const ambiente = (settings?.focus_ambiente || settings?.ambiente || "homologacao") as
    "homologacao" | "producao";

  const isHomologacao = ambiente === "homologacao";
  const canCallFocus = !dryRun && (flagEnabled || inAllowlist || isHomologacao);

  // ── SELEÇÃO DAS NOTAS ────────────────────────────────────────────────
  let q = sb
    .from("fiscal_invoices")
    .select("id, status, focus_ref, reconcile_attempts, last_reconcile_at, ambiente, tenant_id")
    .eq("tenant_id", tenantId)
    .not("focus_ref", "is", null)
    .in("status", Array.from(RECONCILABLE))
    .lt("reconcile_attempts", MAX_ATTEMPTS)
    .order("last_reconcile_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  if (invoiceId) q = q.eq("id", invoiceId);

  const { data: invoices, error: selErr } = await q;
  if (selErr) {
    console.error("[fiscal-reconcile] select error", selErr.message);
    return ok({ success: false, error: "Falha ao listar notas" }, 200);
  }

  const now = Date.now();
  const eligible = (invoices || []).filter((inv) => {
    if (TERMINAL.has(inv.status)) return false;
    if (!inv.last_reconcile_at) return true;
    const last = new Date(inv.last_reconcile_at).getTime();
    return (now - last) >= BACKOFF_SECONDS * 1000;
  });

  const report: any[] = [];

  // ── DRY RUN: apenas relatar ──────────────────────────────────────────
  if (!canCallFocus) {
    for (const inv of eligible) {
      report.push({
        invoice_id: inv.id,
        current_status: inv.status,
        attempts: inv.reconcile_attempts,
        action: "would_check",
      });
    }
    return ok({
      success: true,
      mode: dryRun ? "dry_run" : "blocked_by_scope",
      ambiente,
      actor,
      tenant_id: tenantId,
      eligible_count: eligible.length,
      report,
      reason_if_blocked: !canCallFocus && !dryRun
        ? "Reconciliação real exige FISCAL_RECONCILE_ENABLED=true, tenant em allowlist, ou ambiente=homologacao"
        : undefined,
    }, 200);
  }

  // ── EXECUÇÃO REAL ────────────────────────────────────────────────────
  if (!focusToken) {
    return ok({ success: false, error: "Token Focus NFe não configurado" }, 200);
  }

  const focusConfig: FocusNFeConfig = { token: focusToken, ambiente };

  for (const inv of eligible) {
    const attempt = (inv.reconcile_attempts || 0) + 1;
    try {
      const result = await getNFeStatus(focusConfig, inv.focus_ref!);

      if (!result.success) {
        // Erro técnico — registra tentativa, não rebaixa status
        await sb.from("fiscal_invoices")
          .update({
            reconcile_attempts: attempt,
            last_reconcile_at: new Date().toISOString(),
            last_reconcile_error: String(result.error).slice(0, 500),
          })
          .eq("id", inv.id)
          .eq("tenant_id", tenantId);

        report.push({ invoice_id: inv.id, action: "tech_error", attempt, error: result.error });
        continue;
      }

      const focusStatus = result.data?.status || "processando_autorizacao";
      const internal = mapFocusStatusToInternal(focusStatus);

      // Idempotência: nunca sobrescrever terminal
      if (TERMINAL.has(inv.status) && inv.status !== internal) {
        report.push({
          invoice_id: inv.id,
          action: "noop_terminal_preserved",
          status: inv.status,
        });
        continue;
      }

      const update: any = {
        reconcile_attempts: attempt,
        last_reconcile_at: new Date().toISOString(),
        last_reconcile_error: null,
        updated_at: new Date().toISOString(),
      };

      if (inv.status !== internal) {
        update.status = internal;
        update.status_motivo = result.data?.mensagem_sefaz || null;

        if (focusStatus === "autorizado" && result.data?.chave_nfe) {
          update.chave_acesso = result.data.chave_nfe;
          update.numero = result.data.numero;
          update.serie = result.data.serie;
          update.authorized_at = new Date().toISOString();
        }
      }

      await sb.from("fiscal_invoices")
        .update(update)
        .eq("id", inv.id)
        .eq("tenant_id", tenantId);

      // Evento (sem XML completo, sem token, sem dado sensível)
      if (inv.status !== internal) {
        await sb.from("fiscal_invoice_events").insert({
          invoice_id: inv.id,
          tenant_id: tenantId,
          event_type: focusStatus === "autorizado" ? "authorized" : "reconcile_status_change",
          event_data: {
            from: inv.status,
            to: internal,
            focus_status: focusStatus,
            mensagem_sefaz: result.data?.mensagem_sefaz,
            actor,
            attempt,
          },
        });
      }

      report.push({
        invoice_id: inv.id,
        action: inv.status !== internal ? "status_updated" : "no_change",
        from: inv.status,
        to: internal,
        focus_status: focusStatus,
        attempt,
      });
    } catch (err: any) {
      console.error("[fiscal-reconcile] error invoice", inv.id, err?.message);
      await sb.from("fiscal_invoices")
        .update({
          reconcile_attempts: attempt,
          last_reconcile_at: new Date().toISOString(),
          last_reconcile_error: String(err?.message || err).slice(0, 500),
        })
        .eq("id", inv.id)
        .eq("tenant_id", tenantId);
      report.push({ invoice_id: inv.id, action: "exception", attempt });
    }
  }

  return ok({
    success: true,
    mode: "executed",
    ambiente,
    actor,
    tenant_id: tenantId,
    processed: report.length,
    report,
  }, 200);
});
