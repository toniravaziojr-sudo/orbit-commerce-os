import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ShoppingBag, RefreshCw, Loader2, CheckCircle, AlertCircle,
  Clock, XCircle, AlertTriangle, Package, Search,
} from "lucide-react";
import { useGoogleMerchant } from "@/hooks/useGoogleMerchant";
import { useGoogleConnection } from "@/hooks/useGoogleConnection";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "synced":
      return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 dark:bg-green-900/20"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
    case "pending":
      return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    case "pending_review":
      return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 dark:bg-orange-900/20"><AlertTriangle className="h-3 w-3 mr-1" />Em revisão</Badge>;
    case "disapproved":
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Reprovado</Badge>;
    case "error":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function GoogleMerchantTab() {
  const { currentTenant } = useAuth();
  const merchant = useGoogleMerchant();
  const googleConn = useGoogleConnection();
  const [searchQuery, setSearchQuery] = useState("");

  const merchantAccounts = googleConn.connection?.assets?.merchant_accounts || [];
  const isConnected = googleConn.isConnected && merchantAccounts.length > 0;
  const primaryAccount = merchantAccounts[0];

  // Fetch product names for display
  const productIds = merchant.products.map(p => p.product_id);
  const { data: productNames } = useQuery({
    queryKey: ["merchant-product-names", currentTenant?.id, productIds.join(",")],
    queryFn: async () => {
      if (!productIds.length) return {};
      const { data } = await supabase
        .from("products")
        .select("id, name, sku")
        .in("id", productIds.slice(0, 100));
      const map: Record<string, { name: string; sku: string | null }> = {};
      for (const p of (data || [])) {
        map[p.id] = { name: p.name, sku: p.sku };
      }
      return map;
    },
    enabled: !!currentTenant?.id && productIds.length > 0,
    staleTime: 60000,
  });

  if (googleConn.isLoading || merchant.summaryLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!googleConn.isConnected) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Google não conectado"
        description="Conecte sua conta Google com permissão Merchant Center na aba Integrações"
      />
    );
  }

  if (!isConnected) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Merchant Center não disponível"
        description="Conecte o pack Merchant Center nas configurações do Google para sincronizar seu catálogo"
      />
    );
  }

  const summary = merchant.summary;
  const filteredProducts = merchant.products.filter(p => {
    if (!searchQuery) return true;
    const prod = productNames?.[p.product_id];
    const q = searchQuery.toLowerCase();
    return prod?.name?.toLowerCase().includes(q) || prod?.sku?.toLowerCase().includes(q) || p.product_id.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold">{summary.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-green-600">Aprovados</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-green-600">{summary.synced}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-orange-600">Em revisão</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-orange-600">{summary.pending_review}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-destructive">Reprovados</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-destructive">{summary.disapproved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-destructive">Erros</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold text-destructive">{summary.error}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <ShoppingBag className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-base">Google Shopping — Catálogo</CardTitle>
                <CardDescription>
                  Conta: {primaryAccount?.name || primaryAccount?.id}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => merchant.checkStatuses.mutate(primaryAccount.id)}
                disabled={merchant.isCheckingStatuses}
              >
                {merchant.isCheckingStatuses ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Verificar Status
              </Button>
              <Button
                size="sm"
                onClick={() => merchant.syncProducts.mutate({ merchantAccountId: primaryAccount.id })}
                disabled={merchant.isSyncing}
              >
                {merchant.isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Package className="h-4 w-4 mr-1" />}
                Sincronizar Catálogo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {summary && summary.disapproved > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {summary.disapproved} produto(s) reprovado(s) pelo Google. Verifique os detalhes na tabela abaixo.
              </AlertDescription>
            </Alert>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto por nome ou SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Product table */}
          {merchant.productsLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhum produto sincronizado"
              description="Clique em 'Sincronizar Catálogo' para enviar seus produtos ao Google Shopping"
            />
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Sync</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.slice(0, 50).map(p => {
                    const prod = productNames?.[p.product_id];
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-sm max-w-[200px] truncate">
                          {prod?.name || p.product_id}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {prod?.sku || "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={p.sync_status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.last_sync_at
                            ? new Date(p.last_sync_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {p.last_error || (p.disapproval_reasons?.length ? `${p.disapproval_reasons.length} problema(s)` : "—")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filteredProducts.length > 50 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t">
                  Mostrando 50 de {filteredProducts.length} produtos
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
