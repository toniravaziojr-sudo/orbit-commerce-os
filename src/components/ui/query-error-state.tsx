import { ErrorFallback } from '@/components/ui/error-fallback';

interface QueryErrorStateProps {
  /** Título do erro (ex: "Erro ao carregar produtos") */
  title?: string;
  /** Mensagem descritiva */
  message?: string;
  /** Callback para tentar novamente */
  onRetry?: () => void;
  /** Mostrar link para suporte */
  showSupportLink?: boolean;
  /** Classe CSS adicional */
  className?: string;
}

/**
 * Componente reutilizável para exibir estado de erro em queries.
 * Wrapper fino sobre ErrorFallback — preserva API exata para ~20 páginas existentes.
 */
export function QueryErrorState({
  title = 'Erro ao carregar dados',
  message = 'Não foi possível carregar os dados. Tente novamente.',
  onRetry,
  showSupportLink = true,
  className = '',
}: QueryErrorStateProps) {
  return (
    <ErrorFallback
      variant="card"
      title={title}
      message={message}
      onRetry={onRetry}
      showSupport={showSupportLink}
      className={className}
    />
  );
}
