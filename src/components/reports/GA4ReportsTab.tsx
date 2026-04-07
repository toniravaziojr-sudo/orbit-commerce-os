// =============================================
// GA4 REPORTS TAB
// Google Analytics GA4 data tab for /reports page
// =============================================

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { StatCard } from "@/components/ui/stat-card";
import {
  Activity,
  Users,
  UserPlus,
  Eye,
  Target,
  DollarSign,
  TrendingDown,
  RefreshCw,
  Loader2,
  BarChart3,
  Info,
  Zap,
  Link2,
} from "lucide-react";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pt-BR");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function GA4ReportsTab() {
  const { isConnected, isLoading: connLoading } = useGoogleConnection();
  const {
    summary,
    summaryLoading,
    realtime,
    realtimeLoading,
    reports,
    reportsLoading,
    sync,
    isSyncing,
  } = useGoogleAnalytics();

  // Not connected state
  if (!connLoading && !isConnected) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Google Analytics não conectado</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Conecte sua conta Google em Integrações → Google para ver os dados do GA4 aqui.
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/integrations?tab=google">
                <Link2 className="h-4 w-4 mr-2" />
                Ir para Integrações
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isLoading = summaryLoading || connLoading;

  return (
    <div className="space-y-6">
      {/* Realtime Banner */}
      {realtime && !realtimeLoading && (
        <Alert className="border-green-500/30 bg-green-500/5">
          <Zap className="h-4 w-4 text-green-600" />
          <AlertDescription className="flex items-center gap-4">
            <span className="font-medium text-green-700">
              Tempo Real:
            </span>
            <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
              {realtime.activeUsers} usuários ativos agora
            </Badge>
            <span className="text-sm text-muted-foreground">
              {realtime.screenPageViews} pageviews • {realtime.conversions} conversões
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Sync Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Dados dos últimos 30 dias do Google Analytics 4
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => sync({})}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sincronizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Sessões"
          value={isLoading ? "..." : formatNumber(summary?.sessions || 0)}
          icon={Activity}
          variant="primary"
        />
        <StatCard
          title="Usuários"
          value={isLoading ? "..." : formatNumber(summary?.totalUsers || 0)}
          icon={Users}
        />
        <StatCard
          title="Novos Usuários"
          value={isLoading ? "..." : formatNumber(summary?.newUsers || 0)}
          icon={UserPlus}
          variant="success"
        />
        <StatCard
          title="Pageviews"
          value={isLoading ? "..." : formatNumber(summary?.pageViews || 0)}
          icon={Eye}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Conversões"
          value={isLoading ? "..." : formatNumber(summary?.conversions || 0)}
          icon={Target}
          variant="primary"
        />
        <StatCard
          title="Receita"
          value={isLoading ? "..." : formatCurrency(summary?.revenue || 0)}
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="Taxa de Rejeição"
          value={isLoading ? "..." : formatPercent(summary?.avgBounceRate || 0)}
          icon={TrendingDown}
          description="Média do período"
        />
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendência Diária</CardTitle>
          <CardDescription>Sessões e pageviews nos últimos 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Carregando...
            </div>
          ) : reports && reports.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={reports
                  .filter((r) => r.report_type === "daily")
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((r) => ({
                    date: r.date.slice(5), // MM-DD
                    sessions: r.metrics?.sessions || 0,
                    pageViews: r.metrics?.screenPageViews || r.metrics?.pageViews || 0,
                    users: r.metrics?.totalUsers || 0,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="sessions"
                  name="Sessões"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.2}
                />
                <Area
                  type="monotone"
                  dataKey="pageViews"
                  name="Pageviews"
                  stroke="hsl(var(--accent-foreground))"
                  fill="hsl(var(--accent-foreground))"
                  fillOpacity={0.1}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum dado disponível</p>
                <p className="text-xs mt-1">Clique em "Sincronizar" para buscar dados do GA4</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users vs New Users Bar Chart */}
      {reports && reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usuários vs Novos Usuários</CardTitle>
            <CardDescription>Comparativo diário de retenção</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={reports
                  .filter((r) => r.report_type === "daily")
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((r) => ({
                    date: r.date.slice(5),
                    totalUsers: r.metrics?.totalUsers || 0,
                    newUsers: r.metrics?.newUsers || 0,
                  }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalUsers" name="Total" fill="hsl(var(--primary))" />
                <Bar dataKey="newUsers" name="Novos" fill="hsl(var(--chart-2, 142 71% 45%))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
