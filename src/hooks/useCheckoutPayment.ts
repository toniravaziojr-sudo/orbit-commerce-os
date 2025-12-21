// =============================================
// USE CHECKOUT PAYMENT - Real payment processing with Pagar.me
// Uses edge functions for secure server-side operations
// =============================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CartItem, ShippingOption } from '@/contexts/CartContext';

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
  }: {
    method: PaymentMethod;
    items: CartItem[];
    shipping: ShippingData;
    shippingOption: ShippingOption | null;
    customer: CustomerData;
    card?: CardData;
    checkoutSessionId?: string;
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
      const total = subtotal + shippingTotal;
      
      console.log('[Checkout] Totals:', { subtotal, shippingTotal, total });

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
            carrier: shippingOption?.label,
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
          shipping_total: shippingTotal,
          total,
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
          checkout_id: orderId,
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
