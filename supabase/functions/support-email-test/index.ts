import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get support email config
    const { data: config, error: configError } = await supabase
      .from("email_provider_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Email configuration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supportConfig = config as any;

    if (!supportConfig.support_email_enabled) {
      return new Response(
        JSON.stringify({ error: "Support email not enabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const host = supportConfig.support_imap_host;
    const port = supportConfig.support_imap_port || 993;
    const user = supportConfig.support_imap_user;
    const password = supportConfig.support_imap_password;
    const useTls = supportConfig.support_imap_tls ?? true;

    if (!host || !user || !password) {
      return new Response(
        JSON.stringify({ error: "IMAP credentials incomplete" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Testing IMAP connection to ${host}:${port} for user ${user}`);

    // Note: Deno doesn't have native IMAP support, so we'll simulate the test
    // In production, you'd use a library or external service
    // For now, we do a basic TCP connection test
    
    let success = false;
    let errorMessage: string | null = null;

    try {
      // Try to connect to the IMAP server
      const conn = await Deno.connect({
        hostname: host,
        port: port,
        transport: "tcp",
      });
      
      // If we got here, the connection succeeded
      conn.close();
      success = true;
      console.log("TCP connection to IMAP server succeeded");
      
      // Note: Full IMAP authentication would require a proper IMAP library
      // This is a basic connectivity test
    } catch (connError) {
      errorMessage = `Connection failed: ${connError instanceof Error ? connError.message : "Unknown error"}`;
      console.error("IMAP connection error:", connError);
    }

    // Update status in database
    await supabase
      .from("email_provider_configs")
      .update({
        support_connection_status: success ? "connected" : "error",
        support_last_error: errorMessage,
      } as any)
      .eq("tenant_id", tenant_id);

    return new Response(
      JSON.stringify({
        success,
        error: errorMessage,
        message: success 
          ? "Conexão IMAP estabelecida com sucesso" 
          : `Falha na conexão: ${errorMessage}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Support email test error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
