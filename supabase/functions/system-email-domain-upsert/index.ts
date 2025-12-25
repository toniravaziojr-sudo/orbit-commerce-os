import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Verify user is platform operator (has owner role on any tenant for now)
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

    // Check if user is platform operator (owner of at least one tenant)
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .limit(1);

    if (!roles || roles.length === 0) {
      throw new Error("Apenas operadores da plataforma podem configurar o email do sistema");
    }

    const { sending_domain } = await req.json();

    if (!sending_domain) {
      throw new Error("sending_domain é obrigatório");
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resend = new Resend(resendApiKey);

    // Get current config
    const { data: currentConfig, error: fetchError } = await supabaseAdmin
      .from("system_email_config")
      .select("*")
      .limit(1)
      .single();

    if (fetchError) {
      console.error("Error fetching config:", fetchError);
      throw new Error("Erro ao buscar configuração do sistema");
    }

    let domainId = currentConfig.resend_domain_id;
    let dnsRecords: any[] = [];
    let verificationStatus = "pending";

    // If domain already exists in Resend, get its info
    if (domainId) {
      try {
        const domainInfo = await resend.domains.get(domainId);
        console.log("Existing domain info:", domainInfo);
        
        if (domainInfo.data) {
          dnsRecords = domainInfo.data.records || [];
          verificationStatus = domainInfo.data.status === "verified" ? "verified" : "pending";
        }
      } catch (e: any) {
        console.log("Domain not found in Resend, will create new:", e.message);
        domainId = null;
      }
    }

    // If no domain exists, create one
    if (!domainId) {
      try {
        console.log("Creating domain in Resend:", sending_domain);
        const createResult = await resend.domains.create({ name: sending_domain });
        console.log("Create result:", createResult);

        if (createResult.error) {
          // Check if domain already exists
          if (createResult.error.message?.includes("already exists")) {
            // List domains to find it
            const listResult = await resend.domains.list();
            console.log("List domains result:", listResult);
            
            const domains = (listResult as any).data?.data || (listResult as any).data || [];
            if (Array.isArray(domains)) {
              const existingDomain = domains.find(
                (d: any) => d.name === sending_domain
              );
              if (existingDomain) {
                domainId = existingDomain.id;
                dnsRecords = existingDomain.records || [];
                verificationStatus = existingDomain.status === "verified" ? "verified" : "pending";
              }
            }
          } else {
            throw new Error(createResult.error.message);
          }
        } else if (createResult.data) {
          domainId = createResult.data.id;
          dnsRecords = createResult.data.records || [];
          verificationStatus = "pending";
        }
      } catch (e: any) {
        console.error("Error creating domain:", e);
        throw new Error(`Erro ao criar domínio no Resend: ${e.message}`);
      }
    }

    // Update config
    const { data: updatedConfig, error: updateError } = await supabaseAdmin
      .from("system_email_config")
      .update({
        sending_domain,
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
      throw new Error("Erro ao atualizar configuração");
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
    console.error("Error in system-email-domain-upsert:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
