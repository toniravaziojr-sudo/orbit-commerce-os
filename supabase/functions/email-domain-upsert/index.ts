import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_URL = "https://api.sendgrid.com/v3";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.error("[email-domain-upsert] SENDGRID_API_KEY not configured");
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

    const { tenant_id, sending_domain: rawSendingDomain } = await req.json();

    if (!tenant_id || !rawSendingDomain) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id e sending_domain são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract domain from email if user provided full email address
    let sending_domain = rawSendingDomain.trim().toLowerCase();
    if (sending_domain.includes("@")) {
      const parts = sending_domain.split("@");
      sending_domain = parts[parts.length - 1];
      console.log(`[email-domain-upsert] Extracted domain from email: ${rawSendingDomain} -> ${sending_domain}`);
    }

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
    if (!domainRegex.test(sending_domain)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Domínio inválido: "${sending_domain}". Informe apenas o domínio (ex.: exemplo.com.br)` 
        }),
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
        JSON.stringify({ success: false, error: "Acesso negado. Apenas owner/admin pode configurar domínios." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[email-domain-upsert] Creating/updating domain ${sending_domain} for tenant ${tenant_id}`);

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from("email_provider_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    // IMPORTANT: If domain is CHANGING, reset verification states
    const isDomainChange = existingConfig && existingConfig.sending_domain && 
                           existingConfig.sending_domain !== sending_domain;
    
    if (isDomainChange) {
      console.log(`[email-domain-upsert] Domain CHANGE detected: ${existingConfig.sending_domain} -> ${sending_domain}`);
      
      // Reset all verification-related fields when domain changes
      await supabase
        .from("email_provider_configs")
        .update({
          dns_all_ok: false,
          verification_status: "pending",
          verified_at: null,
          is_verified: false,
          dns_records: [],
          resend_domain_id: null,
          last_verify_check_at: null,
          last_verify_error: null,
          from_email: "",
        })
        .eq("id", existingConfig.id);
    }

    // Check if domain already exists in SendGrid for this account
    let domainData: any = null;
    let domainStatus = "pending";
    let dnsRecords: any[] = [];

    // First, list existing authenticated domains
    console.log(`[email-domain-upsert] Checking if domain ${sending_domain} exists in SendGrid...`);
    
    try {
      const listResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (listResponse.ok) {
        const domains = await listResponse.json();
        console.log(`[email-domain-upsert] Found ${domains.length} domains in SendGrid`);
        
        const existingDomain = domains.find((d: any) => d.domain === sending_domain);
        if (existingDomain) {
          console.log(`[email-domain-upsert] Domain already exists in SendGrid: ${existingDomain.id}`);
          domainData = existingDomain;
          domainStatus = existingDomain.valid ? "verified" : "pending";
          dnsRecords = formatSendGridDnsRecords(existingDomain);
        }
      }
    } catch (listError) {
      console.error("[email-domain-upsert] Error listing domains:", listError);
    }

    // If domain doesn't exist, create it
    if (!domainData) {
      console.log(`[email-domain-upsert] Creating new domain in SendGrid: ${sending_domain}`);
      
      const createResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          domain: sending_domain,
          automatic_security: true,
        }),
      });

      const createResult = await createResponse.json();
      console.log(`[email-domain-upsert] SendGrid create response:`, JSON.stringify(createResult).slice(0, 500));

      if (!createResponse.ok) {
        const errorMessage = createResult.errors?.[0]?.message || JSON.stringify(createResult);
        
        // Check if domain already exists
        if (errorMessage.includes("already exists") || errorMessage.includes("duplicate")) {
          // Try to list again and find it
          const retryList = await fetch(`${SENDGRID_API_URL}/whitelabel/domains`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${sendgridApiKey}`,
              "Content-Type": "application/json",
            },
          });
          
          if (retryList.ok) {
            const domains = await retryList.json();
            const found = domains.find((d: any) => d.domain === sending_domain);
            if (found) {
              domainData = found;
              domainStatus = found.valid ? "verified" : "pending";
              dnsRecords = formatSendGridDnsRecords(found);
              console.log(`[email-domain-upsert] Found domain on retry: ${found.id}`);
            }
          }
        }
        
        if (!domainData) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Erro ao criar domínio no SendGrid: ${errorMessage}`,
              provider_error: createResult,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        domainData = createResult;
        dnsRecords = formatSendGridDnsRecords(createResult);
        console.log(`[email-domain-upsert] Domain created:`, JSON.stringify(domainData).slice(0, 500));
      }
    }
    
    if (!domainData?.id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Não foi possível obter o ID do domínio no SendGrid" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert email config
    const upsertPayload = {
      tenant_id,
      sending_domain,
      resend_domain_id: String(domainData.id), // Store SendGrid domain ID here
      dns_records: dnsRecords,
      verification_status: domainStatus,
      verified_at: domainStatus === "verified" ? new Date().toISOString() : null,
      last_verify_check_at: new Date().toISOString(),
      provider_type: "sendgrid",
    };

    if (existingConfig?.id) {
      const { error: updateError } = await supabase
        .from("email_provider_configs")
        .update(upsertPayload)
        .eq("id", existingConfig.id);
      
      if (updateError) {
        console.error("[email-domain-upsert] Error updating config:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao atualizar configuração: ${updateError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const insertPayload = {
        ...upsertPayload,
        from_name: "",
        from_email: "",
      };
      
      const { error: insertError } = await supabase
        .from("email_provider_configs")
        .insert(insertPayload);
      
      if (insertError) {
        console.error("[email-domain-upsert] Error inserting config:", insertError);
        return new Response(
          JSON.stringify({ success: false, error: `Erro ao criar configuração: ${insertError.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[email-domain-upsert] Success! Domain: ${domainData.id}, Status: ${domainStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        domain_id: domainData.id,
        status: domainStatus,
        dns_records: dnsRecords,
        message: domainStatus === "verified" 
          ? "Domínio já verificado!" 
          : "Domínio criado. Configure os registros DNS abaixo."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[email-domain-upsert] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to format SendGrid DNS records to our standard format
function formatSendGridDnsRecords(domainData: any): any[] {
  const records: any[] = [];
  
  // SendGrid returns DNS records in a specific structure
  if (domainData.dns) {
    const dns = domainData.dns;
    
    // DKIM records
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
    
    // Mail CNAME
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
