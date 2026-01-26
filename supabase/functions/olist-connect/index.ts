import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Olist Marketplace API base URL
const OLIST_API_BASE = "https://api.olist.com";

interface ConnectRequest {
  tenantId: string;
  apiToken: string;
  accountType: "marketplace";
}

async function testOlistMarketplaceConnection(token: string): Promise<{ success: boolean; userId?: string; userName?: string; error?: string }> {
  try {
    // Olist Marketplace API - verificar seller info
    const response = await fetch(`${OLIST_API_BASE}/v1/sellers/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[olist-connect] API error:", response.status, errorText);
      return { success: false, error: "Token inválido ou sem permissão" };
    }

    const data = await response.json();
    console.log("[olist-connect] Olist seller response:", JSON.stringify(data));

    return {
      success: true,
      userId: data.id?.toString() || data.seller_id?.toString() || "unknown",
      userName: data.name || data.company_name || "Conta Olist Marketplace",
    };
  } catch (error) {
    console.error("[olist-connect] Erro ao testar Olist:", error);
    return { success: false, error: "Erro de conexão com API Olist Marketplace" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ConnectRequest = await req.json();
    const { tenantId, apiToken, accountType } = body;

    if (!tenantId || !apiToken || !accountType) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId, apiToken e accountType são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validar usuário
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

    // Testar conexão com a API Olist Marketplace
    const testResult = await testOlistMarketplaceConnection(apiToken);

    if (!testResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: testResult.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar conexão
    const { error: upsertError } = await supabase
      .from("marketplace_connections")
      .upsert(
        {
          tenant_id: tenantId,
          marketplace: "olist",
          access_token: apiToken, // Token de API
          external_user_id: testResult.userId,
          external_username: testResult.userName,
          is_active: true,
          connected_at: new Date().toISOString(),
          last_sync_at: null,
          last_error: null,
          metadata: { accountType },
        },
        { onConflict: "tenant_id,marketplace" }
      );

    if (upsertError) {
      console.error("[olist-connect] Erro ao salvar conexão:", upsertError);
      throw new Error("Erro ao salvar conexão");
    }

    console.log(`[olist-connect] Tenant ${tenantId} conectado com Olist ${accountType}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conectado com sucesso",
        connection: {
          externalUserId: testResult.userId,
          externalUsername: testResult.userName,
          accountType,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[olist-connect] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
