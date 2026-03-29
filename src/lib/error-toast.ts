import { toast } from 'sonner';
import { sanitizeError, type ErrorCategory } from './error-sanitizer';
import { logError } from './error-logger';

/**
 * Utilitário centralizado de toast de erro para o Comando Central.
 * 
 * Usa error-sanitizer para NUNCA exibir mensagens técnicas ao usuário.
 * Usa error-logger para registrar detalhes técnicos no console.
 * 
 * @version 2.0.0 — Integrado com sanitizer + logger
 */

interface ErrorToastOptions {
  /** Mensagem customizada (sobrescreve a automática) */
  message?: string;
  /** Descrição adicional */
  description?: string;
  /** Módulo onde o erro ocorreu (ex: "produtos", "pedidos") */
  module?: string;
  /** Ação que falhou (ex: "salvar", "carregar", "excluir") */
  action?: string;
  /** Se deve mostrar link de suporte */
  showSupport?: boolean;
  /** Tenant ID para logging */
  tenantId?: string;
}

function getContextualMessage(
  category: ErrorCategory,
  userMessage: string,
  options: ErrorToastOptions
): string {
  // Se o sanitizer retornou uma mensagem específica (não genérica), usar ela
  if (userMessage && !userMessage.includes('Erro inesperado')) {
    return userMessage;
  }

  // Fallback contextualizado por módulo/ação
  const actionLabel = options.action || 'processar';
  const moduleLabel = options.module ? ` ${options.module}` : '';

  switch (category) {
    case 'permission':
      return `Você não tem permissão para ${actionLabel}${moduleLabel}.`;
    case 'auth':
      return 'Sua sessão expirou. Faça login novamente.';
    case 'network':
      return `Falha de conexão ao ${actionLabel}${moduleLabel}. Verifique sua internet e tente novamente.`;
    case 'validation':
      return `Erro ao ${actionLabel}${moduleLabel}. Verifique os dados informados.`;
    case 'technical':
    default:
      return `Erro ao ${actionLabel}${moduleLabel}. Se o problema persistir, entre em contato com o suporte.`;
  }
}

/**
 * Exibe um toast de erro seguro e categorizado.
 * 
 * @example
 * // Erro genérico
 * showErrorToast(error);
 * 
 * // Com contexto
 * showErrorToast(error, { module: 'produtos', action: 'salvar' });
 * 
 * // Mensagem customizada
 * showErrorToast(error, { message: 'Não foi possível duplicar o produto.' });
 */
export function showErrorToast(error: unknown, options: ErrorToastOptions = {}) {
  // 1. Log estruturado (detalhes técnicos — nunca vai para o toast)
  const sanitized = logError(error, {
    module: options.module,
    action: options.action,
    tenantId: options.tenantId,
  });

  // 2. Mensagem segura para o usuário
  const message = options.message || getContextualMessage(sanitized.category, sanitized.userMessage, options);

  // 3. Toast
  toast.error(message, {
    description: options.description || (
      options.showSupport !== false && sanitized.category === 'technical'
        ? 'Se o problema persistir, entre em contato com o suporte.'
        : undefined
    ),
    duration: sanitized.category === 'technical' ? 6000 : 4000,
  });
}

/**
 * Toast para erros de carregamento de dados (queries).
 */
export function showLoadErrorToast(module: string, error?: unknown) {
  showErrorToast(error || new Error('Falha ao carregar'), {
    module,
    action: 'carregar',
  });
}

/**
 * Toast para erros de salvamento (mutations).
 */
export function showSaveErrorToast(module: string, error?: unknown) {
  showErrorToast(error || new Error('Falha ao salvar'), {
    module,
    action: 'salvar',
  });
}

/**
 * Toast para erros de exclusão.
 */
export function showDeleteErrorToast(module: string, error?: unknown) {
  showErrorToast(error || new Error('Falha ao excluir'), {
    module,
    action: 'excluir',
  });
}