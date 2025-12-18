// =============================================
// USE CHECKOUT PAYMENT - Real payment processing with Pagar.me
// Creates order, payment_transaction, and calls Edge Function
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
  }: {
    method: PaymentMethod;
    items: CartItem[];
    shipping: ShippingData;
    shippingOption: ShippingOption | null;
    customer: CustomerData;
    card?: CardData;
  }): Promise<PaymentResult> => {
    setIsProcessing(true);
    setPaymentResult(null);

    try {
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shippingTotal = shippingOption?.price || 0;
      const total = subtotal + shippingTotal;

      // 1. Generate order number
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('generate_order_number', { p_tenant_id: tenantId });

      if (orderNumberError) {
        console.error('Error generating order number:', orderNumberError);
        throw new Error('Erro ao gerar número do pedido');
      }

      const orderNumber = orderNumberData || `PED-${Date.now()}`;

      // 2. Create order in database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenantId,
          order_number: orderNumber,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          status: 'pending',
          payment_status: 'pending',
          payment_method: method as 'pix' | 'boleto' | 'credit_card',
          subtotal,
          shipping_total: shippingTotal,
          total,
          shipping_street: shipping.street,
          shipping_number: shipping.number,
          shipping_complement: shipping.complement || null,
          shipping_neighborhood: shipping.neighborhood,
          shipping_city: shipping.city,
          shipping_state: shipping.state,
          shipping_postal_code: shipping.postalCode,
          shipping_carrier: shippingOption?.label || null,
        })
        .select('id')
        .single();

      if (orderError) {
        console.error('Error creating order:', orderError);
        throw new Error('Erro ao criar pedido');
      }

      const orderId = order.id;

      // 3. Create order items
      const orderItems = items.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
        product_image_url: item.image_url || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        // Continue anyway - order was created
      }

      // 4. Call Pagar.me Edge Function
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('pagarme-create-charge', {
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
          billing: {
            street: shipping.street,
            number: shipping.number,
            complement: shipping.complement || '',
            neighborhood: shipping.neighborhood,
            city: shipping.city,
            state: shipping.state,
            zip_code: shipping.postalCode.replace(/\D/g, ''),
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
        console.error('Payment error:', paymentError);
        
        // Update order status to failed
        await supabase
          .from('orders')
          .update({ payment_status: 'declined' as const, status: 'cancelled' as const })
          .eq('id', orderId);

        throw new Error(paymentError.message || 'Erro ao processar pagamento');
      }

      // 5. Process payment response
      const result: PaymentResult = {
        success: true,
        orderId,
        orderNumber,
        transactionId: paymentData?.transaction_id,
      };

      if (method === 'pix') {
        result.pixQrCode = paymentData?.pix?.qr_code;
        result.pixQrCodeUrl = paymentData?.pix?.qr_code_url;
        result.pixExpiresAt = paymentData?.pix?.expires_at;
      } else if (method === 'boleto') {
        result.boletoUrl = paymentData?.boleto?.url;
        result.boletoBarcode = paymentData?.boleto?.barcode;
        result.boletoDueDate = paymentData?.boleto?.due_at;
      } else if (method === 'credit_card') {
        result.cardStatus = paymentData?.status;
        
        // If credit card was approved immediately, update order
        if (paymentData?.status === 'paid') {
          await supabase
            .from('orders')
            .update({ 
              payment_status: 'approved' as const, 
              status: 'paid' as const,
              paid_at: new Date().toISOString(),
            })
            .eq('id', orderId);
        }
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
