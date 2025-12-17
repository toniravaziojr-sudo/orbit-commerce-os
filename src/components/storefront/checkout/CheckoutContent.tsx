// =============================================
// CHECKOUT CONTENT - Main checkout page content
// Uses OrderDraft for persistence and centralized totals
// =============================================

import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { CheckoutForm, CheckoutFormData, initialCheckoutFormData, validateCheckoutForm } from './CheckoutForm';
import { CheckoutOrderSummary } from './CheckoutOrderSummary';
import { CheckoutShipping } from './CheckoutShipping';
import { OrderBumpSection } from './OrderBumpSection';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShoppingCart, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

type PaymentStatus = 'idle' | 'processing' | 'approved' | 'failed';

interface CheckoutContentProps {
  tenantId: string;
}

export function CheckoutContent({ tenantId }: CheckoutContentProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { items, shipping, isLoading: cartLoading, clearCart } = useCart();
  const { draft, isHydrated, updateCartSnapshot, updateCustomer, clearDraft } = useOrderDraft();
  
  const [formData, setFormData] = useState<CheckoutFormData>(initialCheckoutFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CheckoutFormData, string>>>({});
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Hydrate form from draft on initial load
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
        name: formData.customerName,
        email: formData.customerEmail,
        phone: formData.customerPhone,
        cpf: formData.customerCpf,
        shippingStreet: formData.shippingStreet,
        shippingNumber: formData.shippingNumber,
        shippingComplement: formData.shippingComplement,
        shippingNeighborhood: formData.shippingNeighborhood,
        shippingCity: formData.shippingCity,
        shippingState: formData.shippingState,
        shippingPostalCode: formData.shippingPostalCode,
      });
    }
  }, [formData, isHydrated]);

  // Sync CEP from cart to form
  useEffect(() => {
    if (shipping.cep && !formData.shippingPostalCode) {
      setFormData(prev => ({ ...prev, shippingPostalCode: shipping.cep }));
    }
  }, [shipping.cep]);

  const handleSubmit = async () => {
    // Validate form
    const errors = validateCheckoutForm(formData);
    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }

    // Check if shipping is selected
    if (!shipping.selected) {
      toast.error('Por favor, selecione uma opção de frete');
      return;
    }

    // Start payment processing
    setPaymentStatus('processing');
    setPaymentError(null);

    try {
      // Mock payment processing - simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Simulate success (90% chance) or failure (10% chance)
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        setPaymentStatus('approved');
        
        // Clear cart and draft only after approval
        clearCart();
        clearDraft();
        
        // Navigate to thank you page
        toast.success('Pedido realizado com sucesso!');
        navigate(`/store/${tenantSlug}/obrigado`);
      } else {
        throw new Error('Pagamento recusado. Por favor, tente novamente.');
      }
    } catch (error) {
      setPaymentStatus('failed');
      setPaymentError(error instanceof Error ? error.message : 'Erro ao processar pagamento');
      toast.error('Falha no pagamento');
    }
  };

  const handleRetry = () => {
    setPaymentStatus('idle');
    setPaymentError(null);
  };

  // Loading state
  if (cartLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Carregando checkout...</span>
        </div>
      </div>
    );
  }

  // Empty cart guard
  if (items.length === 0 && paymentStatus !== 'approved') {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h2>
          <p className="text-muted-foreground mb-6">
            Adicione produtos ao carrinho antes de finalizar a compra.
          </p>
          <Link to={`/store/${tenantSlug}`}>
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para a loja
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isProcessing = paymentStatus === 'processing';

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
