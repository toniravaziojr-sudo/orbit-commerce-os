import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateDomainRequest {
  tenant_id: string;
  domain: string;
}

interface CreateDomainResponse {
  success: boolean;
  domain_id?: string;
  dns_instructions?: {
    cname_host: string;
    cname_target: string;
    txt_host: string;
    txt_value: string;
  };
  error?: string;
}

// Generate a random verification token
function generateVerificationToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Normalize domain (lowercase, remove protocol, trailing slash)
function normalizeDomain(domain: string): string {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/^www\./, '');
}

// Get the TXT record hostname for verification
function getVerificationHost(domain: string): string {
  const parts = domain.split('.');
  if (parts.length > 2) {
    // Subdomain: _cc-verify.subdomain
    return `_cc-verify.${parts[0]}`;
  }
  // Apex domain: _cc-verify
  return '_cc-verify';
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

    const body = await req.json() as CreateDomainRequest;
    const { tenant_id, domain: rawDomain } = body;

    if (!tenant_id || !rawDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing tenant_id or domain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to this tenant
    const { data: roleCheck, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'admin'])
      .single();

    if (roleError || !roleCheck) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied to this tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const domain = normalizeDomain(rawDomain);
    const verificationToken = generateVerificationToken();

    // Get target hostname for CNAME instructions
    const targetHostname = 'shops.comandocentral.com.br';

    console.log(`[domains-create] Creating domain: ${domain} for tenant: ${tenant_id}`);

    // Check if domain already exists
    const { data: existingDomain } = await supabase
      .from('tenant_domains')
      .select('id')
      .eq('domain', domain)
      .single();

    if (existingDomain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este domínio já está cadastrado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert the new domain
    const { data: newDomain, error: insertError } = await supabase
      .from('tenant_domains')
      .insert({
        tenant_id,
        domain,
        type: 'custom',
        verification_token: verificationToken,
        status: 'pending',
        ssl_status: 'none',
        is_primary: false,
        target_hostname: targetHostname,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[domains-create] Insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build DNS instructions
    const dnsInstructions = {
      cname_host: domain.split('.').length > 2 ? domain.split('.')[0] : 'www',
      cname_target: targetHostname,
      txt_host: getVerificationHost(domain),
      txt_value: `cc-verify=${verificationToken}`,
    };

    console.log(`[domains-create] Domain created successfully: ${domain}`);

    const response: CreateDomainResponse = {
      success: true,
      domain_id: newDomain.id,
      dns_instructions: dnsInstructions,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[domains-create] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
