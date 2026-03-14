// =============================================
// CHECKOUT STEP WIZARD - Multi-step checkout (Mercado Livre style)
// Steps: 1) Dados pessoais 2) Endereço 3) Entrega 4) Pagamento
// Uses REAL payment integration with Pagar.me
// =============================================

import React, { useState, useEffect, useRef, Fragment } from 'react';
import { sanitizeCep, isValidCep } from '@/lib/cepUtils';
import { isValidCpf, handleCpfInput } from '@/lib/formatCpf';
import { useCepLookup } from '@/hooks/useCepLookup';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useDiscount, AppliedDiscount } from '@/contexts/DiscountContext';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';
import { useOrderDraft } from '@/hooks/useOrderDraft';
import { useCheckoutPayment, PaymentMethod, CardData } from '@/hooks/useCheckoutPayment';
import { CheckoutFormData, initialCheckoutFormData, validateCheckoutForm } from './CheckoutForm';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { PaymentResultDisplay } from './PaymentResult';
import { CouponInput } from '@/components/storefront/CouponInput';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CepInput } from '@/components/storefront/shared/CepInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertTriangle, ShoppingCart, ArrowLeft, ArrowRight, Check, User, MapPin, Truck, CreditCard, Info, Eye, EyeOff, Tag, ChevronRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { calculateCartTotals, formatCurrency } from '@/lib/cartTotals';
import { useShipping, useCanonicalDomain, useCheckoutConfig } from '@/contexts/StorefrontConfigContext';
import { OrderBumpSection } from './OrderBumpSection';
import { CheckoutTestimonials } from './CheckoutTestimonials';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { getCanonicalOrigin } from '@/lib/canonicalUrls';
import { getStoreHost } from '@/lib/storeHost';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { getStoredAttribution, clearStoredAttribution } from '@/hooks/useAttribution';
import { getStoredAffiliateData, clearStoredAffiliateData } from '@/lib/affiliateTracking';
import {
  startCheckoutSession,
  heartbeatCheckoutSession,
  completeCheckoutSession,
  getCheckoutSessionId,
  captureCheckoutContact,
  endCheckoutSession,
} from '@/lib/checkoutSession';
import { usePublicPaymentDiscounts, calculatePaymentMethodDiscount, getMaxInstallments } from '@/hooks/usePublicPaymentDiscounts';

type PaymentStatus = 'idle' | 'processing' | 'approved' | 'pending_payment' | 'failed';
type CheckoutStep = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1, label: 'Seus dados', icon: User },
  { id: 2, label: 'Endereço', icon: MapPin },
  { id: 3, label: 'Entrega', icon: Truck },
  { id: 4, label: 'Pagamento', icon: CreditCard },
] as const;

// Form data without password (moved to Thank You page)
type ExtendedFormData = CheckoutFormData;

const initialExtendedFormData: ExtendedFormData = {
  ...initialCheckoutFormData,
};

interface CheckoutStepWizardProps {
  tenantId: string;
}

