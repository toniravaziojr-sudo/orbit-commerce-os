// =============================================
// CHECKOUT STEP WIZARD - Multi-step checkout (Mercado Livre style)
// Steps: 1) Dados pessoais 2) Endereço 3) Entrega 4) Pagamento
// Uses REAL payment integration with Pagar.me
// =============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { useCheckoutPayment, PaymentMethod, CardData } from '@/hooks/useCheckoutPayment';
import { CheckoutFormData, initialCheckoutFormData, validateCheckoutForm } from './CheckoutForm';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentResultDisplay } from './PaymentResult';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertTriangle, ShoppingCart, ArrowLeft, ArrowRight, Check, User, MapPin, Truck, CreditCard, Info, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { calculateCartTotals, formatCurrency } from '@/lib/cartTotals';
import { useShipping, useCanonicalDomain } from '@/contexts/StorefrontConfigContext';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getCanonicalOrigin } from '@/lib/canonicalUrls';
import {
  startCheckoutSession,
  heartbeatCheckoutSession,
  completeCheckoutSession,
  endCheckoutSession,
  getCheckoutSessionId,
} from '@/lib/checkoutSession';

type PaymentStatus = 'idle' | 'processing' | 'approved' | 'pending_payment' | 'failed';
type CheckoutStep = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1, label: 'Seus dados', icon: User },
  { id: 2, label: 'Endereço', icon: MapPin },
  { id: 3, label: 'Entrega', icon: Truck },
  { id: 4, label: 'Pagamento', icon: CreditCard },
] as const;

// Extended form data to include password
interface ExtendedFormData extends CheckoutFormData {
  password: string;
  confirmPassword: string;
}

const initialExtendedFormData: ExtendedFormData = {
  ...initialCheckoutFormData,
  password: '',
  confirmPassword: '',
};

interface CheckoutStepWizardProps {
  tenantId: string;
}

