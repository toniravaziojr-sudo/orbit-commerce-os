import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * whatsapp-enable: Habilita o canal WhatsApp para um tenant.
 * 
 * Este endpoint NÃO cria instâncias Z-API automaticamente.
 * O fluxo correto é:
 * 1. Admin cria a instância no painel Z-API manualmente
 * 2. Admin configura as credenciais em Integrações da Plataforma (whatsapp-admin-instances)
 * 3. Tenant clica em "Habilitar WhatsApp" → este endpoint cria o registro básico
 * 4. Tenant clica em "Conectar" → whatsapp-connect busca QR code
 */

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

    // Check if config already exists
    const { data: existingConfig } = await supabase
      .from("whatsapp_configs")
      .select("id, instance_id, is_enabled")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    // If already has instance_id and is enabled, just return success
    if (existingConfig?.instance_id && existingConfig?.is_enabled) {
      console.log(`[whatsapp-enable][${traceId}] WhatsApp already enabled for tenant`);
      return new Response(
        JSON.stringify({ success: true, message: "WhatsApp já habilitado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If config exists but not enabled, just enable it
    if (existingConfig?.instance_id) {
      console.log(`[whatsapp-enable][${traceId}] Enabling existing config`);
      
      await supabase
        .from("whatsapp_configs")
        .update({ is_enabled: true })
        .eq("id", existingConfig.id);

      return new Response(
        JSON.stringify({ success: true, message: "WhatsApp habilitado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No config exists or no instance_id - create/update basic config
    // The instance_id, instance_token, client_token will be set later via:
    // - Platform admin in whatsapp-admin-instances (for platform tenant)
    // - Or manually configured
    console.log(`[whatsapp-enable][${traceId}] Creating basic config for tenant (credentials pending)`);

    const webhookUrl = `${supabaseUrl}/functions/v1/support-webhook?channel=whatsapp&tenant=${tenant_id}`;

    const { error: upsertError } = await supabase
      .from("whatsapp_configs")
      .upsert(
        {
          tenant_id,
          is_enabled: true,
          connection_status: "disconnected",
          webhook_url: webhookUrl,
          // instance_id, instance_token, client_token ficam NULL
          // Serão preenchidos pelo admin ou via outro fluxo
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

    console.log(`[whatsapp-enable][${traceId}] Successfully enabled WhatsApp for tenant ${tenant_id} (credentials pending)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "WhatsApp habilitado. Configure as credenciais para conectar.",
        credentials_pending: true
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
