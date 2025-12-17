// =============================================
// THANK YOU CONTENT - Order confirmation page content
// Renders when order is completed successfully
// =============================================

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Package, Truck, Home, MessageCircle, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { formatCurrency } from '@/lib/cartTotals';

interface ThankYouContentProps {
  tenantSlug: string;
  isPreview?: boolean;
  whatsAppNumber?: string;
}

export function ThankYouContent({ tenantSlug, isPreview, whatsAppNumber }: ThankYouContentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { draft, clearDraft } = useOrderDraft();
  
  // Get order number from URL
  const orderNumber = searchParams.get('pedido') || 'XXXXX';
  
  // Order data from draft (before clearing)
  const [orderData, setOrderData] = useState<{
    items: typeof draft.items;
    totals: typeof draft.totals;
    customer: typeof draft.customer;
    shipping: typeof draft.shipping;
  } | null>(null);

  // Capture order data on mount before clearing
  useEffect(() => {
    if (draft.items.length > 0) {
      setOrderData({
        items: [...draft.items],
        totals: { ...draft.totals },
        customer: { ...draft.customer },
        shipping: { ...draft.shipping },
      });
      
      // Clear the draft after capturing data (unless preview)
      if (!isPreview) {
        setTimeout(() => clearDraft(), 100);
      }
    }
  }, []);

  const handleViewOrders = () => {
    navigate(`/store/${tenantSlug}/conta/pedidos${isPreview ? '?preview=1' : ''}`);
  };

  const handleGoHome = () => {
    navigate(`/store/${tenantSlug}${isPreview ? '?preview=1' : ''}`);
  };

  const handleWhatsApp = () => {
    const phone = (whatsAppNumber || '+55 11 91955-5920').replace(/\D/g, '');
    const message = encodeURIComponent(`Olá! Gostaria de informações sobre meu pedido #${orderNumber}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="py-12 container mx-auto px-4 max-w-2xl">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Obrigado pela compra!</h1>
        <p className="text-muted-foreground">
          Seu pedido <span className="font-semibold">#{orderNumber}</span> foi recebido com sucesso.
        </p>
      </div>

      {/* Order Summary */}
      {orderData && orderData.items.length > 0 && (
        <div className="border rounded-lg p-4 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            Resumo do pedido
          </h3>
          
          <div className="space-y-3 mb-4">
            {orderData.items.map((item, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-muted-foreground">Qtd: {item.quantity}</p>
                </div>
                <p className="font-medium">{formatCurrency(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(orderData.totals.subtotal)}</span>
            </div>
            {orderData.totals.shippingTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete</span>
                <span>{formatCurrency(orderData.totals.shippingTotal)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t">
              <span>Total</span>
              <span>{formatCurrency(orderData.totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="border rounded-lg p-6 mb-6">
        <h3 className="font-semibold mb-4">Próximos passos</h3>
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <Check className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="font-medium">Pedido confirmado</p>
              <p className="text-sm text-muted-foreground">Seu pagamento foi aprovado</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Separação</p>
              <p className="text-sm text-muted-foreground">Preparando seu pedido para envio</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <Truck className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Envio</p>
              <p className="text-sm text-muted-foreground">Código de rastreio será enviado por e-mail</p>
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
          [Modo Preview - Os dados exibidos são de exemplo]
        </p>
      )}
    </div>
  );
}
