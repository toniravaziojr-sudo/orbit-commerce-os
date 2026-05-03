/**
 * ai-config-bootstrap
 *
 * Botão central "Preencher tudo com IA" das Configurações Gerais da IA.
 * Gera SOMENTE os campos texto de Conhecimento Essencial:
 *  - business_context
 *  - attendance_rules
 *  - custom_knowledge (resumo curto)
 *
 * Não toca em system_prompt, claims, dicionário ou objeções (esses têm
 * fluxos próprios).
 *
 * Substitui o que já existe — o aviso de confirmação é responsabilidade da UI.
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

interface Body {
  tenant_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!LOVABLE_API_KEY) {
      return json({ success: false, error: "LOVABLE_API_KEY ausente" });
    }
    const body = (await req.json()) as Body;
    if (!body?.tenant_id) return json({ success: false, error: "tenant_id obrigatório" });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Snapshot básico do tenant
    const [{ data: tenant }, { data: products }, { data: cats }] = await Promise.all([
      sb.from("tenants").select("name, slug").eq("id", body.tenant_id).maybeSingle(),
      sb
        .from("products")
        .select("name, short_description")
        .eq("tenant_id", body.tenant_id)
        .neq("status", "archived")
        .limit(20),
      sb
        .from("product_categories")
        .select("name")
        .eq("tenant_id", body.tenant_id)
        .limit(20),
    ]);

    const productLines = (products || [])
      .map((p: any) => `- ${p.name}${p.short_description ? ` — ${String(p.short_description).slice(0, 120)}` : ""}`)
      .join("\n");
    const categoryLines = (cats || []).map((c: any) => `- ${c.name}`).join("\n");

    const userPrompt = `Você é especialista em onboarding de IA para e-commerce. Gere os campos abaixo
em PT-BR, focados, sem floreio, sem markdown e sem listas — apenas parágrafos curtos.

# Loja
Nome: ${tenant?.name || "(sem nome)"}

# Categorias
${categoryLines || "(sem categorias cadastradas)"}

# Produtos (amostra)
${productLines || "(sem produtos cadastrados — gere conteúdo genérico baseado no nome da loja)"}

# Tarefa
Devolva um JSON com EXATAMENTE estas chaves:
{
  "business_context": "Parágrafo único (máx 600 caracteres) com: o que a empresa vende, qual o produto/linha carro-chefe, para quem (avatar/público), diferenciais e como funciona o uso/atendimento. Foque em fatos.",
  "attendance_rules": "Parágrafo único (máx 600 caracteres) com regras gerais de atendimento: tom, quando perguntar antes de recomendar, quando oferecer kit/upsell, quando escalar para humano, postura sobre desconto, postura sobre dúvidas médicas/jurídicas/sensíveis quando aplicável.",
  "custom_knowledge": "Parágrafo curto (máx 400 caracteres) com observações operacionais úteis (prazos, cupons, políticas frequentes). Se não houver dados suficientes, devolver string vazia."
}

Não escreva nada fora do JSON.`;

    const aiRes = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "Responde apenas com JSON válido conforme solicitado." },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      return json({ success: false, error: `AI Gateway: ${aiRes.status} ${txt.slice(0, 200)}` });
    }

    const aiData = await aiRes.json();
    const content = aiData?.choices?.[0]?.message?.content || "{}";
    let parsed: { business_context?: string; attendance_rules?: string; custom_knowledge?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ success: false, error: "Resposta da IA não é JSON válido" });
    }

    const updates: Record<string, string | null> = {
      business_context: (parsed.business_context || "").trim() || null,
      attendance_rules: (parsed.attendance_rules || "").trim() || null,
    };
    if (parsed.custom_knowledge && parsed.custom_knowledge.trim()) {
      updates.custom_knowledge = parsed.custom_knowledge.trim();
    }

    // Upsert em ai_support_config
    const { data: existing } = await sb
      .from("ai_support_config")
      .select("id")
      .eq("tenant_id", body.tenant_id)
      .maybeSingle();

    if (existing) {
      const { error } = await sb
        .from("ai_support_config")
        .update(updates)
        .eq("tenant_id", body.tenant_id);
      if (error) return json({ success: false, error: error.message });
    } else {
      const { error } = await sb
        .from("ai_support_config")
        .insert({ tenant_id: body.tenant_id, ...updates });
      if (error) return json({ success: false, error: error.message });
    }

    return json({ success: true, updated: Object.keys(updates), preview: parsed });
  } catch (e) {
    return json({ success: false, error: (e as Error).message });
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
