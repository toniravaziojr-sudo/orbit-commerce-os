// =============================================
// VISITOR IDENTITY
// Centralized visitor/user identity for marketing tracking
// Provides external_id, _fbc cookie, click ID capture
// =============================================

/**
 * Get the visitor ID from the _sf_vid cookie (same as useVisitorTracking).
 * This is the anonymous persistent ID used as external_id for Meta CAPI.
 */
export function getVisitorId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)_sf_vid=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Get or create the visitor ID (creates cookie if missing).
 */
export function getOrCreateVisitorId(): string {
  if (typeof document === 'undefined') return '';
  
  const existing = getVisitorId();
  if (existing) return existing;

  const id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `_sf_vid=${id};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
  return id;
}

// =============================================
// COOKIE HELPERS
// =============================================

function setCookie(name: string, value: string, days: number): void {
  if (typeof document === 'undefined') return;
  const expires = new Date();
  expires.setDate(expires.getDate() + days);
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// =============================================
// FBP / FBC (Meta identifiers)
// =============================================

/**
 * Get _fbp cookie value (set by Meta Pixel).
 */
export function getFbp(): string | null {
  return getCookie('_fbp');
}

/**
 * Get _fbc value. Checks URL for fbclid first, then cookie, then localStorage fallback.
 * Persists in first-party cookie (90 days) for better attribution.
 */
export function getFbc(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check URL for fbclid (fresh click = always use)
  const urlParams = new URLSearchParams(window.location.search);
  const fbclid = urlParams.get('fbclid');

  if (fbclid) {
    const fbc = `fb.1.${Date.now()}.${fbclid}`;
    // Persist in cookie (90 days) AND localStorage
    setCookie('_fbc', fbc, 90);
    try { localStorage.setItem('_fbc', fbc); } catch {}
    return fbc;
  }

  // 2. Check cookie first (more reliable than localStorage)
  const cookieFbc = getCookie('_fbc');
  if (cookieFbc && !isFbcExpired(cookieFbc)) return cookieFbc;

  // 3. Fallback to localStorage (with expiration check)
  try {
    const lsFbc = localStorage.getItem('_fbc');
    if (lsFbc) {
      if (isFbcExpired(lsFbc)) {
        // Expired — clean up stale value
        localStorage.removeItem('_fbc');
        return null;
      }
      // Migrate to cookie for next time
      setCookie('_fbc', lsFbc, 90);
      return lsFbc;
    }
  } catch {}

  return null;
}

/**
 * Check if an fbc value is expired (older than 90 days).
 * fbc format: fb.{version}.{timestamp_ms}.{fbclid}
 */
function isFbcExpired(fbc: string): boolean {
  try {
    const parts = fbc.split('.');
    if (parts.length < 3) return true;
    const timestamp = parseInt(parts[2], 10);
    if (isNaN(timestamp)) return true;
    const ageMs = Date.now() - timestamp;
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    return ageMs > ninetyDaysMs;
  } catch {
    return true;
  }
}

// =============================================
// CLICK ID CAPTURE (for future TikTok/Google)
// =============================================

const CLICK_ID_PARAMS: Record<string, { cookie: string; days: number }> = {
  ttclid:  { cookie: '_ttclid',  days: 30 },
  gclid:   { cookie: '_gclid',   days: 90 },
  gbraid:  { cookie: '_gbraid',  days: 90 },
  wbraid:  { cookie: '_wbraid',  days: 90 },
};

/**
 * Capture click IDs from URL and persist in first-party cookies.
 * Call once on page load / tracker initialization.
 */
export function captureClickIds(): void {
  if (typeof window === 'undefined') return;

  const urlParams = new URLSearchParams(window.location.search);

  for (const [param, config] of Object.entries(CLICK_ID_PARAMS)) {
    const value = urlParams.get(param);
    if (value) {
      setCookie(config.cookie, value, config.days);
    }
  }
}

/**
 * Get all stored click IDs (for future provider adapters).
 */
export function getClickIds(): Record<string, string | null> {
  return {
    ttclid: getCookie('_ttclid'),
    gclid:  getCookie('_gclid'),
    gbraid: getCookie('_gbraid'),
    wbraid: getCookie('_wbraid'),
  };
}

// =============================================
// CONSENT
// =============================================

/**
 * Check if the user has granted tracking consent.
 * Reads the _sf_consent cookie set by the LGPD banner.
 */
export function hasTrackingConsent(): boolean {
  const consent = getCookie('_sf_consent');
  // If no cookie exists, default to true (no consent mode active)
  // The MarketingTrackerProvider checks consent_mode_enabled separately
  if (consent === null) return true;
  return consent === 'granted' || consent === '1' || consent === 'true';
}

// =============================================
// COMBINED IDENTITY FOR CAPI
// =============================================

export interface TrackingIdentity {
  external_id: string | null; // _sf_vid
  fbp: string | null;
  fbc: string | null;
}

/**
 * Get the full tracking identity for CAPI events.
 */
export function getTrackingIdentity(): TrackingIdentity {
  return {
    external_id: getVisitorId(),
    fbp: getFbp(),
    fbc: getFbc(),
  };
}
