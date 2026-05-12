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
 * v8.32.0 — Resolve effective _fbp using the canonical priority order:
 *   1. `window.__sfFbp` global injected by storefront-html (synthetic seed)
 *   2. `_fbp` cookie (set by Meta Pixel script or by storefront-html cookie)
 *   3. null
 *
 * This is a READ-ONLY helper. It never generates a new _fbp value, so it
 * cannot create concurrent ids, and it never overwrites an existing
 * _fbp cookie. Safe to call on every CAPI dispatch.
 */
export function getEffectiveFbp(): string | null {
  if (typeof window !== 'undefined') {
    const seed = (window as any).__sfFbp;
    if (typeof seed === 'string' && seed.length > 0) return seed;
  }
  return getFbp();
}

/**
 * v8.33.0 — Client-side seed of `_fbp` for SPA-only routes (parity with
 * the edge `_sfEnsureFbp`). Mirrors the synthesis logic of `storefront-html`
 * so any route mounted purely client-side (e.g. `/thank-you` reached after
 * a payment-gateway redirect) still has a `_fbp` available before the first
 * CAPI dispatch.
 *
 * Behavior:
 *   1. If `window.__sfFbp` already seeded by edge → no-op.
 *   2. If `_fbp` cookie already exists → mirror to `window.__sfFbp` and exit.
 *   3. Otherwise synthesize `fb.1.<ms>.<10-digit-rand>` (Meta canonical),
 *      persist as cookie (90d, Path=/, SameSite=Lax) and expose on window.
 *      The Meta Pixel script (`fbq('init')`) respects an existing `_fbp`
 *      cookie — no concurrent IDs are created.
 *
 * Idempotent and safe to call multiple times per session.
 */
export function ensureFbp(): string | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;

  const existingSeed = (window as any).__sfFbp;
  if (typeof existingSeed === 'string' && existingSeed.length > 0) return existingSeed;

  const cookieFbp = getCookie('_fbp');
  if (cookieFbp) {
    (window as any).__sfFbp = cookieFbp;
    return cookieFbp;
  }

  // Synthesize: fb.1.<ms>.<10-digit-random>  (Meta canonical format)
  const rand = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
  const synthetic = `fb.1.${Date.now()}.${rand}`;
  setCookie('_fbp', synthetic, 90);
  (window as any).__sfFbp = synthetic;
  return synthetic;
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
    fbp: getEffectiveFbp(),
    fbc: getFbc(),
  };
}

// =============================================
// v8.28.0 — PERSISTENT IDENTITY VAULT (`_sf_identity`)
// =============================================
// Accumulates SHA-256 hashed PII across the funnel so any event after
// the user provides a piece of data can enrich its CAPI payload —
// without ever persisting plaintext PII in the browser.
//
// Storage: localStorage `_sf_identity` (JSON).
// TTL: 30 days (refreshed on every write).
// Merge: non-destructive — existing fields are never erased; only updated
// when a new (different) hash arrives.
// =============================================

const IDENTITY_STORAGE_KEY = '_sf_identity';
const IDENTITY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface StoredIdentity {
  em_hash?: string;
  ph_hash?: string;
  fn_hash?: string;
  ln_hash?: string;
  ct_hash?: string;
  st_hash?: string;
  zp_hash?: string;
  country_hash?: string;
  /** SHA-256 of date_of_birth in YYYYMMDD (Meta `db`) */
  db_hash?: string;
  /** SHA-256 of gender single char `m`/`f` (Meta `ge`) */
  ge_hash?: string;
  /** Server-correlatable lead identifier (UUID, plaintext) */
  lead_id?: string;
  /** Logged-in customer id (plaintext UUID) — enriches `external_id` array */
  customer_id?: string;
  updated_at?: number;
}

export interface StoreIdentityInput {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  /** Full name — split into firstName/lastName by first whitespace if firstName not provided */
  name?: string;
  city?: string;
  /** UF (2-letter) */
  state?: string;
  /** CEP (digits only or formatted — sanitized to digits before hashing) */
  zip?: string;
  country?: string;
  /** Birth date — accepts ISO `YYYY-MM-DD`; converted to `YYYYMMDD` before hashing */
  birthDate?: string;
  /** Gender — `m`/`f`/`male`/`female`; normalized to single char */
  gender?: string;
  /** Lead UUID — stored plaintext (server correlation) */
  leadId?: string;
  /** Customer UUID — stored plaintext for external_id enrichment */
  customerId?: string;
}

