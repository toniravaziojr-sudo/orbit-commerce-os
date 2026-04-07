// =============================================
// GA4 ATTRIBUTION PANEL
// Google Analytics GA4 attribution data for /marketing/atribuicao
// =============================================

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, Link2, RefreshCw } from "lucide-react";
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function GA4AttributionPanel() {
  const { connection, isLoading: connLoading } = useGoogleConnection();
  const { reports, reportsLoading, sync, isSyncing } = useGoogleAnalytics();

  const isConnected = !!connection && connection.status === "active";

  if (!connLoading && !isConnected) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center text-center gap-3">
            <BarChart3 className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Conecte o Google Analytics para ver dados de atribuição do GA4
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="/integrations?tab=google">
                <Link2 className="h-4 w-4 mr-2" />
                Conectar
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Aggregate channel data from daily reports
  const channelData = reports
    .filter((r) => r.report_type === "daily" && r.dimensions?.sessionSource)
    .reduce<Record<string, { source: string; sessions: number; conversions: number; revenue: number }>>(
      (acc, r) => {
        const source = (r.dimensions?.sessionSource as string) || "direct";
        if (!acc[source]) {
          acc[source] = { source, sessions: 0, conversions: 0, revenue: 0 };
        }
        acc[source].sessions += r.metrics?.sessions || 0;
        acc[source].conversions += r.metrics?.conversions || 0;
        acc[source].revenue += r.metrics?.purchaseRevenue || 0;
        return acc;
      },
      {}
    );

  const chartData = Object.values(channelData)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dados GA4
          </CardTitle>
          <CardDescription>Sessões por fonte de tráfego (Google Analytics)</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => sync()}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {reportsLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="source"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === "revenue") return [formatCurrency(value), "Receita"];
                  return [value, name === "sessions" ? "Sessões" : "Conversões"];
                }}
              />
              <Bar dataKey="sessions" name="Sessões" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            Sem dados de atribuição GA4. Sincronize os dados primeiro.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
