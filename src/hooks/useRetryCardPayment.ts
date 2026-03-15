// =============================================
// USE RETRY CARD PAYMENT - Secure card retry via server-side edge function
// Used on Thank You page when card is declined
// Sends ONLY retry_token + card data — all sensitive order data resolved server-side
// Does NOT create a new order — reuses existing order_id
// v8.15.1 — Security: no CPF/address/order_id exposure to frontend
// =============================================

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  retryToken: string;
}

export function useRetryCardPayment({ retryToken }: UseRetryCardPaymentOptions) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<RetryResult | null>(null);

  const retryPayment = async (card: RetryCardData, installments: number = 1): Promise<RetryResult> => {
    setIsRetrying(true);
    setRetryResult(null);

    try {
      if (!retryToken) {
        const result: RetryResult = {
          success: false,
          error: 'Token de retentativa não disponível. Tente voltar ao checkout.',
          technicalError: true,
        };
        setRetryResult(result);
        return result;
      }

      console.log('[RetryPayment] Retrying card payment via secure edge function');

      const { data, error } = await supabase.functions.invoke('retry-card-payment', {
        body: {
          retry_token: retryToken,
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

      if (error) {
        console.error('[RetryPayment] Invoke error (technical):', error);
        const result: RetryResult = {
          success: false,
          error: 'Ocorreu um problema técnico ao processar o pagamento. Tente novamente.',
          technicalError: true,
        };
        setRetryResult(result);
        return result;
      }

      if (data?.success === false) {
        const result: RetryResult = {
          success: false,
          error: data.error || 'Pagamento recusado pela operadora.',
          cardDeclined: data.cardDeclined === true,
          technicalError: data.technicalError === true,
        };
        console.error('[RetryPayment] Payment failed:', result.cardDeclined ? 'declined' : 'technical');
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
