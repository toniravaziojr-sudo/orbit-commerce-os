import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenantId");

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar se o usuário tem acesso ao tenant
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claims, error: claimsError } = await userClient.auth.getUser();
    if (claimsError || !claims?.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso ao tenant
    const { data: role } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", claims.user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!role) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso a este tenant" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão existente
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "olist")
      .maybeSingle();

    if (connError) {
      console.error("[olist-connection-status] Erro ao buscar conexão:", connError);
      throw new Error("Erro ao verificar conexão");
    }

    const now = new Date();
    const isConnected = connection?.is_active === true;
    const expiresAt = connection?.expires_at ? new Date(connection.expires_at) : null;
    const isExpired = expiresAt ? expiresAt < now : false;

    return new Response(
      JSON.stringify({
        success: true,
        platformConfigured: true, // Olist não requer config de plataforma
        isConnected: isConnected && !isExpired,
        isExpired,
        connection: connection
          ? {
              externalUserId: connection.external_user_id || "",
              externalUsername: connection.external_username || "",
              connectedAt: connection.connected_at || connection.created_at,
              lastSyncAt: connection.last_sync_at,
              lastError: connection.last_error,
              expiresAt: connection.expires_at,
              accountType: connection.metadata?.accountType || "erp",
            }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[olist-connection-status] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
