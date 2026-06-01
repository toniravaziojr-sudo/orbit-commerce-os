// =============================================
// SALES PREVIEW BLOCK — Top 5 cards no dashboard
// =============================================
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Package, MapPin, Building2, CreditCard } from "lucide-react";
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
        <TopStatesCard filters={filters} />
        <TopCitiesCard filters={filters} />
        <PaymentMixCard filters={filters} />
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
  return <p className="text-sm text-muted-foreground py-6 text-center">{msg}</p>;
}

function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

function TopProductsCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useSalesByProduct(filters, 5);
  return (
    <PreviewCard title="Top 5 produtos mais vendidos" icon={Package} href="/reports?tab=products">
      {isLoading ? (
        <LoadingRows />
      ) : !data || data.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {data.slice(0, 5).map((p, i) => (
            <li key={p.product_id} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-xs text-muted-foreground font-medium">#{i + 1}</span>
              {p.product_image ? (
                <img src={p.product_image} alt="" className="w-8 h-8 object-cover rounded" />
              ) : (
                <div className="w-8 h-8 bg-muted rounded" />
              )}
              <span className="flex-1 truncate font-medium">{p.product_name}</span>
              <span className="text-xs text-muted-foreground">{p.quantity_sold} un</span>
              <span className="text-sm font-semibold tabular-nums">{formatBRL(p.total_revenue)}</span>
            </li>
          ))}
        </ul>
      )}
    </PreviewCard>
  );
}

function TopStatesCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useSalesByState(filters);
  const top = (data || []).slice(0, 5);
  const max = top[0]?.total_revenue || 1;
  return (
    <PreviewCard title="Top 5 estados" icon={MapPin} href="/reports?tab=regions&view=states">
      {isLoading ? (
        <LoadingRows />
      ) : top.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {top.map((s, i) => (
            <li key={s.state} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  <span className="text-xs text-muted-foreground mr-2">#{i + 1}</span>
                  {s.state}
                </span>
                <span className="font-semibold tabular-nums">{formatBRL(s.total_revenue)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(s.total_revenue / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PreviewCard>
  );
}

function TopCitiesCard({ filters }: { filters: ReportFilters }) {
  const { data, isLoading } = useSalesByCity(filters);
  const top = (data || []).slice(0, 5);
  const max = top[0]?.total_revenue || 1;
  return (
    <PreviewCard title="Top 5 cidades" icon={Building2} href="/reports?tab=regions&view=cities">
      {isLoading ? (
        <LoadingRows />
      ) : top.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {top.map((c, i) => (
            <li key={`${c.state}-${c.city}`} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate pr-2">
                  <span className="text-xs text-muted-foreground mr-2">#{i + 1}</span>
                  {c.city} <span className="text-xs text-muted-foreground">/ {c.state}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatBRL(c.total_revenue)}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${(c.total_revenue / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
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
        <LoadingRows />
      ) : top.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {top.map((p, i) => (
            <li key={p.payment_method} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  <span className="text-xs text-muted-foreground mr-2">#{i + 1}</span>
                  {p.payment_method}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatBRL(p.total_revenue)}{" "}
                  <span className="text-xs text-muted-foreground">({p.percentage.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${p.percentage}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PreviewCard>
  );
}
