// =============================================
// STOREFRONT CONFIG CONTEXT - Providers for storefront to consume configs
// =============================================

import React, { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  ShippingConfig,
  BenefitConfig,
  OffersConfig,
  ShippingRule,
  parseShippingConfig,
  parseBenefitConfig,
  parseOffersConfig,
  defaultShippingConfig,
  defaultBenefitConfig,
  defaultOffersConfig,
} from '@/lib/storeConfigTypes';

// ===== SHIPPING PROVIDER =====

interface ShippingQuote {
  price: number;
  deliveryDays: number;
  label: string;
  isFree: boolean;
}

interface ShippingContextValue {
  config: ShippingConfig;
  isLoading: boolean;
  quote: (cep: string, cartTotal: number, cartWeight?: number) => ShippingQuote[];
}

const ShippingContext = createContext<ShippingContextValue | null>(null);

export function useShipping() {
  const context = useContext(ShippingContext);
  if (!context) {
    throw new Error('useShipping must be used within StorefrontConfigProvider');
  }
  return context;
}

// ===== BENEFIT PROVIDER =====

interface BenefitContextValue {
  config: BenefitConfig;
  isLoading: boolean;
  getProgress: (cartTotal: number) => {
    enabled: boolean;
    progress: number;
    remaining: number;
    achieved: boolean;
    label: string;
  };
}

const BenefitContext = createContext<BenefitContextValue | null>(null);

export function useBenefit() {
  const context = useContext(BenefitContext);
  if (!context) {
    throw new Error('useBenefit must be used within StorefrontConfigProvider');
  }
  return context;
}

// ===== OFFERS PROVIDER =====

interface OffersContextValue {
  config: OffersConfig;
  isLoading: boolean;
}

const OffersContext = createContext<OffersContextValue | null>(null);

export function useOffers() {
  const context = useContext(OffersContext);
  if (!context) {
    throw new Error('useOffers must be used within StorefrontConfigProvider');
  }
  return context;
}

// ===== MAIN PROVIDER =====

interface StorefrontConfigProviderProps {
  tenantId: string;
  children: React.ReactNode;
}

export function StorefrontConfigProvider({ tenantId, children }: StorefrontConfigProviderProps) {
  // Fetch all configs in one query
  const { data, isLoading } = useQuery({
    queryKey: ['storefront-config', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('shipping_config, benefit_config, offers_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      
      return {
        shippingConfig: parseShippingConfig(data?.shipping_config),
        benefitConfig: parseBenefitConfig(data?.benefit_config),
        offersConfig: parseOffersConfig(data?.offers_config),
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const shippingConfig = data?.shippingConfig || defaultShippingConfig;
  const benefitConfig = data?.benefitConfig || defaultBenefitConfig;
  const offersConfig = data?.offersConfig || defaultOffersConfig;

  // Shipping quote function
  const quote = useMemo(() => {
    return (cep: string, cartTotal: number, cartWeight?: number): ShippingQuote[] => {
      const quotes: ShippingQuote[] = [];
      
      // Check for free shipping threshold
      const isFreeShipping = shippingConfig.freeShippingThreshold != null && 
        cartTotal >= shippingConfig.freeShippingThreshold;

      if (shippingConfig.provider === 'mock') {
        // Mock provider: return default values
        quotes.push({
          price: isFreeShipping ? 0 : shippingConfig.defaultPrice,
          deliveryDays: shippingConfig.defaultDays,
          label: 'Frete padrão',
          isFree: isFreeShipping,
        });
      } else if (shippingConfig.provider === 'manual_table') {
        // Manual table: find matching rules
        const cepNum = parseInt(cep.replace(/\D/g, ''), 10);
        
        const matchingRules = shippingConfig.rules.filter((rule: ShippingRule) => {
          const start = parseInt(rule.zipRangeStart.replace(/\D/g, ''), 10);
          const end = parseInt(rule.zipRangeEnd.replace(/\D/g, ''), 10);
          
          if (cepNum < start || cepNum > end) return false;
          if (rule.minWeight != null && cartWeight != null && cartWeight < rule.minWeight) return false;
          if (rule.maxWeight != null && cartWeight != null && cartWeight > rule.maxWeight) return false;
          if (rule.minValue != null && cartTotal < rule.minValue) return false;
          if (rule.maxValue != null && cartTotal > rule.maxValue) return false;
          
          return true;
        });

        if (matchingRules.length > 0) {
          matchingRules.forEach((rule: ShippingRule) => {
            quotes.push({
              price: isFreeShipping ? 0 : rule.price,
              deliveryDays: rule.deliveryDays,
              label: rule.label || 'Frete',
              isFree: isFreeShipping,
            });
          });
        } else {
          // No matching rule, use default
          quotes.push({
            price: isFreeShipping ? 0 : shippingConfig.defaultPrice,
            deliveryDays: shippingConfig.defaultDays,
            label: 'Frete padrão',
            isFree: isFreeShipping,
          });
        }
      }
      // External provider would be handled differently (API call)

      return quotes;
    };
  }, [shippingConfig]);

  // Benefit progress function
  const getProgress = useMemo(() => {
    return (cartTotal: number) => {
      if (!benefitConfig.enabled) {
        return { enabled: false, progress: 0, remaining: 0, achieved: false, label: '' };
      }

      const threshold = benefitConfig.thresholdValue;
      const progress = Math.min((cartTotal / threshold) * 100, 100);
      const remaining = Math.max(threshold - cartTotal, 0);
      const achieved = cartTotal >= threshold;

      return {
        enabled: true,
        progress,
        remaining,
        achieved,
        label: achieved ? benefitConfig.successLabel : benefitConfig.rewardLabel,
      };
    };
  }, [benefitConfig]);

  const shippingValue: ShippingContextValue = {
    config: shippingConfig,
    isLoading,
    quote,
  };

  const benefitValue: BenefitContextValue = {
    config: benefitConfig,
    isLoading,
    getProgress,
  };

  const offersValue: OffersContextValue = {
    config: offersConfig,
    isLoading,
  };

  return (
    <ShippingContext.Provider value={shippingValue}>
      <BenefitContext.Provider value={benefitValue}>
        <OffersContext.Provider value={offersValue}>
          {children}
        </OffersContext.Provider>
      </BenefitContext.Provider>
    </ShippingContext.Provider>
  );
}
