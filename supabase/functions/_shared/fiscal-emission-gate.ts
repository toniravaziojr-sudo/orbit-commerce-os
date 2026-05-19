// fiscal-emission-gate.ts
// Lote 1.E — Gate de produção e alerta de homologação para emissão/submissão NF-e.
// Garante pré-requisitos antes de qualquer transmissão real à Focus/Sefaz.
//
// Em PRODUÇÃO: bloqueia se webhook != validated, empresa Focus ausente,
// certificado ausente/vencido/CNPJ divergente, ambiente inconsistente
// ou webhook_tenant_token ausente.
//
// Em HOMOLOGAÇÃO: nunca bloqueia por webhook (permite smoke test),
// mas devolve warnings claros que devem ser propagados no payload.
//
// Pré-requisitos fiscais não-relacionados ao webhook (empresa Focus + certificado)
// continuam sendo validados em ambos os ambientes pelas funções chamadoras.

export type GateAmbiente = "homologacao" | "producao";

export interface GateResult {
  blocked: boolean;
  warnings: string[];
  error?: string;
  code?: string;
}

interface GateInput {
  ambiente: GateAmbiente;
  webhook_status?: string | null;
  webhook_environment?: string | null;
  webhook_tenant_token?: string | null;
  focus_empresa_id?: string | null;
  certificado_valido_ate?: string | null;
  certificado_cnpj?: string | null;
  cnpj?: string | null;
}

export function evaluateEmissionGate(input: GateInput): GateResult {
  const warnings: string[] = [];
  const ambiente = input.ambiente;

  const webhookStatus = (input.webhook_status || "not_configured").toLowerCase();
  const webhookEnv = input.webhook_environment || null;
  const webhookEnvMatches = !webhookEnv || webhookEnv === ambiente;
  const hasTenantToken = !!input.webhook_tenant_token;

  if (ambiente === "producao") {
    if (!input.focus_empresa_id) {
      return {
        blocked: true,
        warnings,
        error: "Empresa não cadastrada na Focus NFe. Sincronize antes de emitir em produção.",
        code: "focus_company_missing",
      };
    }
    if (!input.certificado_valido_ate) {
      return {
        blocked: true,
        warnings,
        error: "Certificado A1 ausente. Envie o certificado antes de emitir em produção.",
        code: "certificate_missing",
      };
    }
    if (new Date(input.certificado_valido_ate).getTime() < Date.now()) {
      return {
        blocked: true,
        warnings,
        error: "Certificado A1 vencido. Substitua antes de emitir em produção.",
        code: "certificate_expired",
      };
    }
    const cnpjEmit = (input.cnpj || "").replace(/\D/g, "");
    const cnpjCert = (input.certificado_cnpj || "").replace(/\D/g, "");
    if (cnpjEmit && cnpjCert && cnpjEmit !== cnpjCert) {
      return {
        blocked: true,
        warnings,
        error: "CNPJ do certificado diverge do CNPJ do emitente.",
        code: "certificate_cnpj_mismatch",
      };
    }
    // Aceita "validated" (já confirmado) ou "pending" (registrado na Focus, aguardando 1º retorno).
    // O status "pending" só é gravado após sucesso no cadastro remoto na Focus, então é seguro
    // permitir a 1ª emissão — é justamente ela que dispara o callback que valida o webhook
    // (chicken-and-egg: sem 1ª emissão, nunca sai de pending).
    if (webhookStatus !== "validated" && webhookStatus !== "pending") {
      return {
        blocked: true,
        warnings,
        error:
          "Recebimento automático de retornos ainda não está preparado. Reprocesse a configuração fiscal antes de emitir em produção.",
        code: "webhook_not_validated",
      };
    }
    if (webhookStatus === "pending") {
      warnings.push(
        "Recebimento automático em preparação — será confirmado na primeira nota emitida.",
      );
    }
    if (!webhookEnvMatches) {
      return {
        blocked: true,
        warnings,
        error:
          `Webhook está cadastrado em ${webhookEnv} mas o ambiente fiscal é ${ambiente}. Recadastre antes de emitir.`,
        code: "webhook_environment_mismatch",
      };
    }
    if (!hasTenantToken) {
      return {
        blocked: true,
        warnings,
        error:
          "Configuração segura do webhook ausente (token por loja). Cadastre o webhook antes de emitir em produção.",
        code: "webhook_tenant_token_missing",
      };
    }
    return { blocked: false, warnings };
  }

  // HOMOLOGAÇÃO — nunca bloqueia por webhook, apenas alerta.
  if (webhookStatus === "not_configured") {
    warnings.push(
      "Webhook Focus NFe ainda não foi cadastrado para este tenant. Smoke test permitido em homologação, mas obrigatório antes de produção.",
    );
  } else if (webhookStatus === "pending") {
    warnings.push(
      "Webhook cadastrado mas ainda não validado (aguardando primeira chamada da Focus). Smoke test permitido em homologação.",
    );
  } else if (webhookStatus === "error") {
    warnings.push(
      "Último cadastro do webhook falhou. Smoke test permitido em homologação, mas recadastre antes de produção.",
    );
  }
  if (webhookEnv && !webhookEnvMatches) {
    warnings.push(
      `Webhook foi cadastrado em ${webhookEnv} mas o ambiente fiscal atual é ${ambiente}.`,
    );
  }
  return { blocked: false, warnings };
}
