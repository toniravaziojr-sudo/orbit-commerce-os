import { AlertTriangle, RefreshCw, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
 * Usado em todas as páginas do admin quando uma query falha.
 */
export function QueryErrorState({
  title = 'Erro ao carregar dados',
  message = 'Não foi possível carregar os dados. Tente novamente.',
  onRetry,
  showSupportLink = true,
  className = '',
}: QueryErrorStateProps) {
  return (
    <Card className={`border-destructive/30 ${className}`}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground mb-6 max-w-md">{message}</p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          )}
          {showSupportLink && (
            <Button variant="ghost" asChild>
              <a href="/support">
                <MessageCircle className="h-4 w-4 mr-2" />
                Contatar suporte
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
