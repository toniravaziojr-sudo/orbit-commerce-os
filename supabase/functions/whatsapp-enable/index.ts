import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Busca uma credencial da plataforma (banco ou env var fallback).
 */
async function getCredential(
  supabaseUrl: string,
  supabaseServiceKey: string,
  credentialKey: string
): Promise<string | null> {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('platform_credentials')
      .select('credential_value, is_active')
      .eq('credential_key', credentialKey)
      .single();
    
    if (!error && data?.is_active && data?.credential_value) {
      console.log(`[whatsapp-enable] Using DB value for ${credentialKey}`);
      return data.credential_value;
    }
  } catch (err) {
    console.log(`[whatsapp-enable] DB lookup failed for ${credentialKey}, using env var fallback`);
  }
  
  const envValue = Deno.env.get(credentialKey);
  return envValue || null;
}

/**
 * Cria uma instância Z-API automaticamente via API de parceiros.
 * Retorna { instanceId, instanceToken } se sucesso, null se falha.
 */
async function createZapiInstance(
  clientToken: string,
  tenantName: string,
  tenantId: string,
  webhookBaseUrl: string
): Promise<{ instanceId: string; instanceToken: string } | null> {
  const traceId = crypto.randomUUID().substring(0, 8);
  
  try {
    console.log(`[whatsapp-enable][${traceId}] Creating Z-API instance for tenant: ${tenantName}`);
    
    // Webhook URLs seguindo padrão Z-API
    const webhookUrl = `${webhookBaseUrl}/functions/v1/support-webhook?channel=whatsapp&tenant=${tenantId}`;
    
    // Gerar nome seguro: apenas alfanuméricos, max 30 chars
    const safeName = (tenantName || 'tenant')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 20);
    const shortId = tenantId.replace(/-/g, '').substring(0, 8);
    const instanceName = `CC${safeName}${shortId}`;
    
    const response = await fetch('https://api.z-api.io/instances/integrator/on-demand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        name: instanceName,
        receivedCallbackUrl: webhookUrl,
        deliveryCallbackUrl: webhookUrl,
        disconnectedCallbackUrl: webhookUrl,
        connectedCallbackUrl: webhookUrl,
        messageStatusCallbackUrl: webhookUrl,
        isDevice: false,
        businessDevice: true,
      }),
    });
    
    const responseText = await response.text();
    console.log(`[whatsapp-enable][${traceId}] Z-API response (${response.status}): ${responseText.substring(0, 300)}`);
    
    if (!response.ok) {
      console.error(`[whatsapp-enable][${traceId}] Z-API create instance failed: ${response.status}`);
      return null;
    }
    
    const data = JSON.parse(responseText);
    
    if (!data.id || !data.token) {
      console.error(`[whatsapp-enable][${traceId}] Z-API response missing id or token`);
      return null;
    }
    
    console.log(`[whatsapp-enable][${traceId}] Instance created: id=${data.id.substring(0, 8)}...`);
    
    return {
      instanceId: data.id,
      instanceToken: data.token,
    };
  } catch (error: any) {
    console.error(`[whatsapp-enable][${traceId}] Error creating Z-API instance:`, error.message);
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID().substring(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's token to verify auth
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get user from token
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error(`[whatsapp-enable][${traceId}] Auth error:`, authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse body
    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[whatsapp-enable][${traceId}] User ${user.id} requesting enable for tenant ${tenant_id}`);

    // Create service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user has owner/admin role for this tenant
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (roleError) {
      console.error(`[whatsapp-enable][${traceId}] Role check error:`, roleError);
      return new Response(
        JSON.stringify({ success: false, error: "Error checking permissions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      console.log(`[whatsapp-enable][${traceId}] User ${user.id} lacks owner/admin role for tenant ${tenant_id}`);
      return new Response(
        JSON.stringify({ success: false, error: "Permission denied - requires owner or admin role" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch tenant info
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .eq("id", tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error(`[whatsapp-enable][${traceId}] Tenant fetch error:`, tenantError);
      return new Response(
        JSON.stringify({ success: false, error: "Tenant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if instance already exists
    const { data: existingConfig } = await supabase
      .from("whatsapp_configs")
      .select("id, instance_id, is_enabled")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // If already has instance_id, just enable and return
    if (existingConfig?.instance_id) {
      console.log(`[whatsapp-enable][${traceId}] Instance already exists for tenant, just enabling`);
      
      await supabase
        .from("whatsapp_configs")
        .update({ is_enabled: true })
        .eq("id", existingConfig.id);

      return new Response(
        JSON.stringify({ success: true, message: "WhatsApp já configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform ZAPI_CLIENT_TOKEN
    const clientToken = await getCredential(supabaseUrl, supabaseServiceKey, 'ZAPI_CLIENT_TOKEN');
    
    if (!clientToken) {
      console.error(`[whatsapp-enable][${traceId}] ZAPI_CLIENT_TOKEN not configured`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "WhatsApp não está disponível. Contate o suporte.",
          code: "NO_PLATFORM_CREDENTIALS"
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Auto-provision Z-API instance
    const instanceData = await createZapiInstance(
      clientToken,
      tenant.name || tenant.slug,
      tenant_id,
      supabaseUrl
    );

    if (!instanceData) {
      console.error(`[whatsapp-enable][${traceId}] Failed to create Z-API instance`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Erro ao provisionar WhatsApp. Tente novamente ou contate o suporte.",
          code: "PROVISION_FAILED"
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert whatsapp_configs with the new instance credentials
    const { error: upsertError } = await supabase
      .from("whatsapp_configs")
      .upsert(
        {
          tenant_id,
          instance_id: instanceData.instanceId,
          instance_token: instanceData.instanceToken,
          client_token: clientToken, // Use platform client token
          is_enabled: true,
          connection_status: "disconnected",
          webhook_url: `${supabaseUrl}/functions/v1/support-webhook?channel=whatsapp&tenant=${tenant_id}`,
        },
        { onConflict: "tenant_id" }
      );

    if (upsertError) {
      console.error(`[whatsapp-enable][${traceId}] Upsert error:`, upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Error enabling WhatsApp" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[whatsapp-enable][${traceId}] Successfully enabled and provisioned WhatsApp for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp habilitado com sucesso",
        provisioned: true 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[whatsapp-enable][${traceId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
