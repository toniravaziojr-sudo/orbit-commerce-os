import { useQuery } from "@tanstack/react-query";
import { Clock, MessageSquare, Users, ThumbsUp, Timer, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subDays, startOfDay, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function MetricCard({ title, value, description, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            {trend && (
              <span className={trend.isPositive ? 'text-green-600' : 'text-red-600'}>
                {trend.isPositive ? <TrendingUp className="inline h-3 w-3" /> : <TrendingDown className="inline h-3 w-3" />}
                {' '}{trend.value > 0 ? '+' : ''}{trend.value}%
              </span>
            )}
            {description}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SupportMetrics() {
  const { currentTenant } = useAuth();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['support-metrics', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const today = startOfDay(new Date());
      const yesterday = subDays(today, 1);
      const weekAgo = subDays(today, 7);

      // Get today's conversations
      const { data: todayConvs } = await supabase
        .from('conversations')
        .select('id, created_at, resolved_at, first_response_at, csat_score')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', today.toISOString());

      // Get yesterday's conversations for comparison
      const { data: yesterdayConvs } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .gte('created_at', yesterday.toISOString())
        .lt('created_at', today.toISOString());

      // Get all open/waiting conversations
      const { data: openConvs } = await supabase
        .from('conversations')
        .select('id, assigned_to')
        .eq('tenant_id', currentTenant.id)
        .in('status', ['open', 'new', 'waiting_agent', 'waiting_customer']);

      // Get resolved conversations this week
      const { data: resolvedConvs } = await supabase
        .from('conversations')
        .select('id, created_at, resolved_at, first_response_at')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'resolved')
        .gte('resolved_at', weekAgo.toISOString());

      // Calculate metrics
      const todayCount = todayConvs?.length || 0;
      const yesterdayCount = yesterdayConvs?.length || 0;
      const openCount = openConvs?.length || 0;
      const unassignedCount = openConvs?.filter(c => !c.assigned_to).length || 0;
      const resolvedCount = resolvedConvs?.length || 0;

      // Calculate average first response time (in minutes)
      const responseTimes = (todayConvs || [])
        .filter(c => c.first_response_at)
        .map(c => {
          const created = new Date(c.created_at);
          const firstResponse = new Date(c.first_response_at!);
          return (firstResponse.getTime() - created.getTime()) / 1000 / 60; // minutes
        });

      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      // Calculate average resolution time (in hours)
      const resolutionTimes = (resolvedConvs || [])
        .filter(c => c.resolved_at)
        .map(c => {
          const created = new Date(c.created_at);
          const resolved = new Date(c.resolved_at!);
          return (resolved.getTime() - created.getTime()) / 1000 / 60 / 60; // hours
        });

      const avgResolutionTime = resolutionTimes.length > 0
        ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length * 10) / 10
        : 0;

      // Calculate CSAT
      const csatScores = (todayConvs || [])
        .filter(c => c.csat_score)
        .map(c => c.csat_score!);

      const avgCsat = csatScores.length > 0
        ? Math.round(csatScores.reduce((a, b) => a + b, 0) / csatScores.length * 10) / 10
        : null;

      // Calculate trend
      const convTrend = yesterdayCount > 0
        ? Math.round((todayCount - yesterdayCount) / yesterdayCount * 100)
        : 0;

      return {
        todayCount,
        openCount,
        unassignedCount,
        resolvedCount,
        avgResponseTime,
        avgResolutionTime,
        avgCsat,
        convTrend,
      };
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="h-12 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Conversas hoje"
          value={metrics?.todayCount || 0}
          icon={MessageSquare}
          trend={metrics?.convTrend !== undefined ? {
            value: metrics.convTrend,
            isPositive: metrics.convTrend >= 0,
          } : undefined}
          description="vs. ontem"
        />
        <MetricCard
          title="Em aberto"
          value={metrics?.openCount || 0}
          icon={Users}
          description={`${metrics?.unassignedCount || 0} sem atribuição`}
        />
        <MetricCard
          title="Tempo médio resposta"
          value={metrics?.avgResponseTime ? `${metrics.avgResponseTime}min` : '-'}
          icon={Timer}
          description="primeira resposta"
        />
        <MetricCard
          title="CSAT"
          value={metrics?.avgCsat ? `${metrics.avgCsat}/5` : '-'}
          icon={ThumbsUp}
          description="satisfação do cliente"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Resolvidas (7 dias)"
          value={metrics?.resolvedCount || 0}
          icon={Clock}
          description={`Tempo médio: ${metrics?.avgResolutionTime || 0}h`}
        />
      </div>
    </div>
  );
}
