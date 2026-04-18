// =============================================
// CHECKOUT STEP WIZARD - Multi-step checkout (Mercado Livre style)
// Steps: 1) Dados pessoais 2) Endereço 3) Entrega 4) Pagamento
// Uses REAL payment integration with Pagar.me
// =============================================
//
// REFATOR (Frente D — Performance):
// - Steps extraídos para arquivos próprios em ./wizard
// - Steps 3 (frete) e 4 (pagamento) carregados via React.lazy
//   → quem desiste no Step 1/2 não baixa código de cartão/parcelas
// - Lógica de orquestração (state, navegação, pagamento) permanece aqui
// =============================================

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { sanitizeCep, isValidCep } from '@/lib/cepUtils';
import { useRetryCheckoutData } from '@/hooks/useRetryCheckoutData';
import { isValidCpf } from '@/lib/formatCpf';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useDiscount } from '@/contexts/DiscountContext';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { useCheckoutPayment, PaymentMethod, CardData } from '@/hooks/useCheckoutPayment';
import { initialCheckoutFormData } from './CheckoutForm';
import { PaymentResultDisplay } from './PaymentResult';
import { CouponInput } from '@/components/storefront/CouponInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShoppingCart, ArrowLeft, ArrowRight, Check, User, MapPin, Truck, CreditCard, Info, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { calculateCartTotals } from '@/lib/cartTotals';
import { useShipping, useCanonicalDomain, useCheckoutConfig } from '@/contexts/StorefrontConfigContext';
import { OrderBumpSection } from './OrderBumpSection';
import { CheckoutTestimonials } from './CheckoutTestimonials';
import { getCanonicalOrigin } from '@/lib/canonicalUrls';
import { getStoreHost } from '@/lib/storeHost';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { getStoredAttribution, clearStoredAttribution } from '@/hooks/useAttribution';
import { getStoredAffiliateData, clearStoredAffiliateData } from '@/lib/affiliateTracking';
import { useCheckoutLinkLoader } from '@/hooks/useCheckoutLinkLoader';
import {
  startCheckoutSession,
  heartbeatCheckoutSession,
  completeCheckoutSession,
  getCheckoutSessionId,
  captureCheckoutContact,
  endCheckoutSession,
} from '@/lib/checkoutSession';
import { usePublicPaymentDiscounts, calculatePaymentMethodDiscount, getMaxInstallments, getFreeInstallments } from '@/hooks/usePublicPaymentDiscounts';

// Sub-componentes do wizard
import { ProgressTimeline } from './wizard/ProgressTimeline';
import { Step1PersonalData } from './wizard/Step1PersonalData';
import { Step2Address } from './wizard/Step2Address';
import { OrderSummarySidebar } from './wizard/OrderSummarySidebar';
import type { CheckoutStep, ExtendedFormData, PaymentStatus, StepDef } from './wizard/types';

// LAZY: Steps 3 e 4 só são baixados quando o usuário avança até eles.
// Step 4 puxa PaymentMethodSelector + lógica de cartão/parcelas — chunk pesado.
const Step3Shipping = lazy(() => import('./wizard/Step3Shipping').then(m => ({ default: m.Step3Shipping })));
const Step4Payment = lazy(() => import('./wizard/Step4Payment').then(m => ({ default: m.Step4Payment })));

const STEPS: ReadonlyArray<StepDef> = [
  { id: 1, label: 'Seus dados', icon: User },
  { id: 2, label: 'Endereço', icon: MapPin },
  { id: 3, label: 'Entrega', icon: Truck },
  { id: 4, label: 'Pagamento', icon: CreditCard },
] as const;

const initialExtendedFormData: ExtendedFormData = {
  ...initialCheckoutFormData,
};

interface CheckoutStepWizardProps {
  tenantId: string;
}

// Fallback minimalista para steps lazy (evita "tela branca" perceptível)
function StepLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
      <span className="text-muted-foreground">Carregando...</span>
    </div>
  );
}

