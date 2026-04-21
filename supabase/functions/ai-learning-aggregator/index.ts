// ============================================================
// AI LEARNING AGGREGATOR — Cron diário (Fase 1)
// Agrega tenant_learning_events em tenant_learning_memory
// para os tipos: faq, objection, winning_response.
//
// Pipeline:
//  1. Lê eventos não processados por tenant
//  2. Agrupa por (customer_message normalizado, tipo inferido)
//  3. Calcula score ponderado
//  4. Upsert em tenant_learning_memory
//  5. Chama promote_learning_candidate (guardrails + sensitivity)
//  6. Marca eventos como processed
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  EVENT_WEIGHTS,
  normalizeText,
  type LearningEventType,
} from "../_shared/tenant-learning.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RawEvent {
  id: string;
  tenant_id: string;
  ai_agent: string;
  conversation_id: string | null;
  event_type: LearningEventType;
  weight: number;
  customer_message: string | null;
  ai_response: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Heurística leve para inferir o tipo de aprendizado a partir do texto
function inferLearningType(
  customerMessage: string,
): "faq" | "objection" | "winning_response" {
  const t = normalizeText(customerMessage);
  // Objeções típicas: preço, dúvida sobre funciona, demora, etc
  if (
    /\b(caro|barato|desconto|valor|preco|nao tenho|nao vai|funciona mesmo|sera que|tenho duvida|nao sei se|garante)\b/.test(
      t,
    )
  ) {
    return "objection";
  }
  // Perguntas claras = FAQ
  if (/(\?|\bcomo\b|\bo que\b|\bquando\b|\bonde\b|\bquanto\b|\bqual\b)/.test(t)) {
    return "faq";
  }
  // Caso contrário, aprendizado de abordagem vencedora
  return "winning_response";
}

