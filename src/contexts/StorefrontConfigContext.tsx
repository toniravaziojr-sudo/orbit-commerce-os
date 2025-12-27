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

export interface ShippingQuote {
  code?: string;
  price: number;
  deliveryDays: number;
  label: string;
  carrier?: string;
  sourceProvider?: string; // frenet, correios, loggi
  isFree: boolean;
}

interface ShippingContextValue {
  config: ShippingConfig;
  isLoading: boolean;
  quote: (cep: string, cartTotal: number, cartWeight?: number) => ShippingQuote[];
  quoteAsync: (
    cep: string, 
    cartTotal: number, 
    items: Array<{ weight?: number; height?: number; width?: number; length?: number; quantity: number; price: number }>
  ) => Promise<ShippingQuote[]>;
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

// ===== CANONICAL DOMAIN CONTEXT =====

interface CanonicalDomainContextValue {
  customDomain: string | null;
}

const CanonicalDomainContext = createContext<CanonicalDomainContextValue | null>(null);

export function useCanonicalDomain() {
  const context = useContext(CanonicalDomainContext);
  if (!context) {
    throw new Error('useCanonicalDomain must be used within StorefrontConfigProvider');
  }
  return context;
}

// ===== MAIN PROVIDER =====

export interface StorefrontConfigProviderProps {
  tenantId: string;
  customDomain?: string | null;
  children: React.ReactNode;
}

export function StorefrontConfigProvider({ tenantId, customDomain = null, children }: StorefrontConfigProviderProps) {
  // Fetch all configs in one query
  const { data, isLoading } = useQuery({
    queryKey: ['storefront-config', tenantId],
    queryFn: async () => {
      // Fetch store_settings
      const { data: storeData, error: storeError } = await supabase
        .from('store_settings')
        .select('shipping_config, benefit_config, offers_config')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (storeError) throw storeError;

      // Check for any active shipping providers with quote support
      const { data: shippingProviders } = await supabase
        .from('shipping_providers')
        .select('provider, is_enabled, supports_quote')
        .eq('tenant_id', tenantId)
        .eq('is_enabled', true)
        .eq('supports_quote', true);

      let shippingConfig = parseShippingConfig(storeData?.shipping_config);

      // If any provider with quote support is active, use multi-provider edge function
      const hasActiveQuoteProviders = shippingProviders && shippingProviders.length > 0;
      if (hasActiveQuoteProviders) {
        const activeProviders = shippingProviders.map(p => p.provider);
        shippingConfig = {
          ...shippingConfig,
          provider: 'multi', // Signal to use shipping-quote aggregator
          frenetEnabled: activeProviders.includes('frenet'),
        };
        console.log('[StorefrontConfigContext] Active quote providers:', activeProviders.join(', '));
      }
      
      return {
        shippingConfig,
        benefitConfig: parseBenefitConfig(storeData?.benefit_config),
        offersConfig: parseOffersConfig(storeData?.offers_config),
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const shippingConfig = data?.shippingConfig || defaultShippingConfig;
  const benefitConfig = data?.benefitConfig || defaultBenefitConfig;
  const offersConfig = data?.offersConfig || defaultOffersConfig;

  // Shipping quote function (sync - for mock/manual providers)
  // For Frenet provider, returns fallback. Use quoteAsync for real Frenet quotes.
  const quote = useMemo(() => {
    return (cep: string, cartTotal: number, cartWeight?: number): ShippingQuote[] => {
      const quotes: ShippingQuote[] = [];
      
      // Normalize CEP - extract digits only
      const cepDigits = cep.replace(/\D/g, '');
      if (cepDigits.length !== 8) {
        console.warn('[StorefrontConfigContext] Invalid CEP format:', cep);
        return quotes;
      }
      
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
        const cepNum = parseInt(cepDigits, 10);
        
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
      } else if (shippingConfig.provider === 'frenet' || shippingConfig.provider === 'multi') {
        // Multi-provider or Frenet: this function should not be called
        // Return empty to signal that quoteAsync should be used instead
        console.log('[StorefrontConfigContext] Multi-provider active - use quoteAsync for real quotes');
      }

      return quotes;
    };
  }, [shippingConfig]);

  // Async shipping quote function for Frenet - needs tenantId
  const quoteAsync = useMemo(() => {
    return async (
      cep: string, 
      cartTotal: number,
      items: Array<{ weight?: number; height?: number; width?: number; length?: number; quantity: number; price: number }>
    ): Promise<ShippingQuote[]> => {
      // Check for free shipping threshold
      const isFreeShipping = shippingConfig.freeShippingThreshold != null && 
        cartTotal >= shippingConfig.freeShippingThreshold;

      // If using multi-provider or Frenet, call the shipping-quote Edge Function
      if (shippingConfig.provider === 'multi' || shippingConfig.provider === 'frenet') {
        try {
        console.log('[StorefrontConfigContext] Calling shipping-quote with tenant:', tenantId);
          
          // Always use shipping-quote for both 'multi' and 'frenet' providers
          // shipping-quote is the unified aggregator that handles all providers
          const functionName = 'shipping-quote';
          
          const { data, error } = await supabase.functions.invoke(functionName, {
            body: {
              tenant_id: tenantId, // Edge function will get credentials from database
              store_host: window.location.host, // For domain-aware resolution
              recipient_cep: cep,
              items: items.map(item => ({
                weight: item.weight || 0.3,
                height: item.height || 10,
                width: item.width || 10,
                length: item.length || 10,
                quantity: item.quantity,
                price: item.price,
              })),
            },
          });

          if (error) {
            console.error('[StorefrontConfigContext] Shipping quote error:', error);
            // Fallback to default
            return [{
              price: isFreeShipping ? 0 : shippingConfig.defaultPrice,
              deliveryDays: shippingConfig.defaultDays,
              label: 'Frete padrão (fallback)',
              isFree: isFreeShipping,
            }];
          }

          console.log('[StorefrontConfigContext] Shipping quote response:', data);

          if (data?.options && data.options.length > 0) {
            return data.options.map((opt: { 
              source_provider?: string;
              service_code?: string; 
              code?: string;
              service_name?: string;
              label?: string; 
              carrier?: string; 
              price: unknown; 
              estimated_days?: unknown;
              deliveryDays?: unknown;
            }) => {
              // Safe conversion - handle string/number/undefined
              const safePrice = typeof opt.price === 'number' 
                ? opt.price 
                : parseFloat(String(opt.price)) || 0;
              const rawDays = opt.estimated_days ?? opt.deliveryDays;
              const safeDays = typeof rawDays === 'number' 
                ? rawDays 
                : parseInt(String(rawDays), 10) || 5;
              
              return {
                code: opt.service_code || opt.code,
                label: opt.service_name || opt.label || 'Frete',
                carrier: opt.carrier,
                sourceProvider: opt.source_provider, // Track where quote came from
                price: isFreeShipping ? 0 : safePrice,
                deliveryDays: safeDays,
                isFree: isFreeShipping,
              };
            });
          }
        } catch (err) {
          console.error('[StorefrontConfigContext] Shipping quote exception:', err);
        }
        
        // Fallback
        return [{
          price: isFreeShipping ? 0 : shippingConfig.defaultPrice,
          deliveryDays: shippingConfig.defaultDays,
          label: 'Frete padrão (fallback)',
          isFree: isFreeShipping,
        }];
      }

      // For non-provider configs, use sync quote
      return quote(cep, cartTotal);
    };
  }, [shippingConfig, quote, tenantId]);

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
    quoteAsync,
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

  const canonicalDomainValue: CanonicalDomainContextValue = {
    customDomain,
  };

  return (
    <CanonicalDomainContext.Provider value={canonicalDomainValue}>
      <ShippingContext.Provider value={shippingValue}>
        <BenefitContext.Provider value={benefitValue}>
          <OffersContext.Provider value={offersValue}>
            {children}
          </OffersContext.Provider>
        </BenefitContext.Provider>
      </ShippingContext.Provider>
    </CanonicalDomainContext.Provider>
  );
}
