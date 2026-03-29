// =============================================
// USE PUBLIC PAYMENT DISCOUNTS - Fetch enabled payment method discounts for storefront
// Uses anon access (public RLS policy)
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicPaymentDiscount {
  payment_method: string;
  discount_type: string;
  discount_value: number;
  is_enabled: boolean;
  installments_max: number;
  installments_min_value_cents: number;
  description: string | null;
}

export function usePublicPaymentDiscounts(tenantId: string | undefined, provider?: string) {
  return useQuery({
    queryKey: ['public-payment-discounts', tenantId, provider],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('payment_method_discounts')
        .select('payment_method, discount_type, discount_value, is_enabled, installments_max, installments_min_value_cents, description')
        .eq('tenant_id', tenantId)
        .eq('is_enabled', true);
      
      if (provider) {
        query = query.eq('provider', provider) as typeof query;
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PublicPaymentDiscount[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Calculate the discount amount for a given payment method based on tenant config.
 */
export function calculatePaymentMethodDiscount(
  discounts: PublicPaymentDiscount[],
  paymentMethod: string,
  subtotalAfterCoupon: number,
): number {
  const config = discounts.find(d => d.payment_method === paymentMethod && d.is_enabled);
  if (!config || config.discount_value <= 0) return 0;

  if (config.discount_type === 'percentage') {
    return Math.round((subtotalAfterCoupon * config.discount_value / 100) * 100) / 100;
  }
  // fixed
  return Math.min(config.discount_value, subtotalAfterCoupon);
}

/**
 * Get max installments for a given total.
 */
export function getMaxInstallments(
  discounts: PublicPaymentDiscount[],
  grandTotal: number,
): number {
  const config = discounts.find(d => d.payment_method === 'credit_card' && d.is_enabled);
  if (!config) return 1;

  const maxFromConfig = config.installments_max || 1;
  const minValueCents = config.installments_min_value_cents || 0;

  if (minValueCents <= 0) return maxFromConfig;

  // Calculate max installments based on min value per installment
  const totalCents = Math.round(grandTotal * 100);
  const maxFromValue = Math.floor(totalCents / minValueCents);

  return Math.max(1, Math.min(maxFromConfig, maxFromValue));
}