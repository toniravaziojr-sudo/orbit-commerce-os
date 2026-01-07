import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { storage_path, variant_id } = await req.json();

    let pathToSign = storage_path;

    // If variant_id provided, fetch the storage path
    if (variant_id && !storage_path) {
      const { data: variant, error: variantError } = await supabase
        .from("media_asset_variants")
        .select(`
          storage_path,
          generation:media_asset_generations!inner(tenant_id)
        `)
        .eq("id", variant_id)
        .single();

      if (variantError || !variant) {
        return new Response(
          JSON.stringify({ success: false, error: "Variante não encontrada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user belongs to tenant
      const generationData = variant.generation as unknown as { tenant_id: string };
      const tenantId = generationData.tenant_id;
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .single();

      if (!userRole) {
        return new Response(
          JSON.stringify({ success: false, error: "Sem permissão" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      pathToSign = variant.storage_path;
    }

    if (!pathToSign) {
      return new Response(
        JSON.stringify({ success: false, error: "storage_path ou variant_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to this path (tenant check via path structure)
    const pathTenantId = pathToSign.split("/")[0];
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", pathTenantId)
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para este arquivo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate signed URL (60 minutes expiry)
    const { data: signedUrl, error: signError } = await supabase.storage
      .from("media-assets")
      .createSignedUrl(pathToSign, 3600); // 60 minutes

    if (signError || !signedUrl) {
      console.error("Signed URL error:", signError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao gerar URL" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        signed_url: signedUrl.signedUrl,
        expires_in: 3600 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in media-get-signed-url:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
