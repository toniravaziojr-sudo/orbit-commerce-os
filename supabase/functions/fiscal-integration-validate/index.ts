// fiscal-integration-validate
// Health check da integração Focus NFe por tenant + ATIVAÇÃO AUTOMÁTICA do
// recebimento de retornos quando todos os pré-requisitos estiverem completos.
//
// Owner/Admin only. Não transmite NF, não toca certificado, não chama Sefaz.
// Apenas operações administrativas (consulta empresa + cadastro de webhook).

import { errorResponse } from "../_shared/error-response.ts";
import { requireFiscalRole } from "../_shared/fiscal-role-check.ts";
import { resolveFocusCredentials } from "../_shared/focus-credentials.ts";
import { loadFocusTenantToken } from "../_shared/focus-tenant-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

type CardLevel = "ok" | "warn" | "error" | "pending";
type ReasonCode =
  | "missing_company_data"
  | "certificate_missing"
  | "certificate_invalid"
  | "certificate_expired"
  | "certificate_cnpj_mismatch"
  | "provider_setup_pending"
  | "provider_setup_error"
  | "credentials_capture_error"
  | "returns_setup_pending"
  | "returns_setup_error"
  | "ready_for_test"
  | "ready_for_production"
  | "production_blocked";

interface Card {
  key: string;
  level: CardLevel;
  title: string;
  message: string;
  status_label?: string;
  // goto=true → existe campo cadastral real para o usuário corrigir.
  // Sem goto, o problema é interno (preparação/provedor) e a UI deve
  // oferecer "Reprocessar configuração fiscal" em vez de "Ir para".
  goto?: boolean;
  reason_code?: ReasonCode;
  details?: Record<string, unknown>;
}

type OverallStatus =
  | "ready"            // produção pronta para emitir
  | "ready_for_test"   // homologação pronta para smoke test
  | "config_pending"   // falta uma ação objetiva do usuário (ex: dados/cert)
  | "error"            // erro real (cert vencido, falha remota, etc.)
  | "blocked";         // produção bloqueada por requisito faltante

