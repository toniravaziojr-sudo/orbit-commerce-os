import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RefreshStatusRequest {
  tenant_id: string;
  domain_id: string;
}

interface RefreshStatusResponse {
  success: boolean;
  status?: string;
  ssl_status?: string;
  verified?: boolean;
  last_error?: string | null;
  error?: string;
}

// DNS-over-HTTPS lookup for TXT records
async function lookupTXTRecords(domain: string): Promise<string[]> {
  const DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
  
  try {
    const response = await fetch(`${DOH_ENDPOINT}?name=${encodeURIComponent(domain)}&type=TXT`, {
      headers: { 'Accept': 'application/dns-json' }
    });
    
    if (!response.ok) {
      console.error(`[domains-refresh-status] DNS lookup failed with status ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    
    if (!data.Answer) {
      return [];
    }
    
    return data.Answer
      .filter((record: any) => record.type === 16) // TXT record type
      .map((record: any) => record.data.replace(/"/g, '')); // Remove quotes from TXT values
  } catch (error) {
    console.error('[domains-refresh-status] DNS lookup error:', error);
    return [];
  }
}

// Get the TXT record hostname for verification
function getVerificationHost(domain: string): string {
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Subdomain: _cc-verify.subdomain.domain.tld
    return `_cc-verify.${domain}`;
  }
  // Apex domain: _cc-verify.domain.tld
  return `_cc-verify.${domain}`;
}

// Check SSL status via Cloudflare API
async function checkCloudflareSSLStatus(
  zoneId: string,
  apiToken: string,
  customHostnameId: string
): Promise<{ ssl_status: string; validation_errors?: string[] }> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${customHostnameId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = await response.json();

    if (!data.success || !data.result) {
      console.error('[domains-refresh-status] Cloudflare API error:', data.errors);
      return { ssl_status: 'failed', validation_errors: data.errors?.map((e: any) => e.message) };
    }

    const result = data.result;
    const sslStatus = result.ssl?.status || 'pending';
    
    // Map Cloudflare SSL status to our status
    let mappedStatus = 'pending';
    if (sslStatus === 'active') {
      mappedStatus = 'active';
    } else if (sslStatus === 'pending_validation' || sslStatus === 'pending_issuance' || sslStatus === 'pending_deployment') {
      mappedStatus = 'pending';
    } else if (sslStatus === 'failed' || sslStatus === 'deleted') {
      mappedStatus = 'failed';
    }

    return { 
      ssl_status: mappedStatus,
      validation_errors: result.ssl?.validation_errors 
    };
  } catch (error) {
    console.error('[domains-refresh-status] Error checking Cloudflare SSL:', error);
    return { ssl_status: 'failed', validation_errors: [(error as Error).message] };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as RefreshStatusRequest;
    const { tenant_id, domain_id } = body;

    if (!tenant_id || !domain_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing tenant_id or domain_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get domain record
    const { data: domainRecord, error: fetchError } = await supabase
      .from('tenant_domains')
      .select('*')
      .eq('id', domain_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (fetchError || !domainRecord) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[domains-refresh-status] Refreshing status for domain: ${domainRecord.domain}`);

    let newStatus = domainRecord.status;
    let newSslStatus = domainRecord.ssl_status;
    let lastError: string | null = null;
    let verified = false;

    // Step 1: Check DNS verification if not yet verified
    if (domainRecord.status !== 'verified') {
      const verificationHost = getVerificationHost(domainRecord.domain);
      const txtRecords = await lookupTXTRecords(verificationHost);
      const expectedValue = `cc-verify=${domainRecord.verification_token}`;
      
      console.log(`[domains-refresh-status] Looking for TXT at ${verificationHost}`);
      console.log(`[domains-refresh-status] Expected: ${expectedValue}`);
      console.log(`[domains-refresh-status] Found: ${txtRecords.join(', ')}`);

      if (txtRecords.some(record => record === expectedValue)) {
        newStatus = 'verified';
        verified = true;
        console.log(`[domains-refresh-status] Domain verified: ${domainRecord.domain}`);
      } else {
        lastError = 'Registro TXT de verificação não encontrado. Verifique se o DNS propagou.';
      }
    } else {
      verified = true;
    }

    // Step 2: Check SSL status if domain is verified and has external_id
    if (verified && domainRecord.external_id && domainRecord.ssl_status !== 'active') {
      const cloudflareZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');
      const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');

      if (cloudflareZoneId && cloudflareApiToken) {
        const sslResult = await checkCloudflareSSLStatus(
          cloudflareZoneId,
          cloudflareApiToken,
          domainRecord.external_id
        );
        
        newSslStatus = sslResult.ssl_status;
        if (sslResult.validation_errors?.length) {
          lastError = sslResult.validation_errors.join(', ');
        }
      }
    }

    // Update the domain record
    const { error: updateError } = await supabase
      .from('tenant_domains')
      .update({
        status: newStatus,
        ssl_status: newSslStatus,
        last_checked_at: new Date().toISOString(),
        last_error: lastError,
        verified_at: verified && !domainRecord.verified_at ? new Date().toISOString() : domainRecord.verified_at,
      })
      .eq('id', domain_id);

    if (updateError) {
      console.error('[domains-refresh-status] Update error:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response: RefreshStatusResponse = {
      success: true,
      status: newStatus,
      ssl_status: newSslStatus,
      verified,
      last_error: lastError,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[domains-refresh-status] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