export function CheckoutStepWizard({ tenantId }: CheckoutStepWizardProps) {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);
  const { items, shipping, setShippingCep, setShippingOptions, selectShipping, isLoading: cartLoading, clearCart, subtotal } = useCart();
  const { appliedDiscount, applyDiscount, removeDiscount, getDiscountAmount, revalidateDiscount, checkFirstPurchaseEligibility } = useDiscount();
  const { draft, isHydrated, updateCartSnapshot, updateCustomer, clearDraft } = useOrderDraft();
  const { config: shippingConfig, quote, quoteAsync, isLoading: shippingLoading } = useShipping();
  const { processPayment, isProcessing: paymentProcessing, paymentResult, activeGateway } = useCheckoutPayment({ tenantId });
  const { customDomain } = useCanonicalDomain();
  const { config: checkoutConfig } = useCheckoutConfig();
  const { trackInitiateCheckout, trackLead, trackAddShippingInfo, trackAddPaymentInfo, trackPurchase } = useMarketingEvents();
  // Map gateway name to provider key used in payment_method_discounts
  const providerKey = activeGateway === 'mercadopago' ? 'mercadopago' : 'pagarme';
  const { data: paymentDiscounts = [] } = usePublicPaymentDiscounts(tenantId, providerKey);
  
  // Get canonical origin for auth redirects (custom domain or platform subdomain)
  const canonicalOrigin = getCanonicalOrigin(customDomain, tenantSlug || '');
  
  // Use centralized store host helper - always sends actual browser host
  const storeHost = getStoreHost();
  
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
  
  // Reset installments when payment method changes or max changes
  useEffect(() => {
    if (paymentMethod !== 'credit_card') {
      setSelectedInstallments(1);
    } else if (selectedInstallments > maxInstallments) {
      setSelectedInstallments(maxInstallments);
    }
  }, [paymentMethod, maxInstallments]);

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

  // Revalidate discount on mount and when cart changes
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
      
      // No password validation in checkout - account creation moved to Thank You page
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
      });

      if (result.success) {
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

        // Build userData for PII enrichment (Phase 5)
        const purchaseUserData = {
          email: formData.customerEmail,
          phone: formData.customerPhone,
          name: formData.customerName,
          city: formData.shippingCity,
          state: formData.shippingState,
          zip: formData.shippingPostalCode,
        };

        if (paymentMethod === 'credit_card' && result.cardStatus === 'paid') {
          // Credit card approved immediately - always track Purchase
          trackPurchase({
            order_id: cleanOrderNumber,
            value: totals.grandTotal,
            items: items.map(i => ({ id: i.product_id, sku: i.sku, meta_retailer_id: i.meta_retailer_id, name: i.name, price: i.price, quantity: i.quantity })),
            purchaseEventTiming: checkoutConfig.purchaseEventTiming,
            userData: purchaseUserData,
          });
          
          setPaymentStatus('approved');
          clearCart();
          clearDraft();
          clearStoredAttribution();
          clearStoredAffiliateData();
          toast.success('Pedido realizado com sucesso!');
          navigate(`${urls.thankYou()}?pedido=${encodeURIComponent(cleanOrderNumber)}`);
        } else {
          // PIX/Boleto — Phase 2: Respect purchaseEventTiming
          // all_orders: track Purchase now (creation = conversion)
          // paid_only: DO NOT track — Purchase will come from webhook when payment confirmed
          if (checkoutConfig.purchaseEventTiming !== 'paid_only') {
            trackPurchase({
              order_id: cleanOrderNumber,
              value: totals.grandTotal,
              items: items.map(i => ({ id: i.product_id, sku: i.sku, meta_retailer_id: i.meta_retailer_id, name: i.name, price: i.price, quantity: i.quantity })),
              purchaseEventTiming: checkoutConfig.purchaseEventTiming,
              userData: purchaseUserData,
            });
          } else {
            console.log('[Checkout] Purchase event skipped for PIX/Boleto — purchaseEventTiming is paid_only, will fire from webhook');
          }
          
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
                methodsOrder={checkoutConfig.paymentMethodsOrder}
                customLabels={checkoutConfig.paymentMethodLabels}
                showPix={checkoutConfig.showPix}
                showBoleto={checkoutConfig.showBoleto}
                showCreditCard={checkoutConfig.showCreditCard}
                maxInstallments={maxInstallments}
                selectedInstallments={selectedInstallments}
                onInstallmentsChange={setSelectedInstallments}
                grandTotal={totals.grandTotal}
                paymentMethodDiscountAmount={paymentMethodDiscountAmount}
              />
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

// Progress Timeline Component (modern horizontal style like builder)
// Mobile-friendly: wraps properly and shows smaller labels
function ProgressTimeline({ 
  steps, 
  currentStep, 
  onStepClick 
}: { 
  steps: typeof STEPS; 
  currentStep: CheckoutStep;
  onStepClick: (step: CheckoutStep) => void;
}) {
  return (
    <div className="mb-6 md:mb-8">
      {/* Desktop: horizontal pills with labels */}
      <div className="hidden sm:flex items-center justify-center gap-2 flex-wrap">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.id}>
              <button
                onClick={() => step.id <= currentStep && onStepClick(step.id as CheckoutStep)}
                disabled={step.id > currentStep}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-full text-sm whitespace-nowrap transition-colors",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                style={isCurrent ? {
                  backgroundColor: 'var(--theme-button-primary-bg, hsl(var(--primary)))',
                  color: 'var(--theme-button-primary-text, hsl(var(--primary-foreground)))',
                } : isCompleted ? {
                  backgroundColor: 'color-mix(in srgb, var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e)) 15%, transparent)',
                  color: 'var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e))',
                  cursor: 'pointer',
                } : undefined}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
                <span className="font-medium">{step.label}</span>
              </button>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile: compact numbered circles with current step label */}
      <div className="flex sm:hidden flex-col items-center gap-3">
        <div className="flex items-center gap-1">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => step.id <= currentStep && onStepClick(step.id as CheckoutStep)}
                  disabled={step.id > currentStep}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                  style={isCurrent ? {
                    backgroundColor: 'var(--theme-button-primary-bg, hsl(var(--primary)))',
                    color: 'var(--theme-button-primary-text, hsl(var(--primary-foreground)))',
                  } : isCompleted ? {
                    backgroundColor: 'var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e))',
                    color: 'white',
                  } : undefined}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div 
                    className={cn("w-6 h-0.5", !isCompleted && "bg-muted")}
                    style={currentStep > step.id ? {
                      backgroundColor: 'var(--theme-button-primary-bg, var(--theme-accent-color, #22c55e))',
                    } : undefined}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
        {/* Current step label */}
        <span className="text-sm font-medium text-foreground">
          {steps.find(s => s.id === currentStep)?.label}
        </span>
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
  // Password fields removed - account creation moved to Thank You page

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
              <p className="text-sm mt-1 flex items-center gap-1 sf-accent-icon">
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
            onChange={(e) => onChange('customerCpf', handleCpfInput(e.target.value))}
            placeholder="000.000.000-00"
            disabled={disabled}
            className={errors.customerCpf ? 'border-destructive' : ''}
          />
          {errors.customerCpf && <p className="text-sm text-destructive mt-1">{errors.customerCpf}</p>}
        </div>

        {/* Info about account creation - now on Thank You page */}
        <div className="pt-4 border-t mt-4">
          <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Após a compra, você poderá criar sua conta</p>
              <p className="text-muted-foreground">E acompanhar seus pedidos em "Minha Conta".</p>
            </div>
          </div>
        </div>

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
  const { lookupCep, isLoading: isLookingUp } = useCepLookup();

  const handleCepLookup = async () => {
    const cep = sanitizeCep(formData.shippingPostalCode);
    if (!isValidCep(cep)) return;
    const result = await lookupCep(cep);
    if (result) {
      if (result.street) onChange('shippingStreet', result.street);
      if (result.neighborhood) onChange('shippingNeighborhood', result.neighborhood);
      if (result.city) onChange('shippingCity', result.city);
      if (result.state) onChange('shippingState', result.state);
    }
  };

  const handleCepKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCepLookup();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Endereço de entrega</h2>
        <p className="text-sm text-muted-foreground">Para onde devemos enviar seu pedido?</p>
      </div>

      <div className="grid gap-4">
        <div className="max-w-[250px]">
          <Label htmlFor="shippingPostalCode">CEP *</Label>
          <div className="flex gap-2">
            <CepInput
              id="sf-checkout-step2-cep"
              source="CheckoutStepWizard-Step2"
              value={formData.shippingPostalCode}
              onValueChange={(digits) => onChange('shippingPostalCode', digits)}
              onKeyDown={handleCepKeyDown}
              placeholder="00000000"
              disabled={disabled}
              className={errors.shippingPostalCode ? 'border-destructive' : ''}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleCepLookup}
              disabled={disabled || isLookingUp || !isValidCep(sanitizeCep(formData.shippingPostalCode))}
              title="Buscar endereço pelo CEP"
            >
              {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
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
                    : option.isFree
                    ? "border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 hover:bg-green-50 dark:hover:bg-green-950/30"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={option.label} id={`shipping-${index}`} />
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {option.label}
                      {option.isFree && (
                        <span className="sf-checkout-flag inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: 'var(--theme-flags-color, var(--theme-accent-color, #22c55e))' }}>
                          FRETE GRÁTIS
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Entrega em até {option.deliveryDays} dia(s) úteis
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {option.isFree ? (
                    <div className="flex flex-col items-end">
                      {option.originalPrice != null && option.originalPrice > 0 && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatCurrency(option.originalPrice)}
                        </span>
                      )}
                      <span className="sf-flag-text font-semibold" style={{ color: 'var(--theme-flags-color, var(--theme-accent-color, #22c55e))' }}>Grátis</span>
                    </div>
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
  methodsOrder,
  customLabels,
  showPix,
  showBoleto,
  showCreditCard,
  maxInstallments,
  selectedInstallments,
  onInstallmentsChange,
  grandTotal,
  paymentMethodDiscountAmount,
}: { 
  disabled: boolean;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  cardData: CardData;
  onCardDataChange: (data: CardData) => void;
  methodsOrder?: PaymentMethod[];
  customLabels?: Partial<Record<PaymentMethod, string>>;
  showPix?: boolean;
  showBoleto?: boolean;
  showCreditCard?: boolean;
  maxInstallments: number;
  selectedInstallments: number;
  onInstallmentsChange: (n: number) => void;
  grandTotal: number;
  paymentMethodDiscountAmount: number;
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
        methodsOrder={methodsOrder}
        customLabels={customLabels}
        showPix={showPix}
        showBoleto={showBoleto}
        showCreditCard={showCreditCard}
      />

      {/* Payment method discount info */}
      {paymentMethodDiscountAmount > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: 'var(--theme-accent-color, hsl(var(--primary)))', backgroundColor: 'hsl(var(--primary) / 0.05)' }}>
          <Tag className="h-4 w-4" style={{ color: 'var(--theme-accent-color, hsl(var(--primary)))' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--theme-accent-color, hsl(var(--primary)))' }}>
            Desconto de {formatCurrency(paymentMethodDiscountAmount)} aplicado!
          </span>
        </div>
      )}

      {/* Installments selector for credit card */}
      {paymentMethod === 'credit_card' && maxInstallments > 1 && (
        <div className="border rounded-lg p-4">
          <Label className="text-sm font-semibold mb-2 block">Parcelas</Label>
          <RadioGroup
            value={String(selectedInstallments)}
            onValueChange={(v) => onInstallmentsChange(parseInt(v))}
            className="space-y-2"
            disabled={disabled}
          >
            {Array.from({ length: maxInstallments }, (_, i) => i + 1).map(n => {
              const installmentValue = grandTotal / n;
              return (
                <Label
                  key={n}
                  htmlFor={`installment-${n}`}
                  className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <RadioGroupItem value={String(n)} id={`installment-${n}`} disabled={disabled} />
                  <span className="flex-1 text-sm">
                    {n}x de {formatCurrency(installmentValue)} {n === 1 ? '(à vista)' : 'sem juros'}
                  </span>
                  {n === 1 && <span className="text-xs font-medium text-muted-foreground">{formatCurrency(grandTotal)}</span>}
                </Label>
              );
            })}
          </RadioGroup>
        </div>
      )}
    </div>
  );
}

