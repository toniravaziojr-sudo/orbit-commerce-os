// =============================================
// BUILDER ERROR BOUNDARY — Captura erros JS no Builder
// =============================================

import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorFallback } from '@/components/ui/error-fallback';
import { toast } from 'sonner';

interface ErrorState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  globalErrors: Array<{ message: string; source?: string; timestamp: Date }>;
}

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

// Global error collector for unhandled errors
const globalErrorLog: Array<{ message: string; source?: string; timestamp: Date }> = [];

// Hook to capture global errors
export function useGlobalErrorCapture() {
  const [errors, setErrors] = useState<typeof globalErrorLog>([]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const errorEntry = {
        message: `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`,
        source: 'window.onerror',
        timestamp: new Date(),
      };
      globalErrorLog.push(errorEntry);
      setErrors([...globalErrorLog]);
      console.error('[BuilderErrorBoundary] Global error:', errorEntry);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const errorEntry = {
        message: event.reason?.message || String(event.reason),
        source: 'unhandledrejection',
        timestamp: new Date(),
      };
      globalErrorLog.push(errorEntry);
      setErrors([...globalErrorLog]);
      console.error('[BuilderErrorBoundary] Unhandled rejection:', errorEntry);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return errors;
}

class BuilderErrorBoundary extends Component<Props, ErrorState> {
  state: ErrorState = {
    error: null,
    errorInfo: null,
    globalErrors: [],
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BuilderErrorBoundary] Caught error:', error);
    console.error('[BuilderErrorBoundary] Error info:', errorInfo);
    console.error('[BuilderErrorBoundary] Rota:', window.location.pathname);
    this.setState({ error, errorInfo, globalErrors: [...globalErrorLog] });
  }

  handleCopyDiagnostic = () => {
    const { error, errorInfo, globalErrors } = this.state;

    const diagnostic = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
      componentStack: errorInfo?.componentStack,
      globalErrors: globalErrors.map(e => ({
        message: e.message,
        source: e.source,
        timestamp: e.timestamp.toISOString(),
      })),
    };

    navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2));
    toast.success('Diagnóstico copiado!');
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error, errorInfo } = this.state;

    if (error) {
      return (
        <ErrorFallback
          variant="fullscreen"
          title="Erro no Builder"
          message="Ocorreu um erro ao renderizar o editor visual"
          onReload={this.handleReload}
          error={error}
          errorInfo={errorInfo}
          extraActions={
            <Button onClick={this.handleCopyDiagnostic} variant="outline" className="flex-1">
              <Copy className="h-4 w-4 mr-1.5" />
              Copiar Diagnóstico
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

export default BuilderErrorBoundary;
