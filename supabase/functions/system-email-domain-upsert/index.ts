import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Only this email can manage system email settings
const PLATFORM_ADMIN_EMAIL = "respeiteohomem@gmail.com";

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

    // Check if user is the platform admin
    if (user.email !== PLATFORM_ADMIN_EMAIL) {
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

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY não configurada no servidor" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar configuração do sistema: " + fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let domainId = currentConfig.resend_domain_id;
    let dnsRecords: any[] = [];
    let verificationStatus = "pending";

    // First, try to find existing domain in Resend by listing all domains
    console.log("Listing all domains in Resend...");
    try {
      const listResult = await resend.domains.list();
      console.log("Resend domains list response:", JSON.stringify(listResult));
      
      // Handle different response structures
      const domains = (listResult as any)?.data?.data || (listResult as any)?.data || [];
      
      if (Array.isArray(domains)) {
        const existingDomain = domains.find((d: any) => d.name === cleanDomain);
        if (existingDomain) {
          console.log("Found existing domain:", existingDomain);
          domainId = existingDomain.id;
          dnsRecords = existingDomain.records || [];
          verificationStatus = existingDomain.status === "verified" ? "verified" : "pending";
        }
      }
    } catch (listError: any) {
      console.error("Error listing domains:", listError);
      // Continue - we'll try to create or fetch by ID
    }

    // If we have a domain ID (from DB or list), try to get its current info
    if (domainId) {
      console.log("Fetching domain info for ID:", domainId);
      try {
        const domainInfo = await resend.domains.get(domainId);
        console.log("Domain info response:", JSON.stringify(domainInfo));
        
        if (domainInfo.data) {
          dnsRecords = domainInfo.data.records || [];
          verificationStatus = domainInfo.data.status === "verified" ? "verified" : "pending";
        }
      } catch (getError: any) {
        console.log("Could not fetch domain by ID, may need to create:", getError.message);
        domainId = null; // Reset to trigger creation
      }
    }

    // If no domain exists, create one
    if (!domainId) {
      console.log("Creating new domain in Resend:", cleanDomain);
      try {
        const createResult = await resend.domains.create({ name: cleanDomain });
        console.log("Create domain result:", JSON.stringify(createResult));

        if (createResult.error) {
          // Check if domain already exists
          const errorMessage = createResult.error.message || String(createResult.error);
          console.log("Create error message:", errorMessage);
          
          if (errorMessage.includes("already") || errorMessage.includes("exists") || errorMessage.includes("conflict")) {
            // Domain already exists - try to find it
            console.log("Domain already exists, searching in list...");
            const listResult = await resend.domains.list();
            const domains = (listResult as any)?.data?.data || (listResult as any)?.data || [];
            
            if (Array.isArray(domains)) {
              const existingDomain = domains.find((d: any) => d.name === cleanDomain);
              if (existingDomain) {
                domainId = existingDomain.id;
                dnsRecords = existingDomain.records || [];
                verificationStatus = existingDomain.status === "verified" ? "verified" : "pending";
              } else {
                console.error("Domain reported as existing but not found in list");
                return new Response(
                  JSON.stringify({ 
                    success: false, 
                    error: `Domínio já existe no Resend mas não foi encontrado. Verifique no painel do Resend.`,
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
                error: `Erro ao criar domínio no Resend: ${errorMessage}`,
                details: errorMessage
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else if (createResult.data) {
          domainId = createResult.data.id;
          dnsRecords = createResult.data.records || [];
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
