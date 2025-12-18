// =============================================
// THANK YOU CONTENT - Order confirmation page content
// Loads REAL order data from database
// =============================================

import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Package, Truck, Home, MessageCircle, ShoppingBag, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/cartTotals';
import { useOrderDetails } from '@/hooks/useOrderDetails';

interface ThankYouContentProps {
  tenantSlug: string;
  isPreview?: boolean;
  whatsAppNumber?: string;
}

export function ThankYouContent({ tenantSlug, isPreview, whatsAppNumber }: ThankYouContentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get order identifier from URL (can be order_number or orderId)
  const orderParam = searchParams.get('pedido') || searchParams.get('orderId');
  
  // Fetch real order data from database
  const { data: order, isLoading, error } = useOrderDetails(orderParam || undefined);

  const handleViewOrders = () => {
    navigate(`/store/${tenantSlug}/conta/pedidos${isPreview ? '?preview=1' : ''}`);
  };

  const handleGoHome = () => {
    navigate(`/store/${tenantSlug}${isPreview ? '?preview=1' : ''}`);
  };

  const handleWhatsApp = () => {
    const phone = (whatsAppNumber || '+55 11 91955-5920').replace(/\D/g, '');
    const orderNumber = order?.order_number || orderParam || 'N/A';
    const message = encodeURIComponent(`Olá! Gostaria de informações sobre meu pedido #${orderNumber}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="py-12 container mx-auto px-4 max-w-2xl flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando dados do pedido...</p>
        </div>
      </div>
    );
  }

  // Error or order not found
  if (error || (!order && orderParam)) {
    return (
      <div className="py-12 container mx-auto px-4 max-w-2xl">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Não foi possível carregar os dados do pedido. 
            {orderParam && ` Pedido "${orderParam}" não encontrado.`}
          </AlertDescription>
        </Alert>
        
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Pedido não encontrado</h1>
          <p className="text-muted-foreground mb-6">
            Se você acabou de finalizar uma compra, aguarde alguns instantes e tente novamente.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={handleViewOrders}>
              <ShoppingBag className="h-4 w-4 mr-2" />
              Ver meus pedidos
            </Button>
            <Button variant="outline" onClick={handleGoHome}>
              <Home className="h-4 w-4 mr-2" />
              Voltar para a loja
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No order parameter provided
  if (!orderParam) {
    return (
      <div className="py-12 container mx-auto px-4 max-w-2xl text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-yellow-100 flex items-center justify-center">
          <AlertCircle className="h-10 w-10 text-yellow-600" />
        </div>
        <h1 className="text-2xl font-bold mb-4">Nenhum pedido especificado</h1>
        <p className="text-muted-foreground mb-6">
          Para ver os detalhes do seu pedido, acesse "Meus Pedidos".
        </p>
        <div className="flex flex-col gap-3">
          <Button onClick={handleViewOrders}>
            <ShoppingBag className="h-4 w-4 mr-2" />
            Ver meus pedidos
          </Button>
          <Button variant="outline" onClick={handleGoHome}>
            <Home className="h-4 w-4 mr-2" />
            Voltar para a loja
          </Button>
        </div>
      </div>
    );
  }

  // Get payment status display
  const getPaymentStatusInfo = () => {
    switch (order?.payment_status) {
      case 'approved':
        return { text: 'Pagamento aprovado', color: 'text-green-600' };
      case 'pending':
        return { text: 'Aguardando pagamento', color: 'text-yellow-600' };
      case 'processing':
        return { text: 'Processando pagamento', color: 'text-blue-600' };
      case 'declined':
        return { text: 'Pagamento recusado', color: 'text-red-600' };
      default:
        return { text: 'Status desconhecido', color: 'text-muted-foreground' };
    }
  };

  const paymentInfo = getPaymentStatusInfo();

  return (
    <div className="py-12 container mx-auto px-4 max-w-2xl">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Obrigado pela compra!</h1>
        <p className="text-muted-foreground">
          Seu pedido <span className="font-semibold">#{order?.order_number}</span> foi recebido com sucesso.
        </p>
        <p className={`text-sm mt-2 ${paymentInfo.color}`}>
          {paymentInfo.text}
        </p>
      </div>

      {/* Order Summary */}
      {order && order.items.length > 0 && (
        <div className="border rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Resumo do pedido
          </h3>
          
          <div className="space-y-3 mb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 text-sm">
                <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                  {item.product_image_url ? (
                    <img src={item.product_image_url} alt={item.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.product_name}</p>
                  <p className="text-muted-foreground">Qtd: {item.quantity}</p>
                </div>
                <p className="font-medium">{formatCurrency(item.total_price)}</p>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {order.shipping_total > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>{formatCurrency(order.shipping_total)}</span>
              </div>
            )}
            {order.discount_total > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Desconto</span>
                <span>-{formatCurrency(order.discount_total)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Info */}
      {order?.shipping_street && (
        <div className="border rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Endereço de entrega
          </h3>
          <p className="text-sm text-muted-foreground">
            {order.shipping_street}, {order.shipping_number}
            {order.shipping_complement && ` - ${order.shipping_complement}`}
            <br />
            {order.shipping_neighborhood} - {order.shipping_city}/{order.shipping_state}
            <br />
            CEP: {order.shipping_postal_code}
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="border rounded-lg p-6 mb-6">
        <h3 className="font-semibold mb-4">Próximos passos</h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              order?.payment_status === 'approved' ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <Check className={`h-4 w-4 ${
                order?.payment_status === 'approved' ? 'text-green-600' : 'text-yellow-600'
              }`} />
            </div>
            <div>
              <p className="font-medium">Pedido confirmado</p>
              <p className="text-sm text-muted-foreground">
                {order?.payment_status === 'approved' 
                  ? 'Seu pagamento foi aprovado' 
                  : 'Aguardando confirmação do pagamento'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              order?.shipping_status === 'processing' || order?.shipping_status === 'shipped' 
                ? 'bg-green-100' : 'bg-muted'
            }`}>
              <Package className={`h-4 w-4 ${
                order?.shipping_status === 'processing' || order?.shipping_status === 'shipped' 
                  ? 'text-green-600' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <p className="font-medium">Separação</p>
              <p className="text-sm text-muted-foreground">Preparando seu pedido para envio</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              order?.tracking_code ? 'bg-green-100' : 'bg-muted'
            }`}>
              <Truck className={`h-4 w-4 ${
                order?.tracking_code ? 'text-green-600' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <p className="font-medium">Envio</p>
              {order?.tracking_code ? (
                <p className="text-sm text-muted-foreground">
                  Código de rastreio: <span className="font-mono">{order.tracking_code}</span>
                  {order.shipping_carrier && ` (${order.shipping_carrier})`}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Código de rastreio será enviado por e-mail</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button onClick={handleViewOrders} className="w-full h-12">
          <ShoppingBag className="h-4 w-4 mr-2" />
          Ver meus pedidos
        </Button>
        
        <Button variant="outline" onClick={handleGoHome} className="w-full h-12">
          <Home className="h-4 w-4 mr-2" />
          Voltar para a loja
        </Button>
        
        {whatsAppNumber && (
          <Button variant="ghost" onClick={handleWhatsApp} className="w-full h-10 gap-2">
            <MessageCircle className="h-4 w-4" />
            Falar com suporte via WhatsApp
          </Button>
        )}
      </div>

      {isPreview && (
        <p className="text-sm text-muted-foreground text-center mt-6">
          [Modo Preview - Dados carregados do banco de dados]
        </p>
      )}
    </div>
  );
}
