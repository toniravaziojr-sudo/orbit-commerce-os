import { AlertTriangle, X, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFiscalAlerts } from '@/hooks/useFiscal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const reasonLabels: Record<string, string> = {
  cancelled: 'Pedido Cancelado',
  returned: 'Devolução',
};

export function FiscalAlertsCard() {
  const navigate = useNavigate();
  const { alerts, isLoading, dismissAlert } = useFiscalAlerts();

  if (isLoading || !alerts || alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-base font-semibold text-destructive">
              Alertas Fiscais
            </CardTitle>
            <Badge variant="destructive" className="ml-2">
              {alerts.length}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Pedidos cancelados ou devolvidos que possuem NF-e autorizada precisam de ação.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.slice(0, 3).map((alert) => {
          const orderData = alert.orders as { order_number: string; status: string } | null;
          
          return (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 rounded-lg bg-background border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    NF-e {alert.serie}-{alert.numero}
                  </span>
                  <Badge variant="outline" className="text-destructive border-destructive/50">
                    {reasonLabels[alert.action_reason || ''] || alert.action_reason}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {alert.dest_nome} • {formatCurrency(alert.valor_total)}
                  {orderData && ` • Pedido #${orderData.order_number}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {alert.order_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/orders/${alert.order_id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Ver Pedido
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => dismissAlert.mutate(alert.id)}
                  disabled={dismissAlert.isPending}
                  title="Dispensar alerta"
                >
                  {dismissAlert.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}
        {alerts.length > 3 && (
          <p className="text-sm text-muted-foreground text-center">
            E mais {alerts.length - 3} alerta(s) pendente(s)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
