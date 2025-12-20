import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SaaS domain configuration
const SAAS_DOMAIN = 'comandocentral.com.br';
const SAAS_STOREFRONT_SUBDOMAIN = 'shops';
const TARGET_HOSTNAME = `${SAAS_STOREFRONT_SUBDOMAIN}.${SAAS_DOMAIN}`;

// Cloudflare API configuration
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

interface ProvisionDefaultRequest {
  tenant_id: string;
  tenant_slug: string;
}

/**
 * IMPORTANTE: Sub-subdomínios (*.shops.comandocentral.com.br) NÃO são cobertos
 * pelo Universal SSL do Cloudflare (que cobre apenas *.domain.com).
 * 
 * Para que esses subdomínios funcionem com SSL, precisamos:
 * 1. Criar um Custom Hostname no Cloudflare for SaaS para cada tenant
 * 2. O Custom Hostname provisionará um certificado DV para o subdomínio específico
 * 
 * Alternativa (mais cara): Advanced Certificate Manager com wildcard de segundo nível
 * 
 * Esta função cria o Custom Hostname automaticamente ao provisionar o domínio padrão.
 */

async function createCustomHostname(
  zoneId: string,
  apiToken: string,
  hostname: string,
  targetHostname: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log(`[CF] Creating custom hostname: ${hostname} -> ${targetHostname}`);
  
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
        custom_origin_server: targetHostname,
      }),
    });

    const result = await response.json();
    console.log(`[CF] Create response status: ${response.status}`);

    if (!result.success) {
      const errorMsg = result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      console.error(`[CF] Create failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    console.log(`[CF] Custom hostname created: ${result.result?.id}`);
    return { success: true, data: result.result };
  } catch (error) {
    console.error(`[CF] Error creating custom hostname:`, error);
    return { success: false, error: (error as Error).message };
  }
}

async function getCustomHostnameStatus(
  zoneId: string,
  apiToken: string,
  customHostnameId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log(`[CF] Checking status for: ${customHostnameId}`);
  
  try {
    const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/custom_hostnames/${customHostnameId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!result.success) {
      const errorMsg = result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      return { success: false, error: errorMsg };
    }

    return { success: true, data: result.result };
  } catch (error) {
    console.error(`[CF] Error getting status:`, error);
    return { success: false, error: (error as Error).message };
  }
}

async function findExistingCustomHostname(
  zoneId: string,
  apiToken: string,
  hostname: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  console.log(`[CF] Searching for existing custom hostname: ${hostname}`);
  
  try {
    const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!result.success) {
      const errorMsg = result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      return { success: false, error: errorMsg };
    }

    // Return the first match if any
    if (result.result && result.result.length > 0) {
      console.log(`[CF] Found existing custom hostname: ${result.result[0].id}`);
      return { success: true, data: result.result[0] };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error(`[CF] Error searching custom hostname:`, error);
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
    console.log(`[domains-provision-default] Provisioning for tenant: ${tenant_slug}`);

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
          error: 'Cloudflare credentials not configured. Please add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID secrets.',
          ssl_status: 'failed'
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
    const { data: existingDomain, error: fetchError } = await supabase
      .from('tenant_domains')
      .select('id, status, ssl_status, external_id')
      .eq('tenant_id', tenant_id)
      .eq('domain', hostname)
      .eq('type', 'platform_subdomain')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`[domains-provision-default] DB fetch error:`, fetchError);
    }

    // If domain exists and has external_id, check status in Cloudflare
    if (existingDomain?.external_id) {
      console.log(`[domains-provision-default] Domain exists with external_id: ${existingDomain.external_id}, checking CF status...`);
      
      const cfStatus = await getCustomHostnameStatus(cfZoneId, cfApiToken, existingDomain.external_id);
      
      if (cfStatus.success && cfStatus.data) {
        const sslStatus = cfStatus.data.ssl?.status === 'active' ? 'active' : 
                          cfStatus.data.ssl?.status === 'pending_validation' ? 'pending' : 
                          cfStatus.data.status === 'active' ? 'active' : 'pending';
        
        const lastError = cfStatus.data.ssl?.validation_errors?.map((e: any) => e.message).join(', ') || null;
        
        await supabase
          .from('tenant_domains')
          .update({
            status: 'verified',
            ssl_status: sslStatus,
            last_checked_at: new Date().toISOString(),
            last_error: lastError,
          })
          .eq('id', existingDomain.id);

        console.log(`[domains-provision-default] Updated existing domain, ssl_status: ${sslStatus}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            domain_id: existingDomain.id,
            hostname,
            ssl_status: sslStatus,
            message: sslStatus === 'active' ? 'SSL is active' : 'SSL provisioning in progress'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check if Custom Hostname already exists in Cloudflare (maybe orphaned)
    const existingCH = await findExistingCustomHostname(cfZoneId, cfApiToken, hostname);
    
    let cfData: any = null;
    
    if (existingCH.success && existingCH.data) {
      // Use existing Custom Hostname
      console.log(`[domains-provision-default] Using existing CF custom hostname: ${existingCH.data.id}`);
      cfData = existingCH.data;
    } else {
      // Create new Custom Hostname in Cloudflare
      console.log(`[domains-provision-default] Creating new Custom Hostname in Cloudflare...`);
      
      const cfResult = await createCustomHostname(cfZoneId, cfApiToken, hostname, TARGET_HOSTNAME);
      
      if (!cfResult.success) {
        console.error(`[domains-provision-default] Failed to create CF custom hostname: ${cfResult.error}`);
        
        // Still create the DB record but with failed status
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
              external_id: null,
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
          JSON.stringify({ 
            error: cfResult.error, 
            ssl_status: 'failed',
            hostname
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      cfData = cfResult.data;
    }

    // Determine SSL status from Cloudflare response
    const sslStatus = cfData?.ssl?.status === 'active' ? 'active' : 'pending';
    const externalId = cfData?.id;
    
    console.log(`[domains-provision-default] CF custom hostname ID: ${externalId}, ssl_status: ${sslStatus}`);

    if (existingDomain) {
      // Update existing record
      await supabase
        .from('tenant_domains')
        .update({
          status: 'verified',
          ssl_status: sslStatus,
          external_id: externalId,
          last_checked_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', existingDomain.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          domain_id: existingDomain.id,
          hostname,
          ssl_status: sslStatus,
          external_id: externalId,
          message: sslStatus === 'active' ? 'SSL is active' : 'SSL provisioning in progress (wait 1-5 minutes)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new domain record with correct external_id
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
        external_id: externalId,
      })
      .select('id')
      .single();

    if (insertError) {
      // Check for duplicate (race condition)
      if (insertError.code === '23505') {
        console.log(`[domains-provision-default] Domain already exists (duplicate key), fetching...`);
        
        const { data: existingAfterRace } = await supabase
          .from('tenant_domains')
          .select('id')
          .eq('tenant_id', tenant_id)
          .eq('domain', hostname)
          .single();

        if (existingAfterRace) {
          // Update the existing record with CF data
          await supabase
            .from('tenant_domains')
            .update({
              external_id: externalId,
              ssl_status: sslStatus,
              last_checked_at: new Date().toISOString(),
            })
            .eq('id', existingAfterRace.id);

          return new Response(
            JSON.stringify({ 
              success: true, 
              domain_id: existingAfterRace.id,
              hostname,
              ssl_status: sslStatus,
              external_id: externalId,
              message: sslStatus === 'active' ? 'SSL is active' : 'SSL provisioning in progress'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      console.error(`[domains-provision-default] Insert error:`, insertError);
      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[domains-provision-default] Created new domain: ${newDomain.id}, hostname: ${hostname}, ssl_status: ${sslStatus}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        domain_id: newDomain.id,
        hostname,
        ssl_status: sslStatus,
        external_id: externalId,
        message: sslStatus === 'active' ? 'SSL is active' : 'SSL provisioning in progress (wait 1-5 minutes)'
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
