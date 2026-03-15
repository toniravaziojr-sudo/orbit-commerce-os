// =============================================
// USE RETRY CARD PAYMENT - Retry card payment on existing order
// Used on Thank You page when card is declined
// Calls the same charge edge function with existing order data
// Does NOT create a new order — reuses existing order_id
// =============================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sanitizeCep } from '@/lib/cepUtils';
import type { OrderDetails } from '@/hooks/useOrderDetails';

export interface RetryCardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface RetryResult {
  success: boolean;
  cardDeclined?: boolean;
  technicalError?: boolean;
  error?: string;
}

interface UseRetryCardPaymentOptions {
  order: OrderDetails;
  tenantId: string;
}

export function useRetryCardPayment({ order, tenantId }: UseRetryCardPaymentOptions) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);

  const retryPayment = async (card: RetryCardData, installments: number = 1): Promise<RetryResult> => {
    setIsRetrying(true);
    setRetryResult(null);

    try {
      // Determine active gateway for this tenant
      let gatewayFunction = 'pagarme-create-charge';
      try {
        const { data: providers } = await supabase
          .from('payment_providers')
          .select('provider, is_enabled')
          .eq('tenant_id', tenantId)
          .eq('is_enabled', true)
          .order('updated_at', { ascending: false });
        
        if (providers?.find((p: any) => p.provider === 'mercado_pago')) {
          gatewayFunction = 'mercadopago-create-charge';
        }
      } catch {
        console.warn('[RetryPayment] Could not determine gateway, defaulting to pagarme');
      }

      const amountCents = Math.round(order.total * 100);

      console.log(`[RetryPayment] Retrying card payment on order ${order.order_number} via ${gatewayFunction}`);

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke(gatewayFunction, {
        body: {
          tenant_id: tenantId,
          order_id: order.id,
          method: 'credit_card',
          amount: amountCents,
          customer: {
            name: order.customer_name,
            email: order.customer_email,
            phone: (order.customer_phone || '').replace(/\D/g, ''),
            document: (order.customer_cpf || '').replace(/\D/g, ''),
          },
          billing_address: {
            street: order.shipping_street || '',
            number: order.shipping_number || '',
            complement: order.shipping_complement || '',
            neighborhood: order.shipping_neighborhood || '',
            city: order.shipping_city || '',
            state: order.shipping_state || '',
            postal_code: sanitizeCep(order.shipping_postal_code || ''),
            country: 'BR',
          },
          card: {
            number: card.number.replace(/\D/g, ''),
            holder_name: card.holderName,
            exp_month: parseInt(card.expMonth, 10),
            exp_year: parseInt(card.expYear, 10),
            cvv: card.cvv,
          },
          installments: installments || 1,
        },
      });

      if (paymentError) {
        console.error('[RetryPayment] Invoke error (technical):', paymentError);
        const result: RetryResult = {
          success: false,
          error: 'Ocorreu um problema técnico ao processar o pagamento. Tente novamente.',
          technicalError: true,
        };
        setRetryResult(result);
        return result;
      }

      if (paymentData?.success === false) {
        console.error('[RetryPayment] Gateway rejection:', paymentData.error);
        const result: RetryResult = {
          success: false,
          error: paymentData.error || 'Pagamento recusado pela operadora.',
          cardDeclined: true,
        };
        setRetryResult(result);
        return result;
      }

      console.log('[RetryPayment] Payment approved!');
      const result: RetryResult = { success: true };
      setRetryResult(result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('[RetryPayment] Unexpected error:', errorMessage);
      const result: RetryResult = {
        success: false,
        error: errorMessage,
        technicalError: true,
      };
      setRetryResult(result);
      return result;
    } finally {
      setIsRetrying(false);
    }
  };

  const resetRetryResult = () => setRetryResult(null);

  return {
    retryPayment,
    isRetrying,
    retryResult,
    resetRetryResult,
  };
}
