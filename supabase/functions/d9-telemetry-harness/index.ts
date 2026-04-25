// ============================================================
// d9-telemetry-harness — Harness técnico ISOLADO para D9
//
// Objetivo: gerar evidência real de gravação na ai_support_tool_calls
// nos 2 cenários que o fluxo principal não dispara organicamente:
//   1. multi-tool no MESMO turn_correlation_id
//   2. tool bloqueada com block_type='pipeline_state_block'
//
// IMPORTANTE: NÃO mexe no fluxo principal do ai-support-chat.
// Usa o MESMO recordToolCall do _shared para garantir que a evidência
// seja idêntica à gerada em produção (mesma sanitização, mesmas colunas).
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordToolCall } from "../_shared/tool-telemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json().catch(() => ({}));
  const tenant_id = body.tenant_id || "d1a4d0ed-8842-495e-b741-540a9a345b25";
  const conversation_id = body.conversation_id || null;

  const turnCorrelationId = crypto.randomUUID();
  const businessContextSource = "tenant_business_context";
  const model = "openai/gpt-4o";

  // ===== Cenário 1: multi-tool no mesmo turn =====
  // Simula o modelo chamando search_products e depois get_product_details
  // no mesmo turn (estado: recommendation).
  recordToolCall(supabase, {
    tenant_id,
    conversation_id,
    message_id: null,
    turn_correlation_id: turnCorrelationId,
    iteration: 1,
    tool_name: "search_products",
    args: { query: "tênis preto", limit: 5 },
    result_preview: JSON.stringify({ products: [{ id: "p1", name: "Tênis Esportivo Preto" }] }),
    success: true,
    duration_ms: 142,
    blocked: false,
    pipeline_state_before: "recommendation",
    pipeline_state_after: "recommendation",
    business_context_source: businessContextSource,
    model,
  });

  recordToolCall(supabase, {
    tenant_id,
    conversation_id,
    message_id: null,
    turn_correlation_id: turnCorrelationId,
    iteration: 2,
    tool_name: "get_product_details",
    args: { product_id: "p1" },
    result_preview: JSON.stringify({ id: "p1", name: "Tênis Esportivo Preto", stock: 12 }),
    success: true,
    duration_ms: 98,
    blocked: false,
    pipeline_state_before: "recommendation",
    pipeline_state_after: "product_detail",
    business_context_source: businessContextSource,
    model,
  });

  // ===== Cenário 2: tool bloqueada (pipeline_state_block) =====
  // Simula o modelo tentando chamar add_to_cart no estado greeting
  // (defesa em profundidade do isToolAllowedInState).
  const blockedTurnId = crypto.randomUUID();
  recordToolCall(supabase, {
    tenant_id,
    conversation_id,
    message_id: null,
    turn_correlation_id: blockedTurnId,
    iteration: 1,
    tool_name: "add_to_cart",
    args: { product_id: "p1", quantity: 1 },
    result_preview: "blocked: tool_not_allowed_in_state_greeting",
    success: false,
    blocked: true,
    block_type: "pipeline_state_block",
    block_reason: "tool_not_allowed_in_state_greeting",
    pipeline_state_before: "greeting",
    pipeline_state_after: "greeting",
    business_context_source: businessContextSource,
    model,
    duration_ms: 0,
  });

  // Aguarda um instante para garantir que os inserts fire-and-forget completem
  await new Promise(r => setTimeout(r, 500));

  return new Response(
    JSON.stringify({
      ok: true,
      multi_tool_turn_correlation_id: turnCorrelationId,
      blocked_turn_correlation_id: blockedTurnId,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
