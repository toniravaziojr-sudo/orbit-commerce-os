import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DnsRecord {
  name: string;
  type: string;
  value: string;
  priority?: number;
  record?: string;
  status?: string;
}

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
      // For MX records, data includes priority
      if (type === 'MX') {
        // MX data format: "priority host" e.g., "10 feedback-smtp.us-east-1.amazonses.com."
        return answer.data;
      }
      // For TXT records, remove quotes
      if (type === 'TXT') {
        return answer.data.replace(/^"|"$/g, '');
      }
      return answer.data;
    });
  } catch (error) {
    console.error(`[DNS Lookup] Error for ${name} ${type}:`, error);
    return [];
  }
}

// Verify DNS records against expected values
async function verifyDnsRecords(domain: string, expectedRecords: DnsRecord[]): Promise<DnsLookupResult[]> {
  const results: DnsLookupResult[] = [];
  
  for (const record of expectedRecords) {
    const fullHost = record.name === '@' ? domain : `${record.name}.${domain}`;
    const foundValues = await dnsLookup(fullHost, record.type);
    
    let match = false;
    let details = '';
    
    if (record.type === 'TXT') {
      // For TXT records, check if expected value is contained in any found value
      const expectedClean = record.value.replace(/^"|"$/g, '').trim();
      match = foundValues.some(found => {
        const foundClean = found.replace(/^"|"$/g, '').trim();
        // Check if the key part matches (e.g., p=...)
        return foundClean.includes(expectedClean) || expectedClean.includes(foundClean);
      });
      
      if (!match && foundValues.length > 0) {
        details = `Valores encontrados: ${foundValues.join('; ')}`;
      }
    } else if (record.type === 'MX') {
      // For MX, check if the hostname matches (ignoring priority and trailing dot)
      const expectedHost = record.value.toLowerCase().replace(/\.$/, '');
      match = foundValues.some(found => {
        // MX format: "priority hostname." e.g., "10 feedback-smtp.us-east-1.amazonses.com."
        const parts = found.split(' ');
        const foundHost = (parts[1] || parts[0]).toLowerCase().replace(/\.$/, '');
        return foundHost === expectedHost;
      });
      
      if (!match && foundValues.length > 0) {
        details = `Valores encontrados: ${foundValues.join('; ')}`;
      }
    }
    
    results.push({
      record_type: record.type,
      host: fullHost,
      expected_value: record.type === 'MX' && record.priority 
        ? `${record.priority} ${record.value}` 
        : record.value,
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
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[email-domain-verify] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "RESEND_API_KEY não configurada" 
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

    console.log(`[email-domain-verify] Verifying domain ${config.sending_domain} (${config.resend_domain_id})`);

    const resend = new Resend(resendApiKey);

    // Call Resend verify endpoint
    const verifyResult = await resend.domains.verify(config.resend_domain_id);

    if (verifyResult.error) {
      console.error("[email-domain-verify] Resend verify error:", verifyResult.error);
      
      // Update with error
      await supabase
        .from("email_provider_configs")
        .update({
          last_verify_check_at: new Date().toISOString(),
          last_verify_error: verifyResult.error.message || JSON.stringify(verifyResult.error),
        })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao verificar: ${verifyResult.error.message || JSON.stringify(verifyResult.error)}`,
          status: config.verification_status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch updated domain info
    const domainResult = await resend.domains.get(config.resend_domain_id);

    if (domainResult.error || !domainResult.data) {
      console.error("[email-domain-verify] Error fetching domain:", domainResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Erro ao buscar status do domínio",
          status: config.verification_status
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainData = domainResult.data;
    const isVerified = domainData.status === "verified";
    const newStatus = isVerified ? "verified" : 
                      domainData.status === "pending" ? "pending" : "failed";

    console.log(`[email-domain-verify] Domain status: ${domainData.status}, records:`, domainData.records);

    // Perform real DNS lookup for diagnosis
    let dnsLookupResults: DnsLookupResult[] = [];
    if (!isVerified && domainData.records && config.sending_domain) {
      console.log(`[email-domain-verify] Performing DNS lookup for ${config.sending_domain}`);
      dnsLookupResults = await verifyDnsRecords(config.sending_domain, domainData.records);
      console.log(`[email-domain-verify] DNS lookup results:`, JSON.stringify(dnsLookupResults));
    }

    // Check if all DNS records match
    const dnsAllOk = dnsLookupResults.length > 0 && dnsLookupResults.every(r => r.match);
    
    // Update config with verification result
    await supabase
      .from("email_provider_configs")
      .update({
        dns_records: domainData.records || [],
        verification_status: newStatus,
        verified_at: isVerified ? new Date().toISOString() : null,
        last_verify_check_at: new Date().toISOString(),
        last_verify_error: null,
        is_verified: isVerified,
        dns_all_ok: dnsAllOk || isVerified, // DNS OK if all records match or already verified
      })
      .eq("id", config.id);
    
    console.log(`[email-domain-verify] Updated: verified=${isVerified}, dns_all_ok=${dnsAllOk || isVerified}`);

    // Build status message with diagnosis
    let statusMessage = "";
    let diagnosis: string[] = [];
    
    if (isVerified) {
      statusMessage = "Domínio verificado com sucesso!";
    } else {
      // Check DNS lookup results for problems
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
        dns_records: domainData.records || [],
        message: statusMessage,
        dns_lookup: dnsLookupResults,
        diagnosis,
        provider_status: domainData.status,
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
