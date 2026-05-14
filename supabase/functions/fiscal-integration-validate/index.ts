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
interface Card {
  key: string;
  level: CardLevel;
  title: string;
  message: string;
  status_label?: string;
  details?: Record<string, unknown>;
}

type OverallStatus =
  | "ready"            // produção pronta para emitir
  | "ready_for_test"   // homologação pronta para smoke test
  | "config_pending"   // falta uma ação objetiva do usuário (ex: token)
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
        title: "Configuração fiscal",
        message: "Configuração fiscal não encontrada para esta loja.",
        status_label: "Configurar",
      });
      return new Response(
        JSON.stringify({
          success: true,
          overall_status: "config_pending" as OverallStatus,
          next_action_label: "Preencha os dados fiscais da loja.",
          ready_for_production: false,
          cards,
        }),
        { status: 200, headers: corsHeaders },
      );
    }

    const ambiente = (settings.focus_ambiente || settings.ambiente || "homologacao") as
      | "homologacao" | "producao";

    // -------- Token do tenant (por ambiente) --------
    const tenantTokenRes = await loadFocusTenantToken(serviceClient, tenantId, ambiente);
    const tenantTokenOk = tenantTokenRes.ok;
    const otherAmbiente = ambiente === "producao" ? "homologacao" : "producao";
    const otherTokenRes = await loadFocusTenantToken(serviceClient, tenantId, otherAmbiente);

    // -------- Token administrativo da conta --------
    const accountCreds = resolveFocusCredentials({ ambiente, operationKind: "account_admin" });
    const accountTokenOk = accountCreds.ok && !!accountCreds.token;

    // -------- 1) Empresa fiscal cadastrada --------
    let focusCompanyOk = false;
    let focusCompanyVerifiedRemote: boolean | null = null;
    if (!settings.focus_empresa_id) {
      cards.push({
        key: "focus_company",
        level: "error",
        title: "Empresa fiscal cadastrada",
        message: "Empresa ainda não foi sincronizada com o provedor fiscal.",
        status_label: "Sincronizar",
      });
    } else if (!accountTokenOk) {
      // Sem token admin não dá pra confirmar remoto; UI não deve gritar.
      focusCompanyOk = true; // local OK
      cards.push({
        key: "focus_company",
        level: "pending",
        title: "Empresa fiscal cadastrada",
        message: "Empresa cadastrada localmente. Configure a conta principal do provedor para validar remotamente.",
        status_label: "Cadastrada",
        details: { focus_empresa_id: settings.focus_empresa_id, remote_check: false },
      });
    } else if (!tenantTokenOk) {
      // Cadastro local existe; falta token da empresa para checar remoto.
      focusCompanyOk = true;
      cards.push({
        key: "focus_company",
        level: "pending",
        title: "Empresa fiscal cadastrada",
        message: ambiente === "homologacao"
          ? "Cadastre o token de homologação da empresa para validar no provedor."
          : "Cadastre o token de produção da empresa para validar no provedor.",
        status_label: "Aguardando credencial",
        details: { focus_empresa_id: settings.focus_empresa_id, remote_check: false },
      });
    } else {
      // Tenta confirmar remoto (best-effort).
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
        title: "Empresa fiscal cadastrada",
        message: focusCompanyVerifiedRemote
          ? "Empresa confirmada no provedor fiscal."
          : focusCompanyVerifiedRemote === false
          ? "Empresa não localizada no provedor. Verifique o cadastro."
          : "Não foi possível confirmar agora — tente novamente em instantes.",
        status_label: focusCompanyVerifiedRemote ? "Validada" : focusCompanyVerifiedRemote === false ? "Não localizada" : "Aguardando",
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
        key: "certificate", level: "error",
        title: "Certificado A1 válido",
        message: "Certificado não enviado.",
        status_label: "Enviar certificado",
      });
    } else if (certValidUntil.getTime() < Date.now()) {
      cards.push({
        key: "certificate", level: "error",
        title: "Certificado A1 válido",
        message: "Certificado vencido. Renove para emitir notas.",
        status_label: "Vencido",
        details: { valid_until: certValidUntil.toISOString() },
      });
    } else if (!cnpjMatches) {
      cards.push({
        key: "certificate", level: "error",
        title: "Certificado A1 válido",
        message: "CNPJ do certificado não bate com o emitente.",
        status_label: "CNPJ divergente",
      });
    } else {
      certOk = true;
      cards.push({
        key: "certificate", level: "ok",
        title: "Certificado A1 válido",
        message: `Válido até ${certValidUntil.toLocaleDateString("pt-BR")}.`,
        status_label: "Válido",
        details: { valid_until: certValidUntil.toISOString() },
      });
    }

    // -------- 3) Token do tenant (cards explícitos) --------
    cards.push({
      key: "tenant_token",
      level: tenantTokenOk ? "ok" : "warn",
      title: ambiente === "producao" ? "Token de produção da empresa" : "Token de homologação da empresa",
      message: tenantTokenOk
        ? "Configurado."
        : ambiente === "producao"
          ? "Cadastre o token de produção da empresa em Credenciais do provedor fiscal."
          : "Cadastre o token de homologação da empresa em Credenciais do provedor fiscal.",
      status_label: tenantTokenOk ? "Configurado" : "Configure o token",
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
    let webhookMsg = "Não configurado.";
    let webhookStatusLabel = "Não configurado";

    if (!tenantTokenOk) {
      webhookCardLevel = "warn";
      webhookMsg = ambiente === "homologacao"
        ? "Configure o token de homologação para ativar."
        : "Configure o token de produção para ativar.";
      webhookStatusLabel = "Aguardando token";
    } else if (autoActivationAttempted && !autoActivationSucceeded) {
      webhookCardLevel = "error";
      webhookMsg = `Erro na ativação automática: ${autoActivationError ?? "tente novamente."}`;
      webhookStatusLabel = "Erro na ativação";
    } else if (webhookStatus === "validated" && webhookEnvMatchesAmbiente) {
      webhookCardLevel = "ok";
      webhookMsg = "Recebimento automático ativo.";
      webhookStatusLabel = "Validado";
    } else if (webhookStatus === "pending" && webhookEnvMatchesAmbiente) {
      webhookCardLevel = "pending";
      webhookMsg = "Cadastrado. Será confirmado no primeiro retorno da NF de teste.";
      webhookStatusLabel = "Aguardando primeiro retorno";
    } else if (webhookStatus === "error") {
      webhookCardLevel = "error";
      webhookMsg = "Erro na ativação. Use 'Tentar novamente'.";
      webhookStatusLabel = "Erro";
    } else if (!webhookEnvMatchesAmbiente && webhookStatus) {
      webhookCardLevel = "warn";
      webhookMsg = `Cadastrado em ${settings.webhook_environment} mas o ambiente atual é ${ambiente}.`;
      webhookStatusLabel = "Ambiente divergente";
    }

    cards.push({
      key: "webhook",
      level: webhookCardLevel,
      title: "Recebimento automático de retornos",
      message: webhookMsg,
      status_label: webhookStatusLabel,
      details: {
        status: webhookStatus,
        environment: settings.webhook_environment,
        url: settings.webhook_url_sanitized,
        focus_hook_id: settings.webhook_focus_hook_id,
        registered_at: settings.webhook_registered_at,
        validated_at: settings.webhook_validated_at,
        last_received_at: settings.webhook_last_received_at,
        last_error: settings.webhook_last_error,
        last_error_at: settings.webhook_last_error_at,
        auto_activation_attempted: autoActivationAttempted,
        auto_activation_succeeded: autoActivationSucceeded,
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
      overall = "error";
      nextAction = !settings.focus_empresa_id
        ? "Sincronize a empresa fiscal."
        : "Resolva o problema do certificado A1.";
    } else if (!tenantTokenOk) {
      overall = "config_pending";
      nextAction = ambiente === "homologacao"
        ? "Cadastre o token de homologação da empresa em 'Credenciais do provedor fiscal'."
        : "Cadastre o token de produção da empresa em 'Credenciais do provedor fiscal'.";
    } else if (autoActivationAttempted && !autoActivationSucceeded) {
      overall = "error";
      nextAction = "Tentar novamente a ativação do recebimento automático.";
      canRetryActivation = true;
    } else if (webhookStatus === "error") {
      overall = "error";
      nextAction = "Tentar novamente a ativação do recebimento automático.";
      canRetryActivation = true;
    } else if (ambiente === "producao") {
      // Produção: precisa webhook validated.
      if (webhookStatus === "validated" && webhookEnvMatchesAmbiente) {
        overall = "ready";
      } else {
        overall = "blocked";
        nextAction = webhookStatus === "pending"
          ? "Aguardando primeiro retorno para validar o recebimento automático."
          : "Ative e valide o recebimento automático antes de emitir em produção.";
      }
    } else {
      // Homologação: pending OU validated => pronto para teste
      if (webhookValidatedOrPending) {
        overall = "ready_for_test";
      } else {
        overall = "config_pending";
        nextAction = "Recebimento automático ainda não está ativo.";
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
