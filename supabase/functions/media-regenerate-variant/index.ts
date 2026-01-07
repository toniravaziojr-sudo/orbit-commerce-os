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

    const { variant_id, feedback } = await req.json();

    if (!variant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "variant_id é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!feedback || feedback.trim() === "") {
      return new Response(
        JSON.stringify({ success: false, error: "feedback é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get variant with generation info
    const { data: variant, error: variantError } = await supabase
      .from("media_asset_variants")
      .select(`
        *,
        generation:media_asset_generations!inner(*)
      `)
      .eq("id", variant_id)
      .single();

    if (variantError || !variant) {
      return new Response(
        JSON.stringify({ success: false, error: "Variante não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const generation = variant.generation as {
      id: string;
      tenant_id: string;
      calendar_item_id: string;
      prompt_final: string;
      brand_context_snapshot: unknown;
      settings: unknown;
    };

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

    // Build new prompt with feedback
    const feedbackPrompt = `
${generation.prompt_final}

AJUSTES SOLICITADOS:
${feedback}

Aplique os ajustes acima mantendo o conceito original.
`.trim();

    // Create new generation with adjusted prompt
    const { data: newGeneration, error: genError } = await supabase
      .from("media_asset_generations")
      .insert({
        tenant_id: generation.tenant_id,
        calendar_item_id: generation.calendar_item_id,
        provider: "openai",
        model: "gpt-image-1",
        prompt_final: feedbackPrompt,
        brand_context_snapshot: generation.brand_context_snapshot,
        settings: {
          ...(generation.settings as object || {}),
          regenerated_from: variant_id,
          feedback,
        },
        status: "queued",
        variant_count: 1, // Single regeneration
        created_by: user.id,
      })
      .select()
      .single();

    if (genError || !newGeneration) {
      console.error("Generation insert error:", genError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao criar regeneração" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark original variant with feedback
    await supabase
      .from("media_asset_variants")
      .update({
        feedback,
        rejected_at: new Date().toISOString(),
        rejected_reason: "Regenerado com feedback",
      })
      .eq("id", variant_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        generation_id: newGeneration.id,
        message: "Regeneração adicionada à fila" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in media-regenerate-variant:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
