import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      })
      .eq("id", config.id);

    const statusMessage = isVerified 
      ? "Domínio verificado com sucesso!" 
      : "DNS ainda não propagado. Aguarde alguns minutos e tente novamente.";

    return new Response(
      JSON.stringify({
        success: true,
        verified: isVerified,
        status: newStatus,
        dns_records: domainData.records || [],
        message: statusMessage
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
