import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Perform DNS lookup using Cloudflare DNS-over-HTTPS
async function dnsLookup(name: string, type: string): Promise<string[]> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/dns-json',
      },
    });
    
    if (!response.ok) {
      console.log(`[DNS Lookup] Failed for ${name} ${type}: ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    console.log(`[DNS Lookup] ${name} ${type}:`, JSON.stringify(data));
    
    if (!data.Answer || data.Answer.length === 0) {
      return [];
    }
    
    return data.Answer.map((answer: { data: string }) => {
      if (type === 'MX') {
        // MX records have priority prefix, extract just the hostname
        const parts = answer.data.split(' ');
        return parts.length > 1 ? parts[1].replace(/\.$/, '') : answer.data.replace(/\.$/, '');
      }
      if (type === 'TXT') {
        return answer.data.replace(/^"|"$/g, '');
      }
      return answer.data.replace(/\.$/, '');
    });
  } catch (error) {
    console.error(`[DNS Lookup] Error for ${name} ${type}:`, error);
    return [];
  }
}

interface VerifyRequest {
  mailbox_id: string;
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== MAILBOX DNS VERIFY ===');
  
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
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { mailbox_id }: VerifyRequest = await req.json();

    if (!mailbox_id) {
      return new Response(
        JSON.stringify({ error: 'mailbox_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the mailbox
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('id', mailbox_id)
      .single();

    if (mailboxError || !mailbox) {
      return new Response(
        JSON.stringify({ error: 'Mailbox not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', mailbox.tenant_id)
      .single();

    if (!userRole || !['owner', 'admin'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const domain = mailbox.domain;

    console.log(`Verifying DNS for mailbox ${mailbox_id}, domain: ${domain}`);

    // FIRST: Check if domain is already verified in email_provider_configs
    // This is the source of truth for domain verification
    const { data: providerConfig } = await supabase
      .from('email_provider_configs')
      .select('*')
      .eq('tenant_id', mailbox.tenant_id)
      .eq('sending_domain', domain)
      .single();

    if (providerConfig && providerConfig.verification_status === 'verified' && providerConfig.dns_all_ok) {
      console.log('Domain already verified in email_provider_configs, inheriting status');
      
      // Inherit verification from provider config
      await supabase
        .from('mailboxes')
        .update({
          dns_verified: true,
          dns_records: providerConfig.dns_records,
          last_dns_check_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', mailbox_id);

      return new Response(
        JSON.stringify({
          success: true,
          verified: true,
          inherited: true,
          status: 'active',
          records: providerConfig.dns_records,
          message: 'DNS verificado! Domínio já configurado nas configurações de email.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If not inherited, check DNS records directly for the ROOT domain (not subdomain)
    const results: { type: string; host: string; expected: string; found: string[]; ok: boolean }[] = [];

    // 1. Check MX record for the ROOT domain (emails go to @domain.com)
    const mxRecords = await dnsLookup(domain, 'MX');
    const mxOk = mxRecords.some(r => r.toLowerCase().includes('sendgrid.net'));
    results.push({
      type: 'MX',
      host: `@ (${domain})`,
      expected: 'mx.sendgrid.net',
      found: mxRecords,
      ok: mxOk,
    });

    // 2. Check SPF record (TXT) for the main domain
    const txtRecords = await dnsLookup(domain, 'TXT');
    const spfOk = txtRecords.some(r => r.includes('sendgrid.net'));
    results.push({
      type: 'TXT (SPF)',
      host: domain,
      expected: 'v=spf1 include:sendgrid.net ~all',
      found: txtRecords.filter(r => r.includes('spf')),
      ok: spfOk,
    });

    const allOk = mxOk; // At minimum, MX must be configured for receiving

    // Update mailbox
    const newStatus = allOk ? 'active' : 'pending_dns';
    await supabase
      .from('mailboxes')
      .update({
        dns_verified: allOk,
        dns_records: results,
        last_dns_check_at: new Date().toISOString(),
        status: newStatus,
      })
      .eq('id', mailbox_id);

    console.log(`DNS verification result: ${allOk ? 'PASSED' : 'FAILED'}`);

    return new Response(
      JSON.stringify({
        success: true,
        verified: allOk,
        status: newStatus,
        records: results,
        message: allOk 
          ? 'DNS verificado com sucesso! Mailbox ativo.' 
          : 'DNS ainda não está configurado corretamente. Verifique os registros abaixo.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});