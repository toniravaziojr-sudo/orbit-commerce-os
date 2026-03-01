// =============================================
// URL GUARDS - Runtime protection for storefront URLs
// Detects and handles invalid URLs in production
// POLICY: "Domínio muda, tudo muda" - SEM REDIRECTS
// =============================================

import { isPlatformSubdomain, isAppDomain, SAAS_CONFIG } from './canonicalDomainService';
import { toast } from 'sonner';

export type ViolationType = 
  | 'hardcoded_store_url' 
  | 'app_domain_link' 
  | 'preview_in_public'
  | 'host_disabled'        // NEW: Access to disabled host when custom is active
  | 'wrong_public_origin'  // NEW: Link generated with wrong origin
  | 'content_hardcoded_url';
  
export type ViolationSeverity = 'critical' | 'warning' | 'info';

export interface UrlViolation {
  type: ViolationType;
  severity: ViolationSeverity;
  original: string;
  normalized?: string;
  host: string;
  path: string;
}

// Determine severity of violation
export function getViolationSeverity(type: ViolationType): ViolationSeverity {
  switch (type) {
    case 'app_domain_link':
    case 'hardcoded_store_url':
    case 'host_disabled':
      return 'critical';
    case 'preview_in_public':
    case 'wrong_public_origin':
      return 'warning';
    case 'content_hardcoded_url':
      return 'info';
    default:
      return 'warning';
  }
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
  
  // Preview/dev domains → NOT custom
  if (hostname.endsWith('.lovableproject.com')) return false;
  if (hostname.endsWith('.lovable.app')) return false;
  
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
 * Check if the current host is the canonical public host for this tenant
 * @param tenantSlug - The tenant's slug
 * @param customDomain - The verified custom domain (if any)
 */
export function isOnCanonicalPublicHost(tenantSlug: string, customDomain: string | null): boolean {
  if (typeof window === 'undefined') return true; // SSR safe
  
  const currentHost = getCurrentHost();
  
  // If custom domain is active (verified + ssl_active), that's the only canonical host
  if (customDomain) {
    const normalizedCustom = customDomain.toLowerCase().replace(/^www\./, '');
    return currentHost === normalizedCustom;
  }
  
  // Otherwise, platform subdomain is canonical
  const expectedHost = `${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}`;
  return currentHost === expectedHost;
}

/**
 * Check if current host is disabled (shops subdomain when custom is active)
 * Returns the canonical host that SHOULD be used, or null if current host is OK
 */
export function getHostDisabledInfo(tenantSlug: string, customDomain: string | null): { isDisabled: boolean; canonicalHost: string | null } {
  if (typeof window === 'undefined') return { isDisabled: false, canonicalHost: null };
  
  // If no custom domain, nothing is disabled
  if (!customDomain) {
    return { isDisabled: false, canonicalHost: null };
  }
  
  const currentHost = getCurrentHost();
  const normalizedCustom = customDomain.toLowerCase().replace(/^www\./, '');
  
  // Already on custom domain - all good
  if (currentHost === normalizedCustom) {
    return { isDisabled: false, canonicalHost: null };
  }
  
  // Check if on platform subdomain for this tenant
  const platformHost = `${tenantSlug}.${SAAS_CONFIG.storefrontSubdomain}.${SAAS_CONFIG.domain}`;
  
  if (currentHost === platformHost) {
    // Platform subdomain is DISABLED when custom is active
    return { isDisabled: true, canonicalHost: normalizedCustom };
  }
  
  // On some other host - could be a violation
  return { isDisabled: false, canonicalHost: null };
}

/**
 * Validate a URL and return violation if found
 */
export function validateStorefrontUrl(url: string): UrlViolation | null {
  const host = getCurrentHost();
  const isCustom = isCustomDomain();
  
  // Links to app.comandocentral in public context are CRITICAL violations
  if (APP_DOMAIN_PATTERN.test(url)) {
    return {
      type: 'app_domain_link',
      severity: 'critical',
      original: url,
      host,
      path: url,
    };
  }
  
  // In custom domain, /store/{slug} is a CRITICAL violation
  if (isCustom && STORE_PATH_PATTERN.test(url)) {
    return {
      type: 'hardcoded_store_url',
      severity: 'critical',
      original: url,
      host,
      path: url,
    };
  }
  
  // Preview query in public URL is a WARNING violation (can be auto-fixed)
  if (isCustom && PREVIEW_QUERY_PATTERN.test(url)) {
    return {
      type: 'preview_in_public',
      severity: 'warning',
      original: url,
      host,
      path: url,
    };
  }
  
  return null;
}

/**
 * Normalize a URL by removing /store/{slug} prefix for custom domains
 * ONLY for warning-level violations (preview query)
 * Critical violations should NOT be normalized - they should fail-safe
 */
export function normalizeStorefrontUrl(url: string, allowCritical = false): { normalized: string; wasModified: boolean; blocked: boolean } {
  const violation = validateStorefrontUrl(url);
  
  if (!violation) {
    return { normalized: url, wasModified: false, blocked: false };
  }
  
  // Critical violations: block by default unless explicitly allowed
  if (violation.severity === 'critical' && !allowCritical) {
    return { normalized: url, wasModified: false, blocked: true };
  }
  
  let normalized = url;
  let wasModified = false;
  
  // Remove /store/{slug} prefix (only if allowCritical=true)
  if (allowCritical) {
    const storeMatch = url.match(/^\/store\/[^/]+(.*)$/);
    if (storeMatch) {
      normalized = storeMatch[1] || '/';
      wasModified = true;
    }
  }
  
  // Remove preview query param (safe to do)
  if (PREVIEW_QUERY_PATTERN.test(normalized)) {
    normalized = normalized.replace(/([?&])preview=1(&|$)/, (_, p1, p2) => {
      return p2 === '&' ? p1 : '';
    });
    // Clean up trailing ? or &
    normalized = normalized.replace(/[?&]$/, '');
    wasModified = true;
  }
  
  return { normalized, wasModified, blocked: false };
}

/**
 * Assert URL is valid, throw if not (for development)
 */
export function assertValidStorefrontUrl(url: string, context?: string): void {
  const violation = validateStorefrontUrl(url);
  
  if (violation) {
    const message = `[URL Guard] Invalid storefront URL detected${context ? ` in ${context}` : ''}: "${url}" (${violation.type}, severity: ${violation.severity})`;
    
    if (import.meta.env.DEV) {
      console.error(message);
      console.trace('URL Guard violation trace');
    } else {
      // In production, log but don't throw
      console.warn(message);
    }
  }
}

// Violation reporting (via Edge Function for telemetry)
let isReporting = false;

export async function reportViolationToServer(violation: UrlViolation, tenantId?: string): Promise<void> {
  // Debounce/dedupe: only report once per session per violation
  const key = `violation-${violation.type}-${violation.path}`;
  if (typeof sessionStorage !== 'undefined') {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  }
  
  if (isReporting) return;
  isReporting = true;
  
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return;
    
    await fetch(`${supabaseUrl}/functions/v1/report-runtime-violation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_host: violation.host,
        violation_type: violation.type,
        path: violation.path,
        details: {
          severity: violation.severity,
          original: violation.original,
          tenant_id: tenantId,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          timestamp: new Date().toISOString()
        }
      })
    });
  } catch (e) {
    console.warn('[URL Guard] Failed to report violation:', e);
  } finally {
    isReporting = false;
  }
}

export function reportViolation(violation: UrlViolation, tenantId?: string): void {
  // Always log in console
  console.warn('[URL Guard] Violation detected:', violation);
  
  // Report to server (async, non-blocking)
  reportViolationToServer(violation, tenantId);
}

/**
 * Safe navigate wrapper - validates URL and handles violations
 * FAIL-SAFE: Critical violations redirect to home with toast
 */
export function safeNavigate(
  navigate: (path: string) => void,
  url: string,
  homeUrl: string = '/',
  context?: string
): void {
  const violation = validateStorefrontUrl(url);
  
  if (violation) {
    // Report violation
    reportViolation(violation);
    
    if (violation.severity === 'critical') {
      // FAIL-SAFE: Do not navigate to broken URL
      console.error(`[URL Guard] BLOCKED critical navigation to "${url}" - redirecting to home`);
      toast.error('Link inválido detectado', {
        description: 'Você foi redirecionado para a página inicial.',
        duration: 4000
      });
      navigate(homeUrl);
      return;
    }
    
    // Warning-level: try to normalize
    const { normalized, wasModified } = normalizeStorefrontUrl(url);
    
    if (wasModified) {
      console.info(`[URL Guard] Auto-corrected URL: "${url}" → "${normalized}"`);
      navigate(normalized);
      return;
    }
  }
  
  navigate(url);
}

/**
 * Safe Link href - validates and returns safe URL
 * FAIL-SAFE: Critical violations return home URL
 */
export function getSafeLinkHref(url: string, homeUrl: string = '/'): string {
  const violation = validateStorefrontUrl(url);
  
  if (violation) {
    reportViolation(violation);
    
    if (violation.severity === 'critical') {
      // FAIL-SAFE: Return home instead of broken URL
      console.error(`[URL Guard] BLOCKED critical link href "${url}" - returning home`);
      return homeUrl;
    }
    
    const { normalized, wasModified } = normalizeStorefrontUrl(url);
    
    if (wasModified) {
      console.info(`[URL Guard] Auto-corrected link href: "${url}" → "${normalized}"`);
      return normalized;
    }
  }
  
  return url;
}

/**
 * Check if a URL should be blocked (critical violation)
 */
export function shouldBlockNavigation(url: string): boolean {
  const violation = validateStorefrontUrl(url);
  return violation?.severity === 'critical';
}

/**
 * Check if current host is a tenant host (custom domain or platform subdomain)
 */
export function isOnTenantHost(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname.toLowerCase().replace(/^www\./, '');
  
  // Platform subdomain is a tenant host
  if (isPlatformSubdomain(hostname)) return true;
  
  // Custom domain is a tenant host
  if (isCustomDomain()) return true;
  
  return false;
}

// =============================================
// CONTENT SCANNING (for stored content)
// =============================================

/**
 * Scan a string for URL violations (useful for stored content)
 */
export function scanContentForViolations(content: string): UrlViolation[] {
  const violations: UrlViolation[] = [];
  const host = getCurrentHost();
  
  // Check for /store/ patterns
  const storeMatches = content.match(/\/store\/[a-z0-9_-]+/gi);
  if (storeMatches) {
    for (const match of new Set(storeMatches)) {
      violations.push({
        type: 'content_hardcoded_url',
        severity: 'info',
        original: match,
        host,
        path: 'stored_content',
      });
    }
  }
  
  // Check for app domain
  const appMatches = content.match(/https?:\/\/app\.comandocentral\.com\.br[^\s"']*/gi);
  if (appMatches) {
    for (const match of new Set(appMatches)) {
      violations.push({
        type: 'app_domain_link',
        severity: 'critical',
        original: match,
        host,
        path: 'stored_content',
      });
    }
  }
  
  // Check for preview params
  const previewMatches = content.match(/[?&]preview=1/gi);
  if (previewMatches) {
    violations.push({
      type: 'preview_in_public',
      severity: 'warning',
      original: 'preview=1',
      host,
      path: 'stored_content',
    });
  }
  
  return violations;
}
