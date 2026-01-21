import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShopeeConnectionStatus {
  success: boolean;
  platformConfigured: boolean;
  isConnected: boolean;
  isExpired: boolean;
  connection: {
    externalUserId: string;
    externalUsername: string;
    connectedAt: string;
    lastSyncAt: string | null;
    lastError: string | null;
    expiresAt: string;
    shopId: number;
    region: string;
  } | null;
  error?: string;
}

/**
 * Shopee Connection Status
 * 
 * Verifica o status da conexão Shopee de um tenant.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verificar usuário
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter tenantId via query param
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se usuário tem acesso ao tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem permissão para este tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se credenciais da plataforma estão configuradas
    const partnerId = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_ID");
    const partnerKey = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_KEY");
    const platformConfigured = !!(partnerId && partnerKey);

    // Buscar conexão do tenant
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "shopee")
      .single();

    if (connError || !connection) {
      const response: ShopeeConnectionStatus = {
        success: true,
        platformConfigured,
        isConnected: false,
        isExpired: false,
        connection: null,
      };
      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se token expirou
    const isExpired = connection.expires_at 
      ? new Date(connection.expires_at) < new Date() 
      : false;

    const metadata = connection.metadata as Record<string, any> || {};

    const response: ShopeeConnectionStatus = {
      success: true,
      platformConfigured,
      isConnected: connection.is_active && !isExpired,
      isExpired,
      connection: {
        externalUserId: connection.external_user_id,
        externalUsername: connection.external_username || "Loja Shopee",
        connectedAt: metadata.connected_at || connection.created_at,
        lastSyncAt: connection.last_sync_at,
        lastError: connection.last_error,
        expiresAt: connection.expires_at,
        shopId: metadata.shop_id || parseInt(connection.external_user_id),
        region: metadata.region || "BR",
      },
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[shopee-connection-status] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
