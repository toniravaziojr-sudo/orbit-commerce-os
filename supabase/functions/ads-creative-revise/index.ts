// =============================================================================
// ads-creative-revise — Onda H.4.3
// Permite, na Revisão Final, três operações por criativo de uma proposta:
//
//   action: "apply_override"     → grava override manual (imagem por upload/Drive
//                                  ou edição direta de título/copy/CTA).
//   action: "regenerate_image"   → exige feedback do usuário; chama
//                                  creative-image-generate com o feedback
//                                  apensado ao prompt e grava a nova URL como
//                                  override + registra aprendizado.
//   action: "regenerate_copy"    → exige feedback; chama Lovable AI para
//                                  reescrever headline/copy/CTA e registra
//                                  aprendizado.
//
// Os overrides ficam em action_data.creative_overrides[<creative_index>] e são
// lidos pelo publisher (ads-autopilot-publish-proposal) com precedência sobre
// o planned e sobre o output do job original.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildLearningTitle(base: string, feedback: string): string {
  const snippet = (feedback || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (snippet) return `${base} — "${snippet}"`;
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `${base} — ${stamp}`;
}

async function recordLearning(
  supabase: any,
  tenantId: string,
  actionId: string,
  userId: string,
  subtype: "creative_image_feedback" | "creative_copy_feedback",
  title: string,
  description: string,
  metadata: Record<string, unknown>,
) {
  // Mapeia para as categorias oficiais da UI de Aprendizados.
  const category = subtype === "creative_copy_feedback" ? "copy" : "criativo";
  const finalTitle = buildLearningTitle(title, description);
  try {
    const { error } = await supabase.from("ads_ai_learnings").insert({
      tenant_id: tenantId,
      title: finalTitle,
      description,
      category,
      status: "active",
      source_type: "user_feedback",
      source_action_id: actionId,
      evidence_count: 1,
      confidence: 0.8,
      created_by: userId,
      metadata: { ...metadata, subtype, base_title: title },
    });
    if (error) {
      if ((error as any)?.code === "23505") {
        const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
        const retry = await supabase.from("ads_ai_learnings").insert({
          tenant_id: tenantId,
          title: `${finalTitle} (${stamp})`,
          description,
          category,
          status: "active",
          source_type: "user_feedback",
          source_action_id: actionId,
          evidence_count: 1,
          confidence: 0.8,
          created_by: userId,
          metadata: { ...metadata, subtype, base_title: title, dedup_retry: true },
        });
        if (retry.error) {
          console.error("[ads-creative-revise] learning insert retry rejected:", retry.error);
        }
      } else {
        console.error("[ads-creative-revise] learning insert rejected:", error);
      }
    }
  } catch (e) {
    console.warn("[ads-creative-revise] learning insert failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return ok({ success: false, error_pt: "Sessão não identificada." });
    const { data: userData } = await supabase.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) return ok({ success: false, error_pt: "Sessão inválida." });

    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenant_id || "");
    const actionId = String(body.action_id || "");
    const creativeIndex = Number(body.creative_index);
    const action = String(body.action || "");

    if (!tenantId || !actionId || !Number.isFinite(creativeIndex) || !action) {
      return ok({ success: false, error_pt: "Parâmetros obrigatórios ausentes." });
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!role) return ok({ success: false, error_pt: "Sem permissão para esta loja." });

    // Carrega proposta
    const { data: actionRow } = await supabase
      .from("ads_autopilot_actions")
      .select("id, tenant_id, action_data")
      .eq("id", actionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!actionRow) return ok({ success: false, error_pt: "Proposta não encontrada." });

    const propData = actionRow.action_data || {};
    const overrides: Record<string, any> = { ...(propData.creative_overrides || {}) };
    const key = String(creativeIndex);
    const current = overrides[key] || {};
    const planned = (Array.isArray(propData.planned_creatives) ? propData.planned_creatives[creativeIndex] : null) || {};

    // ---------- apply_override ----------
    if (action === "apply_override") {
      const override = body.override || {};
      const next: Record<string, any> = { ...current };
      let touched = false;
      for (const k of ["image_url", "image_source", "headline", "copy", "cta"]) {
        if (Object.prototype.hasOwnProperty.call(override, k)) {
          next[k] = override[k];
          touched = true;
        }
      }
      if (!touched) return ok({ success: false, error_pt: "Nada para atualizar." });

      next.updated_at = new Date().toISOString();
      next.updated_by = userId;
      overrides[key] = next;

      await supabase.from("ads_autopilot_actions").update({
        action_data: { ...propData, creative_overrides: overrides },
      }).eq("id", actionId);

      return ok({ success: true, override: next });
    }

    // ---------- regenerate_image ----------
    if (action === "regenerate_image") {
      const feedback = String(body.feedback || "").trim();
      if (feedback.length < 5) {
        return ok({ success: false, error_pt: "Conte o que você quer diferente na imagem antes de regenerar." });
      }

      // Resolve produto a partir do planned ou da proposta
      const productId = planned.product_id || propData.product_id || null;
      let productName = planned.product_name || "";
      let productDescription = planned.product_description || "";
      let productImageUrl = planned.product_image_url || "";

      if (productId) {
        const { data: prod } = await supabase
          .from("products")
          .select("name, description, featured_image_url")
          .eq("id", productId)
          .maybeSingle();
        if (prod) {
          productName = productName || prod.name;
          productDescription = productDescription || (prod.description || "");
          productImageUrl = productImageUrl || (prod.featured_image_url || "");
        }
      }

      if (!productId || !productImageUrl) {
        // Mesmo sem produto resolvido, registra o feedback como aprendizado.
        await recordLearning(
          supabase, tenantId, actionId, userId,
          "creative_image_feedback",
          `Feedback de Imagem — ${productName || "anúncio"}`,
          feedback,
          { creative_index: creativeIndex, product_name: productName || null, product_resolved: false },
        );
        return ok({ success: false, error_pt: "Produto da campanha não encontrado para regenerar a imagem." });
      }

      // Grava aprendizado ANTES de chamar o gerador — feedback não pode
      // ser perdido se a geração demorar/falhar.
      await recordLearning(
        supabase, tenantId, actionId, userId,
        "creative_image_feedback",
        `Feedback de Imagem — ${productName || "anúncio"}`,
        feedback,
        { creative_index: creativeIndex, product_id: productId, product_name: productName || null },
      );

      const promptHint = `Ajustes pedidos pelo usuário: ${feedback}`.slice(0, 1200);

      const resp = await supabase.functions.invoke("creative-image-generate", {
        body: {
          tenant_id: tenantId,
          product_id: productId,
          product_name: productName,
          product_description: productDescription,
          product_image_url: productImageUrl,
          prompt: promptHint,
          settings: {
            providers: ["openai", "gemini"],
            generation_style: "product_natural",
            format: planned.format === "portrait" ? "portrait" : (planned.format === "landscape" ? "landscape" : "square"),
            quality: "medium",
            variations: 1,
            enable_qa: true,
            enable_fallback: true,
          },
          proposal_link: {
            proposal_action_id: actionId,
            planned_creative_index: creativeIndex,
            revision: true,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      const jobId = (resp.data as any)?.data?.job_id || (resp.data as any)?.job_id;
      if (!jobId) {
        return ok({ success: false, error_pt: "Não foi possível iniciar a regeneração da imagem." });
      }

      // Busca o job (resilientGenerate é síncrono → output_urls já estão prontas)
      const { data: job } = await supabase
        .from("creative_jobs")
        .select("status, output_urls, error_message")
        .eq("id", jobId)
        .maybeSingle();

      const newUrl = Array.isArray(job?.output_urls) && job!.output_urls.length > 0 ? job!.output_urls[0] : null;
      if (!newUrl) {
        return ok({
          success: false,
          error_pt: job?.error_message || "A regeneração não retornou uma imagem válida.",
        });
      }

      const next = {
        ...current,
        image_url: newUrl,
        image_source: "ai_regen",
        last_image_feedback: feedback,
        regen_job_id: jobId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };
      overrides[key] = next;

      await supabase.from("ads_autopilot_actions").update({
        action_data: { ...propData, creative_overrides: overrides },
      }).eq("id", actionId);

      // Aprendizado de imagem já foi gravado antes da chamada do gerador.


      return ok({ success: true, override: next });
    }

    // ---------- regenerate_copy ----------
    if (action === "regenerate_copy") {
      const feedback = String(body.feedback || "").trim();
      if (feedback.length < 5) {
        return ok({ success: false, error_pt: "Conte como você quer a copy diferente antes de regenerar." });
      }

      const productName = String(planned.product_name || propData?.campaign?.product_name || "").trim();

      // Grava o feedback como aprendizado ANTES da IA — não pode ser perdido
      // se a IA vier vazia/falhar.
      await recordLearning(
        supabase, tenantId, actionId, userId,
        "creative_copy_feedback",
        `Feedback de Copy — ${productName || "anúncio"}`,
        feedback,
        { creative_index: creativeIndex, product_name: productName || null, field: "copy", field_label_pt: "copy" },
      );

      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) return ok({ success: false, error_pt: "Serviço de IA indisponível no momento." });


      const baseHeadline = current.headline || planned.headline || (propData.campaign?.name) || "";
      const baseCopy = current.copy || planned.copy || planned.primary_text || "";
      const baseCta = current.cta || planned.cta || (propData.identity?.default_cta) || "SHOP_NOW";

      const productHint = planned.product_name ? `Produto: ${planned.product_name}.` : "";

      const sys = `Você escreve copy de anúncio para Meta Ads em português do Brasil. Responda APENAS um JSON válido { "headline": string (até 40 caracteres), "copy": string (até 180 caracteres), "cta": string (um destes: SHOP_NOW, LEARN_MORE, SIGN_UP, ORDER_NOW, GET_OFFER, BUY_NOW) }. Sem markdown, sem texto extra.`;
      const usr = `${productHint}
Versão atual:
- Headline: ${baseHeadline}
- Copy: ${baseCopy}
- CTA: ${baseCta}

Feedback do usuário (obrigatório aplicar): ${feedback}

Reescreva mantendo a oferta e a clareza. Não invente desconto/garantia que não estejam no texto atual.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        }),
      });

      if (!aiRes.ok) {
        const t = await aiRes.text().catch(() => "");
        console.error("[ads-creative-revise] AI gateway error:", aiRes.status, t);
        return ok({ success: false, error_pt: "Não foi possível regenerar a copy agora." });
      }
      const aiJson = await aiRes.json();
      const raw = aiJson?.choices?.[0]?.message?.content || "";
      let parsed: any = null;
      try {
        const m = raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(m ? m[0] : raw);
      } catch {
        return ok({ success: false, error_pt: "Resposta da IA não veio em formato esperado. Tente novamente." });
      }

      const headline = String(parsed?.headline || "").trim().slice(0, 60);
      const copy = String(parsed?.copy || "").trim().slice(0, 300);
      const cta = String(parsed?.cta || baseCta).trim();
      if (!headline || !copy) {
        return ok({ success: false, error_pt: "A nova copy veio incompleta. Tente novamente." });
      }

      const next = {
        ...current,
        headline,
        copy,
        cta,
        copy_source: "ai_regen",
        last_copy_feedback: feedback,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };
      overrides[key] = next;

      await supabase.from("ads_autopilot_actions").update({
        action_data: { ...propData, creative_overrides: overrides },
      }).eq("id", actionId);

      // Aprendizado de copy já foi gravado antes da chamada da IA.

      return ok({ success: true, override: next });
    }


    return ok({ success: false, error_pt: "Ação não suportada." });
  } catch (e) {
    console.error("[ads-creative-revise] error", e);
    return ok({ success: false, error_pt: "Falha ao processar a revisão do criativo." });
  }
});
