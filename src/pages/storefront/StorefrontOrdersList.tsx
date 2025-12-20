// =============================================
// STOREFRONT ORDERS LIST - Customer orders list page
// =============================================

import { Link } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { useCustomerOrders, getOrderStatusInfo } from '@/hooks/useCustomerOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Package, ShoppingBag, ArrowLeft, ChevronRight } from 'lucide-react';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/cartTotals';
import { useTenantSlug } from '@/hooks/useTenantSlug';

export default function StorefrontOrdersList() {
  const tenantSlug = useTenantSlug();
  const basePath = tenantSlug ? `/store/${tenantSlug}` : '';
  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const homeTemplate = usePublicTemplate(tenantSlug || '', 'home');

  // Customer orders - uses logged-in user's email automatically
  const { orders, isLoading: ordersLoading, customerEmail } = useCustomerOrders();

  // Build context
  const context: BlockRenderContext = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      primary_color: storeSettings?.primary_color || undefined,
      social_instagram: storeSettings?.social_instagram || undefined,
      social_facebook: storeSettings?.social_facebook || undefined,
      social_whatsapp: storeSettings?.social_whatsapp || undefined,
      store_description: storeSettings?.store_description || undefined,
    },
    headerMenu: headerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    footerMenu: footerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
  };

  const homeContent = homeTemplate.content as BlockNode | null;
  const headerNode = homeContent?.children?.find(child => child.type === 'Header');
  const footerNode = homeContent?.children?.find(child => child.type === 'Footer');

  // Filter orders
  const inProgressOrders = orders.filter(o => !['delivered', 'cancelled', 'returned'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled', 'returned'].includes(o.status));

  const isLoading = storeLoading || homeTemplate.isLoading || ordersLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      {headerNode && (
        <BlockRenderer node={headerNode} context={context} isEditing={false} />
      )}

      {/* Main Content */}
      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-3xl">
          {/* Back link */}
          <Link 
            to={`${basePath}/conta`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Meus Pedidos</h1>
            <p className="text-muted-foreground">
              Acompanhe o status das suas compras
              {customerEmail && <span className="block text-sm">({customerEmail})</span>}
            </p>
          </div>

          {/* Empty state */}
          {orders.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum pedido encontrado</h3>
                <p className="text-muted-foreground mb-6">
                  {customerEmail 
                    ? 'Você ainda não realizou nenhuma compra.'
                    : 'Faça login para ver seus pedidos.'
                  }
                </p>
                <Link to={`${basePath}`}>
                  <Button>
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Ir às compras
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Orders list */}
          {orders.length > 0 && (
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">Todos ({orders.length})</TabsTrigger>
                <TabsTrigger value="progress">Em andamento ({inProgressOrders.length})</TabsTrigger>
                <TabsTrigger value="completed">Finalizados ({completedOrders.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4">
                {orders.map(order => (
                  <OrderCard key={order.id} order={order} basePath={basePath} />
                ))}
              </TabsContent>

              <TabsContent value="progress" className="space-y-4">
                {inProgressOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum pedido em andamento.</p>
                ) : (
                  inProgressOrders.map(order => (
                    <OrderCard key={order.id} order={order} basePath={basePath} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="completed" className="space-y-4">
                {completedOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum pedido finalizado.</p>
                ) : (
                  completedOrders.map(order => (
                    <OrderCard key={order.id} order={order} basePath={basePath} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      {/* Footer */}
      {footerNode && (
        <BlockRenderer node={footerNode} context={context} isEditing={false} />
      )}
    </div>
  );
}

// Order card component
function OrderCard({ 
  order, 
  basePath,
}: { 
  order: ReturnType<typeof useCustomerOrders>['orders'][0]; 
  basePath: string;
}) {
  const statusInfo = getOrderStatusInfo(order.status);
  const orderDate = format(new Date(order.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR });

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">
              Pedido #{order.order_number}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{orderDate}</p>
          </div>
          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
            </p>
            <p className="font-semibold">{formatCurrency(order.total)}</p>
          </div>
          <Link to={`${basePath}/conta/pedidos/${order.id}`}>
            <Button variant="outline" size="sm">
              Ver detalhes
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
