// =============================================
// BLOCK ERROR BOUNDARY - Diagnostic wrapper for Builder blocks
// Catches React errors and shows block-level diagnostics
// =============================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<BlockErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log detailed diagnostics
    console.group(`[BlockErrorBoundary] Error in block: ${this.props.blockType}`);
    console.error('Block ID:', this.props.blockId);
    console.error('Block Type:', this.props.blockType);
    console.error('Page Type:', this.props.pageType);
    console.error('Is Editing:', this.props.isEditing);
    console.error('Is Safe Mode:', this.props.isSafeMode);
    console.error('Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Check React instance status
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
      block: {
        id: blockId,
        type: blockType,
        pageType,
        isEditing,
        isSafeMode,
      },
      error: {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      },
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
      const { blockId, blockType, pageType, isEditing, isSafeMode } = this.props;
      const { error } = this.state;
      const reactStatus = getReactGuardStatus();
      
      // Check if it's a React #300 error
      const is300Error = error?.message?.includes('#300') || 
                         error?.message?.includes('Invalid hook call') ||
                         error?.message?.includes('Rendered fewer hooks');
      
      return (
        <div className="p-4 m-2 bg-red-50 dark:bg-red-950/30 border-2 border-red-500 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-red-700 dark:text-red-400 text-lg">
                Erro no Bloco: {blockType}
              </h3>
              
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <span className="text-muted-foreground">blockId:</span>{' '}
                  <span className="text-red-600">{blockId.slice(0, 12)}...</span>
                </div>
                <div className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <span className="text-muted-foreground">blockType:</span>{' '}
                  <span className="text-red-600">{blockType}</span>
                </div>
                <div className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <span className="text-muted-foreground">pageType:</span>{' '}
                  <span className="text-red-600">{pageType || 'N/A'}</span>
                </div>
                <div className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <span className="text-muted-foreground">isEditing:</span>{' '}
                  <span className="text-red-600">{String(isEditing)}</span>
                </div>
                <div className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <span className="text-muted-foreground">isSafeMode:</span>{' '}
                  <span className="text-red-600">{String(isSafeMode)}</span>
                </div>
                <div className="font-mono bg-white/50 dark:bg-black/20 px-2 py-1 rounded">
                  <span className="text-muted-foreground">React:</span>{' '}
                  <span className={reactStatus.ok ? 'text-green-600' : 'text-red-600'}>
                    {reactStatus.version} {reactStatus.multipleInstances ? '⚠️ MÚLTIPLAS!' : '✓'}
                  </span>
                </div>
              </div>
              
              {is300Error && (
                <div className="mt-3 p-2 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-500 rounded text-sm">
                  <strong>⚠️ Erro React #300 detectado!</strong>
                  <p className="mt-1 text-yellow-800 dark:text-yellow-200">
                    Possíveis causas: hook chamado condicionalmente, múltiplas instâncias de React, 
                    ou componente chamado como função.
                  </p>
                </div>
              )}
              
              <div className="mt-3 p-2 bg-white/50 dark:bg-black/20 rounded">
                <p className="text-sm font-mono text-red-600 break-all">
                  {error?.message || 'Erro desconhecido'}
                </p>
              </div>
              
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleCopyDiagnostics}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Copiar Diagnóstico
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Tentar Novamente
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default BlockErrorBoundary;