// Order Summary Sidebar
function OrderSummarySidebar({ 
  items, 
  totals, 
  shipping,
  appliedDiscount,
  freeShipping,
  paymentMethodDiscountAmount = 0,
  paymentMethod,
}: { 
  items: any[];
  totals: { subtotal: number; shippingTotal: number; discountTotal: number; grandTotal: number; itemCount: number; totalItems: number; paymentMethodDiscount?: number };
  shipping: any;
  appliedDiscount?: AppliedDiscount | null;
  freeShipping?: boolean;
  paymentMethodDiscountAmount?: number;
  paymentMethod?: string;
}) {
  const methodLabel = paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'boleto' ? 'Boleto' : paymentMethod === 'credit_card' ? 'Cartão' : '';

  return (
    <div className="bg-card border rounded-lg p-4">
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
          <span>
            {!shipping ? 'A calcular' : freeShipping ? (
              <span className="sf-flag-text font-medium" style={{ color: 'var(--theme-flags-color, var(--theme-accent-color, #22c55e))' }}>Grátis</span>
            ) : (
              formatCurrency(totals.shippingTotal)
            )}
          </span>
        </div>
        {shipping && (
          <div className="text-xs text-muted-foreground">
            {shipping.label} • {shipping.deliveryDays} dia(s)
          </div>
        )}

        {/* Coupon discount line */}
        {(totals.discountTotal > 0 || appliedDiscount) && (
          <div className="flex justify-between" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
            <span className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {appliedDiscount?.discount_name || 'Desconto'}
              {appliedDiscount?.is_auto_applied && (
                <span className="text-xs font-normal">(automático)</span>
              )}
            </span>
            <span>- {formatCurrency(totals.discountTotal)}</span>
          </div>
        )}

        {/* Payment method discount line */}
        {paymentMethodDiscountAmount > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
            <span className="flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              Desconto {methodLabel}
            </span>
            <span>- {formatCurrency(paymentMethodDiscountAmount)}</span>
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
