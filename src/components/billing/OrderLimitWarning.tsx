import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { useOrderLimitCheck, useTenantSubscription } from '@/hooks/usePlans';
import { useNavigate } from 'react-router-dom';

interface OrderLimitWarningProps {
  showAlways?: boolean;
}

export function OrderLimitWarning({ showAlways = false }: OrderLimitWarningProps) {
  const { data: limitCheck } = useOrderLimitCheck();
  const { data: subscription } = useTenantSubscription();
  const navigate = useNavigate();

  if (!limitCheck || !subscription) return null;

  const { current_count, order_limit, is_over_limit, plan_key } = limitCheck;

  // Não mostrar para planos sem limite
  if (!order_limit) return null;

  // Calcular porcentagem de uso
  const usagePercent = Math.min((current_count / order_limit) * 100, 100);
  const isNearLimit = usagePercent >= 80;

  // Só mostrar se está próximo do limite ou ultrapassou, ou se showAlways
  if (!showAlways && !isNearLimit && !is_over_limit) return null;

  return (
    <Alert variant={is_over_limit ? 'destructive' : 'default'} className="mb-4">
      {is_over_limit ? (
        <AlertTriangle className="h-4 w-4" />
      ) : (
        <TrendingUp className="h-4 w-4" />
      )}
      <AlertTitle>
        {is_over_limit 
          ? 'Limite de pedidos atingido' 
          : 'Você está próximo do limite'}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Pedidos este mês</span>
              <span className="font-medium">{current_count} / {order_limit}</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>

          {is_over_limit ? (
            <p className="text-sm">
              Você ultrapassou o limite do plano <strong>{plan_key}</strong>. 
              Faça upgrade para continuar crescendo sem preocupações.
            </p>
          ) : (
            <p className="text-sm">
              Você já usou {usagePercent.toFixed(0)}% do seu limite mensal. 
              Considere fazer upgrade para não ter interrupções.
            </p>
          )}

          <Button 
            size="sm" 
            variant={is_over_limit ? 'default' : 'outline'}
            onClick={() => navigate('/settings/billing')}
          >
            Fazer Upgrade
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
