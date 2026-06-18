// =============================================================================
// ads-creative-inline-generate — Onda H.4.4
//
// Geração inline de criativos e textos DENTRO da etapa "Anúncios" do wizard
// de proposta de campanha (StructuredProposalModal step 4), substituindo o
// fluxo separado de Revisão Final + creative_jobs em background.
//
// Ações suportadas:
//   "generate_copy"     — gera título + texto principal + descrição do zero
//                         para um anúncio. Sem feedback obrigatório.
//   "regen_copy_field"  — regenera APENAS um campo (headline | primary_text |
//                         description) com feedback obrigatório (>=5 chars).
//   "generate_image"    — gera imagem do criativo (sem feedback).
//   "regen_image"       — regenera imagem com feedback obrigatório.
//
// Governança (H.4.0 / H.4.4):
//   - Gesto explícito do lojista (cada clique).
//   - Cobrança/aprendizado lateral via ads_ai_learnings quando há feedback.
//   - Persiste em action_data.ads[idx] E em action_data.planned_creatives[idx]
//     para o publisher e a UI verem o mesmo estado.
//   - Idempotência leve: cada chamada sobrescreve os campos alvo.
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

async function recordLearning(
  supabase: any,
  tenantId: string,
  actionId: string,
  userId: string,
  category: "creative_image_feedback" | "creative_copy_feedback",
  title: string,
  description: string,
  metadata: Record<string, unknown>,
) {
  try {
    await supabase.from("ads_ai_learnings").insert({
      tenant_id: tenantId,
      title,
      description,
      category,
      status: "active",
      source_type: "user_feedback",
      source_action_id: actionId,
      evidence_count: 1,
      confidence: 0.8,
      created_by: userId,
      metadata,
    });
  } catch (e) {
    console.warn("[ads-creative-inline-generate] learning insert failed:", e);
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
    const adIndex = Number(body.ad_index);
    const action = String(body.action || "");

    if (!tenantId || !actionId || !Number.isFinite(adIndex) || !action) {
      return ok({ success: false, error_pt: "Parâmetros obrigatórios ausentes." });
    }

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!role) return ok({ success: false, error_pt: "Sem permissão para esta loja." });

    const { data: actionRow } = await supabase
      .from("ads_autopilot_actions")
      .select("id, tenant_id, action_data, status")
      .eq("id", actionId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!actionRow) return ok({ success: false, error_pt: "Proposta não encontrada." });
    if (actionRow.status === "rejected" || actionRow.status === "executed") {
      return ok({ success: false, error_pt: "Esta proposta não aceita mais alterações." });
    }

    const propData = actionRow.action_data || {};
    const planned: any[] = Array.isArray(propData.planned_creatives) ? [...propData.planned_creatives] : [];
    const adsArr: any[] = Array.isArray(propData.ads) ? [...propData.ads] : [];
    const plannedItem = planned[adIndex] || {};
    const adItem = adsArr[adIndex] || {};

    const productId = adItem.product_id || plannedItem.product_id || propData.product_id || null;
    const productName = adItem.product_name || plannedItem.product_name || propData.campaign?.product_name || "";
    const productDescription = adItem.product_description || plannedItem.product_description || "";
    const promiseHint = plannedItem.promise || adItem.offer_note || "";

    // Persiste patch unificado em ads[idx] e planned_creatives[idx].
    const persist = async (patch: Record<string, any>, plannedPatch?: Record<string, any>) => {
      adsArr[adIndex] = { ...adItem, ...patch };
      planned[adIndex] = { ...plannedItem, ...(plannedPatch || patch) };
      await supabase
        .from("ads_autopilot_actions")
        .update({
          action_data: {
            ...propData,
            ads: adsArr,
            planned_creatives: planned,
          },
        })
        .eq("id", actionId);
    };

    // ---------- generate_copy / regen_copy_field ----------
    if (action === "generate_copy" || action === "regen_copy_field") {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) return ok({ success: false, error_pt: "Serviço de IA indisponível no momento." });

      const isRegen = action === "regen_copy_field";
      const field = isRegen ? String(body.field || "") : "";
      const feedback = String(body.feedback || "").trim();

      if (isRegen && !["headline", "primary_text", "description"].includes(field)) {
        return ok({ success: false, error_pt: "Campo inválido para regeneração." });
      }
      if (isRegen && feedback.length < 5) {
        return ok({ success: false, error_pt: "Conte como você quer este texto diferente antes de regenerar." });
      }

      const currHeadline = adItem.headline || plannedItem.headline || "";
      const currPrimary = adItem.primary_text || plannedItem.copy || plannedItem.primary_text || "";
      const currDesc = adItem.description || plannedItem.description || "";

      const productHint = productName ? `Produto: ${productName}.` : "";
      const promiseLine = promiseHint ? `Promessa central: ${promiseHint}.` : "";
      const descLine = productDescription ? `Sobre o produto: ${String(productDescription).slice(0, 400)}` : "";

      let sys = "";
      let usr = "";

      if (action === "generate_copy") {
        sys = `Você escreve copy de anúncio para Meta Ads em português do Brasil. Responda APENAS um JSON válido { "headline": string (até 40 caracteres), "primary_text": string (até 180 caracteres), "description": string (até 30 caracteres) }. Sem markdown, sem texto extra. Não invente desconto, garantia, prazo de entrega ou claim regulado que não esteja explícito nas informações do produto.`;
        usr = `${productHint}
${promiseLine}
${descLine}

Gere headline + texto principal + descrição para um anúncio focado em conversão.`;
      } else {
        const labelPt = field === "headline" ? "título" : field === "primary_text" ? "texto principal" : "descrição";
        const limit = field === "headline" ? 40 : field === "primary_text" ? 180 : 30;
        sys = `Você reescreve copy de anúncio Meta Ads em português do Brasil. Responda APENAS um JSON válido { "${field}": string (até ${limit} caracteres) }. Sem markdown, sem texto extra. Não invente desconto/garantia/prazo que não esteja no contexto.`;
        usr = `${productHint}
${promiseLine}

Versão atual do anúncio:
- Título: ${currHeadline}
- Texto principal: ${currPrimary}
- Descrição: ${currDesc}

Feedback do lojista (obrigatório aplicar SÓ no ${labelPt}): ${feedback}

Reescreva APENAS o ${labelPt}, mantendo coerência com os outros campos.`;
      }

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
        console.error("[ads-creative-inline-generate] AI gateway error:", aiRes.status, t);
        return ok({ success: false, error_pt: "Não foi possível gerar a copy agora. Tente de novo em instantes." });
      }
      const aiJson = await aiRes.json();
      const raw = aiJson?.choices?.[0]?.message?.content || "";
      let parsed: any = null;
      try {
        const m = raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(m ? m[0] : raw);
      } catch {
        return ok({ success: false, error_pt: "Resposta da IA veio em formato inesperado. Tente novamente." });
      }

      if (action === "generate_copy") {
        const headline = String(parsed?.headline || "").trim().slice(0, 40);
        const primary_text = String(parsed?.primary_text || parsed?.copy || "").trim().slice(0, 180);
        const description = String(parsed?.description || "").trim().slice(0, 30);
        if (!headline || !primary_text) {
          return ok({ success: false, error_pt: "A copy gerada veio incompleta. Tente novamente." });
        }
        const patch = {
          headline,
          primary_text,
          description,
          copy_source: "ai_inline",
          copy_generated_at: new Date().toISOString(),
        };
        const plannedPatch = {
          headline,
          copy: primary_text,
          primary_text,
          description,
          copy_source: "ai_inline",
        };
        await persist(patch, plannedPatch);
        return ok({ success: true, headline, primary_text, description });
      }

      // regen single field
      const value = String(parsed?.[field] || "").trim();
      const limit = field === "headline" ? 40 : field === "primary_text" ? 180 : 30;
      const sliced = value.slice(0, limit);
      if (!sliced) {
        return ok({ success: false, error_pt: "A nova versão veio vazia. Tente novamente." });
      }
      const patch: Record<string, any> = { [field]: sliced, copy_source: "ai_inline" };
      const plannedPatch: Record<string, any> = field === "primary_text"
        ? { copy: sliced, primary_text: sliced, copy_source: "ai_inline" }
        : { [field]: sliced, copy_source: "ai_inline" };

      await persist(patch, plannedPatch);

      await recordLearning(
        supabase, tenantId, actionId, userId,
        "creative_copy_feedback",
        `Campo ${field} do anúncio #${adIndex + 1} regenerado`,
        feedback,
        { ad_index: adIndex, field, before: { headline: currHeadline, primary_text: currPrimary, description: currDesc }, after: { [field]: sliced } },
      );

      return ok({ success: true, [field]: sliced });
    }

    // ---------- generate_image / regen_image ----------
    if (action === "generate_image" || action === "regen_image") {
      const isRegen = action === "regen_image";
      const feedback = String(body.feedback || "").trim();
      if (isRegen && feedback.length < 5) {
        return ok({ success: false, error_pt: "Conte o que você quer diferente na imagem antes de regenerar." });
      }

      let productImageUrl = adItem.reference_image_url || plannedItem.reference || plannedItem.product_image_url || "";
      let pName = productName;
      let pDesc = productDescription;

      if (productId && !productImageUrl) {
        const { data: prod } = await supabase
          .from("products")
          .select("name, description, featured_image_url")
          .eq("id", productId)
          .maybeSingle();
        if (prod) {
          pName = pName || prod.name;
          pDesc = pDesc || (prod.description || "");
          productImageUrl = productImageUrl || (prod.featured_image_url || "");
        }
      }

      if (!productId || !productImageUrl) {
        return ok({ success: false, error_pt: "Produto da campanha não encontrado para gerar a imagem." });
      }

      const visualPrompt = plannedItem.visual_prompt || adItem.creative_prompt || "";
      const basePrompt = isRegen
        ? `${visualPrompt}\n\nAjustes pedidos: ${feedback}`.slice(0, 1200)
        : (visualPrompt || `Anúncio de ${pName}.`).slice(0, 1200);

      const formatRaw = plannedItem.format || adItem.creative_format || "square";
      const format = formatRaw === "portrait" ? "portrait" : formatRaw === "landscape" ? "landscape" : "square";

      const resp = await supabase.functions.invoke("creative-image-generate", {
        body: {
          tenant_id: tenantId,
          product_id: productId,
          product_name: pName,
          product_description: pDesc,
          product_image_url: productImageUrl,
          prompt: basePrompt,
          settings: {
            providers: ["openai", "gemini"],
            generation_style: "product_natural",
            format,
            quality: "medium",
            variations: 1,
            enable_qa: true,
            enable_fallback: true,
          },
          proposal_link: {
            proposal_action_id: actionId,
            planned_creative_index: adIndex,
            revision: isRegen,
            inline_generation: true,
          },
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      const jobId = (resp.data as any)?.data?.job_id || (resp.data as any)?.job_id;
      if (!jobId) {
        return ok({ success: false, error_pt: "Não foi possível iniciar a geração da imagem." });
      }
      const { data: job } = await supabase
        .from("creative_jobs")
        .select("status, output_urls, error_message")
        .eq("id", jobId)
        .maybeSingle();
      const newUrl = Array.isArray(job?.output_urls) && job!.output_urls.length > 0 ? job!.output_urls[0] : null;
      if (!newUrl) {
        return ok({
          success: false,
          error_pt: job?.error_message || "A geração não retornou uma imagem válida.",
        });
      }

      const patch = {
        creative_final_url: newUrl,
        creative_status: "ready",
        creative_source: isRegen ? "ai_regen" : "ai_inline",
        creative_job_id: jobId,
        creative_generated_at: new Date().toISOString(),
      };
      const plannedPatch = {
        ...patch,
        image_url: newUrl,
      };
      await persist(patch, plannedPatch);

      if (isRegen) {
        await recordLearning(
          supabase, tenantId, actionId, userId,
          "creative_image_feedback",
          `Imagem do anúncio #${adIndex + 1} regenerada`,
          feedback,
          { ad_index: adIndex, regen_job_id: jobId, product_id: productId },
        );
      }

      return ok({ success: true, image_url: newUrl, job_id: jobId });
    }

    return ok({ success: false, error_pt: "Ação não suportada." });
  } catch (e: any) {
    console.error("[ads-creative-inline-generate] error", e);
    return ok({ success: false, error_pt: "Falha ao processar a geração do criativo." });
  }
});
