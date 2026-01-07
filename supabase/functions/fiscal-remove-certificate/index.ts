import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's tenant
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("current_tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Tenant não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Clear certificate fields from fiscal_settings (using correct column names)
    const { error: updateError } = await supabase
      .from("fiscal_settings")
      .update({
        certificado_pfx: null,
        certificado_senha: null,
        certificado_cn: null,
        certificado_cnpj: null,
        certificado_valido_ate: null,
        certificado_serial: null,
        certificado_uploaded_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);

    if (updateError) {
      console.error("[fiscal-remove-certificate] Update error:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao remover certificado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[fiscal-remove-certificate] Certificate removed for tenant ${tenantId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[fiscal-remove-certificate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
