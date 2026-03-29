// =============================================
// THANK YOU CONTENT - Order confirmation page content
// Loads REAL order data from database (SERVER-SIDE)
// Shows PIX/Boleto payment info + Account creation
// PIX data is fetched from server, not localStorage (reliable)
// v8.15.0 — Declined state with inline card retry
// =============================================

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Check, Package, Truck, Home, MessageCircle, ShoppingBag, Loader2, AlertCircle, Clock, Copy, ExternalLink, QrCode, XCircle, CreditCard, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/cartTotals';
import { useOrderDetails } from '@/hooks/useOrderDetails';
import { useRetryCardPayment, RetryCardData } from '@/hooks/useRetryCardPayment';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { CreateAccountSection } from '@/components/storefront/CreateAccountSection';
import { UpsellSection } from '@/components/storefront/sections/UpsellSection';
import { SocialShareButtons } from '@/components/storefront/SocialShareButtons';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { useMarketingTracker } from '@/components/storefront/MarketingTrackerProvider';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const urls = useStorefrontUrls(tenantSlug);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { trackPurchase } = useMarketingEvents();
  const { tracker } = useMarketingTracker();
  const { config: checkoutConfig } = useCheckoutConfig();
  const purchaseTrackedRef = useRef<string | null>(null);
  
  // Declined state
  const statusParam = searchParams.get('status');
  const isDeclined = statusParam === 'declined';
  const [retryApproved, setRetryApproved] = useState(false);
  
  // CRITICAL: Get tenant ID for order disambiguation
  const { tenant } = usePublicStorefront(tenantSlug);
  
  // Get order identifier from URL - normalize by removing # and trimming
  const rawOrderParam = searchParams.get('pedido') || searchParams.get('orderId') || searchParams.get('orderNumber');
  const hashValue = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '').trim() : '';
  
  const orderParam = useMemo(() => {
    if (rawOrderParam) {
      const cleaned = decodeURIComponent(rawOrderParam).replace(/^#/, '').trim();
      if (cleaned) return cleaned;
    }
    if (hashValue) return hashValue;
    return null;
  }, [rawOrderParam, hashValue]);

  console.log('[ThankYou] Order param:', { rawOrderParam, hashValue, orderParam, tenantId: tenant?.id, isDeclined });
  
  // Fetch real order data from database
  const { data: order, isLoading, error, refetch } = useOrderDetails(orderParam || undefined, tenant?.id);

  // Extract payment instructions from server response
  const paymentInstructions = useMemo<PaymentInstructions | null>(() => {
    if (!order?.payment_instructions) return null;
    return order.payment_instructions as PaymentInstructions;
  }, [order?.payment_instructions]);

  // Determine effective state: if retry approved or order updated to approved, show success
  const effectiveDeclined = isDeclined && !retryApproved && order?.payment_status !== 'approved';

  // MARKETING: Track Purchase event when order loads (with deduplication)
  useEffect(() => {
    if (!order || !order.order_number || isLoading || isPreview) return;
    if (purchaseTrackedRef.current === order.order_number) return;
    if (!tracker) return;
    
    // Don't track purchase for declined orders
    if (effectiveDeclined) return;

    if (checkoutConfig.purchaseEventTiming === 'paid_only') {
      const isPaid = order.payment_status === 'approved' || order.payment_status === 'paid';
      if (!isPaid) return;
    }
    
    // v8.23.0: Strip # from order_number to match server-side event_id format
    // Server (process-events) uses cleanOrderNumber.replace(/^#/, '') → purchase_paid_141
    // Browser must use the same format for deduplication to work
    const cleanOrderNumber = order.order_number.replace(/^#/, '').trim();
    
    trackPurchase({
      order_id: cleanOrderNumber,
      value: order.total,
      items: order.items.map((item: any) => ({
        id: item.product_id || item.id,
        sku: item.sku || item.product_sku,
        meta_retailer_id: item.meta_retailer_id,
        name: item.product_name,
        price: item.unit_price,
        quantity: item.quantity,
      })),
      purchaseEventTiming: checkoutConfig.purchaseEventTiming,
      userData: {
        email: order.customer_email,
        phone: order.customer_phone,
        name: order.customer_name,
        city: order.shipping_city,
        state: order.shipping_state,
        zip: order.shipping_postal_code,
      },
    });
    
    purchaseTrackedRef.current = order.order_number;
    console.log('[ThankYou] Purchase event tracked for order:', order.order_number);
  }, [order, isLoading, isPreview, tracker, trackPurchase, checkoutConfig.purchaseEventTiming, effectiveDeclined]);

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

  // Handle successful retry — update URL to remove declined status and refresh order
  const handleRetrySuccess = useCallback(async () => {
    setRetryApproved(true);
    // Remove status=declined from URL
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('status');
    setSearchParams(newParams, { replace: true });
    // Refetch order to get updated payment_status
    await refetch();
    toast.success('Pagamento aprovado!');
  }, [searchParams, setSearchParams, refetch]);

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
      {/* Header — conditional on declined vs success */}
      {effectiveDeclined ? (
        <DeclinedHeader orderNumber={order?.order_number} />
      ) : (
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
      )}

      {/* Card Retry Section — only when declined and retry_token is available */}
      {effectiveDeclined && order && (order.retry_token || searchParams.get('rt')) && (
        <CardRetrySection
          retryToken={order.retry_token || searchParams.get('rt') || ''}
          orderTotal={order.total}
          onSuccess={handleRetrySuccess}
        />
      )}

      {/* PIX Payment Section - SERVER-SIDE DATA */}
      {paymentInstructions?.method === 'pix' && paymentInstructions.pix_qr_code && order?.payment_status === 'pending' && (
        <div className="border rounded-lg p-6 bg-muted/30 text-center space-y-4 mb-6">
          <div 
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--theme-accent-color, #22c55e) 15%, transparent)',
              color: 'var(--theme-accent-color, #22c55e)',
            }}
          >
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
              effectiveDeclined ? 'bg-red-100' : order?.payment_status === 'approved' ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              {effectiveDeclined ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Check className={`h-4 w-4 ${
                  order?.payment_status === 'approved' ? 'text-green-600' : 'text-yellow-600'
                }`} />
              )}
            </div>
            <div>
              <p className="font-medium">
                {effectiveDeclined ? 'Pagamento não aprovado' : 'Pedido confirmado'}
              </p>
              <p className="text-sm text-muted-foreground">
                {effectiveDeclined
                  ? 'O pagamento foi recusado. Tente novamente com outro cartão.'
                  : order?.payment_status === 'approved' 
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
      {!effectiveDeclined && (
        <UpsellSection tenantId={undefined} orderId={order?.id} />
      )}

      {/* Social Share - Optional */}
      {showSocialShare && !effectiveDeclined && (
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

// =============================================
// DECLINED HEADER — Alert/failure state
// =============================================

function DeclinedHeader({ orderNumber }: { orderNumber?: string }) {
  return (
    <div className="text-center mb-8">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
        <XCircle className="h-10 w-10 text-red-600" />
      </div>
      
      <h1 className="text-3xl font-bold mb-2">Pagamento não aprovado</h1>
      <p className="text-muted-foreground">
        O pagamento do pedido <span className="font-semibold">#{orderNumber}</span> foi recusado pela operadora.
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        Você pode tentar novamente com outro cartão de crédito.
      </p>
    </div>
  );
}

// =============================================
// CARD RETRY SECTION — Inline card form for retry
// Only card — no PIX/boleto retry inline
// Uses retry_token — NO sensitive data from frontend
// =============================================

function CardRetrySection({ retryToken, orderTotal, onSuccess }: {
  retryToken: string;
  orderTotal: number;
  onSuccess: () => void;
}) {
  const { retryPayment, isRetrying, retryResult, resetRetryResult } = useRetryCardPayment({ retryToken });
  
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvv, setCvv] = useState('');
  const [installments, setInstallments] = useState(1);
  const [showCvv, setShowCvv] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  // Synchronous lock to prevent double-click on retry
  const retryLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // === SYNC LOCK: immediate guard before any async operation ===
    if (retryLockRef.current) return;
    retryLockRef.current = true;

    setRetryError(null);
    resetRetryResult();

    // Basic validation
    const cleanNumber = cardNumber.replace(/\D/g, '');
    if (cleanNumber.length < 13) {
      setRetryError('Número do cartão inválido.');
      retryLockRef.current = false;
      return;
    }
    if (!holderName.trim()) {
      setRetryError('Nome no cartão é obrigatório.');
      retryLockRef.current = false;
      return;
    }
    if (!expMonth || !expYear) {
      setRetryError('Data de validade é obrigatória.');
      retryLockRef.current = false;
      return;
    }
    if (cvv.length < 3) {
      setRetryError('CVV inválido.');
      retryLockRef.current = false;
      return;
    }

    // Generate stable idempotency key for this retry click
    const paymentAttemptId = crypto.randomUUID();

    const card: RetryCardData = {
      number: cleanNumber,
      holderName: holderName.trim(),
      expMonth,
      expYear,
      cvv,
    };

    try {
      const result = await retryPayment(card, installments, paymentAttemptId);

      if (result.success) {
        onSuccess();
      }
    } finally {
      retryLockRef.current = false;
    }
  };

  // If retry succeeded, don't show the form
  if (retryResult?.success) {
    return null;
  }

  const displayError = retryResult?.error || retryError;
  const isTechnicalError = retryResult?.technicalError === true;

  return (
    <div className="border rounded-lg p-6 mb-6 bg-muted/30">
      <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <CreditCard className="h-5 w-5" />
        Tentar novamente com cartão
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Insira os dados de um cartão de crédito para tentar o pagamento de {formatCurrency(orderTotal)}.
      </p>

      {displayError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isTechnicalError
              ? 'Ocorreu um problema técnico ao processar o pagamento. Tente novamente em alguns instantes.'
              : displayError
            }
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="retry-card-number">Número do cartão</Label>
          <Input
            id="retry-card-number"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            maxLength={19}
            autoComplete="cc-number"
            disabled={isRetrying}
          />
        </div>

        <div>
          <Label htmlFor="retry-holder-name">Nome no cartão</Label>
          <Input
            id="retry-holder-name"
            placeholder="Como aparece no cartão"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value.toUpperCase())}
            autoComplete="cc-name"
            disabled={isRetrying}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="retry-exp-month">Mês</Label>
            <Select value={expMonth} onValueChange={setExpMonth} disabled={isRetrying}>
              <SelectTrigger id="retry-exp-month">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const m = String(i + 1).padStart(2, '0');
                  return <SelectItem key={m} value={m}>{m}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="retry-exp-year">Ano</Label>
            <Select value={expYear} onValueChange={setExpYear} disabled={isRetrying}>
              <SelectTrigger id="retry-exp-year">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => {
                  const y = String(new Date().getFullYear() + i);
                  return <SelectItem key={y} value={y.slice(-2)}>{y}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="retry-cvv">CVV</Label>
            <div className="relative">
              <Input
                id="retry-cvv"
                type={showCvv ? 'text' : 'password'}
                placeholder="***"
                value={cvv}
                onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                autoComplete="cc-csc"
                disabled={isRetrying}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowCvv(!showCvv)}
                tabIndex={-1}
              >
                {showCvv ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Installments — use order's original installments info or default to 1 */}
        <div>
          <Label htmlFor="retry-installments">Parcelas</Label>
          <Select value={String(installments)} onValueChange={(v) => setInstallments(Number(v))} disabled={isRetrying}>
            <SelectTrigger id="retry-installments">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => {
                const n = i + 1;
                const valuePerInstallment = orderTotal / n;
                return (
                  <SelectItem key={n} value={String(n)}>
                    {n}x de {formatCurrency(valuePerInstallment)}
                    {n === 1 ? ' (à vista)' : ''}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full h-12" disabled={isRetrying}>
          {isRetrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processando pagamento...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pagar {formatCurrency(orderTotal)}
            </>
          )}
        </Button>
      </form>

      {/* CTA: Other payment method — Step 5: redirect to checkout with retry_token */}
      <div className="text-center mt-4">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            const checkoutUrl = `/loja/${window.location.pathname.split('/loja/')[1]?.split('/')[0]}/checkout?rt=${encodeURIComponent(retryToken)}`;
            window.location.href = checkoutUrl;
          }}
        >
          Tentar com outra forma de pagamento
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Você será redirecionado ao checkout para escolher PIX, boleto ou outro cartão.
        </p>
      </div>
    </div>
  );
}