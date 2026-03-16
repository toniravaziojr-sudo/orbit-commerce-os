// =============================================
// BLOCK ERROR BOUNDARY — Wrapper para blocos do Builder
// Captura erros e mostra fallback inline estável
// =============================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorFallback } from '@/components/ui/error-fallback';
import { getReactGuardStatus } from '@/lib/reactInstanceGuard';

interface BlockErrorBoundaryProps {
  blockId: string;
  blockType: string;
  pageType?: string;
  isEditing?: boolean;
  isSafeMode?: boolean;
  children: ReactNode;
}

interface BlockErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class BlockErrorBoundary extends Component<BlockErrorBoundaryProps, BlockErrorBoundaryState> {
  constructor(props: BlockErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<BlockErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Logging detalhado — apenas no console, nunca na UI
    console.group(`[BlockErrorBoundary] Erro no bloco: ${this.props.blockType}`);
    console.error('Block ID:', this.props.blockId);
    console.error('Block Type:', this.props.blockType);
    console.error('Page Type:', this.props.pageType);
    console.error('Is Editing:', this.props.isEditing);
    console.error('Is Safe Mode:', this.props.isSafeMode);
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    const reactStatus = getReactGuardStatus();
    console.error('React Instance Status:', reactStatus);
    console.groupEnd();
  }

  handleCopyDiagnostics = () => {
    const { blockId, blockType, pageType, isEditing, isSafeMode } = this.props;
    const { error, errorInfo } = this.state;
    const reactStatus = getReactGuardStatus();

    const diagnostics = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      block: { id: blockId, type: blockType, pageType, isEditing, isSafeMode },
      error: { name: error?.name, message: error?.message, stack: error?.stack },
      componentStack: errorInfo?.componentStack,
      reactStatus: {
        ok: reactStatus.ok,
        version: reactStatus.version,
        multipleInstances: reactStatus.multipleInstances,
        versions: reactStatus.versions,
      },
    };

    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    alert('Diagnóstico copiado para a área de transferência!');
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          variant="inline"
          title={`Erro no bloco: ${this.props.blockType}`}
          message="Este bloco encontrou um erro. Tente novamente."
          onRetry={this.handleRetry}
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          extraActions={
            <Button size="sm" variant="ghost" onClick={this.handleCopyDiagnostics}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copiar
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}

export default BlockErrorBoundary;
