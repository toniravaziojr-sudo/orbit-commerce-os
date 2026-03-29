/**
 * error-sanitizer.ts — Sanitizador central de erros
 * 
 * Mapeia códigos técnicos (Postgres, Meta, rede) para mensagens
 * operacionais em PT-BR. NUNCA expõe nomes de tabelas, colunas,
 * SQL ou stack traces ao usuário.
 * 
 * @version 1.0.0
 */

export type ErrorCategory = 'permission' | 'validation' | 'auth' | 'network' | 'technical';

export interface SanitizedError {
  /** Mensagem segura para exibir ao usuário (PT-BR) */
  userMessage: string;
  /** Código técnico padronizado (para logging/debug) */
  code: string;
  /** Categoria do erro */
  category: ErrorCategory;
  /** Se o usuário pode tentar novamente */
  retryable: boolean;
  /** Mensagem técnica original (NUNCA expor ao usuário) */
  _rawMessage?: string;
}

// ── Mapeamento: código Postgres → mensagem operacional ──────────────
const POSTGRES_CODE_MAP: Record<string, Pick<SanitizedError, 'userMessage' | 'code' | 'category' | 'retryable'>> = {
  '23505': {
    userMessage: 'Esse registro já existe. Verifique os dados e tente novamente.',
    code: 'DUPLICATE_KEY',
    category: 'validation',
    retryable: false,
  },
  '42501': {
    userMessage: 'Você não tem permissão para esta ação.',
    code: 'PERMISSION_DENIED',
    category: 'permission',
    retryable: false,
  },
  '42P01': {
    userMessage: 'Erro interno. Se o problema persistir, entre em contato com o suporte.',
    code: 'RELATION_NOT_FOUND',
    category: 'technical',
    retryable: false,
  },
  '23503': {
    userMessage: 'Este item está vinculado a outros registros e não pode ser alterado.',
    code: 'FOREIGN_KEY_VIOLATION',
    category: 'validation',
    retryable: false,
  },
  '23514': {
    userMessage: 'Dados inválidos. Verifique os campos e tente novamente.',
    code: 'CHECK_VIOLATION',
    category: 'validation',
    retryable: false,
  },
};

// ── Mapeamento: padrões de texto → mensagem operacional ─────────────
interface PatternRule {
  patterns: string[];
  result: Pick<SanitizedError, 'userMessage' | 'code' | 'category' | 'retryable'>;
}

const PATTERN_RULES: PatternRule[] = [
  // Auth / Sessão
  {
    patterns: ['jwt expired', 'token expired', 'pgrst301', 'token is expired'],
    result: {
      userMessage: 'Sua sessão expirou. Faça login novamente.',
      code: 'SESSION_EXPIRED',
      category: 'auth',
      retryable: false,
    },
  },
  {
    patterns: ['invalid claim', 'missing sub claim', 'invalid jwt', 'jwt malformed'],
    result: {
      userMessage: 'Sessão inválida. Faça login novamente.',
      code: 'INVALID_SESSION',
      category: 'auth',
      retryable: false,
    },
  },
  // Permissão / RLS
  {
    patterns: ['row-level security', 'rls', 'policy', 'not authorized', 'permission denied', 'permissão negada'],
    result: {
      userMessage: 'Você não tem permissão para esta ação.',
      code: 'RLS_DENIED',
      category: 'permission',
      retryable: false,
    },
  },
  // Rede
  {
    patterns: ['failed to fetch', 'networkerror', 'net::', 'econnrefused', 'econnreset', 'dns'],
    result: {
      userMessage: 'Erro de conexão. Verifique sua internet e tente novamente.',
      code: 'NETWORK_ERROR',
      category: 'network',
      retryable: true,
    },
  },
  {
    patterns: ['timeout', 'aborterror', 'aborted', 'request timed out'],
    result: {
      userMessage: 'A operação demorou demais. Tente novamente.',
      code: 'TIMEOUT',
      category: 'network',
      retryable: true,
    },
  },
  // Meta API
  {
    patterns: ['(#100) invalid parameter'],
    result: {
      userMessage: 'Configuração inválida na Meta. Verifique os parâmetros.',
      code: 'META_INVALID_PARAM',
      category: 'validation',
      retryable: false,
    },
  },
  {
    patterns: ['(#4) application request limit', 'rate limit'],
    result: {
      userMessage: 'Limite de requisições atingido. Aguarde alguns minutos e tente novamente.',
      code: 'RATE_LIMITED',
      category: 'technical',
      retryable: true,
    },
  },
  {
    patterns: ['(#10) permission denied'],
    result: {
      userMessage: 'Permissão negada pela Meta. Verifique as permissões do aplicativo.',
      code: 'META_PERMISSION_DENIED',
      category: 'permission',
      retryable: false,
    },
  },
  {
    patterns: ['oauthexception', 'oauth expired'],
    result: {
      userMessage: 'Conexão com a Meta expirou. Reconecte sua conta.',
      code: 'META_OAUTH_EXPIRED',
      category: 'auth',
      retryable: false,
    },
  },
  // Validação genérica
  {
    patterns: ['duplicate', 'unique constraint', 'unique violation'],
    result: {
      userMessage: 'Esse registro já existe. Verifique os dados e tente novamente.',
      code: 'DUPLICATE_KEY',
      category: 'validation',
      retryable: false,
    },
  },
  {
    patterns: ['violates foreign key'],
    result: {
      userMessage: 'Este item está vinculado a outros registros.',
      code: 'FOREIGN_KEY_VIOLATION',
      category: 'validation',
      retryable: false,
    },
  },
  {
    patterns: ['violates check constraint'],
    result: {
      userMessage: 'Dados inválidos. Verifique os campos preenchidos.',
      code: 'CHECK_VIOLATION',
      category: 'validation',
      retryable: false,
    },
  },
];

