// ============================================
// SHARED TENANT RESOLUTION UTILITY
// Single source of truth for resolving tenant from hostname
// Used by: resolve-domain, storefront-bootstrap
// ============================================

import { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// SaaS platform configuration
const SAAS_DOMAIN = Deno.env.get('SAAS_DOMAIN') || 'comandocentral.com.br';
const SAAS_STOREFRONT_SUBDOMAIN = 'shops';
const SAAS_APP_SUBDOMAIN = 'app';

export interface ResolvedTenant {
  found: true;
  tenant_slug: string;
  tenant_id: string;
  domain: string;
  domain_type: 'platform_subdomain' | 'custom';
  canonical_origin: string;
  primary_public_host: string;
  is_primary: boolean;
  has_custom_primary: boolean;
}

export interface ResolveNotFound {
  found: false;
  error?: string;
}

export type ResolveResult = ResolvedTenant | ResolveNotFound;

/**
 * Parse platform subdomain to extract tenant slug
 * Pattern: tenantSlug.shops.comandocentral.com.br
 */
export function parsePlatformSubdomain(hostname: string): string | null {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');
  const platformPattern = new RegExp(
    `^([a-z0-9-]+)\\.${SAAS_STOREFRONT_SUBDOMAIN}\\.${SAAS_DOMAIN.replace(/\./g, '\\.')}$`
  );
  const match = normalizedHostname.match(platformPattern);
  return match ? match[1] : null;
}

/**
 * Check if hostname is the app/admin domain
 */
export function isAppDomain(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');
  return normalizedHostname === `${SAAS_APP_SUBDOMAIN}.${SAAS_DOMAIN}` ||
         normalizedHostname === 'orbit-commerce-os.lovable.app';
}

/**
 * Resolve tenant from hostname using Supabase client
 * This is the single source of truth for domain → tenant resolution
 */
export async function resolveTenantFromHostname(
  supabase: SupabaseClient,
  hostname: string
): Promise<ResolveResult> {
  const normalizedHostname = hostname.toLowerCase().trim();
  const hostnameWithoutWww = normalizedHostname.replace(/^www\./, '');
  const hostnameWithWww = hostnameWithoutWww.startsWith('www.') 
    ? hostnameWithoutWww 
    : `www.${hostnameWithoutWww}`;

  console.log(`[resolveTenant] Looking up: ${normalizedHostname}`);

  // Check app domain
  if (isAppDomain(hostnameWithoutWww)) {
    return { found: false, error: 'App domain - not a storefront' };
  }

  // Check platform subdomain
  const platformTenantSlug = parsePlatformSubdomain(hostnameWithoutWww);
  if (platformTenantSlug) {
    console.log(`[resolveTenant] Platform subdomain: ${platformTenantSlug}`);

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, slug')
      .eq('slug', platformTenantSlug)
      .single();

    if (!tenant) {
      return { found: false };
    }

    // Check for primary custom domain
    const { data: primaryDomain } = await supabase
      .from('tenant_domains')
      .select('domain')
      .eq('tenant_id', tenant.id)
      .eq('type', 'custom')
      .eq('status', 'verified')
      .eq('ssl_status', 'active')
      .eq('is_primary', true)
      .single();

    const hasCustomPrimary = !!primaryDomain;
    const primaryPublicHost = hasCustomPrimary
      ? primaryDomain.domain
      : `${platformTenantSlug}.${SAAS_STOREFRONT_SUBDOMAIN}.${SAAS_DOMAIN}`;

    return {
      found: true,
      tenant_slug: platformTenantSlug,
      tenant_id: tenant.id,
      domain: hostnameWithoutWww,
      domain_type: 'platform_subdomain',
      canonical_origin: `https://${primaryPublicHost}`,
      primary_public_host: primaryPublicHost,
      is_primary: !hasCustomPrimary,
      has_custom_primary: hasCustomPrimary,
    };
  }

  // Custom domain lookup — try exact, without www, and with www
  const { data: domains, error } = await supabase
    .from('tenant_domains')
    .select(`
      id, domain, tenant_id, status, ssl_status, is_primary, type,
      tenants!inner(slug)
    `)
    .or(`domain.eq.${normalizedHostname},domain.eq.${hostnameWithoutWww},domain.eq.${hostnameWithWww}`)
    .eq('status', 'verified')
    .eq('ssl_status', 'active')
    .eq('type', 'custom')
    .limit(1);

  if (error) {
    console.error('[resolveTenant] Database error:', error);
    return { found: false, error: 'Database error' };
  }

  if (!domains || domains.length === 0) {
    return { found: false };
  }

  const domainRow = domains[0];
  const tenantSlug = (domainRow.tenants as any)?.slug;

  if (!tenantSlug) {
    return { found: false, error: 'Tenant not found' };
  }

  // Determine primary host
  let primaryPublicHost = domainRow.domain;
  if (!domainRow.is_primary) {
    const { data: primaryDomain } = await supabase
      .from('tenant_domains')
      .select('domain')
      .eq('tenant_id', domainRow.tenant_id)
      .eq('type', 'custom')
      .eq('status', 'verified')
      .eq('ssl_status', 'active')
      .eq('is_primary', true)
      .single();

    if (primaryDomain) {
      primaryPublicHost = primaryDomain.domain;
    }
  }

  return {
    found: true,
    tenant_slug: tenantSlug,
    tenant_id: domainRow.tenant_id,
    domain: domainRow.domain,
    domain_type: 'custom',
    canonical_origin: `https://${primaryPublicHost}`,
    primary_public_host: primaryPublicHost,
    is_primary: domainRow.is_primary,
    has_custom_primary: true,
  };
}
