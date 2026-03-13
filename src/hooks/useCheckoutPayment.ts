// =============================================
// USE CHECKOUT PAYMENT - Real payment processing
// Supports Pagar.me and Mercado Pago gateways
// Uses edge functions for secure server-side operations
// =============================================

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem, ShippingOption } from '@/contexts/CartContext';
import { AttributionData } from '@/hooks/useAttribution';
import { sanitizeCep } from '@/lib/cepUtils';
import { AffiliateData } from '@/lib/affiliateTracking';
// Meta CAPI identifiers no longer needed here - handled by MarketingTracker client-side

export type PaymentMethod = 'pix' | 'boleto' | 'credit_card';

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

// SessionStorage key for persisting pending order across page refreshes
const PENDING_ORDER_KEY = 'checkout_pending_order';

function loadPendingOrder(tenantId: string): { orderId: string; orderNumber: string } | null {
  try {
    const raw = sessionStorage.getItem(`${PENDING_ORDER_KEY}_${tenantId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.orderId && parsed?.orderNumber) return parsed;
    return null;
  } catch { return null; }
}

function savePendingOrder(tenantId: string, ref: { orderId: string; orderNumber: string } | null) {
  try {
    if (ref) {
      sessionStorage.setItem(`${PENDING_ORDER_KEY}_${tenantId}`, JSON.stringify(ref));
    } else {
      sessionStorage.removeItem(`${PENDING_ORDER_KEY}_${tenantId}`);
    }
  } catch { /* ignore */ }
}

export function useCheckoutPayment({ tenantId }: UseCheckoutPaymentOptions) {
  // Determine which payment gateway to use based on tenant config
  const [activeGateway, setActiveGateway] = useState<'pagarme' | 'mercadopago'>('pagarme');
  
  // Check for active payment provider on mount
  useEffect(() => {
    const checkGateway = async () => {
      try {
        const { data } = await supabase
          .from('payment_providers')
          .select('provider, is_enabled')
          .eq('tenant_id', tenantId)
          .eq('is_enabled', true)
          .order('updated_at', { ascending: false });
        
        if (data && data.length > 0) {
          // Prefer mercado_pago if configured, otherwise pagarme
          const mp = data.find((p: any) => p.provider === 'mercado_pago');
          const pg = data.find((p: any) => p.provider === 'pagarme');
          if (mp) setActiveGateway('mercadopago');
          else if (pg) setActiveGateway('pagarme');
        }
      } catch (e) {
        console.warn('[Checkout] Could not determine gateway, defaulting to pagarme');
      }
    };
    checkGateway();
  }, [tenantId]);

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  // Track the last created order to avoid duplicates on payment retry
  // Persisted in sessionStorage so it survives page refreshes within the same tab
  const [pendingOrderRef, setPendingOrderRefState] = useState<{ orderId: string; orderNumber: string } | null>(
    () => loadPendingOrder(tenantId)
  );
  
  const setPendingOrderRef = (ref: { orderId: string; orderNumber: string } | null) => {
    setPendingOrderRefState(ref);
    savePendingOrder(tenantId, ref);
  };

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
  }): Promise<PaymentResult> => {
    setIsProcessing(true);
    setPaymentResult(null);

    try {
      console.log('[Checkout] Starting payment process via edge functions');
      
      // Calculate totals (discount is already applied if present)
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shippingTotal = typeof shippingOption?.price === 'string' 
        ? parseFloat(shippingOption.price) || 0 
        : (shippingOption?.price || 0);
      
      // Apply discount & free shipping hierarchy: product > coupon > logistics
      const discountAmount = discount?.discount_amount || 0;
      const allItemsFreeShipping = items.length > 0 && items.every(item => (item as any).free_shipping === true);
      const hasFreeShipping = allItemsFreeShipping || discount?.free_shipping;
      const effectiveShippingTotal = hasFreeShipping ? 0 : shippingTotal;
      
      // Payment method discount (real, from tenant config)
      const pmDiscountAmount = paymentMethodDiscount?.amount || 0;
      const total = Math.max(0, subtotal - discountAmount - pmDiscountAmount + effectiveShippingTotal);
      
      console.log('[Checkout] Totals:', { subtotal, shippingTotal: effectiveShippingTotal, discountAmount, pmDiscountAmount, total });

      // 1. Create order OR reuse existing pending order (avoids duplicates on retry)
      let orderId: string;
      let orderNumber: string;

      if (pendingOrderRef) {
        // Reuse existing order from a previous failed payment attempt
        orderId = pendingOrderRef.orderId;
        orderNumber = pendingOrderRef.orderNumber;
        console.log('[Checkout] Step 1: Reusing existing order:', orderId, orderNumber);
      } else {
        // Create new order
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
            // Shipping quote ID for server-side validation (Security Plan v3.1)
            shipping_quote_id: shippingQuoteId || undefined,
            // Meta CAPI is now handled client-side via marketing-capi-track edge function
            // No need to pass browser identifiers in order creation
          },
        });

        if (orderError || !orderData?.success) {
          console.error('[Checkout] Step 1 FAILED:', orderError || orderData?.error);
          throw new Error(orderError?.message || orderData?.error || 'Erro ao criar pedido');
        }

        orderId = orderData.order_id;
        orderNumber = orderData.order_number;
        // Store for potential retry
        setPendingOrderRef({ orderId, orderNumber });
        console.log('[Checkout] Step 1 OK - Order:', orderId, orderNumber);
      }

      // 2. Process payment via active gateway (Pagar.me or Mercado Pago)
      const gatewayFunction = activeGateway === 'mercadopago' ? 'mercadopago-create-charge' : 'pagarme-create-charge';
      console.log(`[Checkout] Step 2: Processing payment via ${gatewayFunction}`);
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(gatewayFunction, {
        body: {
          tenant_id: tenantId,
          order_id: orderId,
          method,
          amount: Math.round(total * 100), // Convert to cents
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
        },
      });

      if (paymentError) {
        console.error('[Checkout] Step 2 FAILED (invoke error):', paymentError);
        throw new Error(paymentError.message || 'Erro ao processar pagamento');
      }

      // Check if payment was rejected by the gateway
      if (paymentData?.success === false) {
        console.error('[Checkout] Step 2 FAILED (gateway rejection):', paymentData.error);
        throw new Error(paymentData.error || 'Pagamento recusado. Tente novamente.');
      }
      
      console.log('[Checkout] Step 2 OK - Payment processed');

      // Payment succeeded - clear pending order ref
      setPendingOrderRef(null);

      // Build result
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
      // NOTE: pendingOrderRef is intentionally NOT cleared here
      // so the next retry reuses the same order instead of creating a duplicate
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
    setPendingOrderRef(null);
  };

  return {
    processPayment,
    resetPayment,
    isProcessing,
    paymentResult,
    activeGateway,
  };
}
