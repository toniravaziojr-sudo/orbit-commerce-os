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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY não configurada");
    }

    const resend = new Resend(resendApiKey);

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

    console.log("Verifying domain:", config.resend_domain_id);

    // Verify domain in Resend
    const verifyResult = await resend.domains.verify(config.resend_domain_id);
    console.log("Verify result:", verifyResult);

    // Get updated domain info
    const domainInfo = await resend.domains.get(config.resend_domain_id);
    console.log("Domain info after verify:", domainInfo);

    let verificationStatus = "pending";
    let dnsRecords: any[] = [];
    let verifyError: string | null = null;

    if (domainInfo.data) {
      verificationStatus = domainInfo.data.status === "verified" ? "verified" : "pending";
      dnsRecords = domainInfo.data.records || [];
      
      // Check for any failing records
      const failingRecords = dnsRecords.filter((r: any) => r.status === "not_started" || r.status === "pending");
      if (failingRecords.length > 0 && verificationStatus !== "verified") {
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
