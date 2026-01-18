// =============================================
// THANK YOU CONTENT - Order confirmation page content
// Loads REAL order data from database (SERVER-SIDE)
// Shows PIX/Boleto payment info + Account creation
// PIX data is fetched from server, not localStorage (reliable)
// =============================================

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Package, Truck, Home, MessageCircle, ShoppingBag, Loader2, AlertCircle, Clock, Copy, ExternalLink, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/cartTotals';
import { useOrderDetails } from '@/hooks/useOrderDetails';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';
import { CreateAccountSection } from '@/components/storefront/CreateAccountSection';
import { UpsellSection } from '@/components/storefront/sections/UpsellSection';
import { SocialShareButtons } from '@/components/storefront/SocialShareButtons';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { useCheckoutConfig } from '@/contexts/StorefrontConfigContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentInstructions {
  method: string;
  status: string;
  pix_qr_code: string | null;
  pix_qr_code_url: string | null;
  pix_expires_at: string | null;
  boleto_url: string | null;
  boleto_barcode: string | null;
  boleto_due_date: string | null;
}

interface ThankYouContentProps {
  tenantSlug: string;
  isPreview?: boolean;
  whatsAppNumber?: string;
  showSocialShare?: boolean;
  storeName?: string;
}

export function ThankYouContent({ tenantSlug, isPreview, whatsAppNumber, showSocialShare = false, storeName }: ThankYouContentProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urls = useStorefrontUrls(tenantSlug);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { trackPurchase } = useMarketingEvents();
  const { config: checkoutConfig } = useCheckoutConfig();
  const purchaseTrackedRef = useRef<string | null>(null);
  
  // Get order identifier from URL - normalize by removing # and trimming
  // CRITICAL: The # in URL becomes fragment, so we also need to check window.location.hash
  const rawOrderParam = searchParams.get('pedido') || searchParams.get('orderId') || searchParams.get('orderNumber');
  
  // Also check if order number was passed as hash (legacy/malformed URLs like ?pedido=#5001)
  const hashValue = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '').trim() : '';
  
  // Normalize: remove # prefix, trim, decode URI component
  const orderParam = useMemo(() => {
    // First try query param
    if (rawOrderParam) {
      const cleaned = decodeURIComponent(rawOrderParam).replace(/^#/, '').trim();
      if (cleaned) return cleaned;
    }
    // Fallback to hash (for malformed URLs where # was in the value)
    if (hashValue) return hashValue;
    return null;
  }, [rawOrderParam, hashValue]);

  console.log('[ThankYou] Order param:', { rawOrderParam, hashValue, orderParam });
  
  // Fetch real order data from database (includes payment_instructions)
  const { data: order, isLoading, error } = useOrderDetails(orderParam || undefined);

  // Extract payment instructions from server response
  const paymentInstructions = useMemo<PaymentInstructions | null>(() => {
    if (!order?.payment_instructions) return null;
    return order.payment_instructions as PaymentInstructions;
  }, [order?.payment_instructions]);

  // MARKETING: Track Purchase event when order loads (with deduplication)
  // Respects purchaseEventTiming setting
  useEffect(() => {
    if (!order || !order.order_number || isLoading || isPreview) return;
    
    // Dedupe: only track once per order (even if component re-renders)
    if (purchaseTrackedRef.current === order.order_number) return;
    
    // Check purchaseEventTiming configuration
    // 'paid_only': only track if payment_status is 'paid' or 'approved'
    // 'all_orders': always track (this page is also called from checkout so we track here as backup)
    const isPaid = order.payment_status === 'paid' || order.payment_status === 'approved';
    
    if (checkoutConfig.purchaseEventTiming === 'paid_only' && !isPaid) {
      console.log('[ThankYou] Skipping Purchase event - payment not confirmed yet (purchaseEventTiming: paid_only)');
      return;
    }
    
    purchaseTrackedRef.current = order.order_number;
    
    // Track Purchase event with all order data
    trackPurchase({
      order_id: order.order_number,
      value: order.total,
      items: order.items.map((item: any) => ({
        id: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        quantity: item.quantity,
      })),
    });
    
    console.log('[ThankYou] Purchase event tracked for order:', order.order_number);
  }, [order, isLoading, isPreview, trackPurchase, checkoutConfig.purchaseEventTiming]);

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const handleViewOrders = () => navigate(urls.accountOrders());
  const handleGoHome = () => navigate(urls.home());

  const handleWhatsApp = () => {
    const phone = (whatsAppNumber || '+55 11 91955-5920').replace(/\D/g, '');
    const orderNumber = order?.order_number || orderParam || 'N/A';
    const message = encodeURIComponent(`Olá! Gostaria de informações sobre meu pedido #${orderNumber}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
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

      {/* PIX Payment Section - SERVER-SIDE DATA */}
      {paymentInstructions?.method === 'pix' && paymentInstructions.pix_qr_code && order?.payment_status === 'pending' && (
        <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-4 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Aguardando pagamento PIX
          </div>

          <h3 className="text-lg font-semibold">Escaneie o QR Code para pagar</h3>
          
          {paymentInstructions.pix_qr_code_url ? (
            <div className="flex justify-center">
              <img 
                src={paymentInstructions.pix_qr_code_url} 
                alt="QR Code PIX" 
                className="w-48 h-48 bg-white p-2 rounded-lg"
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-48 h-48 bg-white p-4 rounded-lg flex items-center justify-center">
                <QrCode className="w-32 h-32 text-muted-foreground" />
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">Ou copie o código PIX:</p>

          <div className="flex gap-2">
            <code className="flex-1 bg-background p-3 rounded border text-xs break-all text-left">
              {paymentInstructions.pix_qr_code}
            </code>
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(paymentInstructions.pix_qr_code!)}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {paymentInstructions.pix_expires_at && (
            <p className="text-sm text-muted-foreground">
              Expira em: {new Date(paymentInstructions.pix_expires_at).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {/* Boleto Payment Section - SERVER-SIDE DATA */}
      {paymentInstructions?.method === 'boleto' && paymentInstructions.boleto_url && order?.payment_status === 'pending' && (
        <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-4 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Boleto gerado
          </div>

          <h3 className="text-lg font-semibold">Seu boleto foi gerado!</h3>

          <Button onClick={() => window.open(paymentInstructions.boleto_url!, '_blank')} className="w-full">
            <ExternalLink className="h-4 w-4 mr-2" />
            Visualizar Boleto
          </Button>

          {paymentInstructions.boleto_barcode && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Código de barras:</p>
              <div className="flex gap-2">
                <code className="flex-1 bg-background p-3 rounded border text-xs break-all text-left font-mono">
                  {paymentInstructions.boleto_barcode}
                </code>
                <Button variant="outline" size="icon" onClick={() => copyToClipboard(paymentInstructions.boleto_barcode!)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {paymentInstructions.boleto_due_date && (
            <p className="text-sm text-muted-foreground">
              Vencimento: {new Date(paymentInstructions.boleto_due_date).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      )}

      {/* Account Creation Section - only for non-authenticated users */}
      {!user && order?.customer_email && (
        <div className="mb-6">
          <CreateAccountSection 
            customerEmail={order.customer_email} 
            customerName={order.customer_name}
            tenantSlug={tenantSlug}
          />
        </div>
      )}

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

      {/* Upsell Section - Post-purchase offer from Aumentar Ticket */}
      <UpsellSection tenantId={undefined} orderId={order?.id} />

      {/* Social Share - Optional */}
      {showSocialShare && (
        <SocialShareButtons 
          storeName={storeName || 'a loja'} 
          orderNumber={order?.order_number} 
          className="my-6" 
        />
      )}

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
