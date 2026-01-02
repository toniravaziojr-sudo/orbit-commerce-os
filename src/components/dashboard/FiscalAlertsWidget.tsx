import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFiscalAlerts } from '@/hooks/useFiscal';

export function FiscalAlertsWidget() {
  const navigate = useNavigate();
  const { alerts, isLoading } = useFiscalAlerts();

  if (isLoading || !alerts || alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-destructive">Alertas Fiscais</span>
              <Badge variant="destructive">{alerts.length}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Pedidos cancelados com NF-e autorizada
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/fiscal')}
          >
            Ver Detalhes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
