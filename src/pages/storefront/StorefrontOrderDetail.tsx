// =============================================
// STOREFRONT ORDER DETAIL - Single order detail with timeline
// =============================================

import { Link, useParams, useSearchParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
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
import { BlockRenderContext, BlockNode } from '@/lib/builder/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/cartTotals';
import { getWhatsAppHref } from '@/lib/contactHelpers';

export default function StorefrontOrderDetail() {
  const { tenantSlug, orderId } = useParams<{ tenantSlug: string; orderId: string }>();
  const [searchParams] = useSearchParams();
  const { storeSettings, headerMenu, footerMenu, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const homeTemplate = usePublicTemplate(tenantSlug || '', 'home');
  const { order, isLoading: orderLoading } = useCustomerOrder(orderId);

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

  // WhatsApp support
  const whatsappNumber = storeSettings?.social_whatsapp || '+5511919555920';
  const whatsappMessage = order 
    ? `Quero suporte sobre o pedido #${order.order_number}`
    : 'Quero suporte sobre meu pedido';
  const whatsappHref = getWhatsAppHref(whatsappNumber, whatsappMessage);

  const isLoading = storeLoading || homeTemplate.isLoading || orderLoading;

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
            <Link to={`/store/${tenantSlug}/conta/pedidos`}>
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
            to={`/store/${tenantSlug}/conta/pedidos`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar aos pedidos
          </Link>

          {/* Order header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold">Pedido #{order.order_number}</h1>
              <p className="text-muted-foreground">{orderDate}</p>
            </div>
            <Badge className={`${statusInfo.color} text-sm`}>{statusInfo.label}</Badge>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Main column */}
            <div className="md:col-span-2 space-y-6">
              {/* Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Acompanhamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderTimeline order={order} />
                </CardContent>
              </Card>

              {/* Items */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Itens do pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {order.items.map(item => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-16 h-16 bg-muted rounded-md flex items-center justify-center shrink-0">
                        {item.product_image_url ? (
                          <img src={item.product_image_url} alt={item.product_name} className="w-full h-full object-cover rounded-md" />
                        ) : (
                          <Package className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-1">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">Qtd: {item.quantity}</p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.total_price)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Tracking */}
              {order.tracking_code && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Rastreamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Código de rastreio</p>
                        <p className="font-mono font-medium">{order.tracking_code}</p>
                        {order.shipping_carrier && (
                          <p className="text-sm text-muted-foreground">via {order.shipping_carrier}</p>
                        )}
                      </div>
                      <a 
                        href={`https://www.linkcorreios.com.br/?id=${order.tracking_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          Rastrear
                          <ExternalLink className="h-4 w-4 ml-1" />
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!order.tracking_code && !['delivered', 'cancelled'].includes(order.status) && (
                <Alert className="border-muted">
                  <Truck className="h-4 w-4" />
                  <AlertDescription>
                    O código de rastreio será disponibilizado assim que o pedido for enviado.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.shipping_total > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Frete</span>
                      <span>{formatCurrency(order.shipping_total)}</span>
                    </div>
                  )}
                  {order.discount_total > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
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
    { key: 'processing', label: 'Em separação', icon: PackageCheck, done: ['processing', 'shipped', 'in_transit', 'delivered'].includes(order.status) },
    { key: 'shipped', label: 'Enviado', icon: Truck, done: ['shipped', 'in_transit', 'delivered'].includes(order.status) },
    { key: 'delivered', label: 'Entregue', icon: CheckCircle2, done: order.status === 'delivered' },
  ];

  // Handle cancelled/returned
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
