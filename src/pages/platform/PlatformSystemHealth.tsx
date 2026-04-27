import { Activity, Database, Clock, Layers, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { PlatformAdminGate } from '@/components/auth/PlatformAdminGate';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCronJobsStatus,
  useQueueHealth,
  useSystemHealthOverview,
  useTopSlowQueries,
} from '@/hooks/useSystemHealth';
import { formatInTimeZone } from 'date-fns-tz';

const BRT = 'America/Sao_Paulo';

function formatBRT(date: string | null | undefined) {
  if (!date) return '—';
  try {
    return formatInTimeZone(new Date(date), BRT, "dd/MM/yyyy HH:mm:ss");
  } catch {
    return '—';
  }
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(1)} ${units[i]}`;
}

function formatMs(ms: number) {
  if (ms == null) return '—';
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function HealthDashboard() {
  const queryClient = useQueryClient();
  const overview = useSystemHealthOverview();
  const slowQueries = useTopSlowQueries(15);
  const cronJobs = useCronJobsStatus();
  const queues = useQueueHealth();

  const isLoading =
    overview.isLoading || slowQueries.isLoading || cronJobs.isLoading || queues.isLoading;

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['system-health'] });
  };

  // Métricas derivadas
  const conn = overview.data?.connections;
  const usagePct = conn ? Math.round((conn.total / conn.max) * 100) : 0;
  const cacheRatio = overview.data?.cache_hit_ratio ?? 0;

  const connVariant = usagePct >= 80 ? 'destructive' : usagePct >= 60 ? 'warning' : 'success';
  const cacheVariant = cacheRatio >= 99 ? 'success' : cacheRatio >= 95 ? 'warning' : 'destructive';

  const failedCronTotal = (cronJobs.data ?? []).reduce(
    (acc, j) => acc + (j.failures_last_24h || 0),
    0,
  );
  const cronVariant = failedCronTotal > 100 ? 'destructive' : failedCronTotal > 0 ? 'warning' : 'success';

  const queueEntries = Object.entries(queues.data ?? {});
  const orphansTotal = queueEntries.reduce((acc, [, v]) => acc + (v?.pending_or_orphans || 0), 0);
  const queueVariant = orphansTotal > 100 ? 'destructive' : orphansTotal > 0 ? 'warning' : 'success';

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Saúde do Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Visibilidade em tempo real de banco, filas e tarefas automatizadas. Acesso restrito a operadores da plataforma.
          </p>
          {overview.data?.captured_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Último snapshot: {formatBRT(overview.data.captured_at)} (BRT)
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Conexões do banco"
          value={conn ? `${conn.total} / ${conn.max}` : '—'}
          description={`${usagePct}% em uso · ${conn?.active ?? 0} ativas`}
          icon={Database}
          variant={connVariant as any}
        />
        <StatCard
          title="Cache hit ratio"
          value={`${cacheRatio.toFixed(2)}%`}
          description={cacheRatio >= 99 ? 'Saudável' : 'Abaixo do alvo (99%+)'}
          icon={Activity}
          variant={cacheVariant as any}
        />
        <StatCard
          title="Falhas de cron (24h)"
          value={failedCronTotal}
          description={`${(cronJobs.data ?? []).length} jobs ativos`}
          icon={Clock}
          variant={cronVariant as any}
        />
        <StatCard
          title="Pendências em filas"
          value={orphansTotal}
          description={`${queueEntries.length} filas monitoradas`}
          icon={Layers}
          variant={queueVariant as any}
        />
      </div>

      {/* Detalhe */}
      <Tabs defaultValue="cron" className="w-full">
        <TabsList>
          <TabsTrigger value="cron">Tarefas Automatizadas</TabsTrigger>
          <TabsTrigger value="queues">Filas</TabsTrigger>
          <TabsTrigger value="queries">Queries Lentas</TabsTrigger>
          <TabsTrigger value="db">Banco</TabsTrigger>
        </TabsList>

        {/* CRON */}
        <TabsContent value="cron">
          <Card>
            <CardHeader>
              <CardTitle>Status dos jobs (últimas 24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Agendamento</TableHead>
                      <TableHead>Última execução</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Sucessos</TableHead>
                      <TableHead className="text-right">Falhas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(cronJobs.data ?? []).map((j) => {
                      const failing = j.failures_last_24h > 0;
                      return (
                        <TableRow key={j.jobid}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {failing ? (
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              )}
                              <span>{j.jobname}</span>
                              {!j.active && <Badge variant="outline">inativo</Badge>}
                            </div>
                          </TableCell>
                          <TableCell><code className="text-xs">{j.schedule}</code></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatBRT(j.last_run_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={j.last_status === 'succeeded' ? 'default' : j.last_status === 'failed' ? 'destructive' : 'secondary'}>
                              {j.last_status ?? '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{j.successes_last_24h}</TableCell>
                          <TableCell className="text-right">
                            <span className={failing ? 'text-destructive font-semibold' : ''}>
                              {j.failures_last_24h}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* QUEUES */}
        <TabsContent value="queues">
          <Card>
            <CardHeader>
              <CardTitle>Saúde das filas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead className="text-right">Pendentes / órfãos</TableHead>
                    <TableHead>Mais antigo</TableHead>
                    <TableHead className="text-right">Idade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhuma fila com pendências.
                      </TableCell>
                    </TableRow>
                  )}
                  {queueEntries.map(([name, info]) => {
                    const orphans = info?.pending_or_orphans ?? 0;
                    const ageMin = info?.oldest_age_seconds ? Math.round(info.oldest_age_seconds / 60) : null;
                    return (
                      <TableRow key={name}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell className="text-right">
                          <span className={orphans > 0 ? 'text-warning font-semibold' : ''}>{orphans}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatBRT(info?.oldest_pending_at)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {ageMin != null ? `${ageMin} min` : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SLOW QUERIES */}
        <TabsContent value="queries">
          <Card>
            <CardHeader>
              <CardTitle>Top 15 queries por tempo total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Query</TableHead>
                      <TableHead className="text-right">Chamadas</TableHead>
                      <TableHead className="text-right">Tempo total</TableHead>
                      <TableHead className="text-right">Médio</TableHead>
                      <TableHead className="text-right">Máximo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(slowQueries.data ?? []).map((q, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <code className="text-xs block max-w-2xl truncate" title={q.query_sample}>
                            {q.query_sample}
                          </code>
                        </TableCell>
                        <TableCell className="text-right">{q.calls?.toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-right">{formatMs(q.total_time_ms)}</TableCell>
                        <TableCell className="text-right">{formatMs(q.mean_time_ms)}</TableCell>
                        <TableCell className="text-right">{formatMs(q.max_time_ms)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* DB */}
        <TabsContent value="db">
          <Card>
            <CardHeader>
              <CardTitle>Banco de dados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Tamanho</p>
                  <p className="font-semibold text-lg">{formatBytes(overview.data?.database_size ?? 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Conexões ativas</p>
                  <p className="font-semibold text-lg">{conn?.active ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Conexões idle</p>
                  <p className="font-semibold text-lg">{conn?.idle ?? 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Idle in transaction</p>
                  <p className="font-semibold text-lg">{conn?.idle_in_transaction ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PlatformSystemHealth() {
  return (
    <PlatformAdminGate
      fallback={
        <div className="container mx-auto py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-10 w-10 mx-auto text-warning mb-3" />
              <h2 className="text-xl font-semibold">Acesso restrito</h2>
              <p className="text-muted-foreground mt-1">
                Esta área é exclusiva para operadores da plataforma.
              </p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <HealthDashboard />
    </PlatformAdminGate>
  );
}
