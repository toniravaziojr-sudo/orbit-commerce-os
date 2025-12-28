import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDGRID_API_URL = "https://api.sendgrid.com/v3";

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

    // Verify user is platform operator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is platform operator
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .limit(1);

    if (!roles || roles.length === 0) {
      throw new Error("Apenas operadores da plataforma podem verificar o domínio do sistema");
    }

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY não configurada");
    }

    // Get current config
    const { data: config, error: fetchError } = await supabaseAdmin
      .from("system_email_config")
      .select("*")
      .limit(1)
      .single();

    if (fetchError || !config) {
      throw new Error("Configuração do sistema não encontrada");
    }

    if (!config.resend_domain_id) {
      throw new Error("Domínio não configurado. Configure o domínio primeiro.");
    }

    const domainId = config.resend_domain_id;
    console.log("Verifying domain:", domainId);

    // Call SendGrid validate endpoint
    const validateResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains/${domainId}/validate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
    });

    const validateResult = await validateResponse.json();
    console.log("Validate result:", JSON.stringify(validateResult));

    // Get updated domain info
    const domainResponse = await fetch(`${SENDGRID_API_URL}/whitelabel/domains/${domainId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!domainResponse.ok) {
      console.error("Error fetching domain:", await domainResponse.text());
      throw new Error("Erro ao buscar informações do domínio");
    }

    const domainInfo = await domainResponse.json();
    console.log("Domain info after verify:", JSON.stringify(domainInfo));

    const verificationStatus = domainInfo.valid ? "verified" : "pending";
    const dnsRecords = formatSendGridDnsRecords(domainInfo);
    
    // Check for any failing records
    let verifyError: string | null = null;
    if (!domainInfo.valid) {
      const failingRecords = dnsRecords.filter((r: any) => r.status !== "verified");
      if (failingRecords.length > 0) {
        verifyError = `${failingRecords.length} registro(s) DNS pendente(s)`;
      }
    }

    // Update config
    const { data: updatedConfig, error: updateError } = await supabaseAdmin
      .from("system_email_config")
      .update({
        verification_status: verificationStatus,
        dns_records: dnsRecords,
        verified_at: verificationStatus === "verified" ? new Date().toISOString() : config.verified_at,
        last_verify_check_at: new Date().toISOString(),
        last_verify_error: verifyError,
      })
      .eq("id", config.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating config:", updateError);
      throw new Error("Erro ao atualizar configuração");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        config: updatedConfig,
        verification_status: verificationStatus,
        dns_records: dnsRecords
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in system-email-domain-verify:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
