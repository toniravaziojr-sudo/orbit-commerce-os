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
  error?: string;
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

    // Initialize Supabase with service role for unrestricted access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query for the domain - try both with and without www
    const { data: domains, error } = await supabase
      .from('tenant_domains')
      .select(`
        id,
        domain,
        tenant_id,
        status,
        ssl_status,
        is_primary,
        tenants!inner(slug)
      `)
      .or(`domain.eq.${normalizedHostname},domain.eq.${hostnameWithoutWww}`)
      .eq('status', 'verified')
      .eq('ssl_status', 'active')
      .eq('is_primary', true)
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

    console.log(`[resolve-domain] Found: ${domain.domain} -> tenant: ${tenantSlug}`);

    const response: ResolveResponse = {
      found: true,
      tenant_slug: tenantSlug,
      tenant_id: domain.tenant_id,
      domain: domain.domain,
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
