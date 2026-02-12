import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  Package,
  Eye,
  ShoppingCart,
  DollarSign,
  RefreshCw,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MeliMetrics {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalSold: number;
  totalRevenue: number;
  listings: Array<{
    meli_item_id: string;
    title: string;
    price: number;
    available_quantity: number;
    sold_quantity: number;
    visits: number;
    permalink: string;
    status: string;
    health: string;
  }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function MeliMetricsTab() {
  const { currentTenant, session } = useAuth();
  const [metrics, setMetrics] = useState<MeliMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    if (!currentTenant?.id || !session?.access_token) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get ML connection
      const { data: connection } = await supabase
        .from("marketplace_connections")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("marketplace", "mercadolivre")
        .eq("is_active", true)
        .single();

      if (!connection?.access_token) {
        setError("Mercado Livre não conectado");
        return;
      }

      const accessToken = connection.access_token;
      const sellerId = connection.external_user_id;

      // Fetch seller items
      const itemsRes = await fetch(
        `https://api.mercadolibre.com/users/${sellerId}/items/search?limit=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!itemsRes.ok) {
        setError("Erro ao buscar dados do Mercado Livre");
        return;
      }

      const itemsData = await itemsRes.json();
      const itemIds = itemsData.results || [];

      if (itemIds.length === 0) {
        setMetrics({
          totalListings: 0,
          activeListings: 0,
          totalViews: 0,
          totalSold: 0,
          totalRevenue: 0,
          listings: [],
        });
        return;
      }

      // Fetch item details in batches (max 20 per request)
      const listings: MeliMetrics["listings"] = [];
      const batchSize = 20;

      for (let i = 0; i < itemIds.length; i += batchSize) {
        const batch = itemIds.slice(i, i + batchSize);
        const multigetRes = await fetch(
          `https://api.mercadolibre.com/items?ids=${batch.join(",")}&attributes=id,title,price,available_quantity,sold_quantity,permalink,status,health`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (multigetRes.ok) {
          const multigetData = await multigetRes.json();
          for (const item of multigetData) {
            if (item.code === 200 && item.body) {
              const b = item.body;
              listings.push({
                meli_item_id: b.id,
                title: b.title,
                price: b.price || 0,
                available_quantity: b.available_quantity || 0,
                sold_quantity: b.sold_quantity || 0,
                visits: 0, // Will be fetched separately if needed
                permalink: b.permalink || "",
                status: b.status || "unknown",
                health: b.health || 0,
              });
            }
          }
        }
      }

      // Fetch visits for active items (optional - can fail)
      try {
        for (const listing of listings.slice(0, 10)) {
          const visitsRes = await fetch(
            `https://api.mercadolibre.com/items/${listing.meli_item_id}/visits/time_window?last=30&unit=day`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (visitsRes.ok) {
            const visitsData = await visitsRes.json();
            listing.visits = visitsData.total_visits || 0;
          }
        }
      } catch {
        // Visits data is optional
      }

      const activeListings = listings.filter(l => l.status === "active");
      const totalSold = listings.reduce((sum, l) => sum + l.sold_quantity, 0);
      const totalViews = listings.reduce((sum, l) => sum + l.visits, 0);
      const totalRevenue = listings.reduce((sum, l) => sum + l.sold_quantity * l.price, 0);

      setMetrics({
        totalListings: listings.length,
        activeListings: activeListings.length,
        totalViews,
        totalSold,
        totalRevenue,
        listings: listings.sort((a, b) => b.sold_quantity - a.sold_quantity),
      });
    } catch (err: any) {
      setError(err.message || "Erro ao buscar métricas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [currentTenant?.id]);

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
          <p className="font-medium">{error}</p>
          <Button variant="outline" className="mt-4" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          title="Anúncios Ativos"
          value={metrics?.activeListings}
          total={metrics?.totalListings}
          icon={Package}
          isLoading={isLoading}
        />
        <MetricCard
          title="Visitas (30 dias)"
          value={metrics?.totalViews}
          icon={Eye}
          isLoading={isLoading}
        />
        <MetricCard
          title="Unidades Vendidas"
          value={metrics?.totalSold}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
        <MetricCard
          title="Faturamento Estimado"
          value={metrics?.totalRevenue}
          isCurrency
          icon={DollarSign}
          isLoading={isLoading}
        />
      </div>

      {/* Listings Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Desempenho dos Anúncios
              </CardTitle>
              <CardDescription>
                Métricas dos seus anúncios ativos no Mercado Livre
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : !metrics?.listings.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Nenhum anúncio publicado ainda.</p>
              <p className="text-sm mt-1">Publique anúncios na aba "Anúncios" para ver as métricas aqui.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics.listings.map((listing) => (
                <div
                  key={listing.meli_item_id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{listing.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{formatCurrency(listing.price)}</span>
                      <span>•</span>
                      <span>Estoque: {listing.available_quantity}</span>
                      <span>•</span>
                      <span>{listing.sold_quantity} vendidos</span>
                      {listing.visits > 0 && (
                        <>
                          <span>•</span>
                          <span>{listing.visits} visitas</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                      {listing.status === "active" ? "Ativo" : listing.status === "paused" ? "Pausado" : listing.status}
                    </Badge>
                    {listing.permalink && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(listing.permalink, "_blank")}
                        title="Ver no ML"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  total,
  icon: Icon,
  isCurrency,
  isLoading,
}: {
  title: string;
  value?: number;
  total?: number;
  icon: any;
  isCurrency?: boolean;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {isLoading ? (
              <Skeleton className="h-7 w-20 mt-1" />
            ) : (
              <p className="text-2xl font-bold">
                {isCurrency
                  ? formatCurrency(value || 0)
                  : (value ?? 0).toLocaleString("pt-BR")}
                {total !== undefined && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ {total}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
