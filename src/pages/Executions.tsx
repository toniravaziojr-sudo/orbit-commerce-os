import {
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Filter,
  Search,
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

// This is the Central de Execuções - core for event-driven architecture
// Will show Jobs, Tasks, Scheduled executions, and their statuses

export default function Executions() {
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
