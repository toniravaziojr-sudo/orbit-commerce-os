// =============================================
// USE CHECKOUT PAYMENT - Real payment processing
// Supports Pagar.me and Mercado Pago gateways
// Resolves gateway PER payment method via payment_method_gateway_map
// Uses edge functions for secure server-side operations
// =============================================

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem, ShippingOption } from '@/contexts/CartContext';
import { AttributionData } from '@/hooks/useAttribution';
import { sanitizeCep } from '@/lib/cepUtils';
import { AffiliateData } from '@/lib/affiliateTracking';

export type PaymentMethod = 'pix' | 'boleto' | 'credit_card' | 'mercadopago_redirect';

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  transactionId?: string;
  // PIX specific
  pixQrCode?: string;
  pixQrCodeUrl?: string;
  pixExpiresAt?: string;
  // Boleto specific
  boletoUrl?: string;
  boletoBarcode?: string;
  boletoDueDate?: string;
  // Credit card specific
  cardStatus?: string;
  // Failure classification (v8.15.0)
  cardDeclined?: boolean;
  technicalError?: boolean;
  // Secure retry token (v8.15.1)
  retryToken?: string;
  // MP Redirect
  redirectUrl?: string;
  // Error
  error?: string;
}

export interface CustomerData {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export interface ShippingData {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface CardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface DiscountData {
  discount_id: string;
  discount_code: string;
  discount_name: string;
  discount_type: string;
  discount_amount: number;
  free_shipping: boolean;
}

interface UseCheckoutPaymentOptions {
  tenantId: string;
}

interface GatewayMapEntry {
  payment_method: string;
  provider: string;
  is_enabled: boolean;
}

export function useCheckoutPayment({ tenantId }: UseCheckoutPaymentOptions) {
  // Gateway map: which provider handles each method
  const [gatewayMap, setGatewayMap] = useState<GatewayMapEntry[]>([]);
  // Fallback: legacy single gateway
  const [activeGateway, setActiveGateway] = useState<'pagarme' | 'mercadopago'>('pagarme');
  // MP Redirect enabled flag
  const [mpRedirectEnabled, setMpRedirectEnabled] = useState(false);
  
  // Load gateway map + fallback on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 1. Load per-method gateway map
        const { data: mapData } = await supabase
          .from('payment_method_gateway_map' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_enabled', true);
        
        if (mapData && (mapData as any[]).length > 0) {
          setGatewayMap(mapData as any as GatewayMapEntry[]);
        }

        // 2. Load providers for fallback + MP redirect flag
        const { data: providers } = await supabase
          .from('payment_providers')
          .select('provider, is_enabled, mp_redirect_enabled' as any)
          .eq('tenant_id', tenantId)
          .eq('is_enabled', true)
          .order('updated_at', { ascending: false });
        
        if (providers && providers.length > 0) {
          const mp = (providers as any[]).find(p => p.provider === 'mercado_pago' || p.provider === 'mercadopago');
          const pg = (providers as any[]).find(p => p.provider === 'pagarme');
          if (mp) {
            setActiveGateway('mercadopago');
            setMpRedirectEnabled(!!(mp as any).mp_redirect_enabled);
          } else if (pg) {
            setActiveGateway('pagarme');
          }
        }
      } catch (e) {
        console.warn('[Checkout] Could not load gateway config, defaulting to pagarme');
      }
    };
    loadConfig();
  }, [tenantId]);

  // Resolve which gateway to use for a given method
  const resolveGateway = (method: PaymentMethod): 'pagarme' | 'mercadopago' => {
    if (method === 'mercadopago_redirect') return 'mercadopago';
    
    // Check per-method map first
    const entry = gatewayMap.find(e => e.payment_method === method);
    if (entry) {
      if (entry.provider === 'mercado_pago' || entry.provider === 'mercadopago') return 'mercadopago';
      if (entry.provider === 'pagarme') return 'pagarme';
    }
    
    // Fallback to legacy single gateway
    return activeGateway;
  };

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const processPayment = async ({
    method,
    items,
    shipping,
    shippingOption,
    customer,
    card,
    checkoutSessionId,
    discount,
    attribution,
    affiliate,
    paymentMethodDiscount,
    installments,
    shippingQuoteId,
    retryFromOrderId,
    retryToken,
    checkoutAttemptId,
    paymentAttemptId,
  }: {
    method: PaymentMethod;
    items: CartItem[];
    shipping: ShippingData;
    shippingOption: ShippingOption | null;
    customer: CustomerData;
    card?: CardData;
    checkoutSessionId?: string;
    discount?: DiscountData;
    attribution?: AttributionData;
    affiliate?: AffiliateData;
    paymentMethodDiscount?: { amount: number; type: string; value: number; method: string };
    installments?: number;
    shippingQuoteId?: string | null;
    retryFromOrderId?: string;
    retryToken?: string;
    checkoutAttemptId?: string;
    paymentAttemptId?: string;
  }): Promise<PaymentResult> => {
    setIsProcessing(true);
    setPaymentResult(null);

    try {
      console.log('[Checkout] Starting payment process via edge functions');
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shippingTotal = typeof shippingOption?.price === 'string' 
        ? parseFloat(shippingOption.price) || 0 
        : (shippingOption?.price || 0);
      
      const discountAmount = discount?.discount_amount || 0;
      const allItemsFreeShipping = items.length > 0 && items.every(item => (item as any).free_shipping === true);
      const hasFreeShipping = allItemsFreeShipping || discount?.free_shipping;
      const effectiveShippingTotal = hasFreeShipping ? 0 : shippingTotal;
      
      const pmDiscountAmount = paymentMethodDiscount?.amount || 0;
      const total = Math.max(0, subtotal - discountAmount - pmDiscountAmount + effectiveShippingTotal);
      
      console.log('[Checkout] Totals:', { subtotal, shippingTotal: effectiveShippingTotal, discountAmount, pmDiscountAmount, total });

      // === MP REDIRECT FLOW ===
      if (method === 'mercadopago_redirect') {
        console.log('[Checkout] MP Redirect flow - creating preference');
        const { data: mpData, error: mpError } = await supabase.functions.invoke('mercadopago-create-preference', {
          body: {
            tenant_id: tenantId,
            checkout_session_id: checkoutSessionId,
            customer: {
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
              cpf: customer.cpf,
            },
            shipping: {
              street: shipping.street,
              number: shipping.number,
              complement: shipping.complement,
              neighborhood: shipping.neighborhood,
              city: shipping.city,
              state: shipping.state,
              postal_code: shipping.postalCode,
              carrier: shippingOption?.carrier || shippingOption?.label || 'Frenet',
              service_code: shippingOption?.code,
              service_name: shippingOption?.label,
              estimated_days: shippingOption?.deliveryDays,
            },
            items: items.map(item => ({
              product_id: item.product_id,
              variant_id: item.variant_id || undefined,
              product_name: item.name,
              sku: item.sku,
              quantity: item.quantity,
              unit_price: item.price,
              image_url: item.image_url,
            })),
            subtotal,
            shipping_total: effectiveShippingTotal,
            discount_total: discountAmount,
            payment_method_discount: pmDiscountAmount,
            total,
            discount: discount || undefined,
            attribution: attribution || undefined,
            affiliate: affiliate || undefined,
            shipping_quote_id: shippingQuoteId || undefined,
            checkout_attempt_id: checkoutAttemptId || undefined,
          },
        });

        if (mpError || !mpData?.success) {
          console.error('[Checkout] MP Redirect FAILED:', mpError || mpData?.error);
          throw new Error(mpError?.message || mpData?.error || 'Erro ao criar checkout do Mercado Pago');
        }

        const result: PaymentResult = {
          success: true,
          redirectUrl: mpData.init_point || mpData.redirect_url,
        };
        setPaymentResult(result);
        return result;
      }

      // === TRANSPARENT FLOW (PIX, Boleto, Credit Card) ===
      // Resolve which gateway handles this method
      const gateway = resolveGateway(method);
      console.log(`[Checkout] Resolved gateway for ${method}: ${gateway}`);

      // 1. Create order
      console.log('[Checkout] Step 1: Creating order via edge function');
      const { data: orderData, error: orderError } = await supabase.functions.invoke('checkout-create-order', {
        body: {
          tenant_id: tenantId,
          checkout_session_id: checkoutSessionId,
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            cpf: customer.cpf,
          },
          shipping: {
            street: shipping.street,
            number: shipping.number,
            complement: shipping.complement,
            neighborhood: shipping.neighborhood,
            city: shipping.city,
            state: shipping.state,
            postal_code: shipping.postalCode,
            carrier: shippingOption?.carrier || shippingOption?.label || 'Frenet',
            service_code: shippingOption?.code,
            service_name: shippingOption?.label,
            estimated_days: shippingOption?.deliveryDays,
          },
          items: items.map(item => ({
            product_id: item.product_id,
            variant_id: item.variant_id || undefined,
            product_name: item.name,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.price,
            image_url: item.image_url,
          })),
          payment_method: method,
          subtotal,
          shipping_total: effectiveShippingTotal,
          discount_total: discountAmount,
          payment_method_discount: pmDiscountAmount,
          total,
          installments: installments || 1,
          discount: discount ? {
            discount_id: discount.discount_id,
            discount_code: discount.discount_code,
            discount_name: discount.discount_name,
            discount_type: discount.discount_type,
            discount_amount: discount.discount_amount,
            free_shipping: discount.free_shipping,
          } : undefined,
          attribution: attribution ? {
            utm_source: attribution.utm_source,
            utm_medium: attribution.utm_medium,
            utm_campaign: attribution.utm_campaign,
            utm_content: attribution.utm_content,
            utm_term: attribution.utm_term,
            gclid: attribution.gclid,
            fbclid: attribution.fbclid,
            ttclid: attribution.ttclid,
            msclkid: attribution.msclkid,
            referrer_url: attribution.referrer_url,
            referrer_domain: attribution.referrer_domain,
            landing_page: attribution.landing_page,
            attribution_source: attribution.attribution_source,
            attribution_medium: attribution.attribution_medium,
            session_id: attribution.session_id,
            first_touch_at: attribution.first_touch_at,
          } : undefined,
          affiliate: affiliate ? {
            affiliate_code: affiliate.affiliate_code,
            captured_at: affiliate.captured_at,
          } : undefined,
          shipping_quote_id: shippingQuoteId || undefined,
          retry_from_order_id: retryFromOrderId || undefined,
          retry_token: retryToken || undefined,
          checkout_attempt_id: checkoutAttemptId || undefined,
        },
      });

      if (orderError || !orderData?.success) {
        console.error('[Checkout] Step 1 FAILED:', orderError || orderData?.error);
        throw new Error(orderError?.message || orderData?.error || 'Erro ao criar pedido');
      }

      const orderId = orderData.order_id;
      const orderNumber = orderData.order_number;
      const newRetryToken = orderData.retry_token || undefined;
      console.log('[Checkout] Step 1 OK - Order:', orderId, orderNumber);

      // 2. Process payment via resolved gateway
      const canonicalTotal = orderData.canonical_total;
      const gatewayAmount = canonicalTotal != null
        ? Math.round(Number(canonicalTotal) * 100)
        : Math.round(total * 100);
      console.log(`[Checkout] Using ${canonicalTotal != null ? 'canonical' : 'frontend'} total for gateway: ${gatewayAmount} cents`);

      const gatewayFunction = gateway === 'mercadopago' ? 'mercadopago-create-charge' : 'pagarme-create-charge';
      console.log(`[Checkout] Step 2: Processing payment via ${gatewayFunction}`);
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(gatewayFunction, {
        body: {
          tenant_id: tenantId,
          order_id: orderId,
          method,
          amount: gatewayAmount,
          customer: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone.replace(/\D/g, ''),
            document: customer.cpf.replace(/\D/g, ''),
          },
          billing_address: {
            street: shipping.street,
            number: shipping.number,
            complement: shipping.complement || '',
            neighborhood: shipping.neighborhood,
            city: shipping.city,
            state: shipping.state,
            postal_code: sanitizeCep(shipping.postalCode),
            country: 'BR',
          },
          card: card ? {
            number: card.number.replace(/\D/g, ''),
            holder_name: card.holderName,
            exp_month: parseInt(card.expMonth, 10),
            exp_year: parseInt(card.expYear, 10),
            cvv: card.cvv,
          } : undefined,
          installments: method === 'credit_card' ? (installments || 1) : 1,
          payment_attempt_id: paymentAttemptId || undefined,
        },
      });

      if (paymentError) {
        console.error('[Checkout] Step 2 FAILED (invoke error):', paymentError);
        const result: PaymentResult = {
          success: false,
          error: paymentError.message || 'Erro ao processar pagamento',
          orderId,
          orderNumber,
          technicalError: true,
        };
        setPaymentResult(result);
        return result;
      }

      if (paymentData?.success === false) {
        console.error('[Checkout] Step 2 FAILED (gateway rejection):', paymentData.error);
        const result: PaymentResult = {
          success: false,
          error: paymentData.error || 'Pagamento recusado pela operadora.',
          orderId,
          orderNumber,
          cardDeclined: true,
          retryToken: newRetryToken,
        };
        setPaymentResult(result);
        return result;
      }
      
      console.log('[Checkout] Step 2 OK - Payment processed');

      const result: PaymentResult = {
        success: true,
        orderId,
        orderNumber,
        transactionId: paymentData?.transaction_id,
      };

      if (method === 'pix') {
        result.pixQrCode = paymentData?.payment_data?.qr_code;
        result.pixQrCodeUrl = paymentData?.payment_data?.qr_code_url;
        result.pixExpiresAt = paymentData?.payment_data?.expires_at;
      } else if (method === 'boleto') {
        result.boletoUrl = paymentData?.payment_data?.boleto_url;
        result.boletoBarcode = paymentData?.payment_data?.boleto_barcode;
        result.boletoDueDate = paymentData?.payment_data?.boleto_due_date;
      } else if (method === 'credit_card') {
        result.cardStatus = paymentData?.status;
      }

      setPaymentResult(result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const result: PaymentResult = {
        success: false,
        error: errorMessage,
      };
      setPaymentResult(result);
      return result;
    } finally {
      setIsProcessing(false);
    }
  };

  const resetPayment = () => {
    setPaymentResult(null);
  };

  return {
    processPayment,
    resetPayment,
    isProcessing,
    paymentResult,
    activeGateway,
    mpRedirectEnabled,
    resolveGateway,
  };
}
