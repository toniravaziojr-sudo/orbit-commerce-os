// =============================================
// MARKETING TRACKER PROVIDER
// Provides marketing tracking context to storefront
// Automatically injects pixels and tracks page views
// =============================================

import { createContext, useContext, useEffect, useRef, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublicMarketingConfig, PublicMarketingConfig } from '@/hooks/useMarketingIntegrations';
import { MarketingTracker } from '@/lib/marketingTracker';
import { useAttribution } from '@/hooks/useAttribution';
import { useAffiliateTracking } from '@/hooks/useAffiliateTracking';

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
  // This improves FCP and TBT on mobile by avoiding render-blocking scripts
  useEffect(() => {
    if (!config || initializedTracker) return;
    
    // Check if any tracking is enabled
    const hasAnyEnabled = config.meta_enabled || config.google_enabled || config.tiktok_enabled;
    if (!hasAnyEnabled) return;

    const initTracker = () => {
      const tracker = new MarketingTracker({
        meta_pixel_id: config.meta_pixel_id,
        meta_enabled: config.meta_enabled,
        google_measurement_id: config.google_measurement_id,
        google_ads_conversion_id: config.google_ads_conversion_id,
        google_enabled: config.google_enabled,
        tiktok_pixel_id: config.tiktok_pixel_id,
        tiktok_enabled: config.tiktok_enabled,
      });
      
      tracker.initialize();
      setInitializedTracker(tracker);
      
      // Track initial page view
      tracker.trackPageView();
      lastPathRef.current = location.pathname + location.search;
      
      console.log('[MarketingTrackerProvider] Tracker initialized (deferred) and ready');
    };

    // Defer initialization: use requestIdleCallback if available, otherwise setTimeout
    // This ensures marketing scripts don't compete with critical rendering
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(initTracker, { timeout: 3000 });
    } else {
      setTimeout(initTracker, 2000);
    }
  }, [config, initializedTracker, location.pathname, location.search]);

  // Track page views on route change (SPA navigation)
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Only track if path actually changed and tracker exists
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
