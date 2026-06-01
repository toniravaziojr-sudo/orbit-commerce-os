// =============================================
// SALES PREVIEW BLOCK — Top 5 cards no dashboard
// =============================================
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Package, MapPin, Building2, CreditCard } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  useSalesByProduct,
  useSalesByState,
  useSalesByCity,
  useSalesByPaymentMethod,
  ReportFilters,
} from "@/hooks/useReports";

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

// Paleta de gráficos via tokens HSL do design system
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, var(--accent)))",
  "hsl(var(--chart-3, 173 58% 39%))",
  "hsl(var(--chart-4, 43 74% 49%))",
  "hsl(var(--chart-5, 27 87% 57%))",
];

interface Props {
  filters: ReportFilters;
}

export function SalesPreviewBlock({ filters }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Preview de Vendas</h2>
        <span className="text-xs text-muted-foreground">Top 5 do período selecionado</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TopProductsCard filters={filters} />
        <PaymentMixCard filters={filters} />
        <TopStatesCard filters={filters} />
        <TopCitiesCard filters={filters} />
      </div>
    </div>
  );
}

function PreviewCard({
  title,
  icon: Icon,
  href,
  children,
}: {
  title: string;
  icon: any;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
          <Link to={href}>
            Ver mais <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState({ msg = "Sem vendas no período" }: { msg?: string }) {
  return <p className="text-sm text-muted-foreground py-10 text-center">{msg}</p>;
}

function LoadingChart() {
  return <Skeleton className="h-[220px] w-full" />;
}

function TopProductsCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useSalesByProduct(filters, 5);
  return (
    <PreviewCard title="Top 5 produtos mais vendidos" icon={Package} href="/reports?tab=products">
      {isLoading ? (
        <LoadingChart />
      ) : !data || data.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-3">
          {data.slice(0, 5).map((p, i) => (
            <li key={p.product_id} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-xs text-muted-foreground font-medium">#{i + 1}</span>
              {p.product_image ? (
                <img src={p.product_image} alt="" className="w-9 h-9 object-cover rounded" />
              ) : (
                <div className="w-9 h-9 bg-muted rounded" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.product_name}</p>
                <p className="text-xs text-muted-foreground">{p.quantity_sold} unidades vendidas</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatBRL(p.total_revenue)}</span>
            </li>
          ))}
        </ul>
      )}
    </PreviewCard>
  );
}

function HorizontalBarChart({
  data,
  labelKey,
}: {
  data: Array<{ label: string; revenue: number; orders: number }>;
  labelKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: any, _name, props: any) => [
            `${formatBRL(value)} • ${props.payload.orders} pedidos`,
            labelKey,
          ]}
        />
        <Bar dataKey="revenue" radius={[4, 4, 4, 4]} barSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function TopStatesCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useSalesByState(filters);
  const top = (data || []).slice(0, 5).map((s) => ({
    label: s.state,
    revenue: s.total_revenue,
    orders: s.orders_count,
  }));
  return (
    <PreviewCard title="Top 5 estados" icon={MapPin} href="/reports?tab=regions&view=states">
      {isLoading ? (
        <LoadingChart />
      ) : top.length === 0 ? (
        <EmptyState />
      ) : (
        <HorizontalBarChart data={top} labelKey="Estado" />
      )}
    </PreviewCard>
  );
}

function TopCitiesCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useSalesByCity(filters);
  const top = (data || []).slice(0, 5).map((c) => ({
    label: `${c.city}/${c.state}`,
    revenue: c.total_revenue,
    orders: c.orders_count,
  }));
  return (
    <PreviewCard title="Top 5 cidades" icon={Building2} href="/reports?tab=regions&view=cities">
      {isLoading ? (
        <LoadingChart />
      ) : top.length === 0 ? (
        <EmptyState />
      ) : (
        <HorizontalBarChart data={top} labelKey="Cidade" />
      )}
    </PreviewCard>
  );
}

function PaymentMixCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useSalesByPaymentMethod(filters);
  const top = (data || []).slice(0, 5);
  return (
    <PreviewCard title="Vendas por forma de pagamento" icon={CreditCard} href="/reports?tab=payments">
      {isLoading ? (
        <LoadingChart />
      ) : top.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-[140px] h-[160px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={top}
                  dataKey="total_revenue"
                  nameKey="payment_method"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={2}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {top.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: any, props: any) => [
                    `${formatBRL(value)} • ${props.payload.orders_count} pedidos`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="flex-1 space-y-2 min-w-0">
            {top.map((p, i) => (
              <li key={p.payment_method} className="flex items-center gap-2 text-sm">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span className="flex-1 truncate font-medium">{p.payment_method}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {p.orders_count} ped
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {p.percentage.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </PreviewCard>
  );
}