// Sensibilidade da categoria
function inferSensitivity(
  type: "faq" | "objection" | "winning_response",
  customerMessage: string,
  aiResponse: string | null,
): "safe" | "commercial" | "sensitive" {
  const combined = normalizeText(
    (customerMessage || "") + " " + (aiResponse || ""),
  );
  // sensitive sinaliza necessidade de revisão humana
  if (/\b(reembolso|cancelar|devolver|reclamacao|insatisfeito|processar)\b/.test(combined)) {
    return "sensitive";
  }
  if (type === "winning_response" || type === "objection") return "commercial";
  return "safe";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const startedAt = Date.now();
    const stats = {
      tenants_processed: 0,
      events_processed: 0,
      learnings_upserted: 0,
      promoted_active: 0,
      kept_pending: 0,
      rejected_blocked: 0,
    };

    // Limite por execução para não estourar tempo do cron
    const { data: events, error: evErr } = await supabase
      .from("tenant_learning_events")
      .select("*")
      .eq("processed", false)
      .order("created_at", { ascending: true })
      .limit(2000);

    if (evErr) throw evErr;
    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ success: true, stats, message: "no_events" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Agrupar eventos por conversa para correlacionar mensagens com sucesso
    const byConv = new Map<string, RawEvent[]>();
    const orphan: RawEvent[] = [];
    for (const e of events as RawEvent[]) {
      if (e.conversation_id) {
        const arr = byConv.get(e.conversation_id) ?? [];
        arr.push(e);
        byConv.set(e.conversation_id, arr);
      } else {
        orphan.push(e);
      }
    }

    const tenantsTouched = new Set<string>();
    const processedIds: string[] = [];

    // Para cada conversa, identificar mensagens-do-cliente que precederam sucesso
    for (const [convId, evs] of byConv) {
      // Pega o evento "pivô" de maior peso positivo da conversa
      const pivot = evs.reduce<RawEvent | null>((acc, e) => {
        if (e.weight <= 0) return acc;
        if (!acc || e.weight > acc.weight) return e;
        return acc;
      }, null);

      if (!pivot || !pivot.customer_message) {
        // Sem sinal positivo — só marca como processado e segue
        for (const e of evs) processedIds.push(e.id);
        continue;
      }

      const tenantId = pivot.tenant_id;
      tenantsTouched.add(tenantId);
      const learningType = inferLearningType(pivot.customer_message);
      const sensitivity = inferSensitivity(
        learningType,
        pivot.customer_message,
        pivot.ai_response,
      );
      const patternNorm = normalizeText(pivot.customer_message);
      if (patternNorm.length < 6) {
        for (const e of evs) processedIds.push(e.id);
        continue;
      }

      // Soma de pesos da conversa (positivo - penalidade)
      const weightSum = evs.reduce((sum, e) => sum + (e.weight || 0), 0);
      if (weightSum <= 0) {
        for (const e of evs) processedIds.push(e.id);
        continue;
      }

      // Upsert: incrementa evidence_count e weight_sum
      const { data: existing } = await supabase
        .from("tenant_learning_memory")
        .select("id, evidence_count, weight_sum, source_evidence")
        .eq("tenant_id", tenantId)
        .eq("ai_agent", pivot.ai_agent)
        .eq("learning_type", learningType)
        .eq("pattern_normalized", patternNorm)
        .maybeSingle();

      let learningId: string | null = null;

      if (existing?.id) {
        const newEvidence = (existing.evidence_count || 0) + 1;
        const newWeightSum = (existing.weight_sum || 0) + weightSum;
        // Score normalizado 0-100 com cap
        const newScore = Math.min(
          100,
          Math.round((newWeightSum / Math.max(newEvidence, 1)) * 4),
        );
        const evidenceArr = Array.isArray(existing.source_evidence)
          ? existing.source_evidence
          : [];
        evidenceArr.push({
          conversation_id: convId,
          weight_sum: weightSum,
          occurred_at: pivot.created_at,
        });
        await supabase
          .from("tenant_learning_memory")
          .update({
            evidence_count: newEvidence,
            weight_sum: newWeightSum,
            success_score: newScore,
            last_seen_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            source_evidence: evidenceArr.slice(-50), // mantém últimas 50
          })
          .eq("id", existing.id);
        learningId = existing.id;
      } else {
        const initialScore = Math.min(100, Math.round(weightSum * 4));
        const { data: created, error: insErr } = await supabase
          .from("tenant_learning_memory")
          .insert({
            tenant_id: tenantId,
            ai_agent: pivot.ai_agent,
            learning_type: learningType,
            pattern_text: pivot.customer_message.slice(0, 500),
            pattern_normalized: patternNorm.slice(0, 500),
            response_text: pivot.ai_response?.slice(0, 800) ?? null,
            evidence_count: 1,
            weight_sum: weightSum,
            success_score: initialScore,
            category_sensitivity: sensitivity,
            status: "pending_review",
            source_evidence: [
              {
                conversation_id: convId,
                weight_sum: weightSum,
                occurred_at: pivot.created_at,
              },
            ],
            last_success_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insErr) {
          console.warn("[aggregator] insert error:", insErr.message);
        } else {
          learningId = created?.id ?? null;
        }
      }

      stats.learnings_upserted += 1;

      // Tenta promover (guardrails + thresholds aplicados na função SQL)
      if (learningId) {
        const { data: promo } = await supabase.rpc("promote_learning_candidate", {
          p_learning_id: learningId,
        });
        if (promo?.success && promo?.new_status === "active") {
          stats.promoted_active += 1;
        } else if (promo?.error === "content_blocked") {
          stats.rejected_blocked += 1;
        } else {
          stats.kept_pending += 1;
        }
      }

      for (const e of evs) processedIds.push(e.id);
    }

    // Marca órfãos como processados (não geram aprendizado sem conversa)
    for (const e of orphan) processedIds.push(e.id);

    // Marca todos como processados
    if (processedIds.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < processedIds.length; i += chunkSize) {
        const chunk = processedIds.slice(i, i + chunkSize);
        await supabase
          .from("tenant_learning_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .in("id", chunk);
      }
    }

    stats.tenants_processed = tenantsTouched.size;
    stats.events_processed = processedIds.length;

    console.log(
      `[ai-learning-aggregator] done in ${Date.now() - startedAt}ms`,
      stats,
    );

    return new Response(
      JSON.stringify({ success: true, stats, duration_ms: Date.now() - startedAt }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ai-learning-aggregator] fatal:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
