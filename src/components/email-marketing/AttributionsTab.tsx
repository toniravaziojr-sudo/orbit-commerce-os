import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, DollarSign, ShoppingCart, Target } from "lucide-react";

export function AttributionsTab() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const [period, setPeriod] = useState("30");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(period));

  const { data: conversions = [], isLoading } = useQuery({
    queryKey: ["email-conversions", tenantId, period, campaignFilter],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("email_conversions")
        .select("*, email_marketing_campaigns(name), email_marketing_subscribers(email, name)")
        .eq("tenant_id", tenantId)
        .gte("attributed_at", startDate.toISOString())
        .order("attributed_at", { ascending: false });

      if (campaignFilter !== "all") {
        query = query.eq("campaign_id", campaignFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch campaigns for filter
  const { data: campaigns = [] } = useQuery({
    queryKey: ["email-campaigns-filter", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("email_marketing_campaigns")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch order details for conversions
  const orderIds = conversions.map((c: any) => c.order_id).filter(Boolean);
  const { data: orders = [] } = useQuery({
    queryKey: ["email-conversion-orders", orderIds],
    queryFn: async () => {
      if (orderIds.length === 0) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, customer_email")
        .in("id", orderIds);
      return data || [];
    },
    enabled: orderIds.length > 0,
  });

  const ordersMap = new Map(orders.map((o: any) => [o.id, o]));

  // Summary stats
  const totalConversions = conversions.length;
  const totalRevenue = conversions.reduce((sum: number, c: any) => sum + (c.value_cents || 0), 0);
  const avgTicket = totalConversions > 0 ? totalRevenue / totalConversions : 0;

  const formatCurrency = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>

        <Select value={campaignFilter} onValueChange={setCampaignFilter}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Todas as campanhas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as campanhas</SelectItem>
            {campaigns.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Conversões
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConversions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Receita Atribuída
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Ticket Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(avgTicket)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Conversions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Conversões Atribuídas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
          ) : conversions.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Nenhuma conversão"
              description="As conversões serão registradas automaticamente quando clientes que clicaram em campanhas realizarem compras"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium text-muted-foreground">Pedido</th>
                    <th className="pb-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="pb-3 font-medium text-muted-foreground">Campanha</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Valor</th>
                    <th className="pb-3 font-medium text-muted-foreground text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.map((conv: any) => {
                    const order = ordersMap.get(conv.order_id);
                    return (
                      <tr key={conv.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3">
                          <Badge variant="outline" className="font-mono">
                            {order?.order_number || "—"}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div>
                            <p className="font-medium">{order?.customer_name || conv.email_marketing_subscribers?.name || "—"}</p>
                            <p className="text-xs text-muted-foreground">{order?.customer_email || conv.email_marketing_subscribers?.email}</p>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="text-sm">{conv.email_marketing_campaigns?.name || "—"}</span>
                        </td>
                        <td className="py-3 text-right font-medium text-primary">
                          {formatCurrency(conv.value_cents || 0)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {conv.attributed_at
                            ? new Date(conv.attributed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
