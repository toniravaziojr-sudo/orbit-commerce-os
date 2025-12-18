import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cloudflare API configuration
const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

interface ProvisionRequest {
  tenant_id: string;
  domain_id: string;
  action: 'provision' | 'check_status' | 'delete';
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
  hostname: string,
  targetHostname: string
): Promise<{ success: boolean; data?: CloudflareCustomHostname; error?: string }> {
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
    console.log(`[CF] Create response:`, JSON.stringify(result));

    if (!result.success) {
      const errorMsg = result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      return { success: false, error: errorMsg };
    }

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
): Promise<{ success: boolean; data?: CloudflareCustomHostname; error?: string }> {
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
    console.log(`[CF] Status response:`, JSON.stringify(result));

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

async function deleteCustomHostname(
  zoneId: string,
  apiToken: string,
  customHostnameId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[CF] Deleting custom hostname: ${customHostnameId}`);
  
  try {
    const response = await fetch(`${CF_API_BASE}/zones/${zoneId}/custom_hostnames/${customHostnameId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    console.log(`[CF] Delete response:`, JSON.stringify(result));

    if (!result.success) {
      const errorMsg = result.errors?.map((e: any) => e.message).join(', ') || 'Unknown error';
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (error) {
    console.error(`[CF] Error deleting:`, error);
    return { success: false, error: (error as Error).message };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, domain_id, action } = await req.json() as ProvisionRequest;
    console.log(`[domains-provision] Action: ${action}, tenant: ${tenant_id}, domain: ${domain_id}`);

    // Validate required params
    if (!tenant_id || !domain_id || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: tenant_id, domain_id, action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Cloudflare credentials from secrets
    const cfApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cfZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
    
    if (!cfApiToken || !cfZoneId) {
      console.error('[domains-provision] Missing Cloudflare credentials');
      return new Response(
        JSON.stringify({ error: 'Cloudflare credentials not configured. Please add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch domain record
    const { data: domain, error: fetchError } = await supabase
      .from('tenant_domains')
      .select('*')
      .eq('id', domain_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchError || !domain) {
      console.error('[domains-provision] Domain not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Domain not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[domains-provision] Domain found: ${domain.domain}, status: ${domain.status}, ssl_status: ${domain.ssl_status}`);

    // Handle different actions
    if (action === 'provision') {
      // Check if domain is verified
      if (domain.status !== 'verified') {
        return new Response(
          JSON.stringify({ error: 'Domain must be verified before provisioning SSL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if already provisioned
      if (domain.external_id && domain.ssl_status === 'active') {
        return new Response(
          JSON.stringify({ success: true, message: 'Domain already provisioned', ssl_status: 'active' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const targetHostname = domain.target_hostname || 'shops.respeiteohomem.com.br';
      
      // Create custom hostname in Cloudflare
      const cfResult = await createCustomHostname(cfZoneId, cfApiToken, domain.domain, targetHostname);

      if (!cfResult.success) {
        // Update domain with error
        await supabase
          .from('tenant_domains')
          .update({
            ssl_status: 'failed',
            last_error: cfResult.error,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', domain_id);

        return new Response(
          JSON.stringify({ error: cfResult.error, ssl_status: 'failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update domain with external_id and pending status
      const sslStatus = cfResult.data?.ssl?.status === 'active' ? 'active' : 'pending';
      
      await supabase
        .from('tenant_domains')
        .update({
          external_id: cfResult.data?.id,
          ssl_status: sslStatus,
          last_error: null,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', domain_id);

      console.log(`[domains-provision] Provisioned successfully, external_id: ${cfResult.data?.id}, ssl_status: ${sslStatus}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          external_id: cfResult.data?.id,
          ssl_status: sslStatus,
          message: sslStatus === 'active' ? 'SSL is active' : 'SSL provisioning in progress'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'check_status') {
      if (!domain.external_id) {
        return new Response(
          JSON.stringify({ error: 'Domain not provisioned yet', ssl_status: domain.ssl_status || 'none' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cfResult = await getCustomHostnameStatus(cfZoneId, cfApiToken, domain.external_id);

      if (!cfResult.success) {
        await supabase
          .from('tenant_domains')
          .update({
            last_error: cfResult.error,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', domain_id);

        return new Response(
          JSON.stringify({ error: cfResult.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map Cloudflare SSL status to our status
      let sslStatus = 'pending';
      if (cfResult.data?.ssl?.status === 'active') {
        sslStatus = 'active';
      } else if (cfResult.data?.ssl?.status === 'pending_validation') {
        sslStatus = 'pending';
      } else if (cfResult.data?.ssl?.validation_errors?.length) {
        sslStatus = 'failed';
      }

      const lastError = cfResult.data?.ssl?.validation_errors?.map(e => e.message).join(', ') || null;

      await supabase
        .from('tenant_domains')
        .update({
          ssl_status: sslStatus,
          last_error: lastError,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', domain_id);

      console.log(`[domains-provision] Status checked: ssl_status=${sslStatus}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          ssl_status: sslStatus,
          cf_status: cfResult.data?.ssl?.status,
          last_error: lastError
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'delete') {
      if (domain.external_id) {
        const cfResult = await deleteCustomHostname(cfZoneId, cfApiToken, domain.external_id);
        
        if (!cfResult.success) {
          console.warn(`[domains-provision] Failed to delete from Cloudflare: ${cfResult.error}`);
        }
      }

      // Reset SSL fields
      await supabase
        .from('tenant_domains')
        .update({
          external_id: null,
          ssl_status: 'none',
          last_error: null,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', domain_id);

      return new Response(
        JSON.stringify({ success: true, message: 'SSL provisioning removed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: provision, check_status, or delete' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[domains-provision] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
