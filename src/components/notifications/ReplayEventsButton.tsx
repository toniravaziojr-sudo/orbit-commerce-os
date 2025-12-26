import { useState } from "react";
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ReplayEventsButtonProps {
  disabled?: boolean;
}

export function ReplayEventsButton({ disabled }: ReplayEventsButtonProps) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    events_reset?: number;
    events_found?: number;
  } | null>(null);

  const handleReplay = async () => {
    if (!profile?.current_tenant_id) return;
    
    setIsLoading(true);
    setResult(null);
    setShowConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke('replay-events', {
        body: { 
          tenant_id: profile.current_tenant_id,
          days: 3,
        },
      });

      if (error) throw error;

      if (data.success) {
        setResult({
          success: true,
          message: data.message || `${data.stats?.events_reset || 0} evento(s) reprocessado(s)`,
          events_reset: data.stats?.events_reset,
          events_found: data.stats?.events_found,
        });
        
        if (data.stats?.events_reset > 0) {
          toast.success(`${data.stats.events_reset} evento(s) reprocessado(s)`);
        } else {
          toast.info('Nenhum evento pendente encontrado');
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Erro ao reprocessar eventos',
        });
        toast.error(data.error || 'Erro ao reprocessar eventos');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setResult({
        success: false,
        message: errorMessage,
      });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={disabled || isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="h-4 w-4" />
        )}
        Reprocessar últimos 3 dias
      </Button>

      {result && (
        <div className={`mt-2 p-3 rounded-md text-sm flex items-start gap-2 ${
          result.success ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
        }`}>
          {result.success ? (
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <div>
            <p>{result.message}</p>
            {result.events_found !== undefined && (
              <p className="text-xs mt-1 opacity-80">
                {result.events_found} evento(s) encontrado(s) no período
              </p>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reprocessar eventos dos últimos 3 dias?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação irá verificar eventos dos últimos 3 dias e reenviar 
                notificações que falharam ou não foram processadas.
              </p>
              <p className="text-sm">
                <strong>Quando usar:</strong> Após instabilidade no sistema de envios 
                (WhatsApp/Email offline temporariamente).
              </p>
              <p className="text-sm">
                <strong>Segurança:</strong> Mensagens já enviadas não serão duplicadas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplay} disabled={isLoading}>
              {isLoading ? 'Reprocessando...' : 'Reprocessar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
