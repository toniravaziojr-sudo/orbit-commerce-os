import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_URL = "https://api.sendgrid.com/v3";

/**
 * Check if a user is a platform admin by querying the platform_admins table
 */
async function isPlatformAdmin(
  adminClient: any,
  email: string | undefined
): Promise<boolean> {
  if (!email) return false;
  
  const { data, error } = await adminClient
    .from("platform_admins")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .eq("is_active", true)
    .maybeSingle();
  
  if (error) {
    console.error("[system-email-domain-upsert] Error checking platform admin:", error);
    return false;
  }
  
  return !!data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify user is platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is platform admin (query database)
    const isAdmin = await isPlatformAdmin(supabaseAdmin, user.email);
    if (!isAdmin) {
      console.error("Access denied for user:", user.email);
      return new Response(
        JSON.stringify({ success: false, error: "Apenas o administrador da plataforma pode configurar o email do sistema" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("Invalid JSON body:", e);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { sending_domain } = body;
    console.log("Request body:", { sending_domain });

    if (!sending_domain || typeof sending_domain !== "string") {
      console.error("Missing or invalid sending_domain:", sending_domain);
      return new Response(
        JSON.stringify({ success: false, error: "sending_domain é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean domain (remove protocol, trailing slashes, etc.)
    const cleanDomain = sending_domain.trim().toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");
    
    console.log("Clean domain:", cleanDomain);

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.error("SENDGRID_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "SENDGRID_API_KEY não configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current config
    const { data: currentConfig, error: fetchError } = await supabaseAdmin
      .from("system_email_config")
      .select("*")
      .limit(1)
      .single();

    if (fetchError) {
      console.error("Error fetching config:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar configuração do sistema: " + fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let domainId = currentConfig.resend_domain_id;
    let dnsRecords: any[] = [];
    let verificationStatus = "pending";

    // First, try to find existing domain in SendGrid by listing all domains
    console.log("Listing all domains in SendGrid...");
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
        console.log(`Found ${domains.length} domains in SendGrid`);
        
        const existingDomain = domains.find((d: any) => d.domain === cleanDomain);
        if (existingDomain) {
          console.log("Found existing domain:", existingDomain.id);
          domainId = String(existingDomain.id);
          dnsRecords = formatSendGridDnsRecords(existingDomain);
          verificationStatus = existingDomain.valid ? "verified" : "pending";
        }
      }
    } catch (listError: any) {
      console.error("Error listing domains:", listError);
    }

    // If we have a domain ID, try to get its current info
    if (domainId) {
      console.log("Fetching domain info for ID:", domainId);
      try {
        const domainResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains/${domainId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
        });
        
        if (domainResponse.ok) {
          const domainInfo = await domainResponse.json();
          console.log("Domain info response:", JSON.stringify(domainInfo));
          
          dnsRecords = formatSendGridDnsRecords(domainInfo);
          verificationStatus = domainInfo.valid ? "verified" : "pending";
        } else {
          console.log("Could not fetch domain by ID, may need to create");
          domainId = null;
        }
      } catch (getError: any) {
        console.log("Error fetching domain:", getError.message);
        domainId = null;
      }
    }

    // If no domain exists, create one
    if (!domainId) {
      console.log("Creating new domain in SendGrid:", cleanDomain);
      try {
        const createResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            domain: cleanDomain,
            automatic_security: true,
          }),
        });

        const createResult = await createResponse.json();
        console.log("Create domain result:", JSON.stringify(createResult));

        if (!createResponse.ok) {
          const errorMessage = createResult.errors?.[0]?.message || JSON.stringify(createResult);
          
          if (errorMessage.includes("already") || errorMessage.includes("exists") || errorMessage.includes("duplicate")) {
            // Domain already exists - try to find it
            console.log("Domain already exists, searching in list...");
            const listResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains`, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${sendgridApiKey}`,
                "Content-Type": "application/json",
              },
            });
            
            if (listResponse.ok) {
              const domains = await listResponse.json();
              const existingDomain = domains.find((d: any) => d.domain === cleanDomain);
              if (existingDomain) {
                domainId = String(existingDomain.id);
                dnsRecords = formatSendGridDnsRecords(existingDomain);
                verificationStatus = existingDomain.valid ? "verified" : "pending";
              } else {
                console.error("Domain reported as existing but not found in list");
                return new Response(
                  JSON.stringify({ 
                    success: false, 
                    error: `Domínio já existe no SendGrid mas não foi encontrado. Verifique no painel do SendGrid.`,
                    details: errorMessage
                  }),
                  { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } else {
            console.error("Unhandled create error:", errorMessage);
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Erro ao criar domínio no SendGrid: ${errorMessage}`,
                details: errorMessage
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          domainId = String(createResult.id);
          dnsRecords = formatSendGridDnsRecords(createResult);
          verificationStatus = "pending";
        }
      } catch (createError: any) {
        console.error("Exception creating domain:", createError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Erro ao criar domínio: ${createError.message}`,
            details: createError.message
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!domainId) {
      console.error("Failed to get or create domain");
      return new Response(
        JSON.stringify({ success: false, error: "Não foi possível configurar o domínio" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Final domain state:", { domainId, verificationStatus, recordsCount: dnsRecords.length });

    // Update config in database
    const { data: updatedConfig, error: updateError } = await supabaseAdmin
      .from("system_email_config")
      .update({
        sending_domain: cleanDomain,
        resend_domain_id: domainId,
        dns_records: dnsRecords,
        verification_status: verificationStatus,
        verified_at: verificationStatus === "verified" ? new Date().toISOString() : null,
        last_verify_check_at: new Date().toISOString(),
        last_verify_error: null,
      })
      .eq("id", currentConfig.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating config:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao atualizar configuração: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Domain upsert successful:", updatedConfig);

    return new Response(
      JSON.stringify({ 
        success: true, 
        config: updatedConfig,
        dns_records: dnsRecords
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Unexpected error in system-email-domain-upsert:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message, details: error.stack }),
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