function basicAuth(token: string): string {
  return "Basic " + btoa(`${token}:`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireFiscalRole(req, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const { tenantId, serviceClient } = auth;

    const selectCols =
      "tenant_id, cnpj, focus_empresa_id, focus_ambiente, ambiente, focus_company_status, certificado_valido_ate, certificado_cnpj, certificado_uploaded_at, webhook_status, webhook_environment, webhook_url_sanitized, webhook_focus_hook_id, webhook_registered_at, webhook_validated_at, webhook_last_received_at, webhook_last_error, webhook_last_error_at";

    let { data: settings } = await serviceClient
      .from("fiscal_settings")
      .select(selectCols)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const cards: Card[] = [];

    if (!settings) {
      cards.push({
        key: "settings",
        level: "error",
        title: "Dados fiscais",
        message: "Configuração fiscal não encontrada para esta loja.",
        status_label: "Configurar",
        goto: true,
        reason_code: "missing_company_data",
      });
      return new Response(
        JSON.stringify({
          success: true,
          overall_status: "config_pending" as OverallStatus,
          reason_code: "missing_company_data" as ReasonCode,
          next_action_label: "Preencha os dados fiscais da loja.",
          next_action_kind: "goto" as const,
          ready_for_production: false,
          cards,
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    const ambiente = (settings.focus_ambiente || settings.ambiente || "homologacao") as
      | "homologacao" | "producao";

    // -------- Token administrativo da conta --------
    const accountCreds = resolveFocusCredentials({ ambiente, operationKind: "account_admin" });
    const accountTokenOk = accountCreds.ok && !!accountCreds.token;

    // -------- Pré-requisitos cadastrais para preparar a empresa fiscal --------
    const _certUntil = settings.certificado_valido_ate ? new Date(settings.certificado_valido_ate) : null;
    const _cnpjMatch = !!(settings.certificado_cnpj && settings.cnpj
      && settings.certificado_cnpj.replace(/\D/g, "") === settings.cnpj.replace(/\D/g, ""));
    const certCadastralOk = !!(_certUntil && _certUntil.getTime() > Date.now() && _cnpjMatch);

    // -------- Token do tenant (por ambiente) — leitura inicial --------
    let tenantTokenRes = await loadFocusTenantToken(serviceClient, tenantId, ambiente);
    let tenantTokenOk = tenantTokenRes.ok;
    const otherAmbiente = ambiente === "producao" ? "homologacao" : "producao";
    let otherTokenRes = await loadFocusTenantToken(serviceClient, tenantId, otherAmbiente);

    // -------- Auto-preparação fiscal (sem depender de "salvar campo falso") --------
    // Se a configuração está completa (cnpj + certificado válido + cnpj bate) e
    // ainda não temos credenciais da empresa OU não temos focus_empresa_id,
    // disparamos a rotina de preparação. Captura credenciais retornadas pela
    // Focus, atualiza focus_empresa_id e snapshot. NÃO emite NF.
    let autoSyncAttempted = false;
    let autoSyncSucceeded = false;
    let autoSyncError: string | null = null;
    const needsPrep = certCadastralOk && accountTokenOk
      && (!settings.focus_empresa_id || !tenantTokenOk);

    if (needsPrep) {
      autoSyncAttempted = true;
      try {
        const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fiscal-sync-focus-nfe`;
        const authHeader = req.headers.get("Authorization") || "";
        const apikey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const r = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "apikey": apikey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const json = await r.json().catch(() => ({}));
        autoSyncSucceeded = !!json?.success;
        if (!autoSyncSucceeded) {
          autoSyncError = json?.error || json?.message || "Falha ao preparar configuração fiscal.";
        }
        // Recarrega settings + tokens após o sync
        const { data: refreshed } = await serviceClient
          .from("fiscal_settings")
          .select(selectCols)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (refreshed) settings = refreshed;
        tenantTokenRes = await loadFocusTenantToken(serviceClient, tenantId, ambiente);
        tenantTokenOk = tenantTokenRes.ok;
        otherTokenRes = await loadFocusTenantToken(serviceClient, tenantId, otherAmbiente);
      } catch (e) {
        autoSyncError = (e as any)?.message || "Erro inesperado ao preparar configuração fiscal.";
      }
    }


    // Pré-checagem dos dados cadastrais e do certificado para usar nas mensagens.
    const _certValidUntilEarly = settings.certificado_valido_ate ? new Date(settings.certificado_valido_ate) : null;
    const _cnpjMatchesEarly = !!(settings.certificado_cnpj && settings.cnpj
      && settings.certificado_cnpj.replace(/\D/g, "") === settings.cnpj.replace(/\D/g, ""));
    const _certPresent = !!_certValidUntilEarly;
    const _certValid = !!(_certValidUntilEarly && _certValidUntilEarly.getTime() > Date.now() && _cnpjMatchesEarly);
    const _missingCompanyData = !settings.cnpj || (settings.cnpj || "").replace(/\D/g, "").length !== 14;

    // -------- 1) Empresa fiscal --------
    let focusCompanyOk = false;
    let focusCompanyVerifiedRemote: boolean | null = null;
    if (!settings.focus_empresa_id) {
      // Distinguir falta de dados/cert (problema do lojista) de falha real de preparação
      // (problema interno) — antes era SEMPRE "Conclua os dados e envie o certificado A1".
      if (_missingCompanyData) {
        cards.push({
          key: "focus_company",
          level: "warn",
          title: "Empresa fiscal",
          message: "Conclua os dados fiscais para preparar o cadastro da empresa.",
          status_label: "Aguardando dados",
          goto: true,
          reason_code: "missing_company_data",
        });
      } else if (!_certPresent) {
        cards.push({
          key: "focus_company",
          level: "warn",
          title: "Empresa fiscal",
          message: "Envie o certificado A1 para preparar o cadastro da empresa.",
          status_label: "Aguardando certificado",
          goto: true,
          reason_code: "certificate_missing",
        });
      } else if (!_certValid) {
        cards.push({
          key: "focus_company",
          level: "warn",
          title: "Empresa fiscal",
          message: "Resolva o problema do certificado A1 para preparar o cadastro da empresa.",
          status_label: "Aguardando certificado",
          goto: true,
          reason_code: "certificate_invalid",
        });
      } else if (autoSyncAttempted && !autoSyncSucceeded) {
        cards.push({
          key: "focus_company",
          level: "error",
          title: "Empresa fiscal",
          message: "Não foi possível preparar automaticamente. Tente reprocessar a configuração fiscal.",
          status_label: "Erro na preparação",
          reason_code: "provider_setup_error",
        });
      } else {
        cards.push({
          key: "focus_company",
          level: "pending",
          title: "Empresa fiscal",
          message: "Estamos preparando o cadastro da empresa.",
          status_label: "Preparando",
          reason_code: "provider_setup_pending",
        });
      }
    } else if (!accountTokenOk) {
      // Sem credencial administrativa central — não é problema do lojista.
      focusCompanyOk = true;
      cards.push({
        key: "focus_company",
        level: "ok",
        title: "Empresa fiscal",
        message: "Empresa cadastrada.",
        status_label: "Cadastrada",
        details: { focus_empresa_id: settings.focus_empresa_id, remote_check: false },
      });
    } else {
      // Confirmar remoto com o token administrativo (best-effort).
      try {
        const r = await fetch(
          `${accountCreds.baseUrl}/v2/empresas/${encodeURIComponent(settings.cnpj || "")}`,
          { method: "GET", headers: { Authorization: basicAuth(accountCreds.token!) } },
        );
        focusCompanyVerifiedRemote = r.ok;
      } catch { focusCompanyVerifiedRemote = null; }
      focusCompanyOk = focusCompanyVerifiedRemote !== false;
      cards.push({
        key: "focus_company",
        level: focusCompanyVerifiedRemote ? "ok" : focusCompanyVerifiedRemote === false ? "error" : "pending",
        title: "Empresa fiscal",
        message: focusCompanyVerifiedRemote
          ? "Empresa confirmada para emissão."
          : focusCompanyVerifiedRemote === false
          ? "Não conseguimos confirmar o cadastro da empresa. Tente reprocessar a configuração fiscal."
          : "Aguarde alguns instantes — estamos confirmando o cadastro.",
        status_label: focusCompanyVerifiedRemote ? "Validada" : focusCompanyVerifiedRemote === false ? "Não localizada" : "Aguardando",
        reason_code: focusCompanyVerifiedRemote === false ? "provider_setup_error" : undefined,
        details: { focus_empresa_id: settings.focus_empresa_id, remote_check: focusCompanyVerifiedRemote },
      });
    }

    // -------- 2) Certificado A1 --------
    const certValidUntil = settings.certificado_valido_ate
      ? new Date(settings.certificado_valido_ate)
      : null;
    const cnpjMatches = settings.certificado_cnpj && settings.cnpj &&
      settings.certificado_cnpj.replace(/\D/g, "") === settings.cnpj.replace(/\D/g, "");

    let certOk = false;
    if (!certValidUntil) {
      cards.push({
        key: "certificate", level: "warn",
        title: "Certificado A1",
        message: "Envie o certificado digital A1 da empresa.",
        status_label: "Enviar certificado",
        goto: true,
        reason_code: "certificate_missing",
      });
    } else if (certValidUntil.getTime() < Date.now()) {
      cards.push({
        key: "certificate", level: "error",
        title: "Certificado A1",
        message: "Certificado vencido. Renove para voltar a emitir.",
        status_label: "Vencido",
        goto: true,
        reason_code: "certificate_expired",
        details: { valid_until: certValidUntil.toISOString() },
      });
    } else if (!cnpjMatches) {
      cards.push({
        key: "certificate", level: "error",
        title: "Certificado A1",
        message: "O CNPJ do certificado não bate com o da empresa cadastrada.",
        status_label: "CNPJ divergente",
        goto: true,
        reason_code: "certificate_cnpj_mismatch",
      });
    } else {
      certOk = true;
      cards.push({
        key: "certificate", level: "ok",
        title: "Certificado A1",
        message: `Válido até ${certValidUntil.toLocaleDateString("pt-BR")}.`,
        status_label: "Válido",
        details: { valid_until: certValidUntil.toISOString() },
      });
    }

    // -------- 3) Credenciais fiscais (automáticas) --------
    const credsLevel: CardLevel = tenantTokenOk
      ? "ok"
      : (autoSyncAttempted && !autoSyncSucceeded ? "error" : "warn");
    const credsMessage = tenantTokenOk
      ? "Configuradas automaticamente."
      : (autoSyncAttempted && !autoSyncSucceeded
          ? "Não conseguimos preparar agora. Use 'Reprocessar configuração fiscal'."
          : "Serão configuradas automaticamente após você salvar os dados fiscais e enviar o certificado A1.");
    const credsLabel = tenantTokenOk
      ? "Configuradas"
      : (autoSyncAttempted && !autoSyncSucceeded ? "Erro na preparação" : "Preparando");
    cards.push({
      key: "credentials",
      level: credsLevel,
      title: "Credenciais fiscais",
      message: credsMessage,
      status_label: credsLabel,
    });

    // -------- 4) Auto-ativação do recebimento de retornos --------
    const webhookStatusBefore = settings.webhook_status as string | null;
    const webhookEnvOk = !settings.webhook_environment || settings.webhook_environment === ambiente;
    const webhookAlreadyOk = (webhookStatusBefore === "validated" || webhookStatusBefore === "pending")
      && webhookEnvOk;

    const prereqsForAutoActivation = focusCompanyOk && certOk && accountTokenOk && tenantTokenOk
      && !!settings.cnpj && !!settings.focus_empresa_id;

    let autoActivationAttempted = false;
    let autoActivationSucceeded = false;
    let autoActivationError: string | null = null;

    if (prereqsForAutoActivation && !webhookAlreadyOk) {
      autoActivationAttempted = true;
      try {
        const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/fiscal-webhook-register`;
        const authHeader = req.headers.get("Authorization") || "";
        const apikey = Deno.env.get("SUPABASE_ANON_KEY") || "";
        const r = await fetch(fnUrl, {
          method: "POST",
          headers: {
            "Authorization": authHeader,
            "apikey": apikey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const json = await r.json().catch(() => ({}));
        autoActivationSucceeded = !!json?.auto_register_succeeded;
        if (!autoActivationSucceeded) {
          autoActivationError = json?.error || "Falha ao ativar automaticamente.";
        }
        // Recarrega settings atualizado
        const { data: refreshed } = await serviceClient
          .from("fiscal_settings")
          .select(selectCols)
          .eq("tenant_id", tenantId)
          .maybeSingle();
        if (refreshed) settings = refreshed;
      } catch (e) {
        autoActivationError = (e as any)?.message || "Erro inesperado ao ativar automaticamente.";
      }
    }

    // -------- 5) Webhook (recebimento automático) --------
    const webhookStatus = settings.webhook_status as string | null;
    const webhookEnvMatchesAmbiente = !settings.webhook_environment ||
      settings.webhook_environment === ambiente;

    let webhookCardLevel: CardLevel = "warn";
    let webhookMsg = "Aguardando preparação automática.";
    let webhookStatusLabel = "Preparando";

    if (!tenantTokenOk) {
      webhookCardLevel = "warn";
      webhookMsg = "Será ativado automaticamente após a preparação fiscal.";
      webhookStatusLabel = "Preparando";
    } else if (autoActivationAttempted && !autoActivationSucceeded) {
      webhookCardLevel = "error";
      webhookMsg = "Não foi possível preparar o recebimento automático. Tente novamente.";
      webhookStatusLabel = "Erro na preparação";
    } else if (webhookStatus === "validated" && webhookEnvMatchesAmbiente) {
      webhookCardLevel = "ok";
      webhookMsg = "Ativo.";
      webhookStatusLabel = "Ativo";
    } else if (webhookStatus === "pending" && webhookEnvMatchesAmbiente) {
      webhookCardLevel = "pending";
      webhookMsg = "Será confirmado no primeiro retorno da NF de teste.";
      webhookStatusLabel = "Aguardando primeiro retorno";
    } else if (webhookStatus === "error") {
      webhookCardLevel = "error";
      webhookMsg = "Não foi possível preparar o recebimento automático. Use 'Reprocessar'.";
      webhookStatusLabel = "Erro";
    } else if (!webhookEnvMatchesAmbiente && webhookStatus) {
      webhookCardLevel = "warn";
      webhookMsg = "Ambiente atual diferente do configurado anteriormente — reprocessando.";
      webhookStatusLabel = "Reprocessando";
    }

    cards.push({
      key: "webhook",
      level: webhookCardLevel,
      title: "Recebimento de retornos",
      message: webhookMsg,
      status_label: webhookStatusLabel,
      details: {
        registered_at: settings.webhook_registered_at,
        validated_at: settings.webhook_validated_at,
        last_received_at: settings.webhook_last_received_at,
      },
    });

    // -------- 6) Ambiente --------
    cards.push({
      key: "environment",
      level: "ok",
      title: "Ambiente atual",
      message: ambiente === "producao" ? "Produção (notas com valor fiscal)" : "Homologação (testes sem valor fiscal)",
      status_label: ambiente === "producao" ? "Produção" : "Homologação",
      details: { ambiente },
    });

    // -------- 7) Status geral --------
    const webhookValidatedOrPending = (webhookStatus === "validated" || webhookStatus === "pending")
      && webhookEnvMatchesAmbiente;

    let overall: OverallStatus;
    let nextAction: string | null = null;
    let canRetryActivation = false;

    if (!certOk || !settings.focus_empresa_id) {
      overall = !settings.focus_empresa_id ? "config_pending" : "error";
      nextAction = !settings.focus_empresa_id
        ? "Conclua os dados fiscais e envie o certificado A1 para preparar a emissão automática."
        : "Resolva o problema do certificado A1.";
    } else if (!tenantTokenOk) {
      overall = "config_pending";
      nextAction = "Preparando emissão automática. Se persistir, clique em 'Reprocessar configuração fiscal'.";
      canRetryActivation = true;
    } else if (autoActivationAttempted && !autoActivationSucceeded) {
      overall = "error";
      nextAction = "Não foi possível preparar a emissão automática. Tente novamente.";
      canRetryActivation = true;
    } else if (webhookStatus === "error") {
      overall = "error";
      nextAction = "Não foi possível preparar a emissão automática. Tente novamente.";
      canRetryActivation = true;
    } else if (ambiente === "producao") {
      if (webhookStatus === "validated" && webhookEnvMatchesAmbiente) {
        overall = "ready";
      } else {
        overall = "blocked";
        nextAction = webhookStatus === "pending"
          ? "Produção bloqueada até a primeira confirmação automática de retorno."
          : "Produção bloqueada. Conclua a preparação automática antes de emitir.";
      }
    } else {
      if (webhookValidatedOrPending) {
        overall = "ready_for_test";
      } else {
        overall = "config_pending";
        nextAction = "Preparando emissão automática.";
        canRetryActivation = true;
      }
    }

    const readyForProduction = overall === "ready" && ambiente === "producao";
    const readyForHomologationSmoke = overall === "ready_for_test" && ambiente === "homologacao";

    return new Response(
      JSON.stringify({
        success: true,
        ambiente,
        overall_status: overall,
        next_action_label: nextAction,
        can_retry_activation: canRetryActivation,
        auto_activation_attempted: autoActivationAttempted,
        auto_activation_succeeded: autoActivationSucceeded,
        auto_sync_attempted: autoSyncAttempted,
        auto_sync_succeeded: autoSyncSucceeded,
        ready_for_production: readyForProduction,
        ready_for_homologation_smoke: readyForHomologationSmoke,
        cards,
      }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e: unknown) {
    return errorResponse(e, corsHeaders, { module: "fiscal", action: "integration-validate" });
  }
});
