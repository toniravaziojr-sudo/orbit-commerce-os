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
      console.log('[Checkout] Step 0: Starting payment process');
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shippingTotal = typeof shippingOption?.price === 'string' 
        ? parseFloat(shippingOption.price) || 0 
        : (shippingOption?.price || 0);
      const total = subtotal + shippingTotal;
      
      console.log('[Checkout] Totals calculated:', { subtotal, shippingTotal, total });

      // 1. Generate order number
      console.log('[Checkout] Step 1: Generating order number');
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('generate_order_number', { p_tenant_id: tenantId });

      if (orderNumberError) {
        console.error('[Checkout] Step 1 FAILED - Error generating order number:', orderNumberError);
        throw new Error(`Erro ao gerar número do pedido: ${orderNumberError.message}`);
      }

      const orderNumber = orderNumberData || `PED-${Date.now()}`;
      console.log('[Checkout] Step 1 OK - Order number:', orderNumber);

      // 2. Upsert customer to get customer_id
      console.log('[Checkout] Step 2: Upserting customer');
      let customerId: string | null = null;
      
      try {
        // Check if customer exists by email
        const { data: existingCustomer, error: selectError } = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('email', customer.email)
          .maybeSingle();

        if (selectError) {
          console.warn('[Checkout] Step 2a - Customer select failed:', selectError);
        }

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log('[Checkout] Step 2b - Updating existing customer:', customerId);
          // Update customer info if needed
          await supabase
            .from('customers')
            .update({
              full_name: customer.name,
              phone: customer.phone,
              cpf: customer.cpf,
              updated_at: new Date().toISOString(),
            })
            .eq('id', customerId);
        } else {
          console.log('[Checkout] Step 2b - Creating new customer');
          // Create new customer
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              tenant_id: tenantId,
              email: customer.email,
              full_name: customer.name,
              phone: customer.phone,
              cpf: customer.cpf,
              status: 'active',
            })
            .select('id')
            .single();

          if (!customerError && newCustomer) {
            customerId = newCustomer.id;
            console.log('[Checkout] Step 2b OK - New customer created:', customerId);
          } else {
            console.warn('[Checkout] Step 2b - Could not create customer:', customerError);
          }
        }
      } catch (customerErr) {
        console.warn('[Checkout] Step 2 - Customer operation failed (non-blocking):', customerErr);
      }
      
      console.log('[Checkout] Step 2 complete - Customer ID:', customerId);

      // 3. Create order in database with customer_id
      console.log('[Checkout] Step 3: Creating order');
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenantId,
          order_number: orderNumber,
          customer_id: customerId,
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
        console.error('[Checkout] Step 3 FAILED - Error creating order:', orderError);
        throw new Error(`Erro ao criar pedido: ${orderError.message}`);
      }

      const orderId = order.id;
      console.log('[Checkout] Step 3 OK - Order created:', orderId);

      // 4. Create order items
      console.log('[Checkout] Step 4: Creating order items');
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
        console.error('[Checkout] Step 4 FAILED - Error creating order items:', itemsError);
        // Continue anyway - order was created
      } else {
        console.log('[Checkout] Step 4 OK - Order items created');
      }

      // 5. Call Pagar.me Edge Function
      console.log('[Checkout] Step 5: Calling Pagar.me');
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('pagarme-create-charge', {
        body: {
          tenant_id: tenantId,
          checkout_id: orderId, // Edge function expects checkout_id
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
        console.error('[Checkout] Step 5 FAILED - Payment error:', paymentError);
        
        // Update order status to failed
        await supabase
          .from('orders')
          .update({ payment_status: 'declined' as const, status: 'cancelled' as const })
          .eq('id', orderId);

        throw new Error(paymentError.message || 'Erro ao processar pagamento');
      }
      
      console.log('[Checkout] Step 5 OK - Payment processed:', paymentData);

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
