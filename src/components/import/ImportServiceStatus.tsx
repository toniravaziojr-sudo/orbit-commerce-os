import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { useImportService } from '@/hooks/useImportService';

interface ImportServiceStatusProps {
  onStatusChange?: (online: boolean) => void;
  autoCheck?: boolean;
}

export function ImportServiceStatus({ onStatusChange, autoCheck = true }: ImportServiceStatusProps) {
  const { health, isChecking, checkHealth } = useImportService();

  useEffect(() => {
    if (autoCheck) {
      checkHealth();
    }
  }, [autoCheck, checkHealth]);

  useEffect(() => {
    onStatusChange?.(health.online);
  }, [health.online, onStatusChange]);

  const handleRetry = async () => {
    await checkHealth();
  };

  if (isChecking && !health.checkedAt) {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Verificando serviço de importação...</AlertTitle>
        <AlertDescription>Aguarde enquanto verificamos a disponibilidade.</AlertDescription>
      </Alert>
    );
  }

  if (health.online) {
    return (
      <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="flex items-center gap-2">
          Serviço de importação
          <Badge variant="outline" className="text-green-600 border-green-600">
            ONLINE
          </Badge>
        </AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-400">
          Versão: {health.version}
          {health.checkedAt && (
            <span className="ml-2 text-xs text-muted-foreground">
              (verificado às {health.checkedAt.toLocaleTimeString('pt-BR')})
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <XCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        Serviço de importação
        <Badge variant="destructive">OFFLINE</Badge>
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{health.error || 'Não foi possível conectar ao serviço de importação.'}</span>
        <div className="flex gap-2 mt-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetry}
            disabled={isChecking}
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Verificar novamente
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
