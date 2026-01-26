import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TINY_API_BASE = "https://api.tiny.com.br/api2";
const VNDA_API_BASE = "https://api.vnda.com.br/api/v2";

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

    if (accountType === "erp") {
      // Testar Olist ERP (Tiny)
      try {
        const formData = new FormData();
        formData.append("token", apiToken);
        formData.append("formato", "JSON");

        const response = await fetch(`${TINY_API_BASE}/info.php`, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        console.log("[olist-test-connection] Tiny response:", JSON.stringify(data));

        if (data.retorno?.status === "OK" || data.retorno?.cnpj) {
          testResult = {
            success: true,
            userId: data.retorno?.cnpj || "unknown",
            userName: data.retorno?.nome_fantasia || data.retorno?.razao_social || "Conta Olist ERP",
          };
        } else {
          testResult = {
            success: false,
            error: data.retorno?.erros?.[0]?.erro || "Token inválido",
          };
        }
      } catch (error) {
        console.error("[olist-test-connection] Erro Tiny:", error);
        testResult = { success: false, error: "Erro de conexão com API" };
      }
    } else {
      // Testar Olist E-commerce (Vnda)
      try {
        const response = await fetch(`${VNDA_API_BASE}/shop`, {
          headers: {
            Authorization: `Token ${apiToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          testResult = { success: false, error: "Token inválido ou sem permissão" };
        } else {
          const data = await response.json();
          testResult = {
            success: true,
            userId: data.id?.toString() || "unknown",
            userName: data.name || "Conta Olist E-commerce",
          };
        }
      } catch (error) {
        console.error("[olist-test-connection] Erro Vnda:", error);
        testResult = { success: false, error: "Erro de conexão com API" };
      }
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
