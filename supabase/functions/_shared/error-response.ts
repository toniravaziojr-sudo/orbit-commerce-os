/**
 * error-response.ts — Helper padronizado de resposta de erro para Edge Functions
 * 
 * Garante que NENHUMA edge function vaze informação técnica no body da resposta.
 * Erros técnicos vão para console.error (logs do servidor), nunca para o cliente.
 * 
 * @version 1.0.0
 * 
 * Contrato de resposta:
 * {
 *   success: false,
 *   error: "Mensagem operacional em PT-BR",
 *   code: "TECH_CODE",
 *   category: "validation" | "permission" | "auth" | "network" | "technical",
 *   retryable: boolean,
 *   request_id?: string
 * }
 */

type ErrorCategory = 'permission' | 'validation' | 'auth' | 'network' | 'technical';

interface ErrorResponseOptions {
  /** Módulo do sistema (ex: "products", "orders") — para logging */
  module?: string;
  /** Ação que falhou (ex: "create", "update") — para logging */
  action?: string;
  /** ID de rastreio da requisição */
  requestId?: string;
  /** Sobrescrever mensagem operacional */
  overrideMessage?: string;
  /** Sobrescrever código */
  overrideCode?: string;
  /** Sobrescrever categoria */
  overrideCategory?: ErrorCategory;
}

// ── Mapeamento interno (servidor) ───────────────────────────────────
interface SanitizedResult {
  message: string;
  code: string;
  category: ErrorCategory;
  retryable: boolean;
}

const PG_CODE_MAP: Record<string, SanitizedResult> = {
  '23505': { message: 'Esse registro já existe.', code: 'DUPLICATE_KEY', category: 'validation', retryable: false },
  '42501': { message: 'Você não tem permissão para esta ação.', code: 'PERMISSION_DENIED', category: 'permission', retryable: false },
  '42P01': { message: 'Erro interno. Tente novamente.', code: 'RELATION_NOT_FOUND', category: 'technical', retryable: false },
  '23503': { message: 'Este item está vinculado a outros registros.', code: 'FOREIGN_KEY_VIOLATION', category: 'validation', retryable: false },
  '23514': { message: 'Dados inválidos. Verifique os campos.', code: 'CHECK_VIOLATION', category: 'validation', retryable: false },
  '42703': { message: 'Erro interno. Tente novamente.', code: 'COLUMN_NOT_FOUND', category: 'technical', retryable: false },
};

interface PatternMatch {
  patterns: string[];
  result: SanitizedResult;
}

const PATTERN_MATCHES: PatternMatch[] = [
  {
    patterns: ['jwt expired', 'token expired', 'pgrst301'],
    result: { message: 'Sessão expirada. Faça login novamente.', code: 'SESSION_EXPIRED', category: 'auth', retryable: false },
  },
  {
    patterns: ['invalid claim', 'missing sub', 'jwt malformed'],
    result: { message: 'Sessão inválida. Faça login novamente.', code: 'INVALID_SESSION', category: 'auth', retryable: false },
  },
  {
    patterns: ['row-level security', 'rls', 'not authorized'],
    result: { message: 'Você não tem permissão para esta ação.', code: 'RLS_DENIED', category: 'permission', retryable: false },
  },
  {
    patterns: ['duplicate key', 'unique constraint', 'unique violation'],
    result: { message: 'Esse registro já existe.', code: 'DUPLICATE_KEY', category: 'validation', retryable: false },
  },
  {
    patterns: ['foreign key', 'still referenced'],
    result: { message: 'Este item está vinculado a outros registros.', code: 'FOREIGN_KEY_VIOLATION', category: 'validation', retryable: false },
  },
  {
    patterns: ['rate limit', 'too many requests'],
    result: { message: 'Limite de requisições. Aguarde alguns minutos.', code: 'RATE_LIMITED', category: 'technical', retryable: true },
  },
  {
    patterns: ['(#100) invalid parameter'],
    result: { message: 'Parâmetro inválido na Meta.', code: 'META_INVALID_PARAM', category: 'validation', retryable: false },
  },
  {
    patterns: ['(#10) permission', 'oauthexception'],
    result: { message: 'Permissão negada pela Meta. Reconecte sua conta.', code: 'META_AUTH_ERROR', category: 'auth', retryable: false },
  },
];

function sanitize(error: unknown): SanitizedResult {
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  const lower = rawMsg.toLowerCase();

  // Código Postgres via Supabase error shape
  const pgCode = (error as any)?.code;
  if (typeof pgCode === 'string' && PG_CODE_MAP[pgCode]) {
    return PG_CODE_MAP[pgCode];
  }

  // Pattern matching
  for (const pm of PATTERN_MATCHES) {
    if (pm.patterns.some(p => lower.includes(p))) {
      return pm.result;
    }
  }

  // Fallback
  return {
    message: 'Erro interno. Se o problema persistir, entre em contato com o suporte.',
    code: 'INTERNAL_ERROR',
    category: 'technical',
    retryable: true,
  };
}

