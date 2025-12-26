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

    // First try to find domain in Resend (idempotent - don't fail if it exists)
    console.log(`[email-domain-upsert] Checking if domain ${sending_domain} exists in Resend...`);
    
    let domainData: any = null;
    let domainStatus = "pending";
    let dnsRecords: any[] = [];
    
    try {
      const listResult = await resend.domains.list();
      console.log(`[email-domain-upsert] List domains result:`, JSON.stringify(listResult).slice(0, 500));
      
      const domainsList = (listResult as any).data?.data || (listResult as any).data || [];
      if (Array.isArray(domainsList)) {
        const existingDomain = domainsList.find((d: any) => d.name === sending_domain);
        
        if (existingDomain) {
          console.log(`[email-domain-upsert] Domain already exists in Resend: ${existingDomain.id}`);
          domainData = existingDomain;
          domainStatus = existingDomain.status === "verified" ? "verified" : "pending";
          dnsRecords = existingDomain.records || [];
        }
      }
    } catch (listError) {
      console.error("[email-domain-upsert] Error listing domains:", listError);
    }
    
    // If domain doesn't exist, create it
    if (!domainData) {
      console.log(`[email-domain-upsert] Creating new domain in Resend: ${sending_domain}`);
      
      const createResult = await resend.domains.create({
        name: sending_domain,
      });

      if (createResult.error) {
        console.error("[email-domain-upsert] Resend create error:", JSON.stringify(createResult.error));
        
        const errorMessage = createResult.error.message || JSON.stringify(createResult.error);
        
        // Even if it says already exists, try to list again
        if (errorMessage.includes("already exists") || errorMessage.includes("already been added")) {
          try {
            const retryList = await resend.domains.list();
            const retryDomainsList = (retryList as any).data?.data || (retryList as any).data || [];
            if (Array.isArray(retryDomainsList)) {
              const found = retryDomainsList.find((d: any) => d.name === sending_domain);
              if (found) {
                domainData = found;
                domainStatus = found.status === "verified" ? "verified" : "pending";
                dnsRecords = found.records || [];
                console.log(`[email-domain-upsert] Found domain on retry: ${found.id}`);
              }
            }
          } catch (retryErr) {
            console.error("[email-domain-upsert] Retry list error:", retryErr);
          }
        }
        
        if (!domainData) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: `Erro ao criar domínio no Resend: ${errorMessage}`,
              provider_error: createResult.error,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } else {
        domainData = createResult.data;
        dnsRecords = domainData?.records || [];
        console.log(`[email-domain-upsert] Domain created:`, JSON.stringify(domainData).slice(0, 500));
      }
    }
    
    if (!domainData?.id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Não foi possível obter o ID do domínio no Resend" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert email config
    const upsertPayload = {
      tenant_id,
      sending_domain,
      resend_domain_id: domainData?.id,
      dns_records: dnsRecords,
      verification_status: domainStatus,
      verified_at: domainStatus === "verified" ? new Date().toISOString() : null,
      last_verify_check_at: new Date().toISOString(),
      provider_type: "resend",
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
      // Insert new config with required fields
      const insertPayload = {
        ...upsertPayload,
        from_name: "", // Will be set by user later
        from_email: "", // Will be set by user later
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

    console.log(`[email-domain-upsert] Success! Domain: ${domainData?.id}, Status: ${domainStatus}`);

    return new Response(
      JSON.stringify({
        success: true,
        domain_id: domainData?.id,
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
