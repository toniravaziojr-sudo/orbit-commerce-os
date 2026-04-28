import { Activity, Database, Clock, Layers, AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, MessageSquare, CreditCard, Inbox } from 'lucide-react';
import { PlatformAdminGate } from '@/components/auth/PlatformAdminGate';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useCronJobsStatus,
  useQueueHealth,
  useSystemHealthOverview,
  useTopSlowQueries,
  useResilienceKpis,
} from '@/hooks/useSystemHealth';
import { WhatsAppIncidentsTab } from '@/components/platform/health/WhatsAppIncidentsTab';
import { PaymentDivergencesTab } from '@/components/platform/health/PaymentDivergencesTab';

function ErrorBanner({ title, error }: { title: string; error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error ?? 'erro desconhecido');
  const isAccessDenied = /access denied|platform admin only|permission denied/i.test(msg);
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex items-start gap-2">
      <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-medium text-destructive">{title}</p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {isAccessDenied
            ? 'Sua conta não está cadastrada como operador de plataforma. Verifique platform_admins.'
            : msg}
        </p>
      </div>
    </div>
  );
}

function TableSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
const BRT_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatBRT(date: string | null | undefined) {
  if (!date) return '—';
  try {
    return BRT_FORMATTER.format(new Date(date));
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
  const overview = useSystemHealthOverview();
  const slowQueries = useTopSlowQueries(15);
  const cronJobs = useCronJobsStatus();
  const queues = useQueueHealth();
  const resilience = useResilienceKpis();

  const isLoading =
    overview.isLoading || slowQueries.isLoading || cronJobs.isLoading || queues.isLoading;
  const isFetching =
    overview.isFetching || slowQueries.isFetching || cronJobs.isFetching || queues.isFetching || resilience.isFetching;

  const refreshAll = () => {
    overview.refetch();
    slowQueries.refetch();
    cronJobs.refetch();
    queues.refetch();
    resilience.refetch();
  };

  // Métricas derivadas — "Indisponível" quando falha (NUNCA cair para 0)
  const conn = overview.data?.connections;
  const overviewUnavailable = !!overview.error || (!overview.isLoading && !overview.data);
  const usagePct = conn ? Math.round((conn.total / conn.max) * 100) : null;
  const cacheRatio = overview.data?.cache_hit_ratio ?? null;

  const connVariant = overviewUnavailable
    ? 'muted'
    : usagePct === null
      ? 'muted'
      : usagePct >= 80 ? 'destructive' : usagePct >= 60 ? 'warning' : 'success';
  const cacheVariant = overviewUnavailable
    ? 'muted'
    : cacheRatio === null
      ? 'muted'
      : cacheRatio >= 99 ? 'success' : cacheRatio >= 95 ? 'warning' : 'destructive';

  const cronUnavailable = !!cronJobs.error || (!cronJobs.isLoading && !cronJobs.data);
  const failedCronTotal = cronUnavailable
    ? null
    : (cronJobs.data ?? []).reduce((acc, j) => acc + (j.failures_last_24h || 0), 0);
  const cronVariant = cronUnavailable
    ? 'muted'
    : (failedCronTotal ?? 0) > 100 ? 'destructive' : (failedCronTotal ?? 0) > 0 ? 'warning' : 'success';

  const queuesUnavailable = !!queues.error || (!queues.isLoading && !queues.data);
  const queueEntries = Object.entries(queues.data ?? {});
  const orphansTotal = queuesUnavailable
    ? null
    : queueEntries.reduce((acc, [, v]) => acc + (v?.pending_or_orphans || 0), 0);
  const queueVariant = queuesUnavailable
    ? 'muted'
    : (orphansTotal ?? 0) > 100 ? 'destructive' : (orphansTotal ?? 0) > 0 ? 'warning' : 'success';

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
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Atualizando...' : 'Atualizar'}
        </Button>
      </div>

      {/* Banner global de erros */}
      {(overview.error || cronJobs.error || queues.error || slowQueries.error) && (
        <div className="space-y-2">
          {overview.error && <ErrorBanner title="Falha ao carregar visão geral" error={overview.error} />}
          {cronJobs.error && <ErrorBanner title="Falha ao carregar tarefas automatizadas" error={cronJobs.error} />}
          {queues.error && <ErrorBanner title="Falha ao carregar filas" error={queues.error} />}
          {slowQueries.error && <ErrorBanner title="Falha ao carregar queries lentas" error={slowQueries.error} />}
        </div>
      )}

      {/* KPIs Onda 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Conexões do banco"
          value={overviewUnavailable ? 'Indisponível' : conn ? `${conn.total} / ${conn.max}` : '—'}
          description={overviewUnavailable ? 'Métrica temporariamente indisponível' : `${usagePct ?? 0}% em uso · ${conn?.active ?? 0} ativas`}
          icon={Database}
          variant={connVariant as any}
        />
        <StatCard
          title="Cache hit ratio"
          value={overviewUnavailable || cacheRatio === null ? 'Indisponível' : `${cacheRatio.toFixed(2)}%`}
          description={overviewUnavailable ? 'Métrica temporariamente indisponível' : (cacheRatio ?? 0) >= 99 ? 'Saudável' : 'Abaixo do alvo (99%+)'}
          icon={Activity}
          variant={cacheVariant as any}
        />
        <StatCard
          title="Falhas de cron (24h)"
          value={cronUnavailable ? 'Indisponível' : failedCronTotal ?? 0}
          description={cronUnavailable ? 'Métrica temporariamente indisponível' : `${(cronJobs.data ?? []).length} jobs ativos`}
          icon={Clock}
          variant={cronVariant as any}
        />
        <StatCard
          title="Pendências em filas"
          value={queuesUnavailable ? 'Indisponível' : orphansTotal ?? 0}
          description={queuesUnavailable ? 'Métrica temporariamente indisponível' : `${queueEntries.length} filas monitoradas`}
          icon={Layers}
          variant={queueVariant as any}
        />
      </div>

      {/* KPIs Onda 2 — Resiliência */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Mensagens WhatsApp travadas"
          value={resilience.error ? 'Indisponível' : resilience.data?.orphan_inbound ?? 0}
          description="Recebidas há mais de 5 min sem processamento"
          icon={Inbox}
          variant={(resilience.data?.orphan_inbound ?? 0) > 0 ? 'warning' : 'success' as any}
        />
        <StatCard
          title="Incidentes WhatsApp abertos"
          value={resilience.error ? 'Indisponível' : resilience.data?.open_incidents ?? 0}
          description="Aguardando ação manual do operador"
          icon={MessageSquare}
          variant={(resilience.data?.open_incidents ?? 0) > 0 ? 'destructive' : 'success' as any}
        />
        <StatCard
          title="Divergências de pagamento (24h)"
          value={resilience.error ? 'Indisponível' : resilience.data?.payment_divergences_24h ?? 0}
          description="Pagamento aprovado sem pedido correspondente"
          icon={CreditCard}
          variant={(resilience.data?.payment_divergences_24h ?? 0) > 0 ? 'destructive' : 'success' as any}
        />
      </div>

      {/* Detalhe */}
      <Tabs defaultValue="cron" className="w-full">
        <TabsList>
          <TabsTrigger value="cron">Tarefas Automatizadas</TabsTrigger>
          <TabsTrigger value="queues">Filas</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="payments">Pagamentos</TabsTrigger>
          <TabsTrigger value="queries">Queries Lentas</TabsTrigger>
          <TabsTrigger value="db">Banco</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <WhatsAppIncidentsTab />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentDivergencesTab />
        </TabsContent>

        {/* CRON */}
        <TabsContent value="cron">
          <Card>
            <CardHeader>
              <CardTitle>Status dos jobs (últimas 24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {cronJobs.isLoading ? (
                <TableSkeleton cols={6} rows={6} />
              ) : cronJobs.error ? (
                <ErrorBanner title="Não foi possível carregar os jobs" error={cronJobs.error} />
              ) : (cronJobs.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum job agendado encontrado.
                </p>
              ) : (
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
              )}
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
              {queues.isLoading ? (
                <TableSkeleton cols={4} rows={4} />
              ) : queues.error ? (
                <ErrorBanner title="Não foi possível carregar as filas" error={queues.error} />
              ) : (
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
              )}
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
              {slowQueries.isLoading ? (
                <TableSkeleton cols={5} rows={6} />
              ) : slowQueries.error ? (
                <ErrorBanner title="Não foi possível carregar as queries" error={slowQueries.error} />
              ) : (slowQueries.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Sem dados ainda. O snapshot de pg_stat_statements precisa acumular consultas.
                </p>
              ) : (
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
              )}
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
