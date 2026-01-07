import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_URL = "https://api.sendgrid.com/v3";

interface DnsLookupResult {
  record_type: string;
  host: string;
  expected_value: string;
  found_values: string[];
  match: boolean;
  details?: string;
}

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
    
    return data.Answer.map((answer: any) => {
      if (type === 'MX') {
        return answer.data;
      }
      if (type === 'TXT') {
        return answer.data.replace(/^"|"$/g, '');
      }
      // For CNAME, remove trailing dot
      return answer.data.replace(/\.$/, '');
    });
  } catch (error) {
    console.error(`[DNS Lookup] Error for ${name} ${type}:`, error);
    return [];
  }
}

// Verify DNS records against expected values
async function verifyDnsRecords(expectedRecords: any[]): Promise<DnsLookupResult[]> {
  const results: DnsLookupResult[] = [];
  
  for (const record of expectedRecords) {
    const host = record.name || record.host;
    const type = record.type || "CNAME";
    const expectedValue = record.value || record.data;
    
    const foundValues = await dnsLookup(host, type);
    
    let match = false;
    let details = '';
    
    if (type === 'CNAME') {
      // For CNAME, check if value matches (ignoring trailing dots)
      const expectedClean = expectedValue.toLowerCase().replace(/\.$/, '');
      match = foundValues.some(found => {
        const foundClean = found.toLowerCase().replace(/\.$/, '');
        return foundClean === expectedClean;
      });
      
      if (!match && foundValues.length > 0) {
        details = `Valores encontrados: ${foundValues.join('; ')}`;
      }
    } else if (type === 'TXT') {
      const expectedClean = expectedValue.replace(/^"|"$/g, '').trim();
      match = foundValues.some(found => {
        const foundClean = found.replace(/^"|"$/g, '').trim();
        return foundClean.includes(expectedClean) || expectedClean.includes(foundClean);
      });
      
      if (!match && foundValues.length > 0) {
        details = `Valores encontrados: ${foundValues.join('; ')}`;
      }
    }
    
    results.push({
      record_type: type,
      host: host,
      expected_value: expectedValue,
      found_values: foundValues,
      match,
      details: match ? 'OK' : (foundValues.length === 0 ? 'Registro não encontrado no DNS' : details),
    });
  }
  
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.error("[email-domain-verify] SENDGRID_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "SENDGRID_API_KEY não configurada" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and get user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user belongs to tenant (owner or admin)
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!roleData || !["owner", "admin"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ success: false, error: "Acesso negado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get email config
    const { data: config, error: configError } = await supabase
      .from("email_provider_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ success: false, error: "Configuração de email não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.resend_domain_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Domínio não registrado. Adicione um domínio primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainId = config.resend_domain_id;
    console.log(`[email-domain-verify] Verifying domain ${config.sending_domain} (ID: ${domainId})`);

    // Call SendGrid validate endpoint
    const validateResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains/${domainId}/validate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
    });

    const validateResult = await validateResponse.json();
    console.log("[email-domain-verify] SendGrid validate result:", JSON.stringify(validateResult));

    // Get updated domain info
    const domainResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains/${domainId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!domainResponse.ok) {
      console.error("[email-domain-verify] Error fetching domain:", await domainResponse.text());
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Erro ao buscar status do domínio",
          status: config.verification_status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainData = await domainResponse.json();
    console.log(`[email-domain-verify] Domain response:`, JSON.stringify(domainData));

    // Format DNS records for our standard format
    const dnsRecords = formatSendGridDnsRecords(domainData);

    // Perform real DNS lookup for diagnosis
    let dnsLookupResults: DnsLookupResult[] = [];
    if (dnsRecords.length > 0) {
      console.log(`[email-domain-verify] Performing DNS lookup for records`);
      dnsLookupResults = await verifyDnsRecords(dnsRecords);
      console.log(`[email-domain-verify] DNS lookup results:`, JSON.stringify(dnsLookupResults));
    }

    // Check if all DNS records match our verification
    const dnsAllOk = dnsLookupResults.length > 0 && dnsLookupResults.every(r => r.match);
    
    // Determine if verified based on SendGrid response
    const isVerified = domainData.valid === true || validateResult.valid === true;
    const newStatus = isVerified ? "verified" : "pending";

    console.log(`[email-domain-verify] Domain valid: ${domainData.valid}, dnsAllOk: ${dnsAllOk}, final verified: ${isVerified}`);
    
    // Update config with verification result
    await supabase
      .from("email_provider_configs")
      .update({
        dns_records: dnsRecords,
        verification_status: newStatus,
        verified_at: isVerified ? new Date().toISOString() : null,
        last_verify_check_at: new Date().toISOString(),
        last_verify_error: null,
        is_verified: isVerified,
        dns_all_ok: dnsAllOk || isVerified,
      })
      .eq("id", config.id);
    
    console.log(`[email-domain-verify] Updated: verified=${isVerified}, dns_all_ok=${dnsAllOk || isVerified}`);

    // Build status message with diagnosis
    let statusMessage = "";
    let diagnosis: string[] = [];
    
    if (isVerified) {
      statusMessage = "Domínio verificado com sucesso!";
    } else {
      const missingRecords = dnsLookupResults.filter(r => !r.match && r.found_values.length === 0);
      const mismatchRecords = dnsLookupResults.filter(r => !r.match && r.found_values.length > 0);
      const okRecords = dnsLookupResults.filter(r => r.match);
      
      if (missingRecords.length > 0) {
        diagnosis.push(`❌ Registros não encontrados no DNS: ${missingRecords.map(r => `${r.record_type} ${r.host}`).join(', ')}`);
      }
      
      if (mismatchRecords.length > 0) {
        for (const r of mismatchRecords) {
          diagnosis.push(`⚠️ ${r.record_type} ${r.host}: valor diferente do esperado. ${r.details}`);
        }
      }
      
      if (okRecords.length > 0) {
        diagnosis.push(`✅ Registros OK: ${okRecords.map(r => `${r.record_type} ${r.host}`).join(', ')}`);
      }
      
      if (diagnosis.length === 0) {
        statusMessage = "DNS ainda não propagado. Aguarde alguns minutos e tente novamente.";
      } else {
        statusMessage = "Verificação DNS com problemas. Veja o diagnóstico abaixo.";
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: isVerified,
        status: newStatus,
        dns_records: dnsRecords,
        message: statusMessage,
        dns_lookup: dnsLookupResults,
        diagnosis,
        provider_status: domainData.valid ? "verified" : "pending",
        checked_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[email-domain-verify] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to format SendGrid DNS records to our standard format
function formatSendGridDnsRecords(domainData: any): any[] {
  const records: any[] = [];
  
  if (domainData.dns) {
    const dns = domainData.dns;
    
    if (dns.dkim1) {
      records.push({
        type: "CNAME",
        name: dns.dkim1.host,
        value: dns.dkim1.data,
        status: dns.dkim1.valid ? "verified" : "pending",
      });
    }
    if (dns.dkim2) {
      records.push({
        type: "CNAME",
        name: dns.dkim2.host,
        value: dns.dkim2.data,
        status: dns.dkim2.valid ? "verified" : "pending",
      });
    }
    
    if (dns.mail_cname) {
      records.push({
        type: "CNAME",
        name: dns.mail_cname.host,
        value: dns.mail_cname.data,
        status: dns.mail_cname.valid ? "verified" : "pending",
      });
    }
  }
  
  return records;
}
