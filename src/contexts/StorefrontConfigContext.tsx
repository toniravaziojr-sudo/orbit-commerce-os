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
  CartConfig,
  CheckoutConfig,
  ShippingRule,
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

// ===== SHIPPING PROVIDER =====

export interface ShippingQuote {
  code?: string;
  price: number;
  originalPrice?: number; // Price before free shipping override
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
    // Return safe defaults for editing mode (builder preview)
    return {
      config: defaultShippingConfig,
      isLoading: false,
      quote: () => [],
      quoteAsync: async () => [],
    } as ShippingContextValue;
  }
  return context;
}

// ===== BENEFIT PROVIDER =====

interface BenefitContextValue {
  config: BenefitConfig;
  isLoading: boolean;
  getProgress: (cartTotal: number, externalFreeShipping?: boolean) => {
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
    // Return safe defaults for editing mode (builder preview)
    return {
      config: defaultBenefitConfig,
      isLoading: false,
      getProgress: () => ({ enabled: false, progress: 0, remaining: 0, achieved: false, label: '' }),
    } as BenefitContextValue;
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
    // Return safe defaults for editing mode (builder preview)
    return {
      config: defaultOffersConfig,
      isLoading: false,
    } as OffersContextValue;
  }
  return context;
}

// ===== CART CONFIG PROVIDER =====

interface CartConfigContextValue {
  config: CartConfig;
  isLoading: boolean;
}

const CartConfigContext = createContext<CartConfigContextValue | null>(null);

export function useCartConfig() {
  const context = useContext(CartConfigContext);
  if (!context) {
    // Return safe defaults for editing mode (builder preview)
    return {
      config: defaultCartConfig,
      isLoading: false,
    } as CartConfigContextValue;
  }
  return context;
}

// ===== CHECKOUT CONFIG PROVIDER =====

interface CheckoutConfigContextValue {
  config: CheckoutConfig;
  isLoading: boolean;
}

const CheckoutConfigContext = createContext<CheckoutConfigContextValue | null>(null);

export function useCheckoutConfig() {
  const context = useContext(CheckoutConfigContext);
  if (!context) {
    // Return safe defaults for editing mode (builder preview)
    return {
      config: defaultCheckoutConfig,
      isLoading: false,
    } as CheckoutConfigContextValue;
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
    // Return safe defaults for editing mode (builder preview)
    return {
      customDomain: null,
    } as CanonicalDomainContextValue;
  }
  return context;
}

// ===== STOREFRONT CONFIG CONTEXT (tenantId) =====

interface StorefrontConfigContextValue {
  tenantId: string;
}

const StorefrontConfigContext = createContext<StorefrontConfigContextValue | null>(null);

