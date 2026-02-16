import {
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Filter,
  Search,
  Wallet,
  Megaphone,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useAdsBalanceMonitor } from "@/hooks/useAdsBalanceMonitor";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// This is the Central de Execuções - core for event-driven architecture
// Will show Jobs, Tasks, Scheduled executions, and their statuses

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function Executions() {
  const navigate = useNavigate();
  const adsMonitor = useAdsBalanceMonitor();

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader
        title="Central de Execuções"
        description="Monitore jobs, tarefas agendadas e execuções do sistema"
        actions={
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Em Execução"
          value="0"
          icon={Activity}
          variant="primary"
        />
        <StatCard
          title="Na Fila"
          value="0"
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Concluídos (24h)"
          value="0"
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Falhas (24h)"
          value="0"
          icon={XCircle}
          variant="destructive"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por ID, tipo ou descrição..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-3">
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="queued">Na fila</SelectItem>
                  <SelectItem value="running">Executando</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="failed">Falha</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="all">
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="notification">Notificação</SelectItem>
                  <SelectItem value="automation">Automação</SelectItem>
                  <SelectItem value="integration">Integração</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executions List - Empty State */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Activity}
            title="Nenhuma execução encontrada"
            description="Quando você configurar automações, notificações ou integrações, as execuções aparecerão aqui com rastreabilidade completa."
          />
        </CardContent>
      </Card>

      {/* Ads Balance Monitoring Card */}
      <Card className={adsMonitor.lowBalanceCount > 0 ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`rounded-lg p-2 ${adsMonitor.lowBalanceCount > 0 ? "bg-destructive/10" : "bg-warning/10"}`}>
                <Megaphone className={`h-4 w-4 ${adsMonitor.lowBalanceCount > 0 ? "text-destructive" : "text-warning"}`} />
              </div>
              <CardTitle className="text-base font-semibold">Anúncios — Saldo & Campanhas</CardTitle>
              {adsMonitor.lowBalanceCount > 0 && (
                <Badge variant="destructive" className="text-[10px] h-5">
                  {adsMonitor.lowBalanceCount} conta{adsMonitor.lowBalanceCount > 1 ? "s" : ""} com saldo baixo
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/ads")}>
              <Wallet className="h-3 w-3" />
              Ver contas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Low balance alerts */}
            {adsMonitor.lowBalanceCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Recarga necessária!</p>
                  <div className="mt-1 space-y-0.5">
                    {adsMonitor.lowBalanceAccounts.map(acc => (
                      <p key={acc.id} className="text-xs text-destructive/80">
                        <span className="font-medium">{acc.name}</span>: saldo restante {formatCurrency(acc.balance_cents)}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-destructive/70 mt-1">
                    Faça uma recarga via PIX ou boleto para evitar pausas automáticas nas campanhas.
                  </p>
                </div>
              </div>
            )}

            {adsMonitor.zeroBalanceCount > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-destructive">Saldo zerado!</p>
                  <div className="mt-1 space-y-0.5">
                    {adsMonitor.zeroBalanceAccounts.map(acc => (
                      <p key={acc.id} className="text-xs text-destructive/80">
                        <span className="font-medium">{acc.name}</span>: sem saldo — campanhas serão pausadas automaticamente.
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!adsMonitor.hasData && !adsMonitor.isLoading && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-background border">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Monitoramento de saldo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Contas pré-pagas (PIX, boleto) são monitoradas automaticamente. Conecte um canal de anúncios para ativar alertas de saldo baixo.
                  </p>
                </div>
              </div>
            )}

            {adsMonitor.hasData && adsMonitor.lowBalanceCount === 0 && adsMonitor.zeroBalanceCount === 0 && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-background border">
                <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Todos os saldos OK</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Nenhuma conta pré-paga com saldo baixo detectada.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-md bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Contas monitoradas</p>
                {adsMonitor.isLoading ? (
                  <Skeleton className="h-7 w-12 mx-auto mt-1" />
                ) : (
                  <p className="text-lg font-bold text-foreground mt-1">
                    {adsMonitor.hasData ? adsMonitor.totalAccounts : "—"}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-md bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Saldo baixo</p>
                {adsMonitor.isLoading ? (
                  <Skeleton className="h-7 w-12 mx-auto mt-1" />
                ) : (
                  <p className={`text-lg font-bold mt-1 ${adsMonitor.lowBalanceCount > 0 ? "text-destructive" : "text-foreground"}`}>
                    {adsMonitor.hasData ? adsMonitor.lowBalanceCount + adsMonitor.zeroBalanceCount : "—"}
                  </p>
                )}
              </div>
              <div className="p-3 rounded-md bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Campanhas ativas</p>
                {adsMonitor.isLoading ? (
                  <Skeleton className="h-7 w-12 mx-auto mt-1" />
                ) : (
                  <p className="text-lg font-bold text-foreground mt-1">
                    {adsMonitor.hasData ? adsMonitor.activeCampaigns : "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Agendamentos</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tarefas programadas para execução futura com delays e condições.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-warning/10 p-2.5">
                <RefreshCw className="h-5 w-5 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Retry Automático</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Falhas são reprocessadas automaticamente com backoff exponencial.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-success/10 p-2.5">
                <CheckCircle className="h-5 w-5 text-success" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Idempotência</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Execuções são idempotentes e rastreáveis para auditoria completa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
