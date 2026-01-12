// =============================================
// BUILDER ERROR BOUNDARY - Captura erros JS no Builder
// =============================================

import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from 'react';
import { AlertTriangle, Copy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  constructor(props: Props) {
    super(props);
    this.state = {
      error: null,
      errorInfo: null,
      globalErrors: [],
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[BuilderErrorBoundary] Caught error:', error);
    console.error('[BuilderErrorBoundary] Error info:', errorInfo);
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
    const { error, errorInfo, globalErrors } = this.state;
    const [showDetails, setShowDetails] = React.useState(false);

    if (error) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-2xl w-full bg-card border border-destructive/50 rounded-lg shadow-lg">
            {/* Header */}
            <div className="flex items-center gap-3 p-6 border-b border-destructive/30 bg-destructive/10 rounded-t-lg">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <h1 className="text-xl font-bold text-destructive">Erro no Builder</h1>
                <p className="text-sm text-muted-foreground">
                  Ocorreu um erro ao renderizar o editor visual
                </p>
              </div>
            </div>

            {/* Error message */}
            <div className="p-6 space-y-4">
              <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                <p className="font-mono text-sm text-destructive break-all">
                  {error.name}: {error.message}
                </p>
              </div>

              {/* Stack trace toggle */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showDetails ? 'Ocultar detalhes' : 'Mostrar detalhes técnicos'}
              </button>

              {showDetails && (
                <div className="space-y-4">
                  {/* Stack trace */}
                  {error.stack && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Stack Trace:</h3>
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-48 font-mono">
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  {/* Component stack */}
                  {errorInfo?.componentStack && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">Component Stack:</h3>
                      <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-48 font-mono">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}

                  {/* Global errors */}
                  {globalErrors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-2">
                        Erros Globais ({globalErrors.length}):
                      </h3>
                      <div className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-32 font-mono space-y-2">
                        {globalErrors.map((e, i) => (
                          <div key={i} className="border-b border-border pb-2 last:border-0">
                            <span className="text-muted-foreground">[{e.source}]</span> {e.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button onClick={this.handleCopyDiagnostic} variant="outline" className="flex-1">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Diagnóstico
                </Button>
                <Button onClick={this.handleReload} className="flex-1">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar Página
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Cole o diagnóstico ao reportar este problema
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default BuilderErrorBoundary;
