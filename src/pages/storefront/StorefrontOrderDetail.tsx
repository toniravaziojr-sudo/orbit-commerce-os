// =============================================
// STOREFRONT ORDER DETAIL - Single order detail with timeline
// v2.0.0: Uses usePublicGlobalLayout for header/footer (bootstrap-powered)
// =============================================

import { Link, useParams, useSearchParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicGlobalLayout } from '@/hooks/useGlobalLayoutIntegration';
import { useCustomerOrder, getOrderStatusInfo, CustomerOrder } from '@/hooks/useCustomerOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, Package, ArrowLeft, Info, MessageCircle, 
  CheckCircle2, Circle, Truck, PackageCheck, Clock, ExternalLink 
} from 'lucide-react';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext } from '@/lib/builder/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/cartTotals';
import { getWhatsAppHref } from '@/lib/contactHelpers';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';

export default function StorefrontOrderDetail() {
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const { 
    storeSettings, headerMenu, footerMenu, isLoading: storeLoading,
    globalLayout: bootstrapGlobalLayout,
  } = usePublicStorefront(tenantSlug || '');
  
  // Use global layout for header/footer (bootstrap-powered, no extra queries)
  const { data: globalLayout, isLoading: layoutLoading } = usePublicGlobalLayout(tenantSlug || '', bootstrapGlobalLayout);
  
  const { order, isLoading: orderLoading } = useCustomerOrder(orderId);

  // Build context
  const context: BlockRenderContext = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      social_instagram: storeSettings?.social_instagram || undefined,
      social_facebook: storeSettings?.social_facebook || undefined,
      social_whatsapp: storeSettings?.social_whatsapp || undefined,
      store_description: storeSettings?.store_description || undefined,
    },
    headerMenu: headerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
      item_type: item.item_type,
      ref_id: item.ref_id || undefined,
      sort_order: item.sort_order,
      parent_id: item.parent_id,
    })),
    footerMenu: footerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
  };

  // Get header/footer from global layout
  const headerNode = globalLayout?.header_enabled !== false ? globalLayout?.header_config : null;
  const footerNode = globalLayout?.footer_enabled !== false ? globalLayout?.footer_config : null;

  // WhatsApp support
  const whatsappNumber = storeSettings?.social_whatsapp || '+5511919555920';
  const whatsappMessage = order 
    ? `Quero suporte sobre o pedido #${order.order_number}`
    : 'Quero suporte sobre meu pedido';
  const whatsappHref = getWhatsAppHref(whatsappNumber, whatsappMessage);

  const isLoading = storeLoading || layoutLoading || orderLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col">
        {headerNode && <BlockRenderer node={headerNode} context={context} isEditing={false} />}
        <main className="flex-1 py-12 px-4">
          <div className="container mx-auto max-w-lg text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Pedido não encontrado</h1>
            <p className="text-muted-foreground mb-6">
              Não conseguimos encontrar este pedido. Verifique o link ou entre em contato.
            </p>
            <Link to={urls.accountOrders()}>
              <Button>Voltar aos pedidos</Button>
            </Link>
          </div>
        </main>
        {footerNode && <BlockRenderer node={footerNode} context={context} isEditing={false} />}
      </div>
    );
  }

  const statusInfo = getOrderStatusInfo(order.status);
  const orderDate = format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

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
            to={urls.accountOrders()}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar aos pedidos
          </Link>

          {/* Order header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Pedido #{order.order_number}</h1>
              <p className="text-muted-foreground">{orderDate}</p>
            </div>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Main column */}
            <div className="md:col-span-2 space-y-6">
              {/* Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Itens do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex gap-4">
                      {item.product_image_url && (
                        <img 
                          src={item.product_image_url} 
                          alt={item.product_name}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Acompanhamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderTimeline order={order} />

                  {/* Tracking link */}
                  {order.tracking_code && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">Código de rastreio:</p>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm">{order.tracking_code}</code>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Side column */}
            <div className="space-y-6">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span>{order.shipping_total > 0 ? formatCurrency(order.shipping_total) : 'Grátis'}</span>
                  </div>
                  {order.discount_total > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto</span>
                      <span>- {formatCurrency(order.discount_total)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Support */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Precisa de ajuda?</CardTitle>
                </CardHeader>
                <CardContent>
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full" variant="outline">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Falar no WhatsApp
                    </Button>
                  </a>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      {footerNode && (
        <BlockRenderer node={footerNode} context={context} isEditing={false} />
      )}
    </div>
  );
}

// Order timeline component
function OrderTimeline({ order }: { order: CustomerOrder }) {
  const steps = [
    { key: 'confirmed', label: 'Pedido confirmado', icon: CheckCircle2, done: true },
    { key: 'processing', label: 'Em preparação', icon: Package, done: ['processing', 'shipped', 'delivered'].includes(order.status) },
    { key: 'shipped', label: 'Enviado', icon: Truck, done: ['shipped', 'delivered'].includes(order.status) },
    { key: 'delivered', label: 'Entregue', icon: PackageCheck, done: order.status === 'delivered' },
  ];

  if (order.status === 'cancelled') {
    return (
      <div className="flex items-center gap-3 text-red-600">
        <Clock className="h-5 w-5" />
        <span>Pedido cancelado</span>
      </div>
    );
  }

  if (order.status === 'returned') {
    return (
      <div className="flex items-center gap-3 text-gray-600">
        <Clock className="h-5 w-5" />
        <span>Pedido devolvido</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isLast = index === steps.length - 1;
        
        return (
          <div key={step.key} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`p-1 rounded-full ${step.done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Circle className="h-5 w-5" />
                )}
              </div>
              {!isLast && (
                <div className={`w-0.5 h-8 ${step.done ? 'bg-green-200' : 'bg-muted'}`} />
              )}
            </div>
            <div className="pb-4">
              <p className={`font-medium ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
