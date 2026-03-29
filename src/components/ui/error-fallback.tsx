// =============================================
// ERROR FALLBACK — Componente visual padronizado de erro
// Apenas presentational, sem logging interno
// =============================================

import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ErrorFallbackProps {
  /** Variante visual */
  variant: 'fullscreen' | 'card' | 'inline';
  /** Título do erro */
  title?: string;
  /** Mensagem descritiva */
  message?: string;
  /** Callback para tentar novamente (reset boundary) */
  onRetry?: () => void;
  /** Callback para recarregar a página */
  onReload?: () => void;
  /** Mostrar link de suporte (default: false) */
  showSupport?: boolean;
  /** Href do link de suporte (default: '/support') */
  supportHref?: string;
  /** Ações extras (ex: "Copiar Diagnóstico") */
  extraActions?: ReactNode;
  /** Erro original — detalhes técnicos visíveis apenas em debug */
  error?: Error | null;
  /** Info do componente React que falhou */
  errorInfo?: React.ErrorInfo | null;
  /** Classe CSS adicional */
  className?: string;
}

/**
 * Checa se detalhes técnicos devem ser visíveis.
 * Seguro fora do browser (SSR/edge).
 */
function shouldShowDebugDetails(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    if (typeof window !== 'undefined' && window.location) {
      return new URLSearchParams(window.location.search).get('debug') === '1';
    }
  } catch {
    // safe fallback
  }
  return false;
}

function DebugDetails({ error, errorInfo }: { error?: Error | null; errorInfo?: React.ErrorInfo | null }) {
  if (!shouldShowDebugDetails() || !error) return null;

  return (
    <details className="mt-3 text-left">
      <summary className="cursor-pointer text-xs text-muted-foreground font-medium">
        Detalhes técnicos
      </summary>
      <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-48 font-mono whitespace-pre-wrap break-words text-destructive">
        {error.message}
        {'\n'}
        {error.stack}
      </pre>
      {errorInfo?.componentStack && (
        <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-32 font-mono whitespace-pre-wrap break-words text-muted-foreground">
          {errorInfo.componentStack}
        </pre>
      )}
    </details>
  );
}

function ActionButtons({
  variant,
  onRetry,
  onReload,
  showSupport,
  supportHref = '/support',
  extraActions,
}: Pick<ErrorFallbackProps, 'variant' | 'onRetry' | 'onReload' | 'showSupport' | 'supportHref' | 'extraActions'>) {
  const isInline = variant === 'inline';
  const btnSize = isInline ? 'sm' as const : 'default' as const;

  return (
    <div className={cn('flex gap-2', isInline ? 'mt-2' : 'mt-4', isInline ? 'flex-row' : 'flex-col sm:flex-row')}>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size={btnSize} className={!isInline ? 'flex-1' : ''}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Tentar novamente
        </Button>
      )}
      {onReload && (
        <Button onClick={onReload} size={btnSize} className={!isInline ? 'flex-1' : ''}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Recarregar página
        </Button>
      )}
      {extraActions}
      {showSupport && (
        <Button variant="ghost" size={btnSize} asChild>
          <a href={supportHref}>
            <MessageCircle className="h-4 w-4 mr-1.5" />
            Contatar suporte
          </a>
        </Button>
      )}
    </div>
  );
}

// ── Fullscreen variant ──
function FullscreenFallback(props: ErrorFallbackProps) {
  const {
    title = 'Algo deu errado',
    message = 'Ocorreu um erro inesperado. Tente recarregar a página.',
    error, errorInfo, className,
    ...actionProps
  } = props;

  return (
    <div className={cn('h-screen w-screen flex items-center justify-center bg-background p-6', className)}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto rounded-full bg-destructive/10 p-4 w-fit">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>
        <ActionButtons {...actionProps} variant="fullscreen" />
        <DebugDetails error={error} errorInfo={errorInfo} />
      </div>
    </div>
  );
}

// ── Card variant ──
function CardFallback(props: ErrorFallbackProps) {
  const {
    title = 'Erro ao carregar dados',
    message = 'Não foi possível carregar os dados. Tente novamente.',
    error, errorInfo, className,
    ...actionProps
  } = props;

  return (
    <Card className={cn('border-destructive/30', className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-2 max-w-md">{message}</p>
        <ActionButtons {...actionProps} variant="card" />
        <DebugDetails error={error} errorInfo={errorInfo} />
      </CardContent>
    </Card>
  );
}

// ── Inline variant (Builder blocks) ──
function InlineFallback(props: ErrorFallbackProps) {
  const {
    title = 'Erro neste bloco',
    message = 'Este bloco encontrou um erro.',
    error, errorInfo, className,
    ...actionProps
  } = props;

  return (
    <div
      className={cn(
        'min-h-[80px] p-3 m-1 border border-destructive/30 bg-destructive/5 rounded-lg flex items-center gap-3 overflow-hidden',
        className,
      )}
    >
      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-destructive truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{message}</p>
        <ActionButtons {...actionProps} variant="inline" />
        <DebugDetails error={error} errorInfo={errorInfo} />
      </div>
    </div>
  );
}

// ── Main component ──
export function ErrorFallback(props: ErrorFallbackProps) {
  switch (props.variant) {
    case 'fullscreen':
      return <FullscreenFallback {...props} />;
    case 'card':
      return <CardFallback {...props} />;
    case 'inline':
      return <InlineFallback {...props} />;
    default:
      return <CardFallback {...props} />;
  }
}

export default ErrorFallback;