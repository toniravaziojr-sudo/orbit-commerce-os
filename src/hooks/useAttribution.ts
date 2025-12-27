// =============================================
// USE ATTRIBUTION HOOK
// Captures and persists attribution data (UTMs, click IDs, referrer)
// for conversion tracking
// =============================================

import { useEffect, useCallback } from 'react';

export interface AttributionData {
  // UTM Parameters
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  
  // Click IDs from ad platforms
  gclid?: string | null;     // Google Ads
  fbclid?: string | null;    // Facebook/Instagram
  ttclid?: string | null;    // TikTok
  msclkid?: string | null;   // Microsoft Ads
  
  // Referrer info
  referrer_url?: string | null;
  referrer_domain?: string | null;
  
  // Landing page
  landing_page?: string | null;
  
  // Derived attribution
  attribution_source?: string | null;
  attribution_medium?: string | null;
  
  // Session info
  session_id?: string | null;
  first_touch_at?: string | null;
}

const STORAGE_KEY = 'attribution_data';

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Derive attribution source and medium from available data
 */
function deriveAttribution(data: AttributionData): { source: string; medium: string } {
  // Priority 1: Explicit UTM parameters
  if (data.utm_source) {
    const source = data.utm_source.toLowerCase();
    const medium = data.utm_medium?.toLowerCase() || 'unknown';
    
    // Normalize common sources
    if (source === 'google' && medium === 'cpc') {
      return { source: 'google_ads', medium: 'cpc' };
    }
    if (source === 'facebook' || source === 'fb' || source === 'instagram' || source === 'ig') {
      return { source: source === 'instagram' || source === 'ig' ? 'instagram' : 'facebook', medium };
    }
    if (source === 'tiktok' || source === 'tt') {
      return { source: 'tiktok', medium };
    }
    
    return { source, medium };
  }
  
  // Priority 2: Click IDs
  if (data.gclid) {
    return { source: 'google_ads', medium: 'cpc' };
  }
  if (data.fbclid) {
    // Could be Facebook or Instagram - default to Facebook
    return { source: 'facebook', medium: 'cpc' };
  }
  if (data.ttclid) {
    return { source: 'tiktok', medium: 'cpc' };
  }
  if (data.msclkid) {
    return { source: 'bing_ads', medium: 'cpc' };
  }
  
  // Priority 3: Referrer domain
  if (data.referrer_domain) {
    const domain = data.referrer_domain.toLowerCase();
    
    // Search engines - organic
    if (domain.includes('google')) {
      return { source: 'google', medium: 'organic' };
    }
    if (domain.includes('bing') || domain.includes('msn')) {
      return { source: 'bing', medium: 'organic' };
    }
    if (domain.includes('yahoo')) {
      return { source: 'yahoo', medium: 'organic' };
    }
    if (domain.includes('duckduckgo')) {
      return { source: 'duckduckgo', medium: 'organic' };
    }
    
    // Social media - organic
    if (domain.includes('facebook.com') || domain.includes('fb.com')) {
      return { source: 'facebook', medium: 'social' };
    }
    if (domain.includes('instagram.com')) {
      return { source: 'instagram', medium: 'social' };
    }
    if (domain.includes('tiktok.com')) {
      return { source: 'tiktok', medium: 'social' };
    }
    if (domain.includes('twitter.com') || domain.includes('x.com')) {
      return { source: 'twitter', medium: 'social' };
    }
    if (domain.includes('linkedin.com')) {
      return { source: 'linkedin', medium: 'social' };
    }
    if (domain.includes('youtube.com')) {
      return { source: 'youtube', medium: 'social' };
    }
    if (domain.includes('pinterest.com')) {
      return { source: 'pinterest', medium: 'social' };
    }
    if (domain.includes('whatsapp.com') || domain.includes('wa.me')) {
      return { source: 'whatsapp', medium: 'social' };
    }
    
    // Email providers
    if (domain.includes('mail.') || domain.includes('outlook') || domain.includes('gmail')) {
      return { source: 'email', medium: 'email' };
    }
    
    // Other referral
    return { source: domain, medium: 'referral' };
  }
  
  // No attribution data - direct traffic
  return { source: 'direct', medium: 'none' };
}

/**
 * Get stored attribution data
 */
export function getStoredAttribution(): AttributionData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('[Attribution] Error reading stored data:', e);
  }
  return null;
}

/**
 * Store attribution data
 */
function storeAttribution(data: AttributionData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[Attribution] Error storing data:', e);
  }
}

/**
 * Clear stored attribution data (after order is placed)
 */
export function clearStoredAttribution(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[Attribution] Error clearing data:', e);
  }
}

/**
 * Hook to capture and manage attribution data
 * Should be used in the storefront layout
 */
export function useAttribution() {
  const captureAttribution = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    const url = new URL(window.location.href);
    const params = url.searchParams;
    
    // Check if we already have stored attribution (first-touch model)
    const existingData = getStoredAttribution();
    
    // Only capture new data if:
    // 1. No existing data, OR
    // 2. New data has click IDs (paid traffic takes priority), OR
    // 3. New data has UTM source
    const hasNewClickId = params.has('gclid') || params.has('fbclid') || params.has('ttclid') || params.has('msclkid');
    const hasNewUtm = params.has('utm_source');
    
    if (existingData && !hasNewClickId && !hasNewUtm) {
      // Keep existing first-touch attribution
      console.log('[Attribution] Keeping existing first-touch data:', existingData.attribution_source);
      return existingData;
    }
    
    // Capture new attribution data
    const referrer = document.referrer || null;
    const referrerDomain = referrer ? extractDomain(referrer) : null;
    
    const newData: AttributionData = {
      // UTM Parameters
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
      
      // Click IDs
      gclid: params.get('gclid'),
      fbclid: params.get('fbclid'),
      ttclid: params.get('ttclid'),
      msclkid: params.get('msclkid'),
      
      // Referrer
      referrer_url: referrer,
      referrer_domain: referrerDomain,
      
      // Landing page
      landing_page: window.location.pathname + window.location.search,
      
      // Session
      session_id: existingData?.session_id || generateSessionId(),
      first_touch_at: existingData?.first_touch_at || new Date().toISOString(),
    };
    
    // Derive attribution source and medium
    const { source, medium } = deriveAttribution(newData);
    newData.attribution_source = source;
    newData.attribution_medium = medium;
    
    // Store the data
    storeAttribution(newData);
    
    console.log('[Attribution] Captured:', source, '/', medium);
    return newData;
  }, []);
  
  // Capture on mount
  useEffect(() => {
    captureAttribution();
  }, [captureAttribution]);
  
  return {
    getAttribution: getStoredAttribution,
    captureAttribution,
    clearAttribution: clearStoredAttribution,
  };
}
