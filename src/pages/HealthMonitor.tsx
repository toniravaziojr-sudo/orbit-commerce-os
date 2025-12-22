import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Globe, 
  Plus, 
  RefreshCw, 
  Settings2, 
  XCircle,
  Loader2 
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { 
  useHealthChecks, 
  useHealthCheckStats, 
  useHealthCheckTargets,
  useRunHealthCheck,
  HealthCheck
} from '@/hooks/useHealthChecks';
import { HealthCheckTargetDialog } from '@/components/health/HealthCheckTargetDialog';
import { HealthCheckDetailDialog } from '@/components/health/HealthCheckDetailDialog';
import { toast } from 'sonner';

const statusConfig = {
  pass: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'OK' },
  fail: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Falha' },
  partial: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Parcial' },
};

export default function HealthMonitor() {
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<HealthCheck | null>(null);
  
  const { data: checks = [], isLoading: checksLoading, refetch } = useHealthChecks(7);
  const { data: targets = [], isLoading: targetsLoading } = useHealthCheckTargets();
  const stats = useHealthCheckStats();
  const runHealthCheck = useRunHealthCheck();

  const handleRunCheck = async () => {
    try {
      await runHealthCheck.mutateAsync();
      toast.success('Verificação iniciada');
      setTimeout(() => refetch(), 3000);
    } catch (error) {
      toast.error('Erro ao iniciar verificação');
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Health Monitor
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Monitoramento automático de saúde do sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handleRunCheck}
              disabled={runHealthCheck.isPending}
            >
              {runHealthCheck.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Executar Agora
            </Button>
            <Button onClick={() => setTargetDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Alvo
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Uptime (24h)"
            value={`${stats.uptime}%`}
            icon={Activity}
            description={`${stats.total} verificações`}
          />
          <StatCard
            title="Passaram"
            value={stats.passed}
            icon={CheckCircle2}
            variant="success"
            description="Últimas 24h"
          />
          <StatCard
            title="Falharam"
            value={stats.failed}
            icon={XCircle}
            variant="destructive"
            description="Últimas 24h"
          />
          <StatCard
            title="Última Verificação"
            value={stats.lastCheck ? format(new Date(stats.lastCheck.ran_at), 'HH:mm') : '-'}
            icon={Clock}
            description={stats.lastCheck ? format(new Date(stats.lastCheck.ran_at), 'dd/MM') : '-'}
          />
        </div>

        <Tabs defaultValue="history" className="space-y-4">
          <TabsList>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="targets">
              Alvos Monitorados ({targets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Verificações Recentes</CardTitle>
                <CardDescription>Últimos 7 dias de monitoramento</CardDescription>
              </CardHeader>
              <CardContent>
                {checksLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : checks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma verificação registrada ainda.</p>
                    <p className="text-sm">Configure alvos e execute a primeira verificação.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {checks.map((check) => {
                      const config = statusConfig[check.status];
                      const StatusIcon = config.icon;

                      return (
                        <div
                          key={check.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedCheck(check)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${config.bg}`}>
                              <StatusIcon className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {format(new Date(check.ran_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                                <Badge variant={check.status === 'pass' ? 'secondary' : 'destructive'}>
                                  {config.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {check.summary || 'Verificação completa'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {check.duration_ms && `${check.duration_ms}ms`}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="targets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Alvos de Monitoramento</CardTitle>
                <CardDescription>
                  URLs e domínios que são verificados automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent>
                {targetsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : targets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum alvo configurado.</p>
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setTargetDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Primeiro Alvo
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {targets.map((target) => (
                      <div
                        key={target.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{target.label}</span>
                              {!target.is_enabled && (
                                <Badge variant="outline">Desabilitado</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {target.storefront_base_url}
                            </p>
                            {target.shops_base_url && (
                              <p className="text-xs text-muted-foreground">
                                + {target.shops_base_url}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon">
                          <Settings2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <HealthCheckTargetDialog 
        open={targetDialogOpen} 
        onOpenChange={setTargetDialogOpen} 
      />

      <HealthCheckDetailDialog
        check={selectedCheck}
        onOpenChange={(open) => !open && setSelectedCheck(null)}
      />
    </AppShell>
  );
}
