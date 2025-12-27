// =============================================
// MARKETING TRACKER PROVIDER
// Provides marketing tracking context to storefront
// Automatically injects pixels and tracks page views
// =============================================

import { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { usePublicMarketingConfig, PublicMarketingConfig } from '@/hooks/useMarketingIntegrations';
import { MarketingTracker } from '@/lib/marketingTracker';

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
  const trackerRef = useRef<MarketingTracker | null>(null);
  const lastPathRef = useRef<string>('');

  // Create tracker instance when config is available
  const tracker = useMemo(() => {
    if (!config) return null;
    
    // Check if any tracking is enabled
    const hasAnyEnabled = config.meta_enabled || config.google_enabled || config.tiktok_enabled;
    if (!hasAnyEnabled) return null;

    return new MarketingTracker({
      meta_pixel_id: config.meta_pixel_id,
      meta_enabled: config.meta_enabled,
      google_measurement_id: config.google_measurement_id,
      google_ads_conversion_id: config.google_ads_conversion_id,
      google_enabled: config.google_enabled,
      tiktok_pixel_id: config.tiktok_pixel_id,
      tiktok_enabled: config.tiktok_enabled,
    });
  }, [config]);

  // Initialize tracker and track initial page view
  useEffect(() => {
    if (tracker && !trackerRef.current) {
      tracker.initialize();
      trackerRef.current = tracker;
      
      // Track initial page view
      tracker.trackPageView();
      lastPathRef.current = location.pathname + location.search;
    }
  }, [tracker, location]);

  // Track page views on route change (SPA navigation)
  useEffect(() => {
    const currentPath = location.pathname + location.search;
    
    // Only track if path actually changed and tracker exists
    if (trackerRef.current && currentPath !== lastPathRef.current) {
      trackerRef.current.trackPageView();
      lastPathRef.current = currentPath;
    }
  }, [location]);

  const contextValue = useMemo(() => ({
    tracker: trackerRef.current || tracker,
    config,
    isLoading,
  }), [tracker, config, isLoading]);

  return (
    <MarketingTrackerContext.Provider value={contextValue}>
      {children}
    </MarketingTrackerContext.Provider>
  );
}
