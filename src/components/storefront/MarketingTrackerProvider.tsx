// =============================================
// MARKETING TRACKER PROVIDER
// Provides marketing tracking context to storefront
// Automatically injects pixels and tracks page views
// =============================================
// PHASE 1: Blocks tracking on preview/staging/localhost domains
// PHASE 8: Respects consent_mode_enabled setting

import { createContext, useContext, useEffect, useRef, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublicMarketingConfig, PublicMarketingConfig } from '@/hooks/useMarketingIntegrations';
import { MarketingTracker } from '@/lib/marketingTracker';
import { useAttribution } from '@/hooks/useAttribution';
import { useAffiliateTracking } from '@/hooks/useAffiliateTracking';
import { isAppDomain } from '@/lib/canonicalDomainService';
import { hasTrackingConsent, getOrCreateVisitorId } from '@/lib/visitorIdentity';

interface MarketingTrackerContextValue {
  tracker: MarketingTracker | null;
  config: PublicMarketingConfig | null;
  isLoading: boolean;
}

const MarketingTrackerContext = createContext<MarketingTrackerContextValue>({
  tracker: null,
  config: null,
  isLoading: true,
});

export function useMarketingTracker() {
  return useContext(MarketingTrackerContext);
}

interface Props {
  tenantId: string | undefined;
  children: React.ReactNode;
}

/**
 * PHASE 1: Check if the current domain is a non-production environment
 * where tracking should be completely blocked.
 */
function isNonProductionDomain(): boolean {
  if (typeof window === 'undefined') return true;

  const hostname = window.location.hostname.toLowerCase();

  // Block on localhost / 127.0.0.1
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

  // Block on Lovable preview/app domains (*.lovableproject.com, *.lovable.app)
  if (isAppDomain(hostname)) return true;

  // Block if URL has preview=1 parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('preview') === '1') return true;

  return false;
}

export function MarketingTrackerProvider({ tenantId, children }: Props) {
  const { data: config, isLoading } = usePublicMarketingConfig(tenantId);
  const location = useLocation();
  const lastPathRef = useRef<string>('');
  const [initializedTracker, setInitializedTracker] = useState<MarketingTracker | null>(null);
  
  // Capture attribution data on storefront entry
  useAttribution();
  
  // Capture affiliate tracking data
  useAffiliateTracking(tenantId);

  // Create and initialize tracker when config is available
  // DEFERRED: Wait for page to fully load before injecting marketing scripts
  // PHASE 1: Skip entirely on non-production domains
  // PHASE 8: Skip if consent_mode_enabled and user hasn't consented
  useEffect(() => {
    if (!config || initializedTracker) return;
    
    // PHASE 1: Block tracking on preview/staging/localhost
    if (isNonProductionDomain()) {
      console.log('[MarketingTrackerProvider] Blocked: non-production domain detected');
      return;
    }

    // Check if any tracking is enabled
    const hasAnyEnabled = config.meta_enabled || config.google_enabled || config.tiktok_enabled;
    if (!hasAnyEnabled) return;

    // PHASE 8: Check consent mode
    if (config.consent_mode_enabled && !hasTrackingConsent()) {
      console.log('[MarketingTrackerProvider] Blocked: consent not granted (consent_mode_enabled=true)');
      return;
    }

    const initTracker = () => {
      // Double-check domain (in case of delayed callback)
      if (isNonProductionDomain()) return;

      const tracker = new MarketingTracker({
        meta_pixel_id: config.meta_pixel_id,
        meta_enabled: config.meta_enabled,
        google_measurement_id: config.google_measurement_id,
        google_ads_conversion_id: config.google_ads_conversion_id,
        google_enabled: config.google_enabled,
        tiktok_pixel_id: config.tiktok_pixel_id,
        tiktok_enabled: config.tiktok_enabled,
        tenantId: tenantId,
      });
      
      tracker.initialize();
      setInitializedTracker(tracker);
      
      // Track initial page view
      tracker.trackPageView();
      lastPathRef.current = location.pathname + location.search;
      
      console.log('[MarketingTrackerProvider] Tracker initialized (deferred) and ready');
    };

    // Defer initialization: use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(initTracker, { timeout: 3000 });
    } else {
      setTimeout(initTracker, 2000);
    }
  }, [config, initializedTracker, location.pathname, location.search]);

  // Track page views on route change (SPA navigation)
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    if (initializedTracker && currentPath !== lastPathRef.current) {
      initializedTracker.trackPageView();
      lastPathRef.current = currentPath;
    }
  }, [location, initializedTracker]);

  const contextValue = useMemo(() => ({
    tracker: initializedTracker,
    config,
    isLoading,
  }), [initializedTracker, config, isLoading]);

  return (
    <MarketingTrackerContext.Provider value={contextValue}>
      {children}
    </MarketingTrackerContext.Provider>
  );
}
