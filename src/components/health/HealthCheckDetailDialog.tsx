import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { HealthCheck } from '@/hooks/useHealthChecks';

const statusConfig = {
  pass: { icon: CheckCircle2, color: 'text-green-500', label: 'OK' },
  fail: { icon: XCircle, color: 'text-destructive', label: 'Falha' },
  partial: { icon: AlertTriangle, color: 'text-yellow-500', label: 'Parcial' },
};

const suiteLabels: Record<string, string> = {
  domains: 'Domínios e URLs',
  checkout_tracking: 'Tracking de Checkout',
  coupons: 'Cupons',
  payments: 'Pagamentos',
};

interface HealthCheckDetailDialogProps {
  check: HealthCheck | null;
  onOpenChange: (open: boolean) => void;
}

export function HealthCheckDetailDialog({ check, onOpenChange }: HealthCheckDetailDialogProps) {
  if (!check) return null;

  const config = statusConfig[check.status];
  const StatusIcon = config.icon;

  return (
    <Dialog open={!!check} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            Verificação de {format(new Date(check.ran_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </DialogTitle>
          <DialogDescription>
            {check.summary || 'Detalhes da verificação de saúde do sistema'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Duração total</span>
              </div>
              <span className="font-mono text-sm">{check.duration_ms || 0}ms</span>
            </div>

            {/* Suites */}
            {check.details?.suites?.map((suite) => {
              const suiteConfig = statusConfig[suite.status];
              const SuiteIcon = suiteConfig.icon;

              return (
                <div key={suite.suite} className="rounded-lg border">
                  <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                      <SuiteIcon className={`h-4 w-4 ${suiteConfig.color}`} />
                      <span className="font-medium">
                        {suiteLabels[suite.suite] || suite.suite}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={suite.status === 'pass' ? 'secondary' : 'destructive'}>
                        {suiteConfig.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">
                        {suite.duration_ms}ms
                      </span>
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    {suite.checks.map((check, index) => {
                      const checkConfig = statusConfig[check.status];
                      const CheckIcon = checkConfig.icon;

                      return (
                        <div key={index} className="flex items-start gap-3 text-sm">
                          <CheckIcon className={`h-4 w-4 mt-0.5 ${checkConfig.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">
                                {check.name}
                              </span>
                              {check.duration_ms && (
                                <span className="text-xs text-muted-foreground">
                                  ({check.duration_ms}ms)
                                </span>
                              )}
                            </div>
                            <p className={check.status === 'fail' ? 'text-destructive' : 'text-foreground'}>
                              {check.message}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {!check.details?.suites && (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhum detalhe disponível para esta verificação.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
