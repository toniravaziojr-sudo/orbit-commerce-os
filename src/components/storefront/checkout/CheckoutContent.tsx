// =============================================
// CHECKOUT CONTENT - Real payment integration with Pagar.me
// =============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useCart } from '@/contexts/CartContext';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { useCheckoutPayment, PaymentMethod, CardData } from '@/hooks/useCheckoutPayment';
import { CheckoutForm, CheckoutFormData, initialCheckoutFormData, validateCheckoutForm } from './CheckoutForm';
import { CheckoutOrderSummary } from './CheckoutOrderSummary';
import { CheckoutShipping } from './CheckoutShipping';
import { OrderBumpSection } from './OrderBumpSection';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentResultDisplay } from './PaymentResult';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShoppingCart, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { 
  startCheckoutSession, 
  heartbeatCheckoutSession, 
  completeCheckoutSession,
  endCheckoutSession,
  getCheckoutSessionId,
  clearCheckoutSessionId
} from '@/lib/checkoutSession';

type PaymentStatus = 'idle' | 'processing' | 'approved' | 'pending_payment' | 'failed';

interface CheckoutContentProps {
  tenantId: string;
}

export function CheckoutContent({ tenantId }: CheckoutContentProps) {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();
  const { items, shipping, isLoading: cartLoading, clearCart } = useCart();
  const { draft, isHydrated, updateCartSnapshot, updateCustomer, clearDraft } = useOrderDraft();
  const { processPayment, isProcessing, paymentResult } = useCheckoutPayment({ tenantId });
  
  const [formData, setFormData] = useState<CheckoutFormData>(initialCheckoutFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CheckoutFormData, string>>>({});
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [cardData, setCardData] = useState<CardData>({
    number: '', holderName: '', expMonth: '', expYear: '', cvv: '',
  });

  // Checkout session tracking refs
  const sessionStarted = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start checkout session once on mount (or when items become available)
  useEffect(() => {
    if (sessionStarted.current || items.length === 0) return;
    
    sessionStarted.current = true;
    
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const shippingTotal = shipping.selected?.price || 0;
    
    console.log('[checkout] Starting session, items:', items.length, 'host:', window.location.host);
    
    startCheckoutSession({
      tenantSlug: tenantSlug || undefined,
      cartItems: items.map(item => ({
        product_id: item.product_id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        price: item.price,
        image_url: item.image_url,
      })),
      totalEstimated: subtotal + shippingTotal,
      customerEmail: formData.customerEmail || undefined,
      customerPhone: formData.customerPhone || undefined,
      customerName: formData.customerName || undefined,
      region: shipping.cep || undefined,
    });
  }, [items.length]);

  // Heartbeat every 25 seconds while in checkout
  useEffect(() => {
    if (items.length === 0) return;

    const sendHeartbeat = () => {
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shippingTotal = shipping.selected?.price || 0;
      
      heartbeatCheckoutSession({
        tenantSlug: tenantSlug || undefined,
        cartItems: items.map(item => ({
          product_id: item.product_id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: item.price,
        })),
        totalEstimated: subtotal + shippingTotal,
        customerEmail: formData.customerEmail || undefined,
        customerPhone: formData.customerPhone || undefined,
        customerName: formData.customerName || undefined,
        region: formData.shippingPostalCode || shipping.cep || undefined,
        step: 'checkout',
      });
    };

    // Start heartbeat interval
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, 25000);

    // Cleanup on unmount
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [tenantSlug, items, formData.customerEmail, formData.customerPhone, formData.customerName, formData.shippingPostalCode, shipping]);

  // Track page exit to mark checkout as abandoned immediately
  useEffect(() => {
    const handlePageExit = () => {
      // Only send if we have a session and items
      const sessionId = getCheckoutSessionId();
      if (sessionId && items.length > 0) {
        console.log('[checkout] Page exit detected, ending session');
        endCheckoutSession();
      }
    };

    // pagehide is more reliable on mobile Safari
    window.addEventListener('pagehide', handlePageExit);
    // beforeunload as fallback for desktop browsers
    window.addEventListener('beforeunload', handlePageExit);

    return () => {
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
    };
  }, [items.length]);

  // Hydrate form from draft
  useEffect(() => {
    if (isHydrated && draft.customer.name) {
      setFormData({
        customerName: draft.customer.name || '',
        customerEmail: draft.customer.email || '',
        customerPhone: draft.customer.phone || '',
        customerCpf: draft.customer.cpf || '',
        shippingStreet: draft.customer.shippingStreet || '',
        shippingNumber: draft.customer.shippingNumber || '',
        shippingComplement: draft.customer.shippingComplement || '',
        shippingNeighborhood: draft.customer.shippingNeighborhood || '',
        shippingCity: draft.customer.shippingCity || '',
        shippingState: draft.customer.shippingState || '',
        shippingPostalCode: draft.customer.shippingPostalCode || shipping.cep || '',
        notes: '',
      });
    }
  }, [isHydrated]);

  // Sync cart snapshot to draft
  useEffect(() => {
    if (isHydrated && items.length > 0) {
      updateCartSnapshot(items, { cep: shipping.cep, selected: shipping.selected });
    }
  }, [items, shipping, isHydrated]);

  // Persist form changes to draft
  useEffect(() => {
    if (isHydrated) {
      updateCustomer({
        name: formData.customerName, email: formData.customerEmail,
        phone: formData.customerPhone, cpf: formData.customerCpf,
        shippingStreet: formData.shippingStreet, shippingNumber: formData.shippingNumber,
        shippingComplement: formData.shippingComplement, shippingNeighborhood: formData.shippingNeighborhood,
        shippingCity: formData.shippingCity, shippingState: formData.shippingState,
        shippingPostalCode: formData.shippingPostalCode,
      });
    }
  }, [formData, isHydrated]);

  useEffect(() => {
    if (shipping.cep && !formData.shippingPostalCode) {
      setFormData(prev => ({ ...prev, shippingPostalCode: shipping.cep }));
    }
  }, [shipping.cep]);

  const handleSubmit = async () => {
    const errors = validateCheckoutForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) { toast.error('Corrija os erros no formulário'); return; }
    if (!shipping.selected) { toast.error('Selecione uma opção de frete'); return; }
    if (paymentMethod === 'credit_card' && (!cardData.number || !cardData.holderName || !cardData.cvv)) {
      toast.error('Preencha os dados do cartão'); return;
    }

    setPaymentStatus('processing');
    setPaymentError(null);

    // Get session ID to pass to order creation
    const sessionId = getCheckoutSessionId();

    const result = await processPayment({
      method: paymentMethod,
      items,
      shipping: {
        street: formData.shippingStreet, number: formData.shippingNumber,
        complement: formData.shippingComplement, neighborhood: formData.shippingNeighborhood,
        city: formData.shippingCity, state: formData.shippingState, postalCode: formData.shippingPostalCode,
      },
      shippingOption: shipping.selected,
      customer: {
        name: formData.customerName, email: formData.customerEmail,
        phone: formData.customerPhone, cpf: formData.customerCpf,
      },
      card: paymentMethod === 'credit_card' ? cardData : undefined,
      checkoutSessionId: sessionId || undefined,
    });

    if (result.success) {
      // Complete checkout session with order ID
      if (tenantSlug && result.orderId) {
        completeCheckoutSession({
          tenantSlug,
          orderId: result.orderId,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
        });
      }

      if (paymentMethod === 'credit_card' && result.cardStatus === 'paid') {
        setPaymentStatus('approved');
        clearCart(); clearDraft();
        toast.success('Pedido realizado com sucesso!');
        navigate(`/store/${tenantSlug}/obrigado?pedido=${result.orderNumber}`);
      } else {
        setPaymentStatus('pending_payment');
        clearCart(); clearDraft();
      }
    } else {
      setPaymentStatus('failed');
      setPaymentError(result.error || 'Erro ao processar pagamento');
      toast.error('Falha no pagamento');
    }
  };

  const handleRetry = () => { setPaymentStatus('idle'); setPaymentError(null); };
  const handleViewOrders = () => navigate(`/store/${tenantSlug}/conta/pedidos`);

  if (cartLoading) {
    return <div className="container mx-auto px-4 py-12 flex items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <span className="text-muted-foreground">Carregando checkout...</span>
    </div>;
  }

  if (items.length === 0 && paymentStatus === 'idle') {
    return <div className="container mx-auto px-4 py-12 max-w-md mx-auto text-center">
      <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h2>
      <p className="text-muted-foreground mb-6">Adicione produtos antes de finalizar.</p>
      <Link to={`/store/${tenantSlug}`}><Button><ArrowLeft className="h-4 w-4 mr-2" />Voltar para a loja</Button></Link>
    </div>;
  }

  // Show payment result for PIX/Boleto
  if (paymentStatus === 'pending_payment' && paymentResult) {
    return <div className="container mx-auto px-4 py-8 max-w-lg">
      <PaymentResultDisplay result={paymentResult} method={paymentMethod} onContinue={handleViewOrders} />
    </div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link 
          to={`/store/${tenantSlug}/cart`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao carrinho
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">Finalizar compra</h1>

      {/* Payment failed alert */}
      {paymentStatus === 'failed' && paymentError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha no pagamento</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{paymentError}</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column - Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Guest checkout notice */}
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Você está comprando como <strong>visitante</strong>. Não é necessário criar conta.
            </p>
          </div>

          {/* Customer form */}
          <div className="border rounded-lg p-4 md:p-6">
            <CheckoutForm
              data={formData}
              onChange={setFormData}
              errors={formErrors}
              disabled={isProcessing}
            />
          </div>

          {/* Shipping section */}
          <CheckoutShipping disabled={isProcessing} />

          {/* Payment method selection */}
          <div className="border rounded-lg p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">Pagamento</h2>
            <p className="text-sm text-muted-foreground mb-4">Escolha como deseja pagar</p>
            <PaymentMethodSelector
              selectedMethod={paymentMethod}
              onMethodChange={setPaymentMethod}
              cardData={cardData}
              onCardDataChange={setCardData}
              disabled={isProcessing}
            />
          </div>

          {/* Order bump */}
          <OrderBumpSection tenantId={tenantId} disabled={isProcessing} />
        </div>

        {/* Sidebar - Order Summary */}
        <div>
          <CheckoutOrderSummary
            onSubmit={handleSubmit}
            paymentStatus={paymentStatus}
          />
        </div>
      </div>

      {/* Mobile spacer */}
      <div className="h-40 lg:hidden" />
    </div>
  );
}
