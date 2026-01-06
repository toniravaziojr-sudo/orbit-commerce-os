import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * whatsapp-enable: Habilita o canal WhatsApp para um tenant.
 * 
 * Este endpoint CRIA automaticamente uma instância Z-API usando a API de integrador.
 * O fluxo:
 * 1. Tenant clica em "Habilitar WhatsApp"
 * 2. Este endpoint busca o ZAPI_CLIENT_TOKEN (credencial da plataforma)
 * 3. Cria uma nova instância no Z-API via API de integrador
 * 4. Salva instance_id e instance_token no whatsapp_configs
 * 5. Tenant pode então clicar em "Conectar" para gerar QR code
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID().substring(0, 8);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error(`[whatsapp-enable][${traceId}] Auth error:`, authError);
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenant_id } = await req.json();
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[whatsapp-enable][${traceId}] User ${user.id} requesting enable for tenant ${tenant_id}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check permission
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roleData) {
      return new Response(
        JSON.stringify({ success: false, error: "Permission denied - requires owner or admin role" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already has instance
    const { data: existingConfig } = await supabase
      .from("whatsapp_configs")
      .select("id, instance_id, is_enabled")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (existingConfig?.instance_id && existingConfig?.is_enabled) {
      console.log(`[whatsapp-enable][${traceId}] WhatsApp already enabled for tenant`);
      return new Response(
        JSON.stringify({ success: true, message: "WhatsApp já habilitado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingConfig?.instance_id) {
      await supabase
        .from("whatsapp_configs")
        .update({ is_enabled: true })
        .eq("id", existingConfig.id);

      return new Response(
        JSON.stringify({ success: true, message: "WhatsApp habilitado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get platform Z-API client token from platform_credentials table or env var
    let clientToken: string | null = null;
    
    // First try database
    const { data: credData } = await supabase
      .from("platform_credentials")
      .select("credential_value, is_active")
      .eq("credential_key", "ZAPI_CLIENT_TOKEN")
      .single();

    if (credData?.is_active && credData?.credential_value) {
      clientToken = credData.credential_value;
      console.log(`[whatsapp-enable][${traceId}] Using ZAPI_CLIENT_TOKEN from database`);
    } else {
      // Fallback to env var
      clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || null;
      if (clientToken) {
        console.log(`[whatsapp-enable][${traceId}] Using ZAPI_CLIENT_TOKEN from env var`);
      }
    }

    if (!clientToken) {
      console.error(`[whatsapp-enable][${traceId}] ZAPI_CLIENT_TOKEN not configured`);
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Z-API da plataforma não configuradas. Contate o administrador." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant info for instance name
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenant_id)
      .single();

    const instanceName = tenantData?.slug || tenant_id.substring(0, 8);

    // Create instance via Z-API Integrator API
    console.log(`[whatsapp-enable][${traceId}] Creating Z-API instance for tenant ${instanceName}`);
    
    const zapiResponse = await fetch("https://api.z-api.io/instances/integrator/on-demand", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify({
        name: `cc-${instanceName}`,
      }),
    });

    if (!zapiResponse.ok) {
      const errorText = await zapiResponse.text();
      console.error(`[whatsapp-enable][${traceId}] Z-API error:`, zapiResponse.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao criar instância Z-API: ${zapiResponse.status}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const zapiData = await zapiResponse.json();
    console.log(`[whatsapp-enable][${traceId}] Z-API response:`, JSON.stringify(zapiData));

    // Z-API returns: { id, token } or similar structure
    const instanceId = zapiData.id || zapiData.instanceId;
    const instanceToken = zapiData.token || zapiData.instanceToken;

    if (!instanceId || !instanceToken) {
      console.error(`[whatsapp-enable][${traceId}] Invalid Z-API response:`, zapiData);
      return new Response(
        JSON.stringify({ success: false, error: "Resposta inválida da Z-API" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to whatsapp_configs
    const webhookUrl = `${supabaseUrl}/functions/v1/support-webhook?channel=whatsapp&tenant=${tenant_id}`;

    const { error: upsertError } = await supabase
      .from("whatsapp_configs")
      .upsert(
        {
          tenant_id,
          instance_id: instanceId,
          instance_token: instanceToken,
          client_token: clientToken,
          is_enabled: true,
          connection_status: "disconnected",
          webhook_url: webhookUrl,
        },
        { onConflict: "tenant_id" }
      );

    if (upsertError) {
      console.error(`[whatsapp-enable][${traceId}] Upsert error:`, upsertError);
      return new Response(
        JSON.stringify({ success: false, error: "Error saving WhatsApp config" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[whatsapp-enable][${traceId}] Successfully created instance ${instanceId} for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp habilitado! Clique em Conectar para gerar o QR Code.",
        instance_id: instanceId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[whatsapp-enable][${traceId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
