// ============================================================================
// FOCUS CREDENTIALS — Resolver único por ambiente (homologação x produção)
// ============================================================================
// Fonte de verdade para escolher token + endpoint do provedor fiscal Focus NFe.
// REGRAS (Onda B — separação estrutural por ambiente):
//   1. ambiente é obrigatório e deve ser 'homologacao' ou 'producao'.
//   2. Token é lido do slot global do ambiente correto:
//        - homologacao → FOCUS_NFE_TOKEN_HOMOLOGACAO
//        - producao    → FOCUS_NFE_TOKEN_PRODUCAO
//   3. Override por tenant (campo legado `provider_token`) só é aceito se vier
//      acompanhado de marca de ambiente confirmada. Como hoje não há essa
//      marca, o override NÃO é usado automaticamente — apenas via parâmetro
//      explícito `providerTokenOverride` quando o caller já garantiu o match.
//   4. Token global legado `FOCUS_NFE_TOKEN` (sem ambiente) NÃO é usado em
//      nenhuma hipótese — apenas registra warning de depreciação se presente.
//   5. Nunca há fallback silencioso entre ambientes.
//   6. Se não houver token para o ambiente correto, retorna erro seguro,
//      sem expor valores em log/payload.
// ============================================================================

export type FocusAmbiente = 'homologacao' | 'producao';

export interface FocusCredentialsResult {
  ok: boolean;
  token?: string;
  baseUrl?: string;
  ambiente: FocusAmbiente;
  errorCode?:
    | 'INVALID_AMBIENTE'
    | 'TOKEN_MISSING_HOMOLOGACAO'
    | 'TOKEN_MISSING_PRODUCAO';
  error?: string;
}

export interface ResolveFocusCredentialsOptions {
  ambiente: string | null | undefined;
  /**
   * Override por tenant. Use APENAS se o caller já confirmou que o token
   * pertence ao mesmo ambiente solicitado. Caso contrário, deixe undefined
   * para que o resolver use o slot global do ambiente.
   */
  providerTokenOverride?: string | null;
}

const ENV_KEY_BY_AMBIENTE: Record<FocusAmbiente, string> = {
  homologacao: 'FOCUS_NFE_TOKEN_HOMOLOGACAO',
  producao: 'FOCUS_NFE_TOKEN_PRODUCAO',
};

const BASE_URL_BY_AMBIENTE: Record<FocusAmbiente, string> = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao: 'https://api.focusnfe.com.br',
};

let legacyWarnedOnce = false;

function normalizeAmbiente(value: string | null | undefined): FocusAmbiente | null {
  if (value === 'producao' || value === 'homologacao') return value;
  return null;
}

/**
 * Resolve token + baseUrl + ambiente do provedor fiscal Focus NFe.
 * Nunca expõe valores de token em logs ou no objeto de erro.
 */
export function resolveFocusCredentials(
  opts: ResolveFocusCredentialsOptions,
): FocusCredentialsResult {
  const ambiente = normalizeAmbiente(opts.ambiente);
  if (!ambiente) {
    return {
      ok: false,
      ambiente: 'homologacao',
      errorCode: 'INVALID_AMBIENTE',
      error: "Ambiente fiscal inválido. Esperado 'homologacao' ou 'producao'.",
    };
  }

  // Warning único sobre slot legado (sem ambiente)
  const legacyToken = Deno.env.get('FOCUS_NFE_TOKEN');
  if (legacyToken && !legacyWarnedOnce) {
    legacyWarnedOnce = true;
    console.warn(
      '[focus-credentials] DEPRECATION: FOCUS_NFE_TOKEN (sem ambiente) está presente e será ignorado. ' +
        'Use FOCUS_NFE_TOKEN_HOMOLOGACAO e FOCUS_NFE_TOKEN_PRODUCAO.',
    );
  }

  // 1) Override por tenant (apenas quando explicitamente aceito pelo caller)
  const overrideToken = (opts.providerTokenOverride || '').trim();
  if (overrideToken.length > 0) {
    return {
      ok: true,
      token: overrideToken,
      baseUrl: BASE_URL_BY_AMBIENTE[ambiente],
      ambiente,
    };
  }

  // 2) Slot global do ambiente correto
  const envKey = ENV_KEY_BY_AMBIENTE[ambiente];
  const token = (Deno.env.get(envKey) || '').trim();
  if (token.length > 0) {
    return {
      ok: true,
      token,
      baseUrl: BASE_URL_BY_AMBIENTE[ambiente],
      ambiente,
    };
  }

  // 3) Erro seguro — não vazar valores
  const errorCode: FocusCredentialsResult['errorCode'] =
    ambiente === 'producao' ? 'TOKEN_MISSING_PRODUCAO' : 'TOKEN_MISSING_HOMOLOGACAO';
  const friendly =
    ambiente === 'producao'
      ? 'Token do provedor fiscal para PRODUÇÃO não está configurado. Solicite o cadastro do token de produção antes de ativar este ambiente.'
      : 'Token do provedor fiscal para HOMOLOGAÇÃO não está configurado. Solicite o cadastro do token de homologação para concluir o piloto.';

  return {
    ok: false,
    ambiente,
    errorCode,
    error: friendly,
  };
}

/**
 * Helper de conveniência: resolve apenas a baseUrl do ambiente.
 */
export function getFocusBaseUrl(ambiente: FocusAmbiente): string {
  return BASE_URL_BY_AMBIENTE[ambiente];
}
