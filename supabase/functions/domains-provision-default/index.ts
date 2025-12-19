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

// Fetch existing custom hostname from Cloudflare by hostname
async function getExistingCustomHostname(
  zoneId: string,
  apiToken: string,
  hostname: string
): Promise<CloudflareCustomHostname | null> {
  console.log(`[CF] Searching for existing hostname: ${hostname}`);
  
  try {
    const response = await fetch(
      `${CF_API_BASE}/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const result = await response.json();
    console.log(`[CF] Search response:`, JSON.stringify(result));

    if (result.success && result.result && result.result.length > 0) {
      const existing = result.result[0];
      console.log(`[CF] Found existing hostname: ${existing.id}, ssl_status: ${existing.ssl?.status}, status: ${existing.status}`);
      return existing;
    }

    return null;
  } catch (error) {
    console.error(`[CF] Error searching for existing hostname:`, error);
    return null;
  }
}

async function createCustomHostname(
  zoneId: string,
  apiToken: string,
  hostname: string
): Promise<{ success: boolean; data?: CloudflareCustomHostname; error?: string; isDuplicate?: boolean }> {
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
    console.log(`[CF] Create response status: ${response.status}`);
    console.log(`[CF] Create response body:`, JSON.stringify(result));

    if (!result.success) {
      const errorMsg = result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      
      // Check if hostname already exists (409 Conflict or specific error message)
      if (errorMsg.toLowerCase().includes('already exists') || 
          errorMsg.toLowerCase().includes('duplicate') ||
          response.status === 409) {
        console.log(`[CF] Hostname already exists, will fetch existing data`);
        return { success: false, error: errorMsg, isDuplicate: true };
      }
      
      return { success: false, error: errorMsg, isDuplicate: false };
    }

    return { success: true, data: result.result };
  } catch (error) {
    console.error(`[CF] Error creating custom hostname:`, error);
    return { success: false, error: (error as Error).message, isDuplicate: false };
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

    // Check if domain already exists for this tenant in DB
    const { data: existingDomain } = await supabase
      .from('tenant_domains')
      .select('id, status, ssl_status, external_id')
      .eq('tenant_id', tenant_id)
      .eq('domain', hostname)
      .eq('type', 'platform_subdomain')
      .single();

    if (existingDomain) {
      console.log(`[domains-provision-default] Domain already exists in DB: ${existingDomain.id}`);
    }

    // Try to create Custom Hostname in Cloudflare
    let cfData: CloudflareCustomHostname | null = null;
    const cfResult = await createCustomHostname(cfZoneId, cfApiToken, hostname);

    if (cfResult.success && cfResult.data) {
      // Successfully created
      cfData = cfResult.data;
      console.log(`[domains-provision-default] Created new hostname: ${cfData.id}`);
    } else if (cfResult.isDuplicate) {
      // Hostname already exists in Cloudflare - fetch the existing one
      console.log(`[domains-provision-default] Duplicate detected, fetching existing hostname`);
      cfData = await getExistingCustomHostname(cfZoneId, cfApiToken, hostname);
      
      if (!cfData) {
        console.error(`[domains-provision-default] Could not fetch existing hostname after duplicate error`);
        return new Response(
          JSON.stringify({ 
            error: 'Hostname exists in Cloudflare but could not fetch details. Please check Cloudflare credentials and permissions.',
            ssl_status: 'failed' 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[domains-provision-default] Fetched existing hostname: ${cfData.id}, ssl: ${cfData.ssl?.status}`);
    } else {
      // Real error - not a duplicate
      console.error(`[domains-provision-default] Cloudflare error: ${cfResult.error}`);
      
      // Create/update the domain record with error status
      if (!existingDomain) {
        await supabase
          .from('tenant_domains')
          .insert({
            tenant_id,
            domain: hostname,
            type: 'platform_subdomain',
            status: 'verified',
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

    // We have cfData at this point (either created or fetched existing)
    // Determine SSL status from Cloudflare response
    const cfSslStatus = cfData.ssl?.status || 'pending';
    let sslStatus = 'pending';
    if (cfSslStatus === 'active') {
      sslStatus = 'active';
    } else if (cfSslStatus === 'pending_validation' || cfSslStatus === 'pending_issuance' || cfSslStatus === 'pending_deployment' || cfSslStatus === 'initializing') {
      sslStatus = 'pending';
    } else if (cfSslStatus === 'failed' || cfSslStatus === 'deleted') {
      sslStatus = 'failed';
    }

    console.log(`[domains-provision-default] Cloudflare SSL status: ${cfSslStatus} -> mapped to: ${sslStatus}`);

    // Create or update the domain record
    let domainId: string;
    
    if (existingDomain) {
      await supabase
        .from('tenant_domains')
        .update({
          external_id: cfData.id,
          ssl_status: sslStatus,
          last_error: null,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', existingDomain.id);
      
      domainId = existingDomain.id;
      console.log(`[domains-provision-default] Updated existing domain: ${domainId}`);
    } else {
      const { data: newDomain, error: insertError } = await supabase
        .from('tenant_domains')
        .insert({
          tenant_id,
          domain: hostname,
          type: 'platform_subdomain',
          status: 'verified',
          ssl_status: sslStatus,
          is_primary: false,
          verification_token: 'platform-auto',
          target_hostname: TARGET_HOSTNAME,
          external_id: cfData.id,
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
      console.log(`[domains-provision-default] Created new domain: ${domainId}`);
    }

    console.log(`[domains-provision-default] Provisioned successfully: ${hostname}, ssl_status: ${sslStatus}, cf_id: ${cfData.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        domain_id: domainId,
        hostname,
        ssl_status: sslStatus,
        external_id: cfData.id,
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
