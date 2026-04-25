/**
 * D8 Brain Harness — prova fim a fim que insights aprovados são injetados
 * no system prompt dos agentes via _shared/brain-context.ts.
 *
 * Uso: GET /functions/v1/d8-brain-harness?tenant_id=...&agent=vendas
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { getBrainContextForPrompt, getBrainInsights, type BrainAgent } from "../_shared/brain-context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id") ?? "";
    const agent = (url.searchParams.get("agent") ?? "vendas") as BrainAgent;

    if (!tenantId) {
      return new Response(JSON.stringify({ ok: false, error: "tenant_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const insights = await getBrainInsights(supabase, tenantId, agent);
    const promptBlock = await getBrainContextForPrompt(supabase, tenantId, agent);
    const finalSystemPrompt = `Você é o agente de ${agent} da loja.\n${promptBlock}`;

    return new Response(JSON.stringify({
      ok: true,
      agent,
      tenant_id: tenantId,
      insights_count: insights.length,
      insight_ids: insights.map(i => i.id),
      prompt_block_length: promptBlock.length,
      prompt_block_preview: promptBlock,
      final_system_prompt_excerpt: finalSystemPrompt.slice(0, 2000),
      injected: promptBlock.length > 0 && finalSystemPrompt.includes(insights[0]?.title ?? "__none__"),
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
