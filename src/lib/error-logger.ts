/**
 * error-logger.ts — Logger estruturado de erros (frontend)
 * 
 * Registra erros de forma estruturada para diagnóstico técnico.
 * Separado da camada de exibição (toast) — o que vai para o log
 * é DIFERENTE do que o usuário vê.
 * 
 * @version 1.0.0
 */

import { sanitizeError, type SanitizedError, type ErrorCategory } from './error-sanitizer';

interface ErrorLogContext {
  /** Módulo do sistema (ex: "produtos", "pedidos") */
  module?: string;
  /** Ação que falhou (ex: "salvar", "carregar") */
  action?: string;
  /** Tenant ID para isolamento */
  tenantId?: string;
  /** ID do usuário */
  userId?: string;
  /** Dados adicionais seguros para log */
  metadata?: Record<string, unknown>;
}

interface StructuredLog {
  timestamp: string;
  level: 'error' | 'warn';
  code: string;
  category: ErrorCategory;
  module?: string;
  action?: string;
  tenantId?: string;
  userId?: string;
  rawMessage: string;
  userMessage: string;
  retryable: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Registra um erro no console de forma estruturada.
 * O log contém detalhes técnicos; a mensagem do usuário é separada.
 * 
 * @example
 * logError(error, { module: 'produtos', action: 'salvar' });
 */
export function logError(error: unknown, context: ErrorLogContext = {}): SanitizedError {
  const sanitized = sanitizeError(error);

  const log: StructuredLog = {
    timestamp: new Date().toISOString(),
    level: sanitized.category === 'validation' ? 'warn' : 'error',
    code: sanitized.code,
    category: sanitized.category,
    module: context.module,
    action: context.action,
    tenantId: context.tenantId,
    userId: context.userId,
    rawMessage: sanitized._rawMessage || '',
    userMessage: sanitized.userMessage,
    retryable: sanitized.retryable,
    metadata: context.metadata,
  };

  // Log estruturado — permanece no console para diagnóstico
  if (log.level === 'error') {
    console.error(`[Error][${sanitized.code}]`, log, error);
  } else {
    console.warn(`[Warn][${sanitized.code}]`, log);
  }

  return sanitized;
}
