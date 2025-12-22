import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Navigate } from 'react-router-dom';
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
  Loader2,
  Users,
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { 
  useHealthChecks, 
  useHealthCheckTargets,
  useRunHealthCheck,
  useAggregatedHealthStats,
  HealthCheck
} from '@/hooks/useHealthChecks';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
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
  
  const { isPlatformOperator, isLoading: authLoading } = usePlatformOperator();
  
  // Platform operators see all tenants' data
  const { data: checks = [], isLoading: checksLoading, refetch } = useHealthChecks(7, true);
  const { data: targets = [], isLoading: targetsLoading } = useHealthCheckTargets(true);
  const aggregatedStats = useAggregatedHealthStats();
  const runHealthCheck = useRunHealthCheck();

  // Block access if not platform operator
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isPlatformOperator) {
    // Show toast and redirect
    toast.error('Acesso restrito: você não tem permissão para acessar este painel.');
    return <Navigate to="/" replace />;
  }

  const handleRunCheck = async () => {
    try {
      await runHealthCheck.mutateAsync();
      toast.success('Verificação iniciada para todos os alvos');
      setTimeout(() => refetch(), 3000);
    } catch (error) {
      toast.error('Erro ao iniciar verificação');
    }
  };

  // Group checks by tenant for drill-down view
  const checksByTenant = checks.reduce((acc, check) => {
    if (!acc[check.tenant_id]) {
      acc[check.tenant_id] = [];
    }
    acc[check.tenant_id].push(check);
    return acc;
  }, {} as Record<string, HealthCheck[]>);

  // Get tenant status (worst status in last 24h)
  const getTenantStatus = (tenantChecks: HealthCheck[]): 'pass' | 'fail' | 'partial' => {
    const last24h = tenantChecks.filter(c => {
      const checkDate = new Date(c.ran_at);
      const now = new Date();
      return (now.getTime() - checkDate.getTime()) < 24 * 60 * 60 * 1000;
    });
    
    if (last24h.some(c => c.status === 'fail')) return 'fail';
    if (last24h.some(c => c.status === 'partial')) return 'partial';
    return 'pass';
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Health Monitor
              </h1>
              <Badge variant="outline" className="ml-2">
                <ShieldAlert className="h-3 w-3 mr-1" />
                Painel Operador
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Monitoramento agregado de saúde de todas as lojas da plataforma
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
              Executar Todos
            </Button>
            <Button onClick={() => setTargetDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Alvo
            </Button>
          </div>
        </div>

        {/* Aggregated Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Tenants Monitorados"
            value={aggregatedStats.totalTenants}
            icon={Users}
            description="Lojas ativas"
          />
          <StatCard
            title="Tenants c/ Problemas"
            value={aggregatedStats.tenantsWithIssues}
            icon={AlertTriangle}
            variant={aggregatedStats.tenantsWithIssues > 0 ? 'destructive' : 'default'}
            description="Falhas nas últimas 24h"
          />
          <StatCard
            title="Uptime Global"
            value={`${aggregatedStats.uptimePercent}%`}
            icon={Activity}
            variant={aggregatedStats.uptimePercent < 90 ? 'destructive' : 'success'}
            description={`${aggregatedStats.totalChecks} verificações`}
          />
          <StatCard
            title="Última Verificação"
            value={aggregatedStats.lastCheckAt ? format(new Date(aggregatedStats.lastCheckAt), 'HH:mm') : '-'}
            icon={Clock}
            description={aggregatedStats.lastCheckAt ? format(new Date(aggregatedStats.lastCheckAt), 'dd/MM') : '-'}
          />
        </div>

        <Tabs defaultValue="tenants" className="space-y-4">
          <TabsList>
            <TabsTrigger value="tenants">
              Visão por Tenant ({Object.keys(checksByTenant).length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Histórico Geral
            </TabsTrigger>
            <TabsTrigger value="targets">
              Alvos Monitorados ({targets.length})
            </TabsTrigger>
          </TabsList>

          {/* Tenant Overview */}
          <TabsContent value="tenants" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Status por Tenant</CardTitle>
                <CardDescription>
                  Visão agregada de cada loja monitorada
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.keys(checksByTenant).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum tenant com verificações ainda.</p>
                    <p className="text-sm">Configure alvos e execute a primeira verificação.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(checksByTenant).map(([tenantId, tenantChecks]) => {
                      const status = getTenantStatus(tenantChecks);
                      const config = statusConfig[status];
                      const StatusIcon = config.icon;
                      const lastCheck = tenantChecks[0];
                      const target = targets.find(t => t.tenant_id === tenantId);

                      return (
                        <div
                          key={tenantId}
                          className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedCheck(lastCheck)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${config.bg}`}>
                              <StatusIcon className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {target?.label || tenantId.slice(0, 8)}
                                </span>
                                <Badge variant={status === 'pass' ? 'secondary' : 'destructive'}>
                                  {config.label}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {target?.storefront_base_url || 'URL não configurada'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            <p>{tenantChecks.length} verificações</p>
                            <p>Última: {format(new Date(lastCheck.ran_at), 'dd/MM HH:mm')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* General History */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Verificações Recentes</CardTitle>
                <CardDescription>Últimos 7 dias de monitoramento de todas as lojas</CardDescription>
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
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {checks.map((check) => {
                      const config = statusConfig[check.status];
                      const StatusIcon = config.icon;
                      const target = targets.find(t => t.tenant_id === check.tenant_id);

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
                                <span className="font-medium text-xs text-muted-foreground">
                                  {target?.label || check.tenant_id.slice(0, 8)}
                                </span>
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

          {/* Targets */}
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {target.tenant_id.slice(0, 8)}
                          </Badge>
                          <Button variant="ghost" size="icon">
                            <Settings2 className="h-4 w-4" />
                          </Button>
                        </div>
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
    </>
  );
}
