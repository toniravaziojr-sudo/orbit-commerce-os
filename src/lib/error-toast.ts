import { toast } from 'sonner';

/**
 * Utilitário centralizado de toast de erro para o Comando Central.
 * 
 * Categoriza erros automaticamente e exibe toasts com mensagens claras:
 * - Erro de permissão (403/RLS) → "Você não tem permissão"
 * - Erro técnico (500/rede/timeout) → "Erro interno. Contate o suporte."
 * - Erro de validação/ação do usuário → Mensagem customizada
 */

type ErrorCategory = 'permission' | 'technical' | 'validation' | 'network';

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
}

function categorizeError(error: unknown): ErrorCategory {
  if (!error) return 'technical';

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Verificar código de status se disponível
  const statusCode = (error as any)?.status || (error as any)?.code || (error as any)?.statusCode;

  if (statusCode === 403 || statusCode === '403' || lowerMessage.includes('permission') || lowerMessage.includes('rls') || lowerMessage.includes('policy') || lowerMessage.includes('not authorized') || lowerMessage.includes('permissão')) {
    return 'permission';
  }

  if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('econnrefused') || lowerMessage.includes('failed to fetch') || lowerMessage.includes('net::') || lowerMessage.includes('timeout') || lowerMessage.includes('aborted')) {
    return 'network';
  }

  if (lowerMessage.includes('duplicate') || lowerMessage.includes('unique') || lowerMessage.includes('violates') || lowerMessage.includes('required') || lowerMessage.includes('invalid') || lowerMessage.includes('obrigatório') || lowerMessage.includes('inválido')) {
    return 'validation';
  }

  return 'technical';
}

function getDefaultMessage(category: ErrorCategory, options: ErrorToastOptions): string {
  const actionLabel = options.action || 'processar';
  const moduleLabel = options.module ? ` ${options.module}` : '';

  switch (category) {
    case 'permission':
      return `Você não tem permissão para ${actionLabel}${moduleLabel}.`;
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
 * Exibe um toast de erro categorizado automaticamente.
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
  const category = categorizeError(error);
  const message = options.message || getDefaultMessage(category, options);

  // Log para debug (sempre)
  console.error(`[ErrorToast][${category}]`, error);

  toast.error(message, {
    description: options.description || (options.showSupport !== false && category === 'technical'
      ? 'Se o problema persistir, entre em contato com o suporte.'
      : undefined),
    duration: category === 'technical' ? 6000 : 4000,
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
