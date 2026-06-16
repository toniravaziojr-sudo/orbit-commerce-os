// =============================================================================
// ai-prompt-conflict-analyze — Onda "Supremacia do Prompt Estratégico" (Fase 2)
// Analisa o prompt estratégico (global ou por conta) e devolve avisos de
// conflito com diretrizes de plataforma e funções declaradas dos produtos.
// NÃO bloqueia nada — apenas alerta. Cache por hash do prompt.
// =============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiChatCompletionJSON } from "../_shared/ai-router.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface AlertItem {
  key: string;
  severity: "informativo" | "atencao" | "critico";
  source: "platform_guideline" | "product_function" | "product_category" | "compliance";
  excerpt: string;
  risk: string;
  suggestion: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userRes } = await anonClient.auth.getUser();
    if (!userRes?.user) return json(401, { success: false, error: "unauthenticated" });

    const body = await req.json().catch(() => ({}));
    const tenantId: string | undefined = body.tenant_id;
    const scope: "global" | "account" = body.scope === "account" ? "account" : "global";
    const channel: string = (body.channel ?? "").toString();
    const adAccountId: string = (body.ad_account_id ?? "").toString();
    const prompt: string = (body.prompt ?? "").toString();
    const action: "analyze" | "toggle_ignore" = body.action === "toggle_ignore" ? "toggle_ignore" : "analyze";

    if (!tenantId) return json(400, { success: false, error: "tenant_id required" });

    // tenant access check
    const { data: access } = await admin.rpc("user_has_tenant_access", { _tenant_id: tenantId });
    if (!access) return json(403, { success: false, error: "no tenant access" });

    const promptTrim = prompt.trim();
    const promptHash = promptTrim ? await sha256(promptTrim) : "empty";

    // ── Toggle ignore ──────────────────────────────────────────────────────
    if (action === "toggle_ignore") {
      const alertKey: string = body.alert_key;
      if (!alertKey) return json(400, { success: false, error: "alert_key required" });
      const { data: row } = await admin
        .from("ai_prompt_conflict_cache")
        .select("id, ignored_keys")
        .eq("tenant_id", tenantId).eq("scope", scope)
        .eq("prompt_hash", promptHash)
        .maybeSingle();
      if (!row) return json(404, { success: false, error: "cache not found" });
      const ignored: string[] = Array.isArray(row.ignored_keys) ? row.ignored_keys as string[] : [];
      const next = ignored.includes(alertKey) ? ignored.filter((k) => k !== alertKey) : [...ignored, alertKey];
      await admin.from("ai_prompt_conflict_cache").update({ ignored_keys: next }).eq("id", row.id);
      return json(200, { success: true, ignored_keys: next });
    }

    // ── Prompt vazio → sem avisos ─────────────────────────────────────────
    if (!promptTrim) {
      return json(200, { success: true, prompt_hash: promptHash, alerts: [], ignored_keys: [], cached: false });
    }

    // ── Cache hit ─────────────────────────────────────────────────────────
    const cacheQuery = admin.from("ai_prompt_conflict_cache").select("*")
      .eq("tenant_id", tenantId).eq("scope", scope).eq("prompt_hash", promptHash);
    if (channel) cacheQuery.eq("channel", channel); else cacheQuery.is("channel", null);
    if (adAccountId) cacheQuery.eq("ad_account_id", adAccountId); else cacheQuery.is("ad_account_id", null);
    const { data: cached } = await cacheQuery.maybeSingle();
    if (cached) {
      return json(200, { success: true, prompt_hash: promptHash, alerts: cached.alerts ?? [], ignored_keys: cached.ignored_keys ?? [], cached: true });
    }

    // ── Carregar contexto: produtos + diretrizes ──────────────────────────
    const [{ data: products }, { data: guidelines }] = await Promise.all([
      admin.from("products")
        .select("id, name, ai_product_type, ai_main_function, regulatory_category, commercial_restrictions")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .eq("status", "active")
        .limit(40),
      admin.from("platform_commercial_guidelines")
        .select("platform, inferred_category, prohibited_claims, sensitive_notes, required_disclaimers")
        .eq("status", "active")
        .limit(60),
    ]);

    const productLines = (products ?? []).map((p: any) =>
      `- ${p.name}${p.ai_product_type ? ` [${p.ai_product_type}]` : ""}${p.ai_main_function ? ` — função: ${p.ai_main_function}` : ""}${p.regulatory_category ? ` (regulatório: ${p.regulatory_category})` : ""}`
    ).join("\n").slice(0, 4000);

    const guidelineLines = (guidelines ?? []).map((g: any) =>
      `• ${g.platform}/${g.inferred_category}: proibido=${g.prohibited_claims ?? "-"}; sensível=${g.sensitive_notes ?? "-"}`
    ).join("\n").slice(0, 4000);

    const channelHint = channel ? `Canal-alvo: ${channel}.` : `Aplicável a todos os canais (global).`;

    const system = `Você é um analista de risco para prompts estratégicos de tráfego pago.
Sua tarefa é APENAS apontar conflitos entre o prompt do usuário e:
(a) políticas comerciais conhecidas das plataformas (Meta, Google, TikTok),
(b) funções/categorias declaradas dos produtos do tenant.

Regras absolutas:
- O prompt do usuário tem PRIORIDADE MÁXIMA. Você NÃO sugere remover, NÃO censura, NÃO bloqueia.
- Você apenas alerta de forma curta, objetiva e em PT-BR de negócio.
- Se não houver conflito relevante, devolva alerts: [].
- Máximo 5 avisos. Foque nos mais relevantes.

Severidade:
- "critico": pode causar reprovação de anúncio, bloqueio de conta ou violação clara de política.
- "atencao": pode gerar baixa entrega, fricção com revisores ou conflito com a função declarada de um produto.
- "informativo": divergência leve, contexto cultural, claim de eficácia sem disclaimer.

Source:
- "platform_guideline": conflita com política da Meta/Google/TikTok.
- "product_function": conflita com a função/tipo declarado de um produto.
- "product_category": prompt contradiz a categoria regulatória do produto.
- "compliance": claim sensível (saúde, antes/depois, garantia de resultado) sem ressalva.

Devolva JSON estrito: { "alerts": [{ "key": "...", "severity": "...", "source": "...", "excerpt": "trecho do prompt", "risk": "qual o risco em PT-BR negócio", "suggestion": "ajuste sugerido (opcional, o usuário decide)" }] }
"key" = slug curto e estável (ex.: "promessa-cura-calvicie").`;

    const user = `${channelHint}

PROMPT ESTRATÉGICO DO USUÁRIO:
"""
${promptTrim.slice(0, 6000)}
"""

PRODUTOS CADASTRADOS (amostra):
${productLines || "(sem produtos cadastrados)"}

DIRETRIZES COMERCIAIS DE PLATAFORMA (amostra):
${guidelineLines || "(sem diretrizes carregadas)"}

Analise e devolva os avisos em JSON conforme especificado.`;

    let alerts: AlertItem[] = [];
    let modelUsed = "google/gemini-2.5-flash";
    try {
      const { data, model } = await aiChatCompletionJSON("google/gemini-2.5-flash", {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }, { logPrefix: "[prompt-conflict]" });
      modelUsed = model || modelUsed;
      const content = data?.choices?.[0]?.message?.content ?? "{}";
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      const raw = Array.isArray(parsed?.alerts) ? parsed.alerts : [];
      alerts = raw.slice(0, 5).map((a: any, idx: number) => ({
        key: String(a.key || `alert-${idx}`).slice(0, 80),
        severity: ["critico", "atencao", "informativo"].includes(a.severity) ? a.severity : "informativo",
        source: ["platform_guideline", "product_function", "product_category", "compliance"].includes(a.source) ? a.source : "compliance",
        excerpt: String(a.excerpt ?? "").slice(0, 300),
        risk: String(a.risk ?? "").slice(0, 400),
        suggestion: String(a.suggestion ?? "").slice(0, 400),
      }));
    } catch (e) {
      console.error("[prompt-conflict] AI error", e);
      // fallback: cache vazio para não martelar o gateway
      alerts = [];
    }

    // upsert cache
    await admin.from("ai_prompt_conflict_cache").upsert({
      tenant_id: tenantId,
      scope,
      channel,
      ad_account_id: adAccountId,
      prompt_hash: promptHash,
      alerts,
      ignored_keys: [],
      model_used: modelUsed,
    }, { onConflict: "tenant_id,scope,channel,ad_account_id,prompt_hash" as any });

    return json(200, { success: true, prompt_hash: promptHash, alerts, ignored_keys: [], cached: false });
  } catch (e) {
    console.error("[ai-prompt-conflict-analyze] fatal", e);
    return json(200, { success: false, error: String(e?.message ?? e), alerts: [], ignored_keys: [] });
  }
});
