import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=60', // Cache for 1 minute
};

interface ResolveRequest {
  hostname: string;
}

interface ResolveResponse {
  found: boolean;
  tenant_slug?: string;
  tenant_id?: string;
  domain?: string;
  domain_type?: 'platform_subdomain' | 'custom';
  canonical_origin?: string;
  is_primary?: boolean;
  error?: string;
}

// SaaS platform configuration
const SAAS_DOMAIN = Deno.env.get('SAAS_DOMAIN') || 'comandocentral.com.br';
const SAAS_STOREFRONT_SUBDOMAIN = 'shops';
const SAAS_APP_SUBDOMAIN = 'app';
const TARGET_HOSTNAME = 'shops.comandocentral.com.br';
const PUBLIC_APP_ORIGIN = Deno.env.get('PUBLIC_APP_ORIGIN') || 'https://orbit-commerce-os.lovable.app';

// Check if hostname is a platform subdomain (tenantSlug.shops.domain)
function parsePlatformSubdomain(hostname: string): string | null {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');
  
  // Pattern: tenantSlug.shops.respeiteohomem.com.br
  const platformPattern = new RegExp(
    `^([a-z0-9-]+)\\.${SAAS_STOREFRONT_SUBDOMAIN}\\.${SAAS_DOMAIN.replace(/\./g, '\\.')}$`
  );
  
  const match = normalizedHostname.match(platformPattern);
  if (match) {
    return match[1]; // Return the tenant slug
  }
  
  return null;
}

// Check if hostname is the app/admin domain
function isAppDomain(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^www\./, '');
  return normalizedHostname === `${SAAS_APP_SUBDOMAIN}.${SAAS_DOMAIN}` ||
         normalizedHostname === 'orbit-commerce-os.lovable.app';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Support both GET (query param) and POST (body)
    let hostname: string | null = null;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      hostname = url.searchParams.get('hostname');
    } else {
      const body = await req.json() as ResolveRequest;
      hostname = body.hostname;
    }

    if (!hostname) {
      return new Response(
        JSON.stringify({ found: false, error: 'Missing hostname parameter' } as ResolveResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize hostname (lowercase, remove www. prefix for lookup)
    const normalizedHostname = hostname.toLowerCase().trim();
    const hostnameWithoutWww = normalizedHostname.replace(/^www\./, '');
    
    console.log(`[resolve-domain] Looking up: ${normalizedHostname} (without www: ${hostnameWithoutWww})`);

    // Check if this is the app domain (admin panel)
    if (isAppDomain(hostnameWithoutWww)) {
      console.log(`[resolve-domain] App domain detected, not a storefront`);
      return new Response(
        JSON.stringify({ found: false, error: 'App domain - not a storefront' } as ResolveResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a platform subdomain (tenantSlug.shops.domain)
    const platformTenantSlug = parsePlatformSubdomain(hostnameWithoutWww);
    if (platformTenantSlug) {
      console.log(`[resolve-domain] Platform subdomain detected: ${platformTenantSlug}`);
      
      // Verify tenant exists
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, slug')
        .eq('slug', platformTenantSlug)
        .single();
      
      if (!tenant) {
        console.log(`[resolve-domain] Tenant not found for slug: ${platformTenantSlug}`);
        return new Response(
          JSON.stringify({ found: false } as ResolveResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Check if tenant has a primary custom domain - if so, that's the canonical
      const { data: primaryDomain } = await supabase
        .from('tenant_domains')
        .select('domain')
        .eq('tenant_id', tenant.id)
        .eq('type', 'custom')
        .eq('status', 'verified')
        .eq('ssl_status', 'active')
        .eq('is_primary', true)
        .single();
      
      const canonicalOrigin = primaryDomain 
        ? `https://${primaryDomain.domain}`
        : `https://${platformTenantSlug}.${SAAS_STOREFRONT_SUBDOMAIN}.${SAAS_DOMAIN}`;
      
      const response: ResolveResponse = {
        found: true,
        tenant_slug: platformTenantSlug,
        tenant_id: tenant.id,
        domain: hostnameWithoutWww,
        domain_type: 'platform_subdomain',
        canonical_origin: canonicalOrigin,
        is_primary: !primaryDomain, // Platform subdomain is primary only if no custom domain
      };
      
      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase with service role for unrestricted access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query for custom domain - try both with and without www
    const { data: domains, error } = await supabase
      .from('tenant_domains')
      .select(`
        id,
        domain,
        tenant_id,
        status,
        ssl_status,
        is_primary,
        type,
        tenants!inner(slug)
      `)
      .or(`domain.eq.${normalizedHostname},domain.eq.${hostnameWithoutWww}`)
      .eq('status', 'verified')
      .eq('ssl_status', 'active')
      .eq('type', 'custom')
      .limit(1);

    if (error) {
      console.error('[resolve-domain] Database error:', error);
      return new Response(
        JSON.stringify({ found: false, error: 'Database error' } as ResolveResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!domains || domains.length === 0) {
      console.log(`[resolve-domain] No matching domain found for: ${normalizedHostname}`);
      return new Response(
        JSON.stringify({ found: false } as ResolveResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const domain = domains[0];
    const tenantSlug = (domain.tenants as any)?.slug;

    if (!tenantSlug) {
      console.error('[resolve-domain] Tenant slug not found for domain:', domain.domain);
      return new Response(
        JSON.stringify({ found: false, error: 'Tenant not found' } as ResolveResponse),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[resolve-domain] Found custom domain: ${domain.domain} -> tenant: ${tenantSlug}`);

    // For custom domains, check if this is the primary or if there's another primary
    let canonicalOrigin = `https://${domain.domain}`;
    
    if (!domain.is_primary) {
      // Check if there's a primary custom domain
      const { data: primaryDomain } = await supabase
        .from('tenant_domains')
        .select('domain')
        .eq('tenant_id', domain.tenant_id)
        .eq('type', 'custom')
        .eq('status', 'verified')
        .eq('ssl_status', 'active')
        .eq('is_primary', true)
        .single();
      
      if (primaryDomain) {
        canonicalOrigin = `https://${primaryDomain.domain}`;
      }
    }

    const response: ResolveResponse = {
      found: true,
      tenant_slug: tenantSlug,
      tenant_id: domain.tenant_id,
      domain: domain.domain,
      domain_type: 'custom',
      canonical_origin: canonicalOrigin,
      is_primary: domain.is_primary,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[resolve-domain] Unexpected error:', error);
    return new Response(
      JSON.stringify({ found: false, error: (error as Error).message } as ResolveResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