export function CheckoutStepWizard({ tenantId }: CheckoutStepWizardProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { items, shipping, setShippingCep, setShippingOptions, selectShipping, isLoading: cartLoading, clearCart } = useCart();
  const { draft, isHydrated, updateCartSnapshot, updateCustomer, clearDraft } = useOrderDraft();
  const { config: shippingConfig, quote, quoteAsync, isLoading: shippingLoading } = useShipping();
  const { processPayment, isProcessing: paymentProcessing, paymentResult } = useCheckoutPayment({ tenantId });
  const { customDomain } = useCanonicalDomain();
  
  // Get canonical origin for auth redirects (custom domain or platform subdomain)
  const canonicalOrigin = getCanonicalOrigin(customDomain, tenantSlug || '');
  
  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [formData, setFormData] = useState<ExtendedFormData>(initialExtendedFormData);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [cardData, setCardData] = useState<CardData>({
    number: '', holderName: '', expMonth: '', expYear: '', cvv: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExtendedFormData, string>>>({});
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Checkout session tracking refs
  const sessionStartedRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use centralized totals
  const totals = calculateCartTotals({
    items,
    selectedShipping: shipping.selected,
    discountAmount: 0,
  });

  // ===== CHECKOUT SESSION TRACKING =====
  // Start session IMMEDIATELY on mount
  useEffect(() => {
    console.log('[checkout-wizard] === MOUNTED ===');
    console.log('[checkout-wizard] tenantId:', tenantId);
    console.log('[checkout-wizard] host:', window.location.host);
    console.log('[checkout-wizard] items:', items.length);
    console.log('[checkout-wizard] VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);

    if (sessionStartedRef.current) {
      console.log('[checkout-wizard] Session already started');
      return;
    }

    const initSession = async () => {
      sessionStartedRef.current = true;
      console.log('[checkout-wizard] === STARTING SESSION ===');
      
      try {
        const result = await startCheckoutSession({
          tenantSlug: tenantSlug || undefined,
          cartItems: items.map(item => ({
            product_id: item.product_id,
            name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            price: item.price,
          })),
          totalEstimated: totals.grandTotal,
          region: shipping.cep || undefined,
        });
        console.log('[checkout-wizard] Session result:', result);
      } catch (err) {
        console.error('[checkout-wizard] Session error:', err);
      }
    };

    initSession();

    // Cleanup: end session on unmount
    return () => {
      console.log('[checkout-wizard] === UNMOUNTING ===');
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // End session when leaving checkout
      endCheckoutSession();
    };
  }, []); // Empty deps - run once on mount

  // Heartbeat every 25 seconds
  useEffect(() => {
    if (!sessionStartedRef.current || items.length === 0) return;

    heartbeatIntervalRef.current = setInterval(() => {
      console.log('[checkout-wizard] Heartbeat');
      heartbeatCheckoutSession({
        tenantSlug: tenantSlug || undefined,
        cartItems: items.map(item => ({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalEstimated: totals.grandTotal,
        customerEmail: formData.customerEmail || undefined,
        customerPhone: formData.customerPhone || undefined,
        customerName: formData.customerName || undefined,
        step: `step_${currentStep}`,
        region: shipping.cep || undefined,
      });
    }, 25000);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [items, totals.grandTotal, formData.customerEmail, formData.customerPhone, formData.customerName, currentStep, shipping.cep, tenantSlug]);

  // Load saved email from localStorage for returning customers
  useEffect(() => {
    const savedEmail = localStorage.getItem(`checkout_email_${tenantSlug}`);
    if (savedEmail) {
      setFormData(prev => ({ ...prev, customerEmail: savedEmail }));
      setIsExistingCustomer(true);
    }
  }, [tenantSlug]);


  // Hydrate form from draft on initial load
  useEffect(() => {
    if (isHydrated && draft.customer.name) {
      setFormData(prev => ({
        ...prev,
        customerName: draft.customer.name || '',
        customerEmail: prev.customerEmail || draft.customer.email || '',
        customerPhone: draft.customer.phone || '',
        customerCpf: draft.customer.cpf || '',
        shippingStreet: draft.customer.shippingStreet || '',
        shippingNumber: draft.customer.shippingNumber || '',
        shippingComplement: draft.customer.shippingComplement || '',
        shippingNeighborhood: draft.customer.shippingNeighborhood || '',
        shippingCity: draft.customer.shippingCity || '',
        shippingState: draft.customer.shippingState || '',
        shippingPostalCode: draft.customer.shippingPostalCode || shipping.cep || '',
      }));
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

  // Check if email exists when user leaves email field
  // Note: This is a non-blocking check. If RLS blocks the query, we assume new customer.
  const checkExistingEmail = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    
    setIsCheckingEmail(true);
    try {
      // Check via localStorage first (customer who already purchased)
      const savedEmail = localStorage.getItem(`checkout_email_${tenantSlug}`);
      if (savedEmail && savedEmail.toLowerCase() === email.toLowerCase()) {
        setIsExistingCustomer(true);
        setIsCheckingEmail(false);
        return;
      }
      
      // For anonymous checkout, we can't query customers table due to RLS
      // Just default to new customer - account creation is optional anyway
      setIsExistingCustomer(false);
    } catch (error) {
      console.error('Error checking email:', error);
      setIsExistingCustomer(false);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleFieldChange = (field: keyof ExtendedFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Check email when user finishes typing
    if (field === 'customerEmail' && value.includes('@')) {
      checkExistingEmail(value);
    }
  };

  // Validate current step
  const validateStep = (step: CheckoutStep): boolean => {
    const errors: Partial<Record<keyof ExtendedFormData, string>> = {};

    if (step === 1) {
      if (!formData.customerName.trim()) errors.customerName = 'Nome é obrigatório';
      if (!formData.customerEmail.trim()) errors.customerEmail = 'E-mail é obrigatório';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) errors.customerEmail = 'E-mail inválido';
      if (!formData.customerPhone.trim()) errors.customerPhone = 'Telefone é obrigatório';
      if (!formData.customerCpf.trim()) errors.customerCpf = 'CPF é obrigatório';
      
      // Password validation for new customers
      if (!isExistingCustomer) {
        if (!formData.password) errors.password = 'Crie uma senha para sua conta';
        else if (formData.password.length < 6) errors.password = 'Senha deve ter no mínimo 6 caracteres';
        if (formData.password !== formData.confirmPassword) errors.confirmPassword = 'Senhas não conferem';
      }
    }

    if (step === 2) {
      if (!formData.shippingPostalCode.trim()) errors.shippingPostalCode = 'CEP é obrigatório';
      if (!formData.shippingStreet.trim()) errors.shippingStreet = 'Rua é obrigatória';
      if (!formData.shippingNumber.trim()) errors.shippingNumber = 'Número é obrigatório';
      if (!formData.shippingNeighborhood.trim()) errors.shippingNeighborhood = 'Bairro é obrigatório';
      if (!formData.shippingCity.trim()) errors.shippingCity = 'Cidade é obrigatória';
      if (!formData.shippingState.trim()) errors.shippingState = 'Estado é obrigatório';
    }

    if (step === 3) {
      if (!shipping.selected) {
        toast.error('Selecione uma opção de frete');
        return false;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const handleNext = async () => {
    if (!validateStep(currentStep)) {
      toast.error('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    // Prevent double-click
    if (isTransitioning) return;

    setIsTransitioning(true);
    setTransitionError(null);

    try {
      // When leaving step 2 (address), calculate shipping
      if (currentStep === 2) {
        await calculateShippingOptions();
      }

      // Small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      if (currentStep < 4) {
        setCurrentStep((currentStep + 1) as CheckoutStep);
      }
    } catch (error) {
      console.error('Error transitioning step:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro. Por favor, tente novamente.';
      setTransitionError(errorMessage);
      toast.error('Erro ao avançar. Tente novamente.');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as CheckoutStep);
    }
  };

  const goToStep = (step: CheckoutStep) => {
    // Only allow going back or to already completed steps
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  const calculateShippingOptions = async () => {
    const cep = formData.shippingPostalCode.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setIsCalculatingShipping(true);
    try {
      setShippingCep(cep);
      
      let options;
      // Use async quote for Frenet provider
      if (shippingConfig.provider === 'frenet') {
        const cartItems = items.map(item => ({
          weight: 0.3,
          height: 10,
          width: 10,
          length: 10,
          quantity: item.quantity,
          price: item.price,
        }));
        options = await quoteAsync(cep, totals.subtotal, cartItems);
      } else {
        options = quote(cep, totals.subtotal);
      }
      
      setShippingOptions(options || []);
      if (options && options.length > 0 && !shipping.selected) {
        selectShipping(options[0]);
      }
    } catch (error) {
      console.error('Error calculating shipping:', error);
      toast.error('Erro ao calcular frete. Tente novamente.');
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  // Real payment processing using Pagar.me
  const handlePayment = async () => {
    if (!validateStep(4)) return;

    // Validate card data if credit card selected
    if (paymentMethod === 'credit_card' && (!cardData.number || !cardData.holderName || !cardData.cvv)) {
      toast.error('Preencha os dados do cartão');
      return;
    }

    setPaymentStatus('processing');
    setPaymentError(null);

    try {
      // Save email for returning customer recognition
      localStorage.setItem(`checkout_email_${tenantSlug}`, formData.customerEmail);
      
      // Create account for new customers BEFORE payment
      if (!isExistingCustomer && formData.password) {
        try {
          const { error: signUpError } = await supabase.auth.signUp({
            email: formData.customerEmail,
            password: formData.password,
            options: {
              // Use canonical origin (custom domain or platform subdomain) with clean URL
              emailRedirectTo: `${canonicalOrigin}/conta`,
              data: {
                full_name: formData.customerName,
              }
            }
          });
          
          if (signUpError) {
            console.error('Error creating account:', signUpError);
          } else {
            toast.success('Conta criada! Verifique seu email para confirmar.', { duration: 5000 });
          }
        } catch (error) {
          console.error('Error creating account:', error);
        }
      }

      // Process REAL payment via Pagar.me
      const result = await processPayment({
        method: paymentMethod,
        items,
        shipping: {
          street: formData.shippingStreet,
          number: formData.shippingNumber,
          complement: formData.shippingComplement,
          neighborhood: formData.shippingNeighborhood,
          city: formData.shippingCity,
          state: formData.shippingState,
          postalCode: formData.shippingPostalCode,
        },
        shippingOption: shipping.selected,
        customer: {
          name: formData.customerName,
          email: formData.customerEmail,
          phone: formData.customerPhone,
          cpf: formData.customerCpf,
        },
        card: paymentMethod === 'credit_card' ? cardData : undefined,
      });

      if (result.success) {
        if (paymentMethod === 'credit_card' && result.cardStatus === 'paid') {
          // Credit card approved immediately
          setPaymentStatus('approved');
          clearCart();
          clearDraft();
          toast.success('Pedido realizado com sucesso!');
          navigate(`/store/${tenantSlug}/obrigado?pedido=${result.orderNumber}`);
        } else {
          // PIX/Boleto - pending payment (show QR code or boleto)
          setPaymentStatus('pending_payment');
          clearCart();
          clearDraft();
        }
      } else {
        throw new Error(result.error || 'Erro ao processar pagamento');
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

  // Empty cart guard (allow if payment pending or approved)
  if (items.length === 0 && paymentStatus !== 'approved' && paymentStatus !== 'pending_payment') {
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

  // Show payment result for PIX/Boleto (pending payment)
  if (paymentStatus === 'pending_payment' && paymentResult) {
    const handleViewOrders = () => navigate(`/store/${tenantSlug}/conta/pedidos`);
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <PaymentResultDisplay result={paymentResult} method={paymentMethod} onContinue={handleViewOrders} />
      </div>
    );
  }

  const isProcessing = paymentStatus === 'processing' || paymentProcessing;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back link */}
      <div className="mb-4">
        <Link 
          to={`/store/${tenantSlug}/cart`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao carrinho
        </Link>
      </div>

      {/* Step indicator */}
      <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />

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

      {/* Transition error alert */}
      {transitionError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao continuar</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{transitionError}</span>
            <Button variant="outline" size="sm" onClick={() => setTransitionError(null)}>
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column - Step content */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg p-6">
            {currentStep === 1 && (
              <Step1PersonalData 
                formData={formData} 
                errors={formErrors} 
                onChange={handleFieldChange}
                disabled={isProcessing}
                isExistingCustomer={isExistingCustomer}
                isCheckingEmail={isCheckingEmail}
              />
            )}
            {currentStep === 2 && (
              <Step2Address 
                formData={formData} 
                errors={formErrors} 
                onChange={handleFieldChange}
                disabled={isProcessing}
              />
            )}
            {currentStep === 3 && (
              <Step3Shipping 
                shippingOptions={shipping.options}
                selectedShipping={shipping.selected}
                onSelectShipping={selectShipping}
                isCalculating={isCalculatingShipping}
                disabled={isProcessing}
              />
            )}
            {currentStep === 4 && (
              <Step4Payment 
                disabled={isProcessing}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                cardData={cardData}
                onCardDataChange={setCardData}
              />
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isProcessing}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              {currentStep < 4 ? (
                <Button onClick={handleNext} disabled={isProcessing || isTransitioning}>
                  {isTransitioning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      Continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={handlePayment} 
                  disabled={isProcessing}
                  className="min-w-[160px]"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      Finalizar Pedido
                      <Check className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Order summary */}
        <div className="lg:col-span-1">
          <OrderSummarySidebar items={items} totals={totals} shipping={shipping.selected} />
        </div>
      </div>
    </div>
  );
}

// Step Indicator Component
function StepIndicator({ 
  steps, 
  currentStep, 
  onStepClick 
}: { 
  steps: typeof STEPS; 
  currentStep: CheckoutStep;
  onStepClick: (step: CheckoutStep) => void;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() => onStepClick(step.id as CheckoutStep)}
                disabled={step.id > currentStep}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg transition-colors",
                  isCompleted && "text-primary cursor-pointer hover:bg-primary/10",
                  isCurrent && "text-primary font-semibold",
                  !isCompleted && !isCurrent && "text-muted-foreground cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "border-primary text-primary",
                  !isCompleted && !isCurrent && "border-muted-foreground/30"
                )}>
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span className="hidden sm:inline text-sm">{step.label}</span>
              </button>

              {index < steps.length - 1 && (
                <div className={cn(
                  "flex-1 h-0.5 mx-2",
                  isCompleted ? "bg-primary" : "bg-muted"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Step 1: Personal Data
function Step1PersonalData({ 
  formData, 
  errors, 
  onChange,
  disabled,
  isExistingCustomer,
  isCheckingEmail
}: { 
  formData: ExtendedFormData;
  errors: Partial<Record<keyof ExtendedFormData, string>>;
  onChange: (field: keyof ExtendedFormData, value: string) => void;
  disabled: boolean;
  isExistingCustomer: boolean;
  isCheckingEmail: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Seus dados</h2>
        <p className="text-sm text-muted-foreground">Informe seus dados para continuar</p>
      </div>

      <div className="grid gap-4">
        <div>
          <Label htmlFor="customerName">Nome completo *</Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => onChange('customerName', e.target.value)}
            disabled={disabled}
            className={errors.customerName ? 'border-destructive' : ''}
          />
          {errors.customerName && <p className="text-sm text-destructive mt-1">{errors.customerName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="customerEmail">E-mail *</Label>
            <div className="relative">
              <Input
                id="customerEmail"
                type="email"
                value={formData.customerEmail}
                onChange={(e) => onChange('customerEmail', e.target.value)}
                disabled={disabled}
                className={errors.customerEmail ? 'border-destructive' : ''}
              />
              {isCheckingEmail && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {errors.customerEmail && <p className="text-sm text-destructive mt-1">{errors.customerEmail}</p>}
            {isExistingCustomer && !errors.customerEmail && (
              <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                <Check className="h-3 w-3" /> Bem-vindo de volta!
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="customerPhone">Telefone/WhatsApp *</Label>
            <Input
              id="customerPhone"
              value={formData.customerPhone}
              onChange={(e) => onChange('customerPhone', e.target.value)}
              placeholder="(00) 00000-0000"
              disabled={disabled}
              className={errors.customerPhone ? 'border-destructive' : ''}
            />
            {errors.customerPhone && <p className="text-sm text-destructive mt-1">{errors.customerPhone}</p>}
          </div>
        </div>

        <div className="max-w-xs">
          <Label htmlFor="customerCpf">CPF *</Label>
          <Input
            id="customerCpf"
            value={formData.customerCpf}
            onChange={(e) => onChange('customerCpf', e.target.value)}
            placeholder="000.000.000-00"
            disabled={disabled}
            className={errors.customerCpf ? 'border-destructive' : ''}
          />
          {errors.customerCpf && <p className="text-sm text-destructive mt-1">{errors.customerCpf}</p>}
        </div>

        {/* Password section - only for new customers */}
        {!isExistingCustomer && (
          <div className="pt-4 border-t mt-4">
            <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-700 dark:text-blue-300">Crie sua conta</p>
                <p className="text-blue-600 dark:text-blue-400">Esta senha será usada para acessar sua conta e acompanhar seus pedidos.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="password">Senha *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => onChange('password', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    disabled={disabled}
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar senha *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => onChange('confirmPassword', e.target.value)}
                    placeholder="Repita a senha"
                    disabled={disabled}
                    className={errors.confirmPassword ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Existing customer - show login hint */}
        {isExistingCustomer && (
          <div className="pt-4 border-t mt-4">
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-green-700 dark:text-green-300">Você já tem uma conta!</p>
                <p className="text-green-600 dark:text-green-400">Após a compra, acesse "Minha Conta" para ver seus pedidos.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Step 2: Address
function Step2Address({ 
  formData, 
  errors, 
  onChange,
  disabled 
}: { 
  formData: CheckoutFormData;
  errors: Partial<Record<keyof CheckoutFormData, string>>;
  onChange: (field: keyof CheckoutFormData, value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Endereço de entrega</h2>
        <p className="text-sm text-muted-foreground">Para onde devemos enviar seu pedido?</p>
      </div>

      <div className="grid gap-4">
        <div className="max-w-[200px]">
          <Label htmlFor="shippingPostalCode">CEP *</Label>
          <Input
            id="shippingPostalCode"
            value={formData.shippingPostalCode}
            onChange={(e) => onChange('shippingPostalCode', e.target.value)}
            placeholder="00000-000"
            disabled={disabled}
            className={errors.shippingPostalCode ? 'border-destructive' : ''}
          />
          {errors.shippingPostalCode && <p className="text-sm text-destructive mt-1">{errors.shippingPostalCode}</p>}
        </div>

        <div>
          <Label htmlFor="shippingStreet">Rua/Logradouro *</Label>
          <Input
            id="shippingStreet"
            value={formData.shippingStreet}
            onChange={(e) => onChange('shippingStreet', e.target.value)}
            disabled={disabled}
            className={errors.shippingStreet ? 'border-destructive' : ''}
          />
          {errors.shippingStreet && <p className="text-sm text-destructive mt-1">{errors.shippingStreet}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shippingNumber">Número *</Label>
            <Input
              id="shippingNumber"
              value={formData.shippingNumber}
              onChange={(e) => onChange('shippingNumber', e.target.value)}
              disabled={disabled}
              className={errors.shippingNumber ? 'border-destructive' : ''}
            />
            {errors.shippingNumber && <p className="text-sm text-destructive mt-1">{errors.shippingNumber}</p>}
          </div>
          <div>
            <Label htmlFor="shippingComplement">Complemento</Label>
            <Input
              id="shippingComplement"
              value={formData.shippingComplement}
              onChange={(e) => onChange('shippingComplement', e.target.value)}
              placeholder="Apto, bloco, etc."
              disabled={disabled}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shippingNeighborhood">Bairro *</Label>
            <Input
              id="shippingNeighborhood"
              value={formData.shippingNeighborhood}
              onChange={(e) => onChange('shippingNeighborhood', e.target.value)}
              disabled={disabled}
              className={errors.shippingNeighborhood ? 'border-destructive' : ''}
            />
            {errors.shippingNeighborhood && <p className="text-sm text-destructive mt-1">{errors.shippingNeighborhood}</p>}
          </div>
          <div>
            <Label htmlFor="shippingCity">Cidade *</Label>
            <Input
              id="shippingCity"
              value={formData.shippingCity}
              onChange={(e) => onChange('shippingCity', e.target.value)}
              disabled={disabled}
              className={errors.shippingCity ? 'border-destructive' : ''}
            />
            {errors.shippingCity && <p className="text-sm text-destructive mt-1">{errors.shippingCity}</p>}
          </div>
        </div>

        <div className="max-w-[100px]">
          <Label htmlFor="shippingState">Estado *</Label>
          <Input
            id="shippingState"
            value={formData.shippingState}
            onChange={(e) => onChange('shippingState', e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="SP"
            disabled={disabled}
            className={errors.shippingState ? 'border-destructive' : ''}
          />
          {errors.shippingState && <p className="text-sm text-destructive mt-1">{errors.shippingState}</p>}
        </div>
      </div>
    </div>
  );
}

// Step 3: Shipping
function Step3Shipping({ 
  shippingOptions, 
  selectedShipping, 
  onSelectShipping,
  isCalculating,
  disabled 
}: { 
  shippingOptions: any[];
  selectedShipping: any;
  onSelectShipping: (option: any) => void;
  isCalculating: boolean;
  disabled: boolean;
}) {
  if (isCalculating) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Calculando opções de frete...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Escolha a entrega</h2>
        <p className="text-sm text-muted-foreground">Selecione como deseja receber seu pedido</p>
      </div>

      {shippingOptions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma opção de frete disponível.</p>
          <p className="text-sm">Volte e verifique o endereço informado.</p>
        </div>
      ) : (
        <RadioGroup
          value={selectedShipping?.label || ''}
          onValueChange={(value) => {
            const option = shippingOptions.find(o => o.label === value);
            if (option) onSelectShipping(option);
          }}
          disabled={disabled}
        >
          <div className="space-y-3">
            {shippingOptions.map((option, index) => (
              <label
                key={index}
                className={cn(
                  "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors",
                  selectedShipping?.label === option.label 
                    ? "border-primary bg-primary/5" 
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={option.label} id={`shipping-${index}`} />
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">
                      Entrega em até {option.deliveryDays} dia(s) úteis
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {option.isFree ? (
                    <span className="text-green-600 font-semibold">Grátis</span>
                  ) : (
                    <span className="font-semibold">{formatCurrency(option.price)}</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        </RadioGroup>
      )}
    </div>
  );
}

// Step 4: Payment - Real payment method selection
function Step4Payment({ 
  disabled,
  paymentMethod,
  onPaymentMethodChange,
  cardData,
  onCardDataChange,
}: { 
  disabled: boolean;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cardData: CardData;
  onCardDataChange: (data: CardData) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Pagamento</h2>
        <p className="text-sm text-muted-foreground">Escolha como deseja pagar</p>
      </div>

      <PaymentMethodSelector
        selectedMethod={paymentMethod}
        onMethodChange={onPaymentMethodChange}
        cardData={cardData}
        onCardDataChange={onCardDataChange}
        disabled={disabled}
      />
    </div>
  );
}

// Order Summary Sidebar
function OrderSummarySidebar({ 
  items, 
  totals, 
  shipping 
}: { 
  items: any[];
  totals: ReturnType<typeof calculateCartTotals>;
  shipping: any;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 sticky top-4">
      <h3 className="font-semibold mb-4">Resumo do pedido</h3>

      {/* Items preview */}
      <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{item.name}</p>
              <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
            </div>
            <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal ({totals.totalItems} {totals.totalItems === 1 ? 'item' : 'itens'})</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Frete</span>
          <span>{shipping ? formatCurrency(totals.shippingTotal) : 'A calcular'}</span>
        </div>
        {shipping && (
          <div className="text-xs text-muted-foreground">
            {shipping.label} • {shipping.deliveryDays} dia(s)
          </div>
        )}
        <div className="flex justify-between font-bold text-base pt-2 border-t">
          <span>Total</span>
          <span>{formatCurrency(totals.grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
