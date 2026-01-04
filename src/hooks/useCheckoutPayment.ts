// =============================================
// USE CHECKOUT PAYMENT - Real payment processing with Pagar.me
// Uses edge functions for secure server-side operations
// =============================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem, ShippingOption } from '@/contexts/CartContext';
import { AttributionData } from '@/hooks/useAttribution';

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

export function useCheckoutPayment({ tenantId }: UseCheckoutPaymentOptions) {
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
      
      // Apply discount
      const discountAmount = discount?.discount_amount || 0;
      const effectiveShippingTotal = discount?.free_shipping ? 0 : shippingTotal;
      const total = Math.max(0, subtotal - discountAmount + effectiveShippingTotal);
      
      console.log('[Checkout] Totals:', { subtotal, shippingTotal: effectiveShippingTotal, discountAmount, total });

      // 1. Create order via edge function (handles customer, order, order_items)
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
          total,
          // Discount data for persistence and redemption
          discount: discount ? {
            discount_id: discount.discount_id,
            discount_code: discount.discount_code,
            discount_name: discount.discount_name,
            discount_type: discount.discount_type,
            discount_amount: discount.discount_amount,
            free_shipping: discount.free_shipping,
          } : undefined,
          // Attribution data for conversion tracking
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
        },
      });

      if (orderError || !orderData?.success) {
        console.error('[Checkout] Step 1 FAILED:', orderError || orderData?.error);
        throw new Error(orderError?.message || orderData?.error || 'Erro ao criar pedido');
      }

      const orderId = orderData.order_id;
      const orderNumber = orderData.order_number;
      console.log('[Checkout] Step 1 OK - Order:', orderId, orderNumber);

      // 2. Process payment via Pagar.me edge function
      console.log('[Checkout] Step 2: Processing payment');
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('pagarme-create-charge', {
        body: {
          tenant_id: tenantId,
          // Note: checkout_id removed - it has FK to checkouts table, not orders
          // We use order_id for linking payment to order
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
            postal_code: shipping.postalCode.replace(/\D/g, ''),
            country: 'BR',
          },
          card: card ? {
            number: card.number.replace(/\D/g, ''),
            holder_name: card.holderName,
            exp_month: parseInt(card.expMonth, 10),
            exp_year: parseInt(card.expYear, 10),
            cvv: card.cvv,
          } : undefined,
        },
      });

      if (paymentError) {
        console.error('[Checkout] Step 2 FAILED:', paymentError);
        throw new Error(paymentError.message || 'Erro ao processar pagamento');
      }
      
      console.log('[Checkout] Step 2 OK - Payment processed');

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
  };
}
