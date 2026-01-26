import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Olist ERP (Tiny) API base URL
const TINY_API_BASE = "https://api.tiny.com.br/api2";
// Olist E-commerce (Vnda) API base URL
const VNDA_API_BASE = "https://api.vnda.com.br/api/v2";

interface ConnectRequest {
  tenantId: string;
  apiToken: string;
  accountType: "erp" | "ecommerce";
}

async function testTinyConnection(token: string): Promise<{ success: boolean; userId?: string; userName?: string; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("token", token);
    formData.append("formato", "JSON");

    const response = await fetch(`${TINY_API_BASE}/info.php`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    console.log("[olist-connect] Tiny info response:", JSON.stringify(data));

    if (data.retorno?.status === "OK" || data.retorno?.cnpj) {
      return {
        success: true,
        userId: data.retorno?.cnpj || data.retorno?.id || "unknown",
        userName: data.retorno?.nome_fantasia || data.retorno?.razao_social || "Conta Olist ERP",
      };
    }

    return {
      success: false,
      error: data.retorno?.erros?.[0]?.erro || "Token inválido ou sem permissão",
    };
  } catch (error) {
    console.error("[olist-connect] Erro ao testar Tiny:", error);
    return { success: false, error: "Erro de conexão com API Olist ERP" };
  }
}

async function testVndaConnection(token: string): Promise<{ success: boolean; userId?: string; userName?: string; error?: string }> {
  try {
    const response = await fetch(`${VNDA_API_BASE}/shop`, {
      headers: {
        Authorization: `Token ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return { success: false, error: "Token inválido ou sem permissão" };
    }

    const data = await response.json();
    console.log("[olist-connect] Vnda shop response:", JSON.stringify(data));

    return {
      success: true,
      userId: data.id?.toString() || "unknown",
      userName: data.name || "Conta Olist E-commerce",
    };
  } catch (error) {
    console.error("[olist-connect] Erro ao testar Vnda:", error);
    return { success: false, error: "Erro de conexão com API Olist E-commerce" };
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

    // Testar conexão com a API correspondente
    let testResult: { success: boolean; userId?: string; userName?: string; error?: string };
    
    if (accountType === "erp") {
      testResult = await testTinyConnection(apiToken);
    } else {
      testResult = await testVndaConnection(apiToken);
    }

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
