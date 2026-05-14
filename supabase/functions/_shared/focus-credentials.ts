// ============================================================================
// FOCUS CREDENTIALS — Resolver por operação + ambiente + tenant
// ============================================================================
// Arquitetura (Onda B v2):
//   - account_admin → operações administrativas da conta Focus
//     (cadastrar/atualizar empresa, certificado, webhook, listar empresas).
//     Usa o token PRINCIPAL DA CONTA: secret global FOCUS_NFE_TOKEN.
//     Endpoint: produção (https://api.focusnfe.com.br) — é o domínio admin.
//
//   - nfe_op → operações fiscais sobre NF (emitir, consultar, cancelar,
//     CC-e, inutilização, reconciliação). Usa o TOKEN DA EMPRESA do tenant
//     no ambiente correto, lido de fiscal_settings:
//       homologacao → focus_token_homologacao
//       producao    → focus_token_producao
//
// REGRAS:
//   1. Nunca misturar tokens entre ambientes.
//   2. Nunca usar token de outro tenant.
//   3. Nunca fazer fallback silencioso (homolog↔prod) ou
//      (token de empresa ↔ token da conta).
//   4. Nunca expor o valor do token em logs ou no objeto de erro.
//   5. Se faltar o token correto, retorna erro seguro.
// ============================================================================

export type FocusAmbiente = 'homologacao' | 'producao';
export type FocusOperationKind = 'account_admin' | 'nfe_op';

export interface FocusCredentialsResult {
  ok: boolean;
  token?: string;
  baseUrl?: string;
  ambiente: FocusAmbiente;
  operationKind: FocusOperationKind;
  errorCode?:
    | 'INVALID_AMBIENTE'
    | 'INVALID_OPERATION_KIND'
    | 'ACCOUNT_TOKEN_MISSING'
    | 'TENANT_TOKEN_MISSING_HOMOLOGACAO'
    | 'TENANT_TOKEN_MISSING_PRODUCAO';
  error?: string;
}

export interface ResolveFocusCredentialsOptions {
  ambiente: string | null | undefined;
  /** Tipo de operação. 'nfe_op' (padrão) usa token do tenant.
   *  'account_admin' usa o token global da conta Focus. */
  operationKind?: FocusOperationKind;
  /** Token do tenant para o ambiente solicitado.
   *  Obrigatório quando operationKind = 'nfe_op'.
   *  O caller é responsável por ter lido a coluna correta:
   *    homologacao → focus_token_homologacao
   *    producao    → focus_token_producao */
  tenantTokenForAmbiente?: string | null;
}

const BASE_URL_BY_AMBIENTE: Record<FocusAmbiente, string> = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
};

function normalizeAmbiente(value: string | null | undefined): FocusAmbiente | null {
  if (value === 'producao' || value === 'homologacao') return value;
  return null;
}

export function resolveFocusCredentials(
  opts: ResolveFocusCredentialsOptions,
): FocusCredentialsResult {
  const operationKind: FocusOperationKind = opts.operationKind ?? 'nfe_op';
  const ambiente = normalizeAmbiente(opts.ambiente);

  if (!ambiente) {
    return {
      ok: false,
      ambiente: 'homologacao',
      operationKind,
      errorCode: 'INVALID_AMBIENTE',
      error: "Ambiente fiscal inválido. Esperado 'homologacao' ou 'producao'.",
    };
  }

  if (operationKind !== 'account_admin' && operationKind !== 'nfe_op') {
    return {
      ok: false,
      ambiente,
      operationKind,
      errorCode: 'INVALID_OPERATION_KIND',
      error: 'Tipo de operação inválido para o resolver fiscal.',
    };
  }

  // ---------------- account_admin: token global da conta ----------------
  if (operationKind === 'account_admin') {
    const accountToken = (Deno.env.get('FOCUS_NFE_TOKEN') || '').trim();
    if (accountToken.length === 0) {
      return {
        ok: false,
        ambiente,
        operationKind,
        errorCode: 'ACCOUNT_TOKEN_MISSING',
        error:
          'Token principal da conta do provedor fiscal não está configurado na plataforma. ' +
          'Cadastre-o em Integrações da Plataforma antes de operar com a conta Focus.',
      };
    }
    return {
      ok: true,
      token: accountToken,
      // Operações administrativas rodam contra o domínio de produção da Focus.
      baseUrl: BASE_URL_BY_AMBIENTE.producao,
      ambiente,
      operationKind,
    };
  }

  // ---------------- nfe_op: token da empresa do tenant -----------------
  const tenantToken = (opts.tenantTokenForAmbiente || '').trim();
  if (tenantToken.length === 0) {
    const errorCode: FocusCredentialsResult['errorCode'] =
      ambiente === 'producao'
        ? 'TENANT_TOKEN_MISSING_PRODUCAO'
        : 'TENANT_TOKEN_MISSING_HOMOLOGACAO';
    const friendly =
      ambiente === 'producao'
        ? 'Token de PRODUÇÃO da empresa não está cadastrado para esta loja. Cadastre o token de produção em Configurações Fiscais antes de operar em produção.'
        : 'Token de HOMOLOGAÇÃO da empresa não está cadastrado para esta loja. Cadastre o token de homologação em Configurações Fiscais para concluir o piloto.';
    return { ok: false, ambiente, operationKind, errorCode, error: friendly };
  }

  return {
    ok: true,
    token: tenantToken,
    baseUrl: BASE_URL_BY_AMBIENTE[ambiente],
    ambiente,
    operationKind,
  };
}

/** Conveniência: pega a baseUrl pública do ambiente. */
export function getFocusBaseUrl(ambiente: FocusAmbiente): string {
  return BASE_URL_BY_AMBIENTE[ambiente];
}