/**
 * Retorna um Response padronizado para erros em Edge Functions.
 * 
 * @example
 * catch (error) {
 *   return errorResponse(error, corsHeaders, { module: 'products', action: 'create' });
 * }
 */
export function errorResponse(
  error: unknown,
  corsHeaders: Record<string, string>,
  options: ErrorResponseOptions = {}
): Response {
  const rawMsg = error instanceof Error ? error.message : String(error || '');
  const result = sanitize(error);

  // Log COMPLETO no servidor (nunca vai para o cliente)
  const logContext = [
    options.module && `module=${options.module}`,
    options.action && `action=${options.action}`,
    options.requestId && `request_id=${options.requestId}`,
    `code=${result.code}`,
  ].filter(Boolean).join(' ');

  console.error(`[ErrorResponse][${logContext}]`, rawMsg, error);

  // Resposta limpa para o cliente
  const body = {
    success: false as const,
    error: options.overrideMessage || result.message,
    code: options.overrideCode || result.code,
    category: options.overrideCategory || result.category,
    retryable: result.retryable,
    ...(options.requestId && { request_id: options.requestId }),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Retorna um Response de validação (dados inválidos enviados pelo cliente).
 * 
 * @example
 * if (!body.email) {
 *   return validationError('Email é obrigatório', corsHeaders);
 * }
 */
export function validationError(
  message: string,
  corsHeaders: Record<string, string>,
  options?: { code?: string; requestId?: string }
): Response {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    code: options?.code || 'VALIDATION_ERROR',
    category: 'validation',
    retryable: false,
    ...(options?.requestId && { request_id: options.requestId }),
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Retorna um Response de sucesso padronizado.
 */
export function successResponse(
  data: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify({ success: true, ...data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Meta Graph API specific errors ─────────────────────────────────

const META_ERROR_MAP: Record<number, string> = {
  4: 'Limite de requisições da Meta atingido. Aguarde alguns minutos.',
  10: 'Permissão negada pela Meta. Verifique as permissões do aplicativo.',
  100: 'Parâmetro inválido na Meta. Verifique a configuração.',
  190: 'Token da Meta expirado ou revogado. Reconecte sua conta.',
  200: 'Permissão da Meta insuficiente. Reconecte com as permissões necessárias.',
  368: 'Bloqueio temporário da Meta por uso excessivo. Aguarde.',
  803: 'Recurso não encontrado na Meta. Verifique se ainda existe.',
};

const META_SUBCODE_MAP: Record<number, string> = {
  458: 'Token de usuário expirado. Reconecte sua conta Meta.',
  459: 'Sessão Meta inválida. Reconecte sua conta.',
  460: 'Senha Meta alterada. Reconecte sua conta.',
  463: 'Token expirado. Reconecte sua conta Meta.',
  467: 'Token inválido. Reconecte sua conta Meta.',
  2388001: 'A Meta rejeitou a requisição. Verifique os parâmetros.',
  2388023: 'Este recurso já existe na Meta.',
  2388366: 'Número já verificado na Meta.',
  136025: 'Número registrado em outra conta. Desregistre primeiro.',
};

/**
 * Sanitiza erro da Graph API da Meta e retorna Response padronizado.
 * 
 * @example
 * const result = await graphApi(...);
 * if (result.error) {
 *   return metaApiErrorResponse(result.error, corsHeaders, { module: 'ads' });
 * }
 */
export function metaApiErrorResponse(
  metaError: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string; type?: string },
  corsHeaders: Record<string, string>,
  options?: { module?: string; requestId?: string }
): Response {
  const rawMsg = metaError?.message || 'Erro desconhecido da Meta';

  // Log completo no servidor
  console.error(`[MetaApiError]${options?.module ? `[${options.module}]` : ''}`, {
    message: rawMsg,
    code: metaError?.code,
    subcode: metaError?.error_subcode,
    fbtrace_id: metaError?.fbtrace_id,
    type: metaError?.type,
  });

  // Resolve mensagem: subcode > code > pattern > fallback
  let userMessage: string;
  let techCode: string;

  if (metaError?.error_subcode && META_SUBCODE_MAP[metaError.error_subcode]) {
    userMessage = META_SUBCODE_MAP[metaError.error_subcode];
    techCode = `META_SUBCODE_${metaError.error_subcode}`;
  } else if (metaError?.code && META_ERROR_MAP[metaError.code]) {
    userMessage = META_ERROR_MAP[metaError.code];
    techCode = `META_CODE_${metaError.code}`;
  } else {
    // Pattern match on message
    const result = sanitize(new Error(rawMsg));
    userMessage = result.message;
    techCode = result.code;
  }

  const body = {
    success: false as const,
    error: userMessage,
    code: techCode,
    category: 'technical' as ErrorCategory,
    retryable: metaError?.code === 4 || metaError?.code === 368,
    ...(options?.requestId && { request_id: options.requestId }),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
