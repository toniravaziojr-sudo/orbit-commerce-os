// Smoke test isolado do TPR — Fase 1 AI Provider Routing.
// Chama classifyTurn() diretamente e retorna provider/modelo/latência.
// NÃO toca composer, Catalog Probe, search_products, Orchestrator ou Onda 1C.
// Uso: invocar com { message: "..." } e ler logs do TPR para o provider real.

import { classifyTurn } from "../_shared/sales-pipeline/turn-pre-router.ts";
import { resetAIRouterCache } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message: string = body.message || "Oi";

    resetAIRouterCache();

    const t0 = Date.now();
    const cls = await classifyTurn({
      customerMessage: message,
      recentHistory: [],
      hasMediaAttachment: false,
      productNamesHint: [],
      timeoutMs: 5000,
    });
    const wall = Date.now() - t0;

    return new Response(
      JSON.stringify({
        success: true,
        wall_ms: wall,
        message_used: message,
        classification: cls,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
