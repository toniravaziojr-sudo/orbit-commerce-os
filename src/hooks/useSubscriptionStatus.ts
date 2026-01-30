import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type SubscriptionStatus = 
  | 'pending_payment_method' 
  | 'active' 
  | 'suspended' 
  | 'cancelled'
  | 'no_subscription';

export interface SubscriptionData {
  status: SubscriptionStatus;
  planKey: string | null;
  billingCycle: string | null;
  hasPaymentMethod: boolean;
  cardLastFour: string | null;
  cardBrand: string | null;
  needsPaymentMethod: boolean;
  isBasicPlan: boolean;
  canPublishStore: boolean;
  canUseFullFeatures: boolean;
}

/**
 * Hook para verificar status da assinatura do tenant atual.
 * 
 * Regras de negócio:
 * - Tenants especiais (is_special=true) ou plano unlimited: bypass total
 * - Plano básico: pode usar sistema, mas precisa de cartão para publicar loja
 * - Planos pagos: precisa ter pagamento confirmado
 * - Status 'pending_payment_method': bloqueado até inserir cartão
 */
export function useSubscriptionStatus() {
  const { currentTenant } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['subscription-status', currentTenant?.id],
    queryFn: async (): Promise<SubscriptionData> => {
      if (!currentTenant?.id) {
        return {
          status: 'no_subscription',
          planKey: null,
          billingCycle: null,
          hasPaymentMethod: false,
          cardLastFour: null,
          cardBrand: null,
          needsPaymentMethod: true,
          isBasicPlan: false,
          canPublishStore: false,
          canUseFullFeatures: false,
        };
      }

      // Buscar dados do tenant com campos extras para bypass
      const { data: tenantData } = await supabase
        .from('tenants')
        .select('is_special, plan, type')
        .eq('id', currentTenant.id)
        .maybeSingle();

      // BYPASS: Tenants especiais ou com plano unlimited não precisam de cartão
      const isSpecialTenant = tenantData?.is_special === true;
      const isUnlimitedPlan = tenantData?.plan === 'unlimited';
      const isPlatformType = tenantData?.type === 'platform';
      
      if (isSpecialTenant || isUnlimitedPlan || isPlatformType) {
        return {
          status: 'active',
          planKey: tenantData?.plan || 'unlimited',
          billingCycle: null,
          hasPaymentMethod: true, // Simular que tem
          cardLastFour: null,
          cardBrand: null,
          needsPaymentMethod: false, // NUNCA pedir cartão
          isBasicPlan: false,
          canPublishStore: true,
          canUseFullFeatures: true,
        };
      }

      const { data: subscription, error } = await supabase
        .from('tenant_subscriptions')
        .select('status, plan_key, billing_cycle, payment_method_type, card_last_four, card_brand')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('[useSubscriptionStatus] Error:', error);
        throw error;
      }

      // Se não tem assinatura
      if (!subscription) {
        return {
          status: 'no_subscription',
          planKey: null,
          billingCycle: null,
          hasPaymentMethod: false,
          cardLastFour: null,
          cardBrand: null,
          needsPaymentMethod: true,
          isBasicPlan: false,
          canPublishStore: false,
          canUseFullFeatures: false,
        };
      }

      const hasPaymentMethod = !!subscription.payment_method_type;
      const isBasicPlan = subscription.plan_key === 'basico';
      const status = subscription.status as SubscriptionStatus;
      
      // Regras de acesso
      // - Plano básico sem cartão: pode usar, mas não pode publicar
      // - Plano básico com cartão: pode tudo
      // - Planos pagos: precisa estar 'active'
      const needsPaymentMethod = !hasPaymentMethod;
      
      // Pode publicar loja?
      // - Plano básico: só se tiver cartão cadastrado
      // - Outros planos: se status for 'active'
      const canPublishStore = isBasicPlan 
        ? hasPaymentMethod 
        : status === 'active';
      
      // Pode usar funcionalidades completas?
      // - Plano básico: só se tiver cartão
      // - Outros planos: se status for 'active'
      const canUseFullFeatures = isBasicPlan 
        ? hasPaymentMethod 
        : status === 'active';

      return {
        status,
        planKey: subscription.plan_key,
        billingCycle: subscription.billing_cycle,
        hasPaymentMethod,
        cardLastFour: subscription.card_last_four,
        cardBrand: subscription.card_brand,
        needsPaymentMethod,
        isBasicPlan,
        canPublishStore,
        canUseFullFeatures,
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  return {
    subscription: data,
    isLoading,
    error,
    refetch,
    // Atalhos úteis
    needsPaymentMethod: data?.needsPaymentMethod ?? true,
    canPublishStore: data?.canPublishStore ?? false,
    canUseFullFeatures: data?.canUseFullFeatures ?? false,
    isBasicPlan: data?.isBasicPlan ?? false,
    hasPaymentMethod: data?.hasPaymentMethod ?? false,
  };
}
