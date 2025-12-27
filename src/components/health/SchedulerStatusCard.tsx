import { useState, useEffect } from 'react';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw,
  Loader2,
  Timer
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface SchedulerConfig {
  name: string;
  displayName: string;
  schedule: string;
  expectedIntervalMinutes: number;
  description: string;
}

interface SchedulerStatus {
  name: string;
  lastRun: string | null;
  status: 'ok' | 'stale' | 'unknown';
  minutesSinceRun: number | null;
}

// Define known schedulers from config.toml
const SCHEDULERS: SchedulerConfig[] = [
  {
    name: 'scheduler-tick',
    displayName: 'Scheduler Tick',
    schedule: '* * * * *',
    expectedIntervalMinutes: 2,
    description: 'Processa eventos, abandono de checkout, e dispara notificações'
  },
  {
    name: 'tracking-poll',
    displayName: 'Tracking Poll',
    schedule: '*/10 * * * *',
    expectedIntervalMinutes: 20,
    description: 'Atualiza status de rastreio de envios'
  },
  {
    name: 'post-sale-backfill-process',
    displayName: 'Pós-venda',
    schedule: '* * * * *',
    expectedIntervalMinutes: 2,
    description: 'Processa sequências de pós-venda'
  },
  {
    name: 'health-check-run',
    displayName: 'Health Check',
    schedule: '*/5 * * * *',
    expectedIntervalMinutes: 10,
    description: 'Verifica saúde das lojas'
  },
  {
    name: 'scan-content-urls',
    displayName: 'Scan URLs',
    schedule: '0 3 * * *',
    expectedIntervalMinutes: 1500, // ~25h (daily job)
    description: 'Escaneia URLs de conteúdo diariamente'
  }
];

export function SchedulerStatusCard() {
  const [statuses, setStatuses] = useState<SchedulerStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSchedulerStatuses = async () => {
    try {
      // Query edge function logs to find last successful runs
      // Using analytics endpoint for function_edge_logs
      const results: SchedulerStatus[] = [];
      
      for (const scheduler of SCHEDULERS) {
        // Check notifications table for activity (as proxy for scheduler-tick)
        // Check events_inbox for process-events activity
        // Check shipments for tracking-poll activity
        let lastRun: string | null = null;
        
        if (scheduler.name === 'scheduler-tick') {
          // Check for recent notifications or events processed
          const { data } = await supabase
            .from('notifications')
            .select('updated_at')
            .order('updated_at', { ascending: false })
            .limit(1);
          lastRun = data?.[0]?.updated_at || null;
        } else if (scheduler.name === 'tracking-poll') {
          // Check for recent shipment updates
          const { data } = await supabase
            .from('shipments')
            .select('last_polled_at')
            .not('last_polled_at', 'is', null)
            .order('last_polled_at', { ascending: false })
            .limit(1);
          lastRun = data?.[0]?.last_polled_at || null;
        } else if (scheduler.name === 'post-sale-backfill-process') {
          // Check for recent post-sale notifications
          const { data } = await supabase
            .from('notification_logs')
            .select('updated_at')
            .eq('rule_type', 'post_sale')
            .order('updated_at', { ascending: false })
            .limit(1);
          lastRun = data?.[0]?.updated_at || null;
        } else if (scheduler.name === 'health-check-run') {
          // Check for recent health checks
          const { data } = await supabase
            .from('system_health_checks')
            .select('ran_at')
            .order('ran_at', { ascending: false })
            .limit(1);
          lastRun = data?.[0]?.ran_at || null;
        } else if (scheduler.name === 'scan-content-urls') {
          // This runs daily, check for any recent runtime violations scan
          const { data } = await supabase
            .from('storefront_runtime_violations')
            .select('created_at')
            .order('created_at', { ascending: false })
            .limit(1);
          lastRun = data?.[0]?.created_at || null;
        }

        let status: 'ok' | 'stale' | 'unknown' = 'unknown';
        let minutesSinceRun: number | null = null;

        if (lastRun) {
          minutesSinceRun = differenceInMinutes(new Date(), new Date(lastRun));
          status = minutesSinceRun <= scheduler.expectedIntervalMinutes ? 'ok' : 'stale';
        }

        results.push({
          name: scheduler.name,
          lastRun,
          status,
          minutesSinceRun
        });
      }

      setStatuses(results);
    } catch (error) {
      console.error('Error fetching scheduler statuses:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchedulerStatuses();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchSchedulerStatuses();
  };

  const getStatusConfig = (status: 'ok' | 'stale' | 'unknown') => {
    switch (status) {
      case 'ok':
        return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'OK' };
      case 'stale':
        return { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Atrasado' };
      default:
        return { icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Sem dados' };
    }
  };

  const staleCount = statuses.filter(s => s.status === 'stale').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Schedulers</CardTitle>
              <CardDescription>Edge Functions agendadas</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {staleCount > 0 && (
              <Badge variant="destructive">
                {staleCount} atrasado{staleCount > 1 ? 's' : ''}
              </Badge>
            )}
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {SCHEDULERS.map((scheduler) => {
              const statusData = statuses.find(s => s.name === scheduler.name);
              const config = getStatusConfig(statusData?.status || 'unknown');
              const StatusIcon = config.icon;

              return (
                <div
                  key={scheduler.name}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${config.bg}`}>
                      <StatusIcon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{scheduler.displayName}</span>
                        <Badge variant="outline" className="text-xs">
                          {scheduler.schedule}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{scheduler.description}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    {statusData?.lastRun ? (
                      <>
                        <p className="text-muted-foreground">
                          {format(new Date(statusData.lastRun), 'HH:mm', { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {statusData.minutesSinceRun}min atrás
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem execução</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
