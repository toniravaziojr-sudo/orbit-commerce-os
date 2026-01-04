// =============================================
// USE STORE CONFIG - Hook for managing store configurations
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  ShippingConfig,
  BenefitConfig,
  OffersConfig,
  CartConfig,
  CheckoutConfig,
  parseShippingConfig,
  parseBenefitConfig,
  parseOffersConfig,
  parseCartConfig,
  parseCheckoutConfig,
  defaultShippingConfig,
  defaultBenefitConfig,
  defaultOffersConfig,
  defaultCartConfig,
  defaultCheckoutConfig,
} from '@/lib/storeConfigTypes';

export interface StoreConfig {
  shippingConfig: ShippingConfig;
  benefitConfig: BenefitConfig;
  offersConfig: OffersConfig;
  cartConfig: CartConfig;
  checkoutConfig: CheckoutConfig;
}

export function useStoreConfig() {
  const { currentTenant } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['store-config', currentTenant?.id],
    queryFn: async (): Promise<StoreConfig> => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('shipping_config, benefit_config, offers_config, cart_config, checkout_config')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (error) throw error;
      
      return {
        shippingConfig: parseShippingConfig(data?.shipping_config),
        benefitConfig: parseBenefitConfig(data?.benefit_config),
        offersConfig: parseOffersConfig(data?.offers_config),
        cartConfig: parseCartConfig(data?.cart_config),
        checkoutConfig: parseCheckoutConfig(data?.checkout_config),
      };
    },
    enabled: !!currentTenant?.id,
  });

  const updateShippingConfig = useMutation({
    mutationFn: async (shippingConfig: ShippingConfig) => {
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('store_settings')
          .update({ shipping_config: shippingConfig as unknown as import('@/integrations/supabase/types').Json })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert({ 
            tenant_id: currentTenant!.id, 
            shipping_config: shippingConfig as unknown as import('@/integrations/supabase/types').Json 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-config'] });
      toast({ title: 'Configurações de frete salvas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configurações de frete', description: error.message, variant: 'destructive' });
    },
  });

  const updateBenefitConfig = useMutation({
    mutationFn: async (benefitConfig: BenefitConfig) => {
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('store_settings')
          .update({ benefit_config: benefitConfig as unknown as import('@/integrations/supabase/types').Json })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert({ 
            tenant_id: currentTenant!.id, 
            benefit_config: benefitConfig as unknown as import('@/integrations/supabase/types').Json 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-config'] });
      toast({ title: 'Configurações de benefícios salvas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configurações de benefícios', description: error.message, variant: 'destructive' });
    },
  });

  const updateOffersConfig = useMutation({
    mutationFn: async (offersConfig: OffersConfig) => {
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('store_settings')
          .update({ offers_config: offersConfig as unknown as import('@/integrations/supabase/types').Json })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert({ 
            tenant_id: currentTenant!.id, 
            offers_config: offersConfig as unknown as import('@/integrations/supabase/types').Json 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-config'] });
      toast({ title: 'Configurações de ofertas salvas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configurações de ofertas', description: error.message, variant: 'destructive' });
    },
  });

  const updateCartConfig = useMutation({
    mutationFn: async (cartConfig: CartConfig) => {
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('store_settings')
          .update({ cart_config: cartConfig as unknown as import('@/integrations/supabase/types').Json })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert({ 
            tenant_id: currentTenant!.id, 
            cart_config: cartConfig as unknown as import('@/integrations/supabase/types').Json 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-config'] });
      toast({ title: 'Configurações do carrinho salvas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configurações do carrinho', description: error.message, variant: 'destructive' });
    },
  });

  const updateCheckoutConfig = useMutation({
    mutationFn: async (checkoutConfig: CheckoutConfig) => {
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('tenant_id', currentTenant!.id)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('store_settings')
          .update({ checkout_config: checkoutConfig as unknown as import('@/integrations/supabase/types').Json })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('store_settings')
          .insert({ 
            tenant_id: currentTenant!.id, 
            checkout_config: checkoutConfig as unknown as import('@/integrations/supabase/types').Json 
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-config'] });
      toast({ title: 'Configurações do checkout salvas!' });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar configurações do checkout', description: error.message, variant: 'destructive' });
    },
  });

  return {
    config: config || {
      shippingConfig: defaultShippingConfig,
      benefitConfig: defaultBenefitConfig,
      offersConfig: defaultOffersConfig,
      cartConfig: defaultCartConfig,
      checkoutConfig: defaultCheckoutConfig,
    },
    isLoading,
    error,
    updateShippingConfig,
    updateBenefitConfig,
    updateOffersConfig,
    updateCartConfig,
    updateCheckoutConfig,
  };
}
