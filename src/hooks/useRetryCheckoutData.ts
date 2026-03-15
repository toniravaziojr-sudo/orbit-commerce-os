// =============================================
// USE RETRY CHECKOUT DATA - Loads prefill data for checkout retry
// Validates retry_token via secure edge function
// Returns customer, shipping, items from original declined order
// NO CPF exposed — resolved server-side
// =============================================

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RetryCheckoutPrefill {
  original_order_id: string;
  order_number: string;
  tenant_id: string;
  tenant_slug: string;
  total: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shipping: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string;
  };
  items: {
    product_id: string;
    variant_id: string | null;
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number;
    image_url: string;
  }[];
}

export function useRetryCheckoutData(retryToken: string | null) {
  const [prefill, setPrefill] = useState<RetryCheckoutPrefill | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!retryToken) {
      setPrefill(null);
      return;
    }

    const loadPrefill = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('[RetryCheckout] Loading prefill data via retry_token');
        const { data, error: fnError } = await supabase.functions.invoke('get-retry-checkout-data', {
          body: { retry_token: retryToken },
        });

        if (fnError) {
          console.error('[RetryCheckout] Edge function error:', fnError);
          setError('Não foi possível carregar os dados do pedido anterior.');
          return;
        }

        if (!data?.success) {
          console.error('[RetryCheckout] Token invalid:', data?.error);
          setError(data?.error || 'Token de retentativa inválido ou expirado.');
          return;
        }

        console.log('[RetryCheckout] Prefill loaded for order:', data.checkout_prefill.order_number);
        setPrefill(data.checkout_prefill);
      } catch (err) {
        console.error('[RetryCheckout] Unexpected error:', err);
        setError('Erro ao carregar dados para retentativa.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPrefill();
  }, [retryToken]);

  return { prefill, isLoading, error };
}
