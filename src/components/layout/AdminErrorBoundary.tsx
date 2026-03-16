import React from 'react';
import { ErrorFallback } from '@/components/ui/error-fallback';

interface AdminErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary global para o admin (Comando Central).
 * Captura erros não tratados e exibe tela amigável com opções de recovery.
 */
export class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AdminErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<AdminErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[AdminErrorBoundary] Erro não tratado:', error, errorInfo);
    console.error('[AdminErrorBoundary] Rota:', window.location.pathname);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          variant="fullscreen"
          title="Algo deu errado"
          message="Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato com o suporte."
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          showSupport
          error={this.state.error}
          errorInfo={this.state.errorInfo}
        />
      );
    }

    return this.props.children;
  }
}
