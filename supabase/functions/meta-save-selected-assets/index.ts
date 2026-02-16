import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Save Selected Assets
 * 
 * Recebe os ativos selecionados pelo usuário após o OAuth e atualiza
 * a conexão Meta com apenas os ativos escolhidos.
 * 
 * Contrato:
 * - POST { tenantId, selectedAssets: { pages, instagram_accounts, whatsapp_business_accounts, ad_accounts, catalogs, threads_profile } }
 * - Erro = HTTP 200 + { success: false, error }
 * - Sucesso = HTTP 200 + { success: true }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tenantId, selectedAssets } = body;

    if (!tenantId || !selectedAssets) {
      return new Response(
        JSON.stringify({ success: false, error: "Parâmetros ausentes" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar que o usuário tem acesso ao tenant
    const { data: role } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão existente
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("metadata")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta")
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão Meta não encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metadata = connection.metadata as Record<string, unknown>;

    // Atualizar metadata com ativos selecionados e remover flag de pendência
    const updatedMetadata = {
      ...metadata,
      assets: selectedAssets,
      pending_asset_selection: false,
      asset_selection_completed_at: new Date().toISOString(),
      asset_selection_by: user.id,
    };

    const { error: updateError } = await supabase
      .from("marketplace_connections")
      .update({ metadata: updatedMetadata })
      .eq("tenant_id", tenantId)
      .eq("marketplace", "meta");

    if (updateError) {
      console.error("[meta-save-selected-assets] Erro ao atualizar:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao salvar seleção" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync pixel selecionado para marketing_integrations
    if (selectedAssets.pixels && selectedAssets.pixels.length > 0) {
      const selectedPixel = selectedAssets.pixels[0]; // Usa o primeiro pixel selecionado
      const { error: miError } = await supabase
        .from("marketing_integrations")
        .upsert({
          tenant_id: tenantId,
          meta_pixel_id: selectedPixel.id,
          meta_enabled: true,
        }, {
          onConflict: "tenant_id",
        });
      
      if (miError) {
        console.warn("[meta-save-selected-assets] Aviso: Erro ao sincronizar pixel com marketing_integrations:", miError);
        // Não falha o fluxo — pixel pode ser configurado manualmente depois
      } else {
        console.log(`[meta-save-selected-assets] Pixel ${selectedPixel.id} sincronizado com marketing_integrations`);
      }
    }

    console.log(`[meta-save-selected-assets] Ativos selecionados salvos para tenant ${tenantId}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meta-save-selected-assets] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