export function CheckoutStepWizard({ tenantId }: CheckoutStepWizardProps) {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);
  const { items, shipping, setShippingCep, setShippingOptions, selectShipping, isLoading: cartLoading, clearCart, addItem, subtotal } = useCart();

  // Step 5: Detect retry mode from URL param ?rt=TOKEN
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const retryTokenParam = searchParams.get('rt');
  const { prefill: retryPrefill, isLoading: retryLoading, error: retryError } = useRetryCheckoutData(retryTokenParam);
  const retryPrefillAppliedRef = useRef(false);
  const { appliedDiscount, applyDiscount, removeDiscount, getDiscountAmount, revalidateDiscount, checkFirstPurchaseEligibility } = useDiscount();
  const { draft, isHydrated, updateCartSnapshot, updateCustomer, clearDraft } = useOrderDraft();
  const { config: shippingConfig, quote, quoteAsync, isLoading: shippingLoading } = useShipping();
  const { processPayment, isProcessing: paymentProcessing, paymentResult, activeGateway, mpRedirectEnabled } = useCheckoutPayment({ tenantId });
  const { customDomain } = useCanonicalDomain();
  const { config: checkoutConfig } = useCheckoutConfig();
  const { isLoading: linkLoading, error: linkError, shippingOverride, linkSlug } = useCheckoutLinkLoader({ tenantId });
  const { trackInitiateCheckout, trackLead, trackAddShippingInfo, trackAddPaymentInfo } = useMarketingEvents();
  // Map gateway name to provider key used in payment_method_discounts
  const providerKey = activeGateway === 'mercadopago' ? 'mercadopago' : 'pagarme';
  const { data: paymentDiscounts = [] } = usePublicPaymentDiscounts(tenantId, providerKey);

  // Get canonical origin for auth redirects (custom domain or platform subdomain)
  const canonicalOrigin = getCanonicalOrigin(customDomain, tenantSlug || '');

  // Use centralized store host helper - always sends actual browser host
  const storeHost = getStoreHost();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>(1);
  const [formData, setFormData] = useState<ExtendedFormData>(initialExtendedFormData);
  const [paymentMethod, setPaymentMethodRaw] = useState<PaymentMethod>('pix');
  const [cardData, setCardData] = useState<CardData>({
    number: '', holderName: '', expMonth: '', expYear: '', cvv: '',
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ExtendedFormData, string>>>({});
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Wrapper: limpa dados do cartão e estado de pagamento ao trocar método
  const setPaymentMethod = (method: PaymentMethod) => {
    setCardData({ number: '', holderName: '', expMonth: '', expYear: '', cvv: '' });
    setPaymentError(null);
    setPaymentStatus('idle');
    setPaymentMethodRaw(method);
  };
  const [isCalculatingShipping, setIsCalculatingShipping] = useState(false);
  const [isExistingCustomer, setIsExistingCustomer] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState(1);

  // Checkout session tracking refs
  const sessionStartedRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const exitFiredRef = useRef(false);

  // Calculate discount
  const discountAmount = getDiscountAmount(subtotal, shipping.selected?.price || 0);

  // Free shipping hierarchy: 1) Product-level → 2) Coupon → 3) Logistics rules
  const allItemsFreeShipping = items.length > 0 && items.every(item => item.free_shipping === true);
  const hasFreeShipping = allItemsFreeShipping || appliedDiscount?.free_shipping;
  const effectiveShipping = hasFreeShipping
    ? (shipping.selected ? { ...shipping.selected, isFree: true, price: 0 } : shipping.selected)
    : shipping.selected;

  // Use centralized totals (before payment method discount)
  const baseTotals = calculateCartTotals({
    items,
    selectedShipping: effectiveShipping,
    discountAmount,
  });

  // Payment method discount (real, from tenant config)
  const paymentMethodDiscountAmount = calculatePaymentMethodDiscount(
    paymentDiscounts,
    paymentMethod,
    baseTotals.grandTotal,
  );

  // Final totals with payment method discount applied
  const totals = {
    ...baseTotals,
    paymentMethodDiscount: paymentMethodDiscountAmount,
    grandTotal: Math.max(0, baseTotals.grandTotal - paymentMethodDiscountAmount),
  };

  // Max installments from config
  const maxInstallments = getMaxInstallments(paymentDiscounts, totals.grandTotal);
  const freeInstallments = getFreeInstallments(paymentDiscounts);
  const pixDiscountPercent = (() => {
    const pixConfig = paymentDiscounts.find(d => d.payment_method === 'pix' && d.is_enabled && d.discount_type === 'percentage');
    return pixConfig?.discount_value || 0;
  })();

  // Reset installments when payment method changes or max changes
  useEffect(() => {
    if (paymentMethod !== 'credit_card') {
      setSelectedInstallments(1);
    } else if (selectedInstallments > maxInstallments) {
      setSelectedInstallments(maxInstallments);
    }
  }, [paymentMethod, maxInstallments]);

  // PREFETCH: assim que usuário entra no Step 2, pré-baixa o chunk do Step 3
  // (idem para Step 3 → Step 4). Como import() retorna Promise resolvida,
  // o lazy() acima vai usar o cache no momento de renderizar.
  useEffect(() => {
    if (currentStep === 2) {
      import('./wizard/Step3Shipping');
    } else if (currentStep === 3) {
      import('./wizard/Step4Payment');
    }
  }, [currentStep]);

  // ===== MARKETING: Track InitiateCheckout on mount =====
  const initiateCheckoutTrackedRef = useRef(false);
  useEffect(() => {
    if (items.length > 0 && !initiateCheckoutTrackedRef.current) {
      initiateCheckoutTrackedRef.current = true;
      trackInitiateCheckout();
    }
  }, [items.length, trackInitiateCheckout]);

  // ===== CHECKOUT SESSION TRACKING =====
  // Start session IMMEDIATELY on mount
  useEffect(() => {
    if (sessionStartedRef.current) return;

    const initSession = async () => {
      sessionStartedRef.current = true;
      await startCheckoutSession({
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
    };

    initSession();

    // Cleanup: just clear heartbeat - DO NOT mark as abandoned
    // Abandoned status should ONLY be set by server-side sweep after 30min inactivity
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      // NOTE: We intentionally do NOT call endCheckoutSession() here
      // The sweep job will mark sessions as abandoned after 30min of no heartbeat
    };
  }, []); // Empty deps - run once on mount

  // ===== EXIT EVENT LISTENERS =====
  // Register exit time when user leaves the page (via sendBeacon)
  // This does NOT mark as abandoned - only records the exit time
  // The server-side sweep will determine abandonment after 30min of inactivity
  useEffect(() => {
    const handlePageExit = () => {
      // Only fire once per session
      if (exitFiredRef.current) return;
      exitFiredRef.current = true;

      // Clear heartbeat to stop sending
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }

      // Register exit time (via sendBeacon - reliable for page close)
      // This does NOT mark as abandoned - just records last_seen_at
      endCheckoutSession();
    };

    // pagehide is the most reliable event for page close/navigation
    window.addEventListener('pagehide', handlePageExit);
    // beforeunload as fallback for older browsers
    window.addEventListener('beforeunload', handlePageExit);
    // visibilitychange for tab switching (only on hide, reset on show)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Don't mark exitFired - just update last_seen_at when tab is hidden
        // The sweep will use this to determine inactivity
        endCheckoutSession();
      } else if (document.visibilityState === 'visible') {
        // User came back - reset exit flag so next hide fires
        exitFiredRef.current = false;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Heartbeat every 25 seconds
  useEffect(() => {
    if (!sessionStartedRef.current || items.length === 0) return;

    heartbeatIntervalRef.current = setInterval(() => {
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

  // Step 5: Apply retry prefill data when loaded (form + cart reconstruction)
  useEffect(() => {
    if (!retryPrefill || retryPrefillAppliedRef.current) return;
    retryPrefillAppliedRef.current = true;
    console.log('[Checkout] Applying retry prefill from order:', retryPrefill.order_number);

    // 1) Prefill form fields (customer + address)
    setFormData(prev => ({
      ...prev,
      customerName: retryPrefill.customer.name || prev.customerName,
      customerEmail: retryPrefill.customer.email || prev.customerEmail,
      customerPhone: retryPrefill.customer.phone || prev.customerPhone,
      shippingStreet: retryPrefill.shipping.street || prev.shippingStreet,
      shippingNumber: retryPrefill.shipping.number || prev.shippingNumber,
      shippingComplement: retryPrefill.shipping.complement || prev.shippingComplement,
      shippingNeighborhood: retryPrefill.shipping.neighborhood || prev.shippingNeighborhood,
      shippingCity: retryPrefill.shipping.city || prev.shippingCity,
      shippingState: retryPrefill.shipping.state || prev.shippingState,
      shippingPostalCode: retryPrefill.shipping.postal_code || prev.shippingPostalCode,
    }));

    // 2) Reconstruct cart from original order items
    if (retryPrefill.items.length > 0) {
      clearCart(); // Clear any stale items first
      retryPrefill.items.forEach(item => {
        addItem({
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          name: item.product_name,
          sku: item.sku,
          price: item.unit_price,
          quantity: item.quantity,
          image_url: item.image_url,
        });
      });
      console.log('[Checkout] Cart reconstructed with', retryPrefill.items.length, 'items from original order');
    }

    // 3) Set shipping CEP from original order if available
    if (retryPrefill.shipping.postal_code) {
      setShippingCep(retryPrefill.shipping.postal_code);
    }
  }, [retryPrefill]);

  // Prefill form from URL params (WhatsApp checkout links with customer data)
  const urlPrefillAppliedRef = useRef(false);
  useEffect(() => {
    if (urlPrefillAppliedRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    const hasUrlPrefill = sp.get('name') || sp.get('email') || sp.get('cpf') || sp.get('cep');
    if (!hasUrlPrefill) return;
    urlPrefillAppliedRef.current = true;
    console.log('[Checkout] Applying URL param prefill (WhatsApp checkout link)');

    setFormData(prev => ({
      ...prev,
      customerName: sp.get('name') || prev.customerName,
      customerEmail: sp.get('email') || prev.customerEmail,
      customerPhone: sp.get('phone') || prev.customerPhone,
      customerCpf: sp.get('cpf') || prev.customerCpf,
      shippingPostalCode: sp.get('cep') || prev.shippingPostalCode,
      shippingStreet: sp.get('street') || prev.shippingStreet,
      shippingNumber: sp.get('number') || prev.shippingNumber,
      shippingComplement: sp.get('complement') || prev.shippingComplement,
      shippingNeighborhood: sp.get('neighborhood') || prev.shippingNeighborhood,
      shippingCity: sp.get('city') || prev.shippingCity,
      shippingState: sp.get('state') || prev.shippingState,
    }));

    // Trigger shipping calculation if CEP provided
    const cep = sp.get('cep');
    if (cep && cep.replace(/\D/g, '').length === 8) {
      setShippingCep(cep.replace(/\D/g, ''));
    }
  }, [setShippingCep]);

  useEffect(() => {
    if (appliedDiscount && subtotal > 0) {
      revalidateDiscount(storeHost, subtotal, shipping.selected?.price || 0, formData.customerEmail || undefined);
    }
  }, [subtotal, shipping.selected?.price]);

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
        shippingPostalCode: sanitizeCep(draft.customer.shippingPostalCode || ''),
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
        shippingPostalCode: sanitizeCep(formData.shippingPostalCode),
      });
    }
  }, [formData, isHydrated]);

  // Check if email exists when user leaves email field
  // Also check for first purchase eligibility
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

      // Check for first purchase discount eligibility
      if (!appliedDiscount) {
        await checkFirstPurchaseEligibility(
          storeHost,
          email,
          subtotal,
          shipping.selected?.price || 0
        );
      }
    } catch (error) {
      console.error('Error checking email:', error);
      setIsExistingCustomer(false);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleFieldChange = (field: keyof ExtendedFormData, value: string) => {
    const nextValue = field === 'shippingPostalCode' ? sanitizeCep(value) : value;
    setFormData(prev => ({ ...prev, [field]: nextValue }));
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
      if (!formData.customerCpf.replace(/\D/g, '')) {
        errors.customerCpf = 'CPF é obrigatório';
      } else if (!isValidCpf(formData.customerCpf)) {
        errors.customerCpf = 'CPF inválido. Verifique os números digitados.';
      }
    }

    if (step === 2) {
      const cepDigits = sanitizeCep(formData.shippingPostalCode);
      if (!cepDigits) errors.shippingPostalCode = 'CEP é obrigatório';
      else if (!isValidCep(cepDigits)) errors.shippingPostalCode = 'CEP inválido';
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
      // When leaving step 1 (personal data), capture contact for abandoned checkout tracking
      if (currentStep === 1) {
        // BLOCKING: Ensure session exists before capturing contact
        // This is critical for abandoned checkout tracking
        const sessionId = getCheckoutSessionId();
        if (!sessionId) {
          console.log('[Checkout] No session ID, starting new session before capture...');
          await startCheckoutSession({
            tenantSlug: tenantSlug || undefined,
            cartItems: items.map(item => ({
              product_id: item.product_id,
              name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              price: item.price,
            })),
            totalEstimated: totals.grandTotal,
            customerEmail: formData.customerEmail,
            customerPhone: formData.customerPhone,
            customerName: formData.customerName,
            region: shipping.cep || undefined,
          });
        }

        // Now capture contact (BLOCKING to ensure it works)
        const captureSuccess = await captureCheckoutContact({
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
        });

        if (!captureSuccess) {
          console.warn('[Checkout] Failed to capture contact for abandoned cart tracking');
          // Show a toast but don't block the user
          toast.info('Continuando...', { description: 'Seu carrinho está sendo salvo' });
        } else {
          console.log('[Checkout] Contact captured successfully for abandoned cart tracking');
        }

        // MARKETING: Track Lead event when personal info is submitted
        trackLead({
          email: formData.customerEmail,
          phone: formData.customerPhone,
          name: formData.customerName,
        });
      }

      // When leaving step 2 (address), calculate shipping
      if (currentStep === 2) {
        await calculateShippingOptions();
      }

      // When leaving step 3 (shipping selected), track AddShippingInfo
      if (currentStep === 3 && shipping.selected) {
        trackAddShippingInfo(shipping.selected.label);
        // Persist funnel step in checkout_sessions
        heartbeatCheckoutSession({
          tenantSlug: tenantSlug || undefined,
          step: 'shipping_selected',
        });
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
    const cep = sanitizeCep(formData.shippingPostalCode);
    if (cep.length !== 8) return;

    setIsCalculatingShipping(true);
    try {
      setShippingCep(cep);

      // If checkout link has shipping override, use fixed shipping
      if (shippingOverride != null) {
        const fixedOptions = [{
          label: shippingOverride === 0 ? 'Frete Grátis' : 'Frete Fixo',
          price: shippingOverride,
          deliveryDays: 0,
          isFree: shippingOverride === 0,
        }];
        setShippingOptions(fixedOptions);
        selectShipping(fixedOptions[0]);
      } else {
        let options;
        // Use async quote for multi-provider or Frenet
        if (shippingConfig.provider === 'frenet' || shippingConfig.provider === 'multi') {
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
          // Sync quote for mock/manual providers
          options = quote(cep, totals.subtotal);
        }

        setShippingOptions(options || []);
        if (options && options.length > 0 && !shipping.selected) {
          selectShipping(options[0]);
        }
      }
    } catch (error) {
      console.error('Error calculating shipping:', error);
      toast.error('Erro ao calcular frete. Tente novamente.');
    } finally {
      setIsCalculatingShipping(false);
    }
  };

  // Real payment processing using Pagar.me
  // Synchronous lock to prevent double-click submitting two orders
  const submissionLockRef = useRef(false);

  const handlePayment = async () => {
    // === SYNC LOCK: immediate guard before any async operation ===
    if (submissionLockRef.current) return;
    submissionLockRef.current = true;

    if (!validateStep(4)) { submissionLockRef.current = false; return; }

    // Validate card data if credit card selected
    if (paymentMethod === 'credit_card' && (!cardData.number || !cardData.holderName || !cardData.cvv)) {
      toast.error('Preencha os dados do cartão');
      submissionLockRef.current = false;
      return;
    }

    // Generate stable idempotency keys for this click
    const checkoutAttemptId = crypto.randomUUID();
    const paymentAttemptId = crypto.randomUUID();

    setPaymentStatus('processing');
    setPaymentError(null);

    // MARKETING: Track AddPaymentInfo when user proceeds to pay
    trackAddPaymentInfo(paymentMethod);
    // Persist funnel step in checkout_sessions
    heartbeatCheckoutSession({
      tenantSlug: tenantSlug || undefined,
      step: 'payment_selected',
    });

    try {
      // Save email for returning customer recognition
      localStorage.setItem(`checkout_email_${tenantSlug}`, formData.customerEmail);

      // Account creation is now handled on the Thank You page (PONTO 2)

      // Get attribution & affiliate data for conversion tracking
      const sessionId = getCheckoutSessionId();
      const attribution = getStoredAttribution();
      const affiliate = getStoredAffiliateData();

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
          postalCode: sanitizeCep(formData.shippingPostalCode),
        },
        shippingOption: effectiveShipping,
        customer: {
          name: formData.customerName,
          email: formData.customerEmail,
          phone: formData.customerPhone,
          cpf: formData.customerCpf,
        },
        card: paymentMethod === 'credit_card' ? cardData : undefined,
        checkoutSessionId: sessionId || undefined,
        // Pass discount data
        discount: appliedDiscount ? {
          discount_id: appliedDiscount.discount_id,
          discount_code: appliedDiscount.discount_code,
          discount_name: appliedDiscount.discount_name,
          discount_type: appliedDiscount.discount_type,
          discount_amount: discountAmount,
          free_shipping: appliedDiscount.free_shipping,
        } : undefined,
        // Payment method discount (real, from tenant config)
        paymentMethodDiscount: paymentMethodDiscountAmount > 0 ? {
          amount: paymentMethodDiscountAmount,
          type: paymentDiscounts.find(d => d.payment_method === paymentMethod)?.discount_type || 'percentage',
          value: paymentDiscounts.find(d => d.payment_method === paymentMethod)?.discount_value || 0,
          method: paymentMethod,
        } : undefined,
        installments: paymentMethod === 'credit_card' ? selectedInstallments : 1,
        // Attribution & affiliate for conversion tracking
        attribution: attribution || undefined,
        affiliate: affiliate || undefined,
        // Shipping quote ID for server-side validation (Security Plan v3.1)
        shippingQuoteId: shipping.quoteId || undefined,
        // Step 5: Link to original declined order via retry_token
        retryFromOrderId: retryPrefill?.original_order_id || undefined,
        retryToken: retryTokenParam || undefined,
        // Idempotency keys (stable per click)
        checkoutAttemptId,
        paymentAttemptId,
      });

      if (result.success) {
        // === MP REDIRECT: redirect to external MP checkout ===
        if (paymentMethod === 'mercadopago_redirect' && result.redirectUrl) {
          clearCart();
          clearDraft();
          clearStoredAttribution();
          clearStoredAffiliateData();
          window.location.href = result.redirectUrl;
          return;
        }
        // Complete checkout session
        completeCheckoutSession({
          tenantSlug: tenantSlug || undefined,
          orderId: result.orderId || '',
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
        });

        // CRITICAL: Remove # from orderNumber for URL - # is URL fragment and breaks parsing
        // The order_number in DB has # (e.g., "#5001") but URL must NOT have it
        const cleanOrderNumber = result.orderNumber?.replace(/^#/, '').trim() || '';
        console.log('[Checkout] Navigating to thankYou with cleanOrderNumber:', cleanOrderNumber);

        if (paymentMethod === 'credit_card' && result.cardStatus === 'paid') {
          setPaymentStatus('approved');
          clearCart();
          clearDraft();
          clearStoredAttribution();
          clearStoredAffiliateData();
          toast.success('Pedido realizado com sucesso!');
          navigate(`${urls.thankYou()}?pedido=${encodeURIComponent(cleanOrderNumber)}`);
        } else {
          if (result.pixQrCode || result.pixQrCodeUrl || result.boletoUrl) {
            localStorage.setItem(`pending_payment_${cleanOrderNumber}`, JSON.stringify({
              method: paymentMethod,
              pixQrCode: result.pixQrCode,
              pixQrCodeUrl: result.pixQrCodeUrl,
              pixExpiresAt: result.pixExpiresAt,
              boletoUrl: result.boletoUrl,
              boletoBarcode: result.boletoBarcode,
              boletoDueDate: result.boletoDueDate,
            }));
          }

          setPaymentStatus('pending_payment');
          clearCart();
          clearDraft();
          clearStoredAttribution();
          clearStoredAffiliateData();
          navigate(`${urls.thankYou()}?pedido=${encodeURIComponent(cleanOrderNumber)}`);
        }
      } else if (result.cardDeclined && result.orderId && result.orderNumber) {
        // Card declined by gateway — redirect to Thank You with declined status
        const cleanOrderNumber = result.orderNumber?.replace(/^#/, '').trim() || '';
        console.log('[Checkout] Card declined — redirecting to thankYou with status=declined');

        clearCart();
        clearDraft();
        clearStoredAttribution();
        clearStoredAffiliateData();
        setPaymentStatus('failed');
        const retryParam = result.retryToken ? `&rt=${encodeURIComponent(result.retryToken)}` : '';
        navigate(`${urls.thankYou()}?pedido=${encodeURIComponent(cleanOrderNumber)}&status=declined${retryParam}`);
      } else if (result.technicalError) {
        // Technical error — order exists but charge failed to reach gateway
        console.warn('[Checkout] Technical error after order creation:', result.error);
        setPaymentStatus('failed');
        setPaymentError('Ocorreu um problema técnico ao processar o pagamento. Tente novamente.');
        toast.error('Problema técnico no pagamento');
      } else {
        // Generic error (e.g. order creation failed — no order exists)
        setPaymentStatus('failed');
        setPaymentError(result.error || 'Erro ao processar pagamento');
        toast.error('Falha no pagamento');
      }
    } catch (error) {
      setPaymentStatus('failed');
      setPaymentError(error instanceof Error ? error.message : 'Erro ao processar pagamento');
      toast.error('Falha no pagamento');
    } finally {
      submissionLockRef.current = false;
    }
  };

  const handleRetry = () => {
    setPaymentStatus('idle');
    setPaymentError(null);
  };

  // Loading state
  if (cartLoading || linkLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Carregando checkout...</span>
        </div>
      </div>
    );
  }

  // Empty cart guard (allow if payment pending, approved, or retry mode with prefill)
  const isRetryMode = !!retryTokenParam && !!retryPrefill;
  if (items.length === 0 && paymentStatus !== 'approved' && paymentStatus !== 'pending_payment' && !isRetryMode && !retryLoading && !linkLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-md mx-auto text-center">
          <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h2>
          <p className="text-muted-foreground mb-6">
            Adicione produtos ao carrinho antes de finalizar a compra.
          </p>
          <Link to={urls.home()}>
            <Button variant="unstyled" className="sf-btn-primary">
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
    const handleViewOrders = () => navigate(urls.accountOrders());
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
          to={urls.cart()}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao carrinho
        </Link>
      </div>

      {/* Step 5: Retry mode banner */}
      {isRetryMode && (
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertTitle>Retentativa de pagamento</AlertTitle>
          <AlertDescription>
            Você está retentando o pagamento do pedido #{retryPrefill.order_number}.
            Escolha uma forma de pagamento diferente para finalizar.
          </AlertDescription>
        </Alert>
      )}

      {/* Progress Timeline (modern style like builder) */}
      <ProgressTimeline steps={STEPS} currentStep={currentStep} onStepClick={goToStep} />

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

      <div className="sf-checkout-layout">
        {/* Main column - Step content */}
        <div>
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
              <Suspense fallback={<StepLoadingFallback />}>
                <Step3Shipping
                  shippingOptions={shipping.options}
                  selectedShipping={shipping.selected}
                  onSelectShipping={selectShipping}
                  isCalculating={isCalculatingShipping}
                  disabled={isProcessing}
                />
              </Suspense>
            )}
            {currentStep === 4 && (
              <Suspense fallback={<StepLoadingFallback />}>
                <Step4Payment
                  disabled={isProcessing}
                  paymentMethod={paymentMethod}
                  onPaymentMethodChange={setPaymentMethod}
                  cardData={cardData}
                  onCardDataChange={setCardData}
                  methodsOrder={checkoutConfig.paymentMethodsOrder}
                  customLabels={checkoutConfig.paymentMethodLabels}
                  showPix={checkoutConfig.showPix}
                  showBoleto={checkoutConfig.showBoleto}
                  showCreditCard={checkoutConfig.showCreditCard}
                  showMercadoPagoRedirect={mpRedirectEnabled}
                  maxInstallments={maxInstallments}
                  freeInstallments={freeInstallments}
                  selectedInstallments={selectedInstallments}
                  onInstallmentsChange={setSelectedInstallments}
                  grandTotal={totals.grandTotal}
                  paymentMethodDiscountAmount={paymentMethodDiscountAmount}
                  pixDiscountPercent={pixDiscountPercent}
                />
              </Suspense>
            )}

            {/* Order Bump - Only on payment step */}
            {currentStep === 4 && (
              <div className="mt-6">
                <OrderBumpSection tenantId={tenantId} disabled={isProcessing} />
              </div>
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
                <Button variant="unstyled" onClick={handleNext} disabled={isProcessing || isTransitioning} className="sf-btn-primary">
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
                  variant="unstyled"
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="min-w-[160px] sf-btn-primary"
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

        {/* Sidebar - Order summary + Coupon (sticky) + Testimonials */}
        <div>
          <div className="sticky top-4 space-y-4" style={{ alignSelf: 'start' }}>
            {/* Coupon input - Conditional based on checkout_config */}
            {checkoutConfig.couponEnabled && (
              <div className="bg-card border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Cupom de desconto
                </h3>
                <CouponInput
                  storeHost={storeHost}
                  subtotal={subtotal}
                  appliedDiscount={appliedDiscount}
                  onApply={(discount) => {
                    applyDiscount(storeHost, discount.discount_code, subtotal);
                  }}
                  onRemove={removeDiscount}
                />
              </div>
            )}

            <OrderSummarySidebar
              items={items}
              totals={totals}
              shipping={effectiveShipping}
              appliedDiscount={appliedDiscount}
              freeShipping={hasFreeShipping}
              paymentMethodDiscountAmount={paymentMethodDiscountAmount}
              paymentMethod={paymentMethod}
            />

            {/* Testimonials - inside sidebar column to avoid gap from grid row height */}
            {checkoutConfig.testimonialsEnabled && (
              <div className="mt-2 pt-4 border-t border-border/40">
                <CheckoutTestimonials tenantId={tenantId} productIds={items.map(item => item.product_id)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
