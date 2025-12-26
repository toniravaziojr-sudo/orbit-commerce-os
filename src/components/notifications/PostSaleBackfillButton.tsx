import { useState } from "react";
import { Users, Loader2, CheckCircle, AlertCircle } from "lucide-react";
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

interface PostSaleBackfillButtonProps {
  disabled?: boolean;
}

export function PostSaleBackfillButton({ disabled }: PostSaleBackfillButtonProps) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    total_customers?: number;
    estimated_duration_hours?: number;
  } | null>(null);

  const handleStart = async () => {
    if (!profile?.current_tenant_id) return;
    
    setIsLoading(true);
    setResult(null);
    setShowConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke('post-sale-backfill-start', {
        body: { 
          tenant_id: profile.current_tenant_id,
          rate_limit_per_hour: 100,
        },
      });

      if (error) throw error;

      if (data.success) {
        if (data.total_customers === 0) {
          setResult({
            success: true,
            message: data.message || 'Nenhum cliente antigo para incluir',
          });
        } else {
          setResult({
            success: true,
            message: `Job iniciado! ${data.total_customers} clientes serão processados.`,
            total_customers: data.total_customers,
            estimated_duration_hours: data.estimated_duration_hours,
          });
          toast.success(`Backfill iniciado para ${data.total_customers} clientes`);
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Erro ao iniciar backfill',
        });
        toast.error(data.error || 'Erro ao iniciar backfill');
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
          <Users className="h-4 w-4" />
        )}
        Incluir clientes antigos
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
            {result.estimated_duration_hours && (
              <p className="text-xs mt-1 opacity-80">
                Tempo estimado: ~{result.estimated_duration_hours} hora(s)
              </p>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incluir clientes antigos no pós-venda?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Esta ação irá agendar o envio da sequência completa de mensagens 
                de pós-venda para clientes que fizeram pedidos antes da criação das regras.
              </p>
              <p className="text-sm">
                <strong>Rate limit:</strong> 100 envios por hora para não sobrecarregar o sistema.
              </p>
              <p className="text-sm">
                <strong>Segurança:</strong> Clientes já processados não receberão mensagens duplicadas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStart} disabled={isLoading}>
              {isLoading ? 'Iniciando...' : 'Iniciar backfill'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
