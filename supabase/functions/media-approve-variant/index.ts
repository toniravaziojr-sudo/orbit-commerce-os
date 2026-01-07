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

    const { variant_id } = await req.json();

    if (!variant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "variant_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get variant with generation info
    const { data: variant, error: variantError } = await supabase
      .from("media_asset_variants")
      .select(`
        *,
        generation:media_asset_generations!inner(
          id,
          tenant_id,
          calendar_item_id
        )
      `)
      .eq("id", variant_id)
      .single();

    if (variantError || !variant) {
      return new Response(
        JSON.stringify({ success: false, error: "Variante não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generation = variant.generation as { id: string; tenant_id: string; calendar_item_id: string };

    // Verify user belongs to tenant
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", generation.tenant_id)
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Download from private bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("media-assets")
      .download(variant.storage_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao baixar arquivo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to public bucket
    const publicPath = `${generation.tenant_id}/${generation.calendar_item_id}/${variant.id}.png`;
    
    const { error: uploadError } = await supabase.storage
      .from("published-assets")
      .upload(publicPath, fileData, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao publicar arquivo" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("published-assets")
      .getPublicUrl(publicPath);

    const publicUrl = publicUrlData.publicUrl;

    // Update variant as approved
    await supabase
      .from("media_asset_variants")
      .update({
        approved_at: new Date().toISOString(),
        public_url: publicUrl,
      })
      .eq("id", variant_id);

    // Update calendar item with approved asset
    await supabase
      .from("media_calendar_items")
      .update({
        asset_url: publicUrl,
        asset_metadata: {
          variant_id: variant_id,
          generation_id: generation.id,
          approved_at: new Date().toISOString(),
        },
      })
      .eq("id", generation.calendar_item_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        public_url: publicUrl,
        message: "Variante aprovada e publicada" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in media-approve-variant:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
