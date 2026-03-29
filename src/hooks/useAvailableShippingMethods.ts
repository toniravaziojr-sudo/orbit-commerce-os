// ============================================
// USE AVAILABLE SHIPPING METHODS
// Returns shipping method options based on active providers
// Used by ProductForm for free_shipping_method selection
// ============================================

import { useMemo } from 'react';
import { useShippingProviders } from './useShippingProviders';

export interface ShippingMethodOption {
  value: string;
  label: string;
  provider: string;
}

/**
 * Maps active shipping providers to their known service methods.
 * This avoids hardcoding and ensures the product form
 * only shows methods that the tenant actually has configured.
 */
const PROVIDER_SERVICES: Record<string, Array<{ value: string; label: string }>> = {
  correios: [
    { value: 'PAC', label: 'PAC (Correios)' },
    { value: 'SEDEX', label: 'SEDEX (Correios)' },
    { value: 'PAC Mini', label: 'PAC Mini (Correios)' },
    { value: 'SEDEX 10', label: 'SEDEX 10 (Correios)' },
    { value: 'SEDEX 12', label: 'SEDEX 12 (Correios)' },
  ],
  frenet: [
    // Frenet is a gateway - services are dynamic per carrier
    // We list common ones that Frenet typically returns
    { value: 'PAC', label: 'PAC (via Frenet)' },
    { value: 'SEDEX', label: 'SEDEX (via Frenet)' },
    { value: 'Mini Envios', label: 'Mini Envios (via Frenet)' },
  ],
  loggi: [
    { value: 'Loggi Express', label: 'Loggi Express' },
  ],
};

/**
 * Service code to service name mapping for Correios.
 * Used to filter methods based on configured service_codes in provider settings.
 */
const CORREIOS_CODE_TO_NAME: Record<string, string> = {
  '03220': 'SEDEX',
  '03298': 'PAC',
  '04014': 'SEDEX',
  '04510': 'PAC',
  '04065': 'SEDEX 10',
  '04707': 'PAC Mini',
  '03158': 'SEDEX 10',
  '03140': 'SEDEX 12',
};

export function useAvailableShippingMethods() {
  const { providers, isLoading } = useShippingProviders();

  const methods = useMemo<ShippingMethodOption[]>(() => {
    if (!providers.length) return [];

    const result: ShippingMethodOption[] = [];
    const seen = new Set<string>();

    for (const provider of providers) {
      if (!provider.is_enabled || !provider.supports_quote) continue;

      const providerKey = provider.provider.toLowerCase();

      if (providerKey === 'correios') {
        // Filter by configured service_codes if available
        const configuredCodes = (provider.settings?.service_codes as string[]) || [];
        
        if (configuredCodes.length > 0) {
          // Only show services that are configured
          const configuredNames = new Set(
            configuredCodes.map(code => CORREIOS_CODE_TO_NAME[code]).filter(Boolean)
          );
          
          const allServices = PROVIDER_SERVICES.correios || [];
          for (const svc of allServices) {
            if (configuredNames.has(svc.value) && !seen.has(svc.value)) {
              seen.add(svc.value);
              result.push({ ...svc, provider: 'correios' });
            }
          }
        } else {
          // No specific codes configured, show all Correios services
          for (const svc of PROVIDER_SERVICES.correios || []) {
            if (!seen.has(svc.value)) {
              seen.add(svc.value);
              result.push({ ...svc, provider: 'correios' });
            }
          }
        }
      } else {
        // For other providers, show all known services
        const services = PROVIDER_SERVICES[providerKey] || [];
        for (const svc of services) {
          if (!seen.has(svc.value)) {
            seen.add(svc.value);
            result.push({ ...svc, provider: providerKey });
          }
        }
      }
    }

    return result;
  }, [providers]);

  return { methods, isLoading };
}