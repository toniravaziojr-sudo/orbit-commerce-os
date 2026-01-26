import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OLIST_API_BASE = "https://api.olist.com";

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

    const { apiToken, accountType } = await req.json();

    if (!apiToken || !accountType) {
      return new Response(
        JSON.stringify({ success: false, error: "apiToken e accountType são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let testResult: { success: boolean; userId?: string; userName?: string; error?: string };

    // Testar Olist Marketplace API
    try {
      const response = await fetch(`${OLIST_API_BASE}/v1/sellers/me`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[olist-test-connection] API error:", response.status, errorText);
        testResult = { success: false, error: "Token inválido ou sem permissão" };
      } else {
        const data = await response.json();
        console.log("[olist-test-connection] Olist response:", JSON.stringify(data));
        testResult = {
          success: true,
          userId: data.id?.toString() || data.seller_id?.toString() || "unknown",
          userName: data.name || data.company_name || "Conta Olist Marketplace",
        };
      }
    } catch (error) {
      console.error("[olist-test-connection] Erro Olist:", error);
      testResult = { success: false, error: "Erro de conexão com API" };
    }

    if (!testResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: testResult.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Conexão válida",
        account: {
          userId: testResult.userId,
          userName: testResult.userName,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro interno";
    console.error("[olist-test-connection] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
