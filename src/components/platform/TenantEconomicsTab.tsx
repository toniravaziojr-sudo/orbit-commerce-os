import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface TenantEconomicsRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  total_cost_usd: number;
  total_sell_usd: number;
  margin_usd: number;
  margin_pct: number;
  events_count: number;
  by_category: Record<string, { cost_usd: number; sell_usd: number; count: number }>;
}

const RANGES = {
  "7d":  { label: "Últimos 7 dias",  days: 7  },
  "30d": { label: "Últimos 30 dias", days: 30 },
  "90d": { label: "Últimos 90 dias", days: 90 },
} as const;

const FX = 5.5; // BRL ≈ USD * 5.5 — apenas display

function fmtUSD(n: number) { return `US$ ${(n ?? 0).toFixed(2)}`; }
function fmtBRL(n: number) { return `R$ ${((n ?? 0) * FX).toFixed(2)}`; }

export default function TenantEconomicsTab() {
  const [range, setRange] = useState<keyof typeof RANGES>("30d");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tenant-economics", range],
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - RANGES[range].days);
      const { data, error } = await supabase.rpc("admin_tenant_economics" as never, {
        p_start_date: start.toISOString(),
        p_end_date: end.toISOString(),
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as TenantEconomicsRow[];
    },
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    const list = data ?? [];
    return list.reduce(
      (acc, r) => {
        acc.cost += Number(r.total_cost_usd) || 0;
        acc.sell += Number(r.total_sell_usd) || 0;
        acc.events += Number(r.events_count) || 0;
        return acc;
      },
      { cost: 0, sell: 0, events: 0 }
    );
  }, [data]);

  const totalMargin = totals.sell - totals.cost;
  const totalMarginPct = totals.sell > 0 ? (totalMargin / totals.sell) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Economia por Tenant</h2>
          <p className="text-sm text-muted-foreground">
            Quanto cada cliente custou (provedor real) versus quanto foi cobrado em créditos. Apenas eventos com débito efetivo (capture).
          </p>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as keyof typeof RANGES)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(RANGES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Custo total (provedor)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtUSD(totals.cost)}</div>
            <div className="text-xs text-muted-foreground">{fmtBRL(totals.cost)}</div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Receita de uso (créditos)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtUSD(totals.sell)}</div>
            <div className="text-xs text-muted-foreground">{fmtBRL(totals.sell)}</div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Margem</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalMargin >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmtUSD(totalMargin)}</div>
            <div className="text-xs text-muted-foreground">{totalMarginPct.toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Eventos cobrados</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.events.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground">no período</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por tenant</CardTitle>
          <CardDescription>Ordenado pela maior receita no período. Tenants sem uso não aparecem.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
          ) : (data ?? []).length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum consumo registrado no período.</div>
          ) : (
            <table className="w-full">
              <thead className="border-t border-b bg-muted/40">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 px-4 font-medium">Tenant</th>
                  <th className="py-2 px-4 font-medium">Custo</th>
                  <th className="py-2 px-4 font-medium">Receita</th>
                  <th className="py-2 px-4 font-medium">Margem</th>
                  <th className="py-2 px-4 font-medium">% Margem</th>
                  <th className="py-2 px-4 font-medium">Eventos</th>
                  <th className="py-2 px-4 font-medium">Categorias</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data ?? []).map((r) => {
                  const cats = Object.entries(r.by_category ?? {});
                  const positive = Number(r.margin_usd) >= 0;
                  return (
                    <tr key={r.tenant_id}>
                      <td className="py-3 px-4">
                        <div className="font-medium">{r.tenant_name || r.tenant_slug}</div>
                        <div className="text-xs text-muted-foreground">{r.tenant_slug}</div>
                      </td>
                      <td className="py-3 px-4 text-sm">{fmtUSD(Number(r.total_cost_usd))}</td>
                      <td className="py-3 px-4 text-sm">{fmtUSD(Number(r.total_sell_usd))}</td>
                      <td className={`py-3 px-4 text-sm font-medium ${positive ? "text-emerald-600" : "text-destructive"}`}>
                        {fmtUSD(Number(r.margin_usd))}
                      </td>
                      <td className="py-3 px-4 text-sm">{Number(r.margin_pct).toFixed(1)}%</td>
                      <td className="py-3 px-4 text-sm">{Number(r.events_count).toLocaleString("pt-BR")}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {cats.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          {cats.map(([cat, v]) => (
                            <Badge key={cat} variant="outline" className="text-[10px]">
                              {cat}: {fmtUSD(Number(v.sell_usd))}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
