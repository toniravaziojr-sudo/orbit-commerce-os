import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cloudflare API configuration
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';
const SAAS_DOMAIN = 'comandocentral.com.br';
const SAAS_STOREFRONT_SUBDOMAIN = 'shops';
const TARGET_HOSTNAME = `${SAAS_STOREFRONT_SUBDOMAIN}.${SAAS_DOMAIN}`;

interface ProvisionDefaultRequest {
  tenant_id: string;
  tenant_slug: string;
}

interface CloudflareCustomHostname {
  id: string;
  hostname: string;
  ssl: {
    status: string;
    validation_errors?: Array<{ message: string }>;
  };
  status: string;
}

async function createCustomHostname(
  zoneId: string,
  apiToken: string,
  hostname: string
): Promise<{ success: boolean; data?: CloudflareCustomHostname; error?: string }> {
  console.log(`[CF] Creating custom hostname: ${hostname}`);
  
  try {
    const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/custom_hostnames`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'http',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
          },
        },
        custom_origin_server: TARGET_HOSTNAME,
      }),
    });

    const result = await response.json();
    console.log(`[CF] Create response:`, JSON.stringify(result));

    if (!result.success) {
      const errorMsg = result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      
      // Check if hostname already exists
      if (errorMsg.includes('already exists')) {
        console.log(`[CF] Hostname already exists, treating as success`);
        return { success: true, data: { id: 'existing', hostname, ssl: { status: 'pending' }, status: 'active' } };
      }
      
      return { success: false, error: errorMsg };
    }

    return { success: true, data: result.result };
  } catch (error) {
    console.error(`[CF] Error creating custom hostname:`, error);
    return { success: false, error: (error as Error).message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, tenant_slug } = await req.json() as ProvisionDefaultRequest;
    console.log(`[domains-provision-default] Provisioning default hostname for tenant: ${tenant_slug}`);

    // Validate required params
    if (!tenant_id || !tenant_slug) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: tenant_id, tenant_slug' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Cloudflare credentials from secrets
    const cfApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cfZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
    
    if (!cfApiToken || !cfZoneId) {
      console.error('[domains-provision-default] Missing Cloudflare credentials');
      return new Response(
        JSON.stringify({ 
          error: 'Cloudflare credentials not configured', 
          instructions: 'Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build the default hostname
    const hostname = `${tenant_slug}.${SAAS_STOREFRONT_SUBDOMAIN}.${SAAS_DOMAIN}`;
    console.log(`[domains-provision-default] Hostname: ${hostname}`);

    // Check if domain already exists for this tenant
    const { data: existingDomain } = await supabase
      .from('tenant_domains')
      .select('id, status, ssl_status, external_id')
      .eq('tenant_id', tenant_id)
      .eq('domain', hostname)
      .eq('type', 'platform_subdomain')
      .single();

    if (existingDomain) {
      console.log(`[domains-provision-default] Domain already exists: ${existingDomain.id}`);
      
      // If already provisioned with SSL, return success
      if (existingDomain.ssl_status === 'active') {
        return new Response(
          JSON.stringify({ 
            success: true, 
            domain_id: existingDomain.id,
            hostname,
            ssl_status: 'active',
            message: 'Domain already provisioned'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create Custom Hostname in Cloudflare
    const cfResult = await createCustomHostname(cfZoneId, cfApiToken, hostname);

    if (!cfResult.success) {
      console.error(`[domains-provision-default] Cloudflare error: ${cfResult.error}`);
      
      // Still create/update the domain record with error status
      if (!existingDomain) {
        await supabase
          .from('tenant_domains')
          .insert({
            tenant_id,
            domain: hostname,
            type: 'platform_subdomain',
            status: 'verified', // Platform subdomains are auto-verified
            ssl_status: 'failed',
            is_primary: false,
            verification_token: 'platform-auto',
            target_hostname: TARGET_HOSTNAME,
            last_error: cfResult.error,
          });
      } else {
        await supabase
          .from('tenant_domains')
          .update({
            ssl_status: 'failed',
            last_error: cfResult.error,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', existingDomain.id);
      }

      return new Response(
        JSON.stringify({ error: cfResult.error, ssl_status: 'failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine SSL status
    const sslStatus = cfResult.data?.ssl?.status === 'active' ? 'active' : 'pending';

    // Create or update the domain record
    let domainId: string;
    
    if (existingDomain) {
      await supabase
        .from('tenant_domains')
        .update({
          external_id: cfResult.data?.id !== 'existing' ? cfResult.data?.id : existingDomain.external_id,
          ssl_status: sslStatus,
          last_error: null,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', existingDomain.id);
      
      domainId = existingDomain.id;
    } else {
      const { data: newDomain, error: insertError } = await supabase
        .from('tenant_domains')
        .insert({
          tenant_id,
          domain: hostname,
          type: 'platform_subdomain',
          status: 'verified', // Platform subdomains are auto-verified
          ssl_status: sslStatus,
          is_primary: false, // User can set primary later
          verification_token: 'platform-auto',
          target_hostname: TARGET_HOSTNAME,
          external_id: cfResult.data?.id !== 'existing' ? cfResult.data?.id : null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error(`[domains-provision-default] Insert error:`, insertError);
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      domainId = newDomain.id;
    }

    console.log(`[domains-provision-default] Provisioned successfully: ${hostname}, ssl_status: ${sslStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        domain_id: domainId,
        hostname,
        ssl_status: sslStatus,
        external_id: cfResult.data?.id,
        message: sslStatus === 'active' ? 'SSL is active' : 'SSL provisioning in progress (may take a few minutes)'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[domains-provision-default] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