export function useStorefrontConfig() {
  const context = useContext(StorefrontConfigContext);
  if (!context) {
    // Return safe defaults for editing mode (builder preview)
    return {
      tenantId: '',
    } as StorefrontConfigContextValue;
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
        .select('shipping_config, benefit_config, offers_config, cart_config, checkout_config')
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

      // Fetch active free shipping rules to derive bar threshold
      // Table not in generated types, use raw REST call
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      let freeShippingRules: Array<{ min_order_cents: number | null }> = [];
      try {
        const res = await fetch(
          `${supabaseUrl}/rest/v1/shipping_free_rules?tenant_id=eq.${tenantId}&is_enabled=eq.true&select=min_order_cents`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        if (res.ok) {
          freeShippingRules = await res.json();
        }
      } catch (e) {
        console.warn('[StorefrontConfigContext] Failed to fetch free shipping rules:', e);
      }

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

      // Derive the lowest min_order threshold from active logistics rules (in reais)
      let logisticsThreshold: number | null = null;
      if (freeShippingRules && freeShippingRules.length > 0) {
        const thresholds = freeShippingRules
          .filter(r => r.min_order_cents != null && r.min_order_cents > 0)
          .map(r => r.min_order_cents as number);
        if (thresholds.length > 0) {
          logisticsThreshold = Math.min(...thresholds) / 100; // cents → reais
        }
      }
      
      return {
        shippingConfig,
        benefitConfig: parseBenefitConfig(storeData?.benefit_config),
        offersConfig: parseOffersConfig(storeData?.offers_config),
        cartConfig: parseCartConfig(storeData?.cart_config),
        checkoutConfig: parseCheckoutConfig(storeData?.checkout_config),
        logisticsThreshold,
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const shippingConfig = data?.shippingConfig || defaultShippingConfig;
  const benefitConfig = data?.benefitConfig || defaultBenefitConfig;
  const offersConfig = data?.offersConfig || defaultOffersConfig;
  const cartConfig = data?.cartConfig || defaultCartConfig;
  const checkoutConfig = data?.checkoutConfig || defaultCheckoutConfig;

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
      items: Array<{ weight?: number; height?: number; width?: number; length?: number; quantity: number; price: number; product_id?: string; variant_id?: string }>
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
                product_id: item.product_id,
                variant_id: item.variant_id || '',
              })),
            },
          });

          if (error) {
            console.error('[StorefrontConfigContext] Shipping quote error:', error);
            // Fallback to default
            return [{
              price: isFreeShipping ? 0 : shippingConfig.defaultPrice,
              deliveryDays: shippingConfig.defaultDays,
              label: 'Frete padrão',
              isFree: isFreeShipping,
            }];
          }

          console.log('[StorefrontConfigContext] Shipping quote response:', data);

          if (data?.options && data.options.length > 0) {
            const mappedOptions = data.options.map((opt: { 
              source_provider?: string;
              service_code?: string; 
              code?: string;
              service_name?: string;
              label?: string; 
              carrier?: string; 
              price: unknown;
              original_price?: unknown;
              estimated_days?: unknown;
              deliveryDays?: unknown;
              is_free?: boolean;
            }) => {
              // Safe conversion - handle string/number/undefined
              const safePrice = typeof opt.price === 'number' 
                ? opt.price 
                : parseFloat(String(opt.price)) || 0;
              const rawDays = opt.estimated_days ?? opt.deliveryDays;
              const safeDays = typeof rawDays === 'number' 
                ? rawDays 
                : parseInt(String(rawDays), 10) || 5;
              const safeOriginalPrice = opt.original_price != null
                ? (typeof opt.original_price === 'number' ? opt.original_price : parseFloat(String(opt.original_price)) || 0)
                : undefined;
              
              // is_free from API takes precedence, then check isFreeShipping threshold
              const optionIsFree = opt.is_free === true || isFreeShipping;
              
              // Clean label: remove carrier/provider references like "(Correios)", "via frenet"
              const rawLabel = opt.service_name || opt.label || 'Frete';
              const cleanLabel = rawLabel
                .replace(/\s*\((?:Correios|Jadlog|Loggi|Frenet|Transportadora)\)/gi, '')
                .replace(/\s*via\s+(?:frenet|correios|loggi|jadlog)/gi, '')
                .trim() || 'Frete';

              return {
                code: opt.service_code || opt.code,
                label: cleanLabel,
                price: optionIsFree ? 0 : safePrice,
                originalPrice: safeOriginalPrice,
                deliveryDays: safeDays,
                isFree: optionIsFree,
                carrier: opt.carrier,
                sourceProvider: opt.source_provider,
              };
            });

            // Attach quote_id to the result array for downstream consumers
            const result = mappedOptions as ShippingQuote[] & { quote_id?: string };
            if (data.quote_id) {
              result.quote_id = data.quote_id;
            }
            return result;
          }
        } catch (err) {
          console.error('[StorefrontConfigContext] Shipping quote exception:', err);
        }
        
        // Fallback
        return [{
          price: isFreeShipping ? 0 : shippingConfig.defaultPrice,
          deliveryDays: shippingConfig.defaultDays,
          label: 'Frete padrão',
          isFree: isFreeShipping,
        }];
      }

      // For non-provider configs, use sync quote
      return quote(cep, cartTotal);
    };
  }, [shippingConfig, quote, tenantId]);

  // Benefit progress function
  // Uses logistics rules threshold when available, falls back to benefit_config.thresholdValue
  const logisticsThreshold = data?.logisticsThreshold ?? null;
  
  const getProgress = useMemo(() => {
    return (cartTotal: number, externalFreeShipping?: boolean) => {
      if (!benefitConfig.enabled) {
        return { enabled: false, progress: 0, remaining: 0, achieved: false, label: '' };
      }

      // External free shipping (product or coupon) always shows as achieved
      const achievedByExternal = !!externalFreeShipping;

      // Priority: logistics rules threshold > benefit_config.thresholdValue (legacy fallback)
      const threshold = logisticsThreshold ?? benefitConfig.thresholdValue;
      
      // If no threshold available (no rules, no legacy value), and not achieved by external, hide bar
      if (threshold <= 0 && !achievedByExternal) {
        return { enabled: true, progress: 0, remaining: 0, achieved: false, label: benefitConfig.rewardLabel };
      }

      const progress = achievedByExternal ? 100 : (threshold > 0 ? Math.min((cartTotal / threshold) * 100, 100) : 0);
      const remaining = achievedByExternal ? 0 : Math.max(threshold - cartTotal, 0);
      const achieved = achievedByExternal || (threshold > 0 && cartTotal >= threshold);

      return {
        enabled: true,
        progress,
        remaining,
        achieved,
        label: achieved ? benefitConfig.successLabel : benefitConfig.rewardLabel,
      };
    };
  }, [benefitConfig, logisticsThreshold]);

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

  const cartConfigValue: CartConfigContextValue = {
    config: cartConfig,
    isLoading,
  };

  const checkoutConfigValue: CheckoutConfigContextValue = {
    config: checkoutConfig,
    isLoading,
  };

  const canonicalDomainValue: CanonicalDomainContextValue = {
    customDomain,
  };

  const storefrontConfigValue: StorefrontConfigContextValue = {
    tenantId,
  };

  return (
    <StorefrontConfigContext.Provider value={storefrontConfigValue}>
      <CanonicalDomainContext.Provider value={canonicalDomainValue}>
        <ShippingContext.Provider value={shippingValue}>
          <BenefitContext.Provider value={benefitValue}>
            <OffersContext.Provider value={offersValue}>
              <CartConfigContext.Provider value={cartConfigValue}>
                <CheckoutConfigContext.Provider value={checkoutConfigValue}>
                  {children}
                </CheckoutConfigContext.Provider>
              </CartConfigContext.Provider>
            </OffersContext.Provider>
          </BenefitContext.Provider>
        </ShippingContext.Provider>
      </CanonicalDomainContext.Provider>
    </StorefrontConfigContext.Provider>
  );
}