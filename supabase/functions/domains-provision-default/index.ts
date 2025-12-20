import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SaaS domain configuration
const SAAS_DOMAIN = 'comandocentral.com.br';
const SAAS_STOREFRONT_SUBDOMAIN = 'shops';

interface ProvisionDefaultRequest {
  tenant_id: string;
  tenant_slug: string;
}

/**
 * ARQUITETURA: SSL gerenciado por ACM (Advanced Certificate Manager)
 * 
 * Com ACM ativado na zona comandocentral.com.br com wildcard para
 * *.shops.comandocentral.com.br, o SSL é automático para todos os tenants.
 * 
 * Esta função APENAS registra o domínio no banco de dados.
 * NÃO cria Custom Hostnames para subdomínios internos.
 * 
 * Custom Hostnames (via domains-provision) são usados APENAS para
 * domínios externos de clientes (ex: loja.cliente.com.br).
 */

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
      .select('id, status, ssl_status')
      .eq('tenant_id', tenant_id)
      .eq('domain', hostname)
      .eq('type', 'platform_subdomain')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(`[domains-provision-default] DB fetch error:`, fetchError);
    }

    if (existingDomain) {
      console.log(`[domains-provision-default] Domain already exists: ${existingDomain.id}`);
      
      // Update to ensure it's marked as verified + active (ACM handles SSL)
      await supabase
        .from('tenant_domains')
        .update({
          status: 'verified',
          ssl_status: 'active',
          last_checked_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', existingDomain.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          domain_id: existingDomain.id,
          hostname,
          ssl_status: 'active',
          message: 'Subdomínio da plataforma ativo (SSL via ACM)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the domain record
    // NOTE: No Cloudflare API call - ACM handles SSL for *.shops.comandocentral.com.br
    const { data: newDomain, error: insertError } = await supabase
      .from('tenant_domains')
      .insert({
        tenant_id,
        domain: hostname,
        type: 'platform_subdomain',
        status: 'verified',
        ssl_status: 'active', // SSL covered by ACM wildcard certificate
        is_primary: false,
        verification_token: 'platform-auto',
        target_hostname: `${SAAS_STOREFRONT_SUBDOMAIN}.${SAAS_DOMAIN}`,
        external_id: null, // No Custom Hostname needed - ACM handles it
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
          return new Response(
            JSON.stringify({ 
              success: true, 
              domain_id: existingAfterRace.id,
              hostname,
              ssl_status: 'active',
              message: 'Subdomínio da plataforma ativo (SSL via ACM)'
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

    console.log(`[domains-provision-default] Created domain: ${newDomain.id}, hostname: ${hostname}`);
    console.log(`[domains-provision-default] SSL is automatic via ACM wildcard certificate`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        domain_id: newDomain.id,
        hostname,
        ssl_status: 'active',
        message: 'Subdomínio da plataforma ativo (SSL via ACM)'
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
