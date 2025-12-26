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
      console.error("[email-domain-upsert] RESEND_API_KEY not configured");
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

    const { tenant_id, sending_domain: rawSendingDomain } = await req.json();

    if (!tenant_id || !rawSendingDomain) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id e sending_domain são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract domain from email if user provided full email address
    // e.g., "contato@respeiteohomem.com.br" -> "respeiteohomem.com.br"
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
          error: `Domínio inválido: "${sending_domain}". Informe apenas o domínio (ex.: respeiteohomem.com.br)` 
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

    const resend = new Resend(resendApiKey);

    // Check if domain already exists in Resend
    if (existingConfig?.resend_domain_id && existingConfig?.sending_domain === sending_domain) {
      // Same domain, just fetch current status
      console.log(`[email-domain-upsert] Domain already registered, fetching status from Resend`);
      
      try {
        const domainResult = await resend.domains.get(existingConfig.resend_domain_id);
        
        if (domainResult.error) {
          console.error("[email-domain-upsert] Error fetching domain from Resend:", domainResult.error);
        } else if (domainResult.data) {
          const status = domainResult.data.status === "verified" ? "verified" : 
                         domainResult.data.status === "pending" ? "pending" : "failed";
          
          // Update config with current status
          await supabase
            .from("email_provider_configs")
            .update({
              dns_records: domainResult.data.records || [],
              verification_status: status,
              verified_at: status === "verified" ? new Date().toISOString() : null,
              last_verify_check_at: new Date().toISOString(),
            })
            .eq("id", existingConfig.id);

          return new Response(
            JSON.stringify({
              success: true,
              domain_id: existingConfig.resend_domain_id,
              status: status,
              dns_records: domainResult.data.records || [],
              message: "Domínio já registrado"
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.error("[email-domain-upsert] Error calling Resend:", e);
      }
    }

    // Create new domain in Resend
    console.log(`[email-domain-upsert] Creating new domain in Resend: ${sending_domain}`);
    
    const createResult = await resend.domains.create({
      name: sending_domain,
    });

    if (createResult.error) {
      console.error("[email-domain-upsert] Resend create error:", createResult.error);
      
      // Check if domain already exists error
      const errorMessage = createResult.error.message || JSON.stringify(createResult.error);
      if (errorMessage.includes("already exists") || errorMessage.includes("already been added")) {
        // Try to list domains and find ours
        const listResult = await resend.domains.list();
        const domainsList = (listResult as any).data?.data || (listResult as any).data || [];
        if (Array.isArray(domainsList)) {
          const existingDomain = domainsList.find(
            (d: any) => d.name === sending_domain
          );
          
          if (existingDomain) {
            console.log(`[email-domain-upsert] Domain found in Resend, using existing: ${existingDomain.id}`);
            
            // Update config with existing domain
            const upsertPayload = {
              tenant_id,
              sending_domain,
              resend_domain_id: existingDomain.id,
              dns_records: existingDomain.records || [],
              verification_status: existingDomain.status === "verified" ? "verified" : "pending",
              verified_at: existingDomain.status === "verified" ? new Date().toISOString() : null,
              last_verify_check_at: new Date().toISOString(),
              provider_type: "resend",
            };

            if (existingConfig?.id) {
              await supabase
                .from("email_provider_configs")
                .update(upsertPayload)
                .eq("id", existingConfig.id);
            } else {
              await supabase
                .from("email_provider_configs")
                .insert(upsertPayload);
            }

            return new Response(
              JSON.stringify({
                success: true,
                domain_id: existingDomain.id,
                status: existingDomain.status === "verified" ? "verified" : "pending",
                dns_records: existingDomain.records || [],
                message: "Domínio já existente no Resend foi vinculado"
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Erro ao criar domínio no Resend: ${errorMessage}` 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainData = createResult.data;
    console.log(`[email-domain-upsert] Domain created in Resend:`, domainData);

    // Upsert email config
    const upsertPayload = {
      tenant_id,
      sending_domain,
      resend_domain_id: domainData?.id,
      dns_records: domainData?.records || [],
      verification_status: "pending",
      last_verify_check_at: new Date().toISOString(),
      provider_type: "resend",
    };

    if (existingConfig?.id) {
      await supabase
        .from("email_provider_configs")
        .update(upsertPayload)
        .eq("id", existingConfig.id);
    } else {
      await supabase
        .from("email_provider_configs")
        .insert(upsertPayload);
    }

    return new Response(
      JSON.stringify({
        success: true,
        domain_id: domainData?.id,
        status: "pending",
        dns_records: domainData?.records || [],
        message: "Domínio criado. Configure os registros DNS abaixo."
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