async function sha256Lower(value: string): Promise<string | null> {
  try {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const normalized = value.toLowerCase().trim();
    if (!normalized) return null;
    const data = new TextEncoder().encode(normalized);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

function normalizePhoneBR(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

function readIdentityRaw(): StoredIdentity {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredIdentity;
    // TTL check
    if (parsed.updated_at && Date.now() - parsed.updated_at > IDENTITY_TTL_MS) {
      localStorage.removeItem(IDENTITY_STORAGE_KEY);
      return {};
    }
    return parsed || {};
  } catch {
    return {};
  }
}

function writeIdentity(identity: StoredIdentity): void {
  if (typeof localStorage === 'undefined') return;
  try {
    identity.updated_at = Date.now();
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {}
}

/**
 * Read the stored identity (already hashed). Returns only fields that exist.
 * Does NOT include `updated_at` in the returned object.
 */
export function getStoredIdentity(): StoredIdentity {
  const raw = readIdentityRaw();
  const out: StoredIdentity = {};
  if (raw.em_hash) out.em_hash = raw.em_hash;
  if (raw.ph_hash) out.ph_hash = raw.ph_hash;
  if (raw.fn_hash) out.fn_hash = raw.fn_hash;
  if (raw.ln_hash) out.ln_hash = raw.ln_hash;
  if (raw.ct_hash) out.ct_hash = raw.ct_hash;
  if (raw.st_hash) out.st_hash = raw.st_hash;
  if (raw.zp_hash) out.zp_hash = raw.zp_hash;
  if (raw.country_hash) out.country_hash = raw.country_hash;
  if (raw.db_hash) out.db_hash = raw.db_hash;
  if (raw.ge_hash) out.ge_hash = raw.ge_hash;
  if (raw.lead_id) out.lead_id = raw.lead_id;
  if (raw.customer_id) out.customer_id = raw.customer_id;
  return out;
}

/**
 * Persist hashed PII into the cofre. Non-destructive merge:
 * - Receives plaintext PII; hashes locally with SHA-256 (lowercased+trimmed).
 * - Existing fields are never erased — only overwritten when a NEW hash arrives.
 * - Also mirrors `em_hash`/`ph_hash` into legacy `_sf_am_em`/`_sf_am_ph`
 *   so the Edge HTML inline `_sfGetAM` continues to work unchanged.
 */
export async function storeIdentity(input: StoreIdentityInput): Promise<void> {
  if (typeof localStorage === 'undefined') return;

  // Resolve firstName / lastName (allow `name` shortcut).
  let firstName = input.firstName?.trim() || undefined;
  let lastName = input.lastName?.trim() || undefined;
  if ((!firstName || !lastName) && input.name) {
    const parts = input.name.trim().split(/\s+/);
    if (!firstName) firstName = parts[0];
    if (!lastName && parts.length > 1) lastName = parts.slice(1).join(' ');
  }

  const current = readIdentityRaw();
  const next: StoredIdentity = { ...current };

  if (input.email) {
    const h = await sha256Lower(input.email);
    if (h) next.em_hash = h;
  }
  if (input.phone) {
    const normalized = normalizePhoneBR(input.phone);
    if (normalized) {
      const h = await sha256Lower(normalized);
      if (h) next.ph_hash = h;
    }
  }
  if (firstName) {
    const h = await sha256Lower(firstName);
    if (h) next.fn_hash = h;
  }
  if (lastName) {
    const h = await sha256Lower(lastName);
    if (h) next.ln_hash = h;
  }
  if (input.city) {
    const h = await sha256Lower(input.city);
    if (h) next.ct_hash = h;
  }
  if (input.state) {
    const h = await sha256Lower(input.state);
    if (h) next.st_hash = h;
  }
  if (input.zip) {
    const digits = input.zip.replace(/\D/g, '');
    if (digits) {
      const h = await sha256Lower(digits);
      if (h) next.zp_hash = h;
    }
  }
  if (input.country) {
    const h = await sha256Lower(input.country);
    if (h) next.country_hash = h;
  }
  if (input.birthDate) {
    // Accept YYYY-MM-DD or YYYYMMDD; output YYYYMMDD for Meta `db`
    const digits = input.birthDate.replace(/\D/g, '');
    if (digits.length === 8) {
      const h = await sha256Lower(digits);
      if (h) next.db_hash = h;
    }
  }
  if (input.gender) {
    const v = input.gender.trim().toLowerCase();
    let g: 'm' | 'f' | null = null;
    if (v.startsWith('m')) g = 'm';
    else if (v.startsWith('f')) g = 'f';
    if (g) {
      const h = await sha256Lower(g);
      if (h) next.ge_hash = h;
    }
  }
  if (input.leadId) next.lead_id = input.leadId;
  if (input.customerId) next.customer_id = input.customerId;

  writeIdentity(next);

  // Legacy compat: keep _sf_am_em / _sf_am_ph in sync so Edge HTML inline
  // `_sfGetAM` (which only reads those keys today) keeps enriching events
  // even from cached HTML rendered before v8.28.0.
  try {
    if (next.em_hash) localStorage.setItem('_sf_am_em', next.em_hash);
    if (next.ph_hash) localStorage.setItem('_sf_am_ph', next.ph_hash);
  } catch {}
}

/**
 * Hash a single value with SHA-256 (lowercased+trimmed). Public helper for
 * callers that need to hash PII outside the cofre (e.g., advanced matching
 * passed to `fbq('init', ...)`).
 */
export async function hashIdentityValue(value: string): Promise<string | null> {
  return sha256Lower(value);
}