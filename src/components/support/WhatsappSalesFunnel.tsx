import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, CheckCircle2, UserMinus, Package, DollarSign, TrendingUp } from "lucide-react";

interface FunnelRow {
  day: string | null;
  tenant_id: string | null;
  total_carts: number | null;
  carts_with_items: number | null;
  carts_converted: number | null;
  carts_handoff: number | null;
  orders_generated: number | null;
  revenue: number | null;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

export function WhatsappSalesFunnel() {
  const { currentTenant } = useAuth();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["whatsapp-sales-funnel", currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("whatsapp_sales_funnel_view")
        .select("*")
        .eq("tenant_id", currentTenant!.id)
        .gte("day", since.toISOString().slice(0, 10))
        .order("day", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FunnelRow[];
    },
  });

  const totals = (rows ?? []).reduce(
    (acc, r) => {
      acc.total_carts += r.total_carts ?? 0;
      acc.carts_with_items += r.carts_with_items ?? 0;
      acc.carts_converted += r.carts_converted ?? 0;
      acc.carts_handoff += r.carts_handoff ?? 0;
      acc.orders_generated += r.orders_generated ?? 0;
      acc.revenue += Number(r.revenue ?? 0);
      return acc;
    },
    { total_carts: 0, carts_with_items: 0, carts_converted: 0, carts_handoff: 0, orders_generated: 0, revenue: 0 }
  );

  const conversionRate = totals.carts_with_items > 0
    ? (totals.orders_generated / totals.carts_with_items) * 100
    : 0;

  const cards = [
    { label: "Carrinhos (com itens)", value: totals.carts_with_items, icon: ShoppingCart, color: "text-primary" },
    { label: "Carrinhos convertidos", value: totals.carts_converted, icon: CheckCircle2, color: "text-emerald-500" },
    { label: "Handoffs comerciais", value: totals.carts_handoff, icon: UserMinus, color: "text-amber-500" },
    { label: "Pedidos gerados", value: totals.orders_generated, icon: Package, color: "text-blue-500" },
    { label: "Receita (R$)", value: fmtCurrency(totals.revenue), icon: DollarSign, color: "text-emerald-500", isText: true },
    { label: "Taxa de conversão", value: `${conversionRate.toFixed(1)}%`, icon: TrendingUp, color: "text-primary", isText: true },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Funil de Vendas WhatsApp</h2>
        <p className="text-sm text-muted-foreground">Últimos 30 dias — carrinhos, conversões, handoffs, pedidos e receita.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold">{c.isText ? c.value : (c.value as number).toLocaleString("pt-BR")}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Por dia (últimos 30)</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !rows?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados de funil no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4">Dia</th>
                    <th className="py-2 pr-4">Carrinhos</th>
                    <th className="py-2 pr-4">Convertidos</th>
                    <th className="py-2 pr-4">Handoffs</th>
                    <th className="py-2 pr-4">Pedidos</th>
                    <th className="py-2 pr-4">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 pr-4">{r.day ? new Date(r.day).toLocaleDateString("pt-BR") : "—"}</td>
                      <td className="py-2 pr-4">{r.carts_with_items ?? 0}</td>
                      <td className="py-2 pr-4">{r.carts_converted ?? 0}</td>
                      <td className="py-2 pr-4">{r.carts_handoff ?? 0}</td>
                      <td className="py-2 pr-4">{r.orders_generated ?? 0}</td>
                      <td className="py-2 pr-4">{fmtCurrency(Number(r.revenue ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
