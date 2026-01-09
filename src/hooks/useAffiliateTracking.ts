// =============================================
// USE AFFILIATE TRACKING HOOK
// Hook to capture and manage affiliate tracking in storefront
// =============================================

import { useEffect, useCallback } from 'react';
import { 
  captureAffiliateCode, 
  getStoredAffiliateData, 
  clearStoredAffiliateData,
  AffiliateData 
} from '@/lib/affiliateTracking';

/**
 * Hook to handle affiliate tracking in the storefront
 * Should be used in the storefront layout/provider
 */
export function useAffiliateTracking(tenantId: string | undefined) {
  const capture = useCallback(async () => {
    if (!tenantId) return null;
    return captureAffiliateCode(tenantId);
  }, [tenantId]);

  // Capture on mount
  useEffect(() => {
    capture();
  }, [capture]);

  return {
    getAffiliateData: getStoredAffiliateData,
    captureAffiliate: capture,
    clearAffiliateData: clearStoredAffiliateData,
  };
}

export type { AffiliateData };