// ── Fallback por status HTTP ────────────────────────────────────────
const HTTP_STATUS_MAP: Record<number, Pick<SanitizedError, 'userMessage' | 'code' | 'category' | 'retryable'>> = {
  400: { userMessage: 'Requisição inválida. Verifique os dados.', code: 'BAD_REQUEST', category: 'validation', retryable: false },
  401: { userMessage: 'Sessão expirada. Faça login novamente.', code: 'UNAUTHORIZED', category: 'auth', retryable: false },
  403: { userMessage: 'Você não tem permissão para esta ação.', code: 'FORBIDDEN', category: 'permission', retryable: false },
  404: { userMessage: 'Recurso não encontrado.', code: 'NOT_FOUND', category: 'validation', retryable: false },
  409: { userMessage: 'Conflito: esse registro já existe.', code: 'CONFLICT', category: 'validation', retryable: false },
  422: { userMessage: 'Dados inválidos. Verifique os campos.', code: 'UNPROCESSABLE', category: 'validation', retryable: false },
  429: { userMessage: 'Muitas requisições. Aguarde alguns minutos.', code: 'RATE_LIMITED', category: 'technical', retryable: true },
  500: { userMessage: 'Erro interno. Se o problema persistir, entre em contato com o suporte.', code: 'SERVER_ERROR', category: 'technical', retryable: true },
  502: { userMessage: 'Erro de conexão com o servidor. Tente novamente.', code: 'BAD_GATEWAY', category: 'network', retryable: true },
  503: { userMessage: 'Serviço temporariamente indisponível. Tente em alguns minutos.', code: 'SERVICE_UNAVAILABLE', category: 'network', retryable: true },
};

// ── Extração de metadados do erro ───────────────────────────────────
function extractErrorInfo(error: unknown): { message: string; pgCode?: string; statusCode?: number } {
  if (!error) return { message: '' };

  const message = error instanceof Error ? error.message : String(error);

  // Supabase error shape: { code, message, details, hint }
  const pgCode = (error as any)?.code as string | undefined;

  // HTTP status
  const statusCode =
    (error as any)?.status ??
    (error as any)?.statusCode ??
    (typeof (error as any)?.code === 'number' ? (error as any).code : undefined);

  return { message, pgCode, statusCode };
}

/**
 * Sanitiza um erro bruto e retorna uma mensagem segura para o usuário.
 * 
 * @example
 * const result = sanitizeError(error);
 * toast.error(result.userMessage);          // seguro para o usuário
 * console.error(result.code, result._rawMessage); // para diagnóstico
 */
export function sanitizeError(error: unknown): SanitizedError {
  const { message, pgCode, statusCode } = extractErrorInfo(error);
  const lowerMessage = message.toLowerCase();

  // 1. Código Postgres explícito
  if (pgCode && POSTGRES_CODE_MAP[pgCode]) {
    return { ...POSTGRES_CODE_MAP[pgCode], _rawMessage: message };
  }

  // 2. Pattern matching no texto
  for (const rule of PATTERN_RULES) {
    if (rule.patterns.some(p => lowerMessage.includes(p))) {
      return { ...rule.result, _rawMessage: message };
    }
  }

  // 3. Status HTTP
  if (statusCode && HTTP_STATUS_MAP[statusCode]) {
    return { ...HTTP_STATUS_MAP[statusCode], _rawMessage: message };
  }

  // 4. Se o backend já mandou envelope padronizado com code
  const errorCode = (error as any)?.code;
  if (typeof errorCode === 'string' && errorCode.length > 2) {
    // O backend já tem um code, mas a mensagem pode ser técnica
    // Retorna a mensagem do backend se existir campo `error` no envelope
    const backendMsg = (error as any)?.error || (error as any)?.message;
    if (backendMsg && !containsTechnicalLeak(backendMsg)) {
      return {
        userMessage: backendMsg,
        code: errorCode,
        category: 'technical',
        retryable: false,
        _rawMessage: message,
      };
    }
  }

  // 5. Fallback seguro — NUNCA expor a mensagem técnica
  return {
    userMessage: 'Erro inesperado. Se o problema persistir, entre em contato com o suporte.',
    code: 'UNKNOWN',
    category: 'technical',
    retryable: true,
    _rawMessage: message,
  };
}

/**
 * Verifica se uma string contém vazamento técnico que não deve ir para o usuário.
 */
function containsTechnicalLeak(text: string): boolean {
  const lower = text.toLowerCase();
  const leakPatterns = [
    'relation "', 'column "', 'table "', 'schema "',
    'select ', 'insert ', 'update ', 'delete ',
    'from ', 'where ', 'join ',
    'function ', 'trigger ',
    'violates', 'constraint',
    'stack trace', 'at object.',
    'syntax error', 'unexpected token',
    'cannot read properties', 'undefined is not',
    'supabase', 'postgrest', 'postgres',
  ];
  return leakPatterns.some(p => lower.includes(p));
}

/**
 * Sanitiza a mensagem de erro para exibição, com contexto de módulo/ação.
 * Atalho para quando você precisa de uma string simples.
 */
export function getSafeErrorMessage(
  error: unknown,
  context?: { module?: string; action?: string }
): string {
  const sanitized = sanitizeError(error);

  // Se temos contexto, personalizar mensagem genérica
  if (context && sanitized.code === 'UNKNOWN') {
    const action = context.action || 'processar';
    const module = context.module ? ` ${context.module}` : '';
    return `Erro ao ${action}${module}. Se o problema persistir, entre em contato com o suporte.`;
  }

  return sanitized.userMessage;
}
