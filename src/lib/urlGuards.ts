// =============================================
// URL GUARDS - Runtime protection for storefront URLs
// Detects and auto-normalizes invalid URLs in production
// =============================================

import { isPlatformSubdomain, isAppDomain, SAAS_CONFIG } from './canonicalDomainService';

export type ViolationType = 'hardcoded_store_url' | 'app_domain_link' | 'preview_in_public';

export interface UrlViolation {
  type: ViolationType;
  original: string;
  normalized?: string;
  host: string;
  path: string;
}

// Check if current host is a custom domain (not platform subdomain, not app domain)
export function isCustomDomain(): boolean {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  
  // Platform subdomain → NOT custom
  if (isPlatformSubdomain(hostname)) return false;
  
  // App domain → NOT custom
  if (isAppDomain(hostname)) return false;
  
  // Fallback origin → NOT custom
  try {
    const fallbackHost = new URL(SAAS_CONFIG.fallbackOrigin).hostname;
    if (hostname === fallbackHost) return false;
  } catch {}
  
  // Localhost → NOT custom
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  
  // Any other domain is custom
  return true;
}

export function getCurrentHost(): string {
  if (typeof window === 'undefined') return '';
  return window.location.hostname.toLowerCase().replace(/^www\./, '');
}

// Patterns that indicate URL violations
const STORE_PATH_PATTERN = /\/store\/[^/]+/i;
const APP_DOMAIN_PATTERN = /app\.comandocentral\.com\.br/i;
const PREVIEW_QUERY_PATTERN = /[?&]preview=1/i;

/**
 * Validate a URL and return violation if found
 */
export function validateStorefrontUrl(url: string): UrlViolation | null {
  const host = getCurrentHost();
  const isCustom = isCustomDomain();
  
  // In custom domain, /store/{slug} is a violation
  if (isCustom && STORE_PATH_PATTERN.test(url)) {
    return {
      type: 'hardcoded_store_url',
      original: url,
      host,
      path: url,
    };
  }
  
  // Links to app.comandocentral in public context are violations
  if (APP_DOMAIN_PATTERN.test(url)) {
    return {
      type: 'app_domain_link',
      original: url,
      host,
      path: url,
    };
  }
  
  // Preview query in public URL is a violation
  if (isCustom && PREVIEW_QUERY_PATTERN.test(url)) {
    return {
      type: 'preview_in_public',
      original: url,
      host,
      path: url,
    };
  }
  
  return null;
}

/**
 * Normalize a URL by removing /store/{slug} prefix for custom domains
 */
export function normalizeStorefrontUrl(url: string): { normalized: string; wasModified: boolean } {
  const isCustom = isCustomDomain();
  
  if (!isCustom) {
    return { normalized: url, wasModified: false };
  }
  
  let normalized = url;
  let wasModified = false;
  
  // Remove /store/{slug} prefix
  const storeMatch = url.match(/^\/store\/[^/]+(.*)$/);
  if (storeMatch) {
    normalized = storeMatch[1] || '/';
    wasModified = true;
  }
  
  // Remove preview query param
  if (PREVIEW_QUERY_PATTERN.test(normalized)) {
    normalized = normalized.replace(/([?&])preview=1(&|$)/, (_, p1, p2) => {
      return p2 === '&' ? p1 : '';
    });
    // Clean up trailing ? or &
    normalized = normalized.replace(/[?&]$/, '');
    wasModified = true;
  }
  
  return { normalized, wasModified };
}

/**
 * Assert URL is valid, throw if not (for development)
 */
export function assertValidStorefrontUrl(url: string, context?: string): void {
  const violation = validateStorefrontUrl(url);
  
  if (violation) {
    const message = `[URL Guard] Invalid storefront URL detected${context ? ` in ${context}` : ''}: "${url}" (${violation.type})`;
    
    if (import.meta.env.DEV) {
      console.error(message);
      console.trace('URL Guard violation trace');
    } else {
      // In production, log but don't throw
      console.warn(message);
    }
  }
}

// Violation reporting (for telemetry)
type ViolationReporter = (violation: UrlViolation & { tenantId?: string }) => void;

let violationReporter: ViolationReporter | null = null;

export function setViolationReporter(reporter: ViolationReporter): void {
  violationReporter = reporter;
}

export function reportViolation(violation: UrlViolation, tenantId?: string): void {
  if (violationReporter) {
    violationReporter({ ...violation, tenantId });
  }
  
  // Always log in console
  console.warn('[URL Guard] Violation reported:', violation);
}

/**
 * Safe navigate wrapper - validates and normalizes URL before navigation
 */
export function safeNavigate(
  navigate: (path: string) => void,
  url: string,
  context?: string
): void {
  const violation = validateStorefrontUrl(url);
  
  if (violation) {
    // Log violation
    reportViolation(violation);
    
    // Try to normalize
    const { normalized, wasModified } = normalizeStorefrontUrl(url);
    
    if (wasModified) {
      console.info(`[URL Guard] Auto-corrected URL: "${url}" → "${normalized}"`);
      navigate(normalized);
      return;
    }
    
    // If we can't normalize, still navigate but warn
    console.warn(`[URL Guard] Could not normalize URL: "${url}"`);
  }
  
  navigate(url);
}

/**
 * Safe Link href - validates and returns normalized URL
 */
export function getSafeLinkHref(url: string): string {
  const violation = validateStorefrontUrl(url);
  
  if (violation) {
    reportViolation(violation);
    
    const { normalized, wasModified } = normalizeStorefrontUrl(url);
    
    if (wasModified) {
      console.info(`[URL Guard] Auto-corrected link href: "${url}" → "${normalized}"`);
      return normalized;
    }
  }
  
  return url;
}
