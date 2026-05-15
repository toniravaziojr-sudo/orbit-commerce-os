// DEPRECATED — substituída por `correios-content-declaration-issue` (motor único).
// Mantida apenas como stub para evitar 404 em chamadas residuais.
// NÃO USAR. Ver docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      success: false,
      error: "deprecated_endpoint",
      replacement: "correios-content-declaration-issue",
      message:
        "dce-emit foi descontinuada. Use a nova função correios-content-declaration-issue para Declaração de Conteúdo dos Correios.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
