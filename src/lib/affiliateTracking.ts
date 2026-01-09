// =============================================
// AFFILIATE TRACKING - Client-side utilities
// Captures affiliate codes from URL and persists for attribution
// =============================================

import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'affiliate_data';
const ATTRIBUTION_WINDOW_DAYS = 30; // Default, will be overridden by tenant config

export interface AffiliateData {
  affiliate_code: string;
  tenant_id: string;
  captured_at: string;
  landing_url: string;
}

/**
 * Get stored affiliate data
 */
export function getStoredAffiliateData(): AffiliateData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data: AffiliateData = JSON.parse(stored);
    
    // Check if within attribution window
    const capturedAt = new Date(data.captured_at);
    const now = new Date();
    const daysDiff = (now.getTime() - capturedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > ATTRIBUTION_WINDOW_DAYS) {
      // Expired - clear and return null
      clearStoredAffiliateData();
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('[AffiliateTracking] Error reading stored data:', e);
    return null;
  }
}

/**
 * Store affiliate data
 */
function storeAffiliateData(data: AffiliateData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[AffiliateTracking] Error storing data:', e);
  }
}

/**
 * Clear stored affiliate data (after order is placed)
 */
export function clearStoredAffiliateData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('[AffiliateTracking] Error clearing data:', e);
  }
}

/**
 * Capture affiliate code from URL if present
 * Call this on storefront entry
 */
export async function captureAffiliateCode(tenantId: string): Promise<AffiliateData | null> {
  if (typeof window === 'undefined') return null;
  
  const url = new URL(window.location.href);
  const affiliateCode = url.searchParams.get('aff') || url.searchParams.get('ref');
  
  if (!affiliateCode) {
    // No new affiliate code - return existing if any
    return getStoredAffiliateData();
  }
  
  // New affiliate code found - store it
  const data: AffiliateData = {
    affiliate_code: affiliateCode,
    tenant_id: tenantId,
    captured_at: new Date().toISOString(),
    landing_url: window.location.href,
  };
  
  storeAffiliateData(data);
  console.log('[AffiliateTracking] Captured affiliate code:', affiliateCode);
  
  // Track the click via edge function
  try {
    await supabase.functions.invoke('affiliate-track-click', {
      body: {
        affiliate_code: affiliateCode,
        tenant_id: tenantId,
        landing_url: window.location.href,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent,
      },
    });
    console.log('[AffiliateTracking] Click tracked');
  } catch (e) {
    console.error('[AffiliateTracking] Error tracking click:', e);
    // Non-blocking - data is still stored locally
  }
  
  return data;
}
