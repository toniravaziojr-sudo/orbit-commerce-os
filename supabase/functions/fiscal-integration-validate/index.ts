// fiscal-integration-validate
// Lote 1.E — Health check da integração Focus NFe por tenant.
// Owner/Admin only. Não transmite NF, não toca certificado, não chama Sefaz.

import { errorResponse } from "../_shared/error-response.ts";
import { requireFiscalRole } from "../_shared/fiscal-role-check.ts";

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
  details?: Record<string, unknown>;
}

function focusBaseUrl(ambiente: "homologacao" | "producao"): string {
  return ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
}
function basicAuth(token: string): string {
  return "Basic " + btoa(`${token}:`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireFiscalRole(req, ["owner", "admin"]);
    if (!auth.ok) return auth.response;
    const { tenantId, serviceClient } = auth;

    const { data: settings } = await serviceClient
      .from("fiscal_settings")
      .select(
        "tenant_id, cnpj, focus_empresa_id, focus_ambiente, ambiente, focus_company_status, certificado_valido_ate, certificado_cnpj, certificado_uploaded_at, webhook_status, webhook_environment, webhook_url_sanitized, webhook_focus_hook_id, webhook_registered_at, webhook_validated_at, webhook_last_received_at, webhook_last_error, webhook_last_error_at, provider_token",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const cards: Card[] = [];

    if (!settings) {
      cards.push({
        key: "settings",
        level: "error",
        title: "Configuração fiscal",
        message: "Configuração fiscal não encontrada para esta loja.",
      });
      return new Response(
        JSON.stringify({ success: true, ready_for_production: false, cards }),
        { status: 200, headers: corsHeaders },
      );
    }

    const ambiente = (settings.focus_ambiente || settings.ambiente || "homologacao") as
      | "homologacao" | "producao";

    // 1) Empresa Focus
    let focusCompanyOk = false;
    if (!settings.focus_empresa_id) {
      cards.push({
        key: "focus_company",
        level: "error",
        title: "Cadastro da empresa no provedor fiscal",
        message: "Empresa ainda não foi sincronizada com o provedor fiscal.",
      });
    } else {
      // Try a remote get (best-effort, doesn't fail validation if Focus is down)
      const focusToken = settings.provider_token || Deno.env.get("FOCUS_NFE_TOKEN");
      let remoteOk: boolean | null = null;
      if (focusToken && settings.cnpj) {
        try {
          const r = await fetch(
            `${focusBaseUrl(ambiente)}/v2/empresas/${encodeURIComponent(settings.cnpj)}`,
            { method: "GET", headers: { Authorization: basicAuth(focusToken) } },
          );
          remoteOk = r.ok;
        } catch { remoteOk = null; }
      }
      focusCompanyOk = remoteOk !== false;
      cards.push({
        key: "focus_company",
        level: focusCompanyOk ? "ok" : "warn",
        title: "Cadastro da empresa no provedor fiscal",
        message: focusCompanyOk
          ? "Empresa cadastrada no provedor fiscal."
          : "Não foi possível confirmar a empresa no provedor fiscal.",
        details: { focus_empresa_id: settings.focus_empresa_id },
      });
    }

    // 2) Certificado
    const certValidUntil = settings.certificado_valido_ate
      ? new Date(settings.certificado_valido_ate)
      : null;
    const cnpjMatches = settings.certificado_cnpj && settings.cnpj &&
      settings.certificado_cnpj.replace(/\D/g, "") === settings.cnpj.replace(/\D/g, "");

    let certOk = false;
    if (!certValidUntil) {
      cards.push({
        key: "certificate",
        level: "error",
        title: "Certificado A1",
        message: "Certificado não enviado.",
      });
    } else if (certValidUntil.getTime() < Date.now()) {
      cards.push({
        key: "certificate",
        level: "error",
        title: "Certificado A1",
        message: "Certificado vencido.",
        details: { valid_until: certValidUntil.toISOString() },
      });
    } else if (!cnpjMatches) {
      cards.push({
        key: "certificate",
        level: "error",
        title: "Certificado A1",
        message: "CNPJ do certificado não bate com o emitente.",
      });
    } else {
      certOk = true;
      cards.push({
        key: "certificate",
        level: "ok",
        title: "Certificado A1",
        message: `Válido até ${certValidUntil.toLocaleDateString("pt-BR")}.`,
        details: { valid_until: certValidUntil.toISOString() },
      });
    }

    // 3) Webhook
    const webhookStatus = settings.webhook_status as string;
    const webhookEnvMatchesAmbiente = !settings.webhook_environment ||
      settings.webhook_environment === ambiente;

    let webhookCardLevel: CardLevel = "warn";
    let webhookMsg = "Webhook não configurado.";
    if (webhookStatus === "validated" && webhookEnvMatchesAmbiente) {
      webhookCardLevel = "ok";
      webhookMsg = "Webhook validado e recebendo eventos.";
    } else if (webhookStatus === "pending") {
      webhookCardLevel = "pending";
      webhookMsg = "Recebimento automático cadastrado, aguardando primeira confirmação.";
    } else if (webhookStatus === "error") {
      webhookCardLevel = "error";
      webhookMsg = "Webhook com erro. Cadastre novamente.";
    } else if (!webhookEnvMatchesAmbiente) {
      webhookCardLevel = "warn";
      webhookMsg = `Webhook foi cadastrado em ${settings.webhook_environment} mas o ambiente atual é ${ambiente}.`;
    }

    cards.push({
      key: "webhook",
      level: webhookCardLevel,
      title: "Recebimento automático de retornos",
      message: webhookMsg,
      details: {
        status: webhookStatus,
        environment: settings.webhook_environment,
        url: settings.webhook_url_sanitized, // sanitized — sem segredos
        focus_hook_id: settings.webhook_focus_hook_id,
        registered_at: settings.webhook_registered_at,
        validated_at: settings.webhook_validated_at,
        last_received_at: settings.webhook_last_received_at,
        last_error: settings.webhook_last_error,
        last_error_at: settings.webhook_last_error_at,
      },
    });

    // 4) Ambiente
    cards.push({
      key: "environment",
      level: "ok",
      title: "Ambiente",
      message: ambiente === "producao" ? "Produção" : "Homologação",
      details: { ambiente },
    });

    const webhookValidated = webhookStatus === "validated" && webhookEnvMatchesAmbiente;
    const readyForProduction = focusCompanyOk && certOk && webhookValidated &&
      ambiente === "producao";
    const readyForHomologationSmoke = focusCompanyOk && certOk &&
      ambiente === "homologacao";

    return new Response(
      JSON.stringify({
        success: true,
        ambiente,
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
