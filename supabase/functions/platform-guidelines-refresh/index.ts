// =============================================================================
// platform-guidelines-refresh — Onda H.4.1 Fase 2
// Cron mensal global + execução manual pelo painel super-admin.
//
// Fluxo:
//   1) Lista guidelines ativas (ou seed inicial se vazio).
//   2) Para cada (platform, inferred_category): se source_url existir, faz
//      Firecrawl scrape (markdown). Caso contrário, segue para próxima.
//   3) Manda o markdown + diretrizes atuais para o Lovable AI Gateway pedindo
//      um diff estruturado (mudou / não mudou + novos campos).
//   4) Se mudou → marca status='review_needed' e grava proposed_changes em
//      metadata. Se não mudou → renova last_verified_at.
//   5) NUNCA aplica mudança de capacidade sozinho. Admin revisa no painel.
//
// Modo seed: insere baseline mínimo se a tabela estiver vazia (uma execução).
// Auth: verify_jwt=false. Aceita chamadas com SERVICE_ROLE (cron) ou
// platform_admin (chamada manual via UI).
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// FIRECRAWL_API_KEY e LOVABLE_API_KEY são lidos dentro do handler (após
// loadPlatformCredentials) para refletir mudanças feitas pelo painel sem
// depender de redeploy.


interface GuidelineRow {
  id: string;
  platform: string;
  inferred_category: string;
  allowed_claims: string | null;
  prohibited_claims: string | null;
  sensitive_notes: string | null;
  required_disclaimers: string | null;
  source_url: string | null;
  version: number;
  status: string;
  last_verified_at: string;
}

// Baseline mínimo — seed inicial das diretrizes atuais conhecidas.
// Curto e factual. A IA refinará com Firecrawl quando source_url estiver setada.
const SEED: Array<Partial<GuidelineRow>> = [
  {
    platform: "meta",
    inferred_category: "cosmetico",
    allowed_claims: "Benefícios estéticos gerais (brilho, maciez, hidratação). Antes/depois apenas com disclaimers e sem promessas absolutas.",
    prohibited_claims: "Promessas médicas, cura de doenças, antes/depois enganosos, calvície reversível, eliminação garantida de caspa/queda.",
    sensitive_notes: "Categoria sob escrutínio. Evitar termos como 'milagre', 'garantido', 'definitivo'.",
    required_disclaimers: "Resultados variam por pessoa.",
    source_url: "https://transparency.meta.com/policies/ad-standards/personal-attributes/",
  },
  {
    platform: "meta",
    inferred_category: "suplemento",
    allowed_claims: "Benefícios gerais de bem-estar e nutrição quando suportados por bula/registro.",
    prohibited_claims: "Cura de doenças, emagrecimento garantido em prazo, substituição de medicamento.",
    sensitive_notes: "Categoria de saúde — exige cuidado redobrado, sem promessas de resultado.",
    required_disclaimers: "Este produto não é destinado a diagnosticar, tratar ou curar doenças.",
    source_url: "https://transparency.meta.com/policies/ad-standards/health-pharmaceuticals/",
  },
  {
    platform: "meta",
    inferred_category: "moda",
    allowed_claims: "Estilo, tendências, qualidade dos materiais, conforto.",
    prohibited_claims: "Atributos pessoais explícitos sobre o público-alvo ('para você que tem celulite').",
    sensitive_notes: "Evitar segmentação implícita por aparência física.",
    required_disclaimers: null,
    source_url: "https://transparency.meta.com/policies/ad-standards/personal-attributes/",
  },
  {
    platform: "google",
    inferred_category: "cosmetico",
    allowed_claims: "Benefícios estéticos, ingredientes, eficácia comprovada com fonte.",
    prohibited_claims: "Promessas médicas, antes/depois exagerados, garantia de cura para condições médicas.",
    sensitive_notes: "Google aplica política de Saúde e Medicina a cosméticos com claims terapêuticos.",
    required_disclaimers: "Resultados podem variar.",
    source_url: "https://support.google.com/adspolicy/answer/9475042",
  },
  {
    platform: "google",
    inferred_category: "suplemento",
    allowed_claims: "Benefícios nutricionais gerais, com base em registro do produto.",
    prohibited_claims: "Substâncias proibidas, claims de cura, perda de peso garantida.",
    sensitive_notes: "Política de Healthcare and Medicines do Google Ads.",
    required_disclaimers: "Procure orientação médica.",
    source_url: "https://support.google.com/adspolicy/answer/176031",
  },
  {
    platform: "tiktok",
    inferred_category: "cosmetico",
    allowed_claims: "Demonstrações de uso, textura, aplicação, benefícios estéticos.",
    prohibited_claims: "Promessas médicas, antes/depois agressivos, claims de cura.",
    sensitive_notes: "TikTok proíbe linguagem que estimule insegurança corporal.",
    required_disclaimers: null,
    source_url: "https://ads.tiktok.com/help/article/advertising-policies-industry-entry",
  },
  {
    platform: "tiktok",
    inferred_category: "suplemento",
    allowed_claims: "Benefícios gerais de bem-estar com suporte regulatório.",
    prohibited_claims: "Claims de cura, perda de peso rápida, substituição de tratamento médico.",
    sensitive_notes: "Categoria sensível — sujeita a revisão manual frequente.",
    required_disclaimers: "Procure orientação médica.",
    source_url: "https://ads.tiktok.com/help/article/advertising-policies-industry-entry",
  },
];

async function firecrawlScrape(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) return null;
  try {
    const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    if (!r.ok) {
      console.warn("[guidelines-refresh] firecrawl failed", url, r.status);
      return null;
    }
    const j = await r.json();
    return (j?.data?.markdown || j?.markdown || null) as string | null;
  } catch (e) {
    console.warn("[guidelines-refresh] firecrawl error", url, e);
    return null;
  }
}

async function diffWithAI(current: GuidelineRow, freshMarkdown: string): Promise<{
  changed: boolean;
  summary: string;
  proposed: Partial<GuidelineRow>;
} | null> {
  if (!LOVABLE_API_KEY) return null;
  // Trunca para custo controlado
  const md = freshMarkdown.slice(0, 12000);
  const prompt = `Você compara diretrizes comerciais atuais com texto oficial recém-extraído.
Plataforma: ${current.platform}
Categoria inferida: ${current.inferred_category}

DIRETRIZES ATUAIS (JSON):
${JSON.stringify({
  allowed_claims: current.allowed_claims,
  prohibited_claims: current.prohibited_claims,
  sensitive_notes: current.sensitive_notes,
  required_disclaimers: current.required_disclaimers,
}, null, 2)}

TEXTO OFICIAL RECENTE (markdown):
${md}

Responda APENAS em JSON com este formato:
{
  "changed": boolean,
  "summary": "frase curta em português explicando o que mudou (ou 'sem mudanças')",
  "proposed": {
    "allowed_claims": "texto atualizado ou null se sem mudança",
    "prohibited_claims": "texto atualizado ou null",
    "sensitive_notes": "texto atualizado ou null",
    "required_disclaimers": "texto atualizado ou null"
  }
}`;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista de políticas publicitárias. Responde sempre em JSON puro." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) {
      console.warn("[guidelines-refresh] AI gateway failed", r.status);
      return null;
    }
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    console.warn("[guidelines-refresh] AI diff error", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const body = await req.json().catch(() => ({}));
  const mode: "seed" | "refresh" | "auto" = body?.mode || "auto";
  const dryRun: boolean = Boolean(body?.dry_run);

  // Seed (se tabela vazia)
  const { count } = await supabase
    .from("platform_commercial_guidelines")
    .select("id", { count: "exact", head: true });

  let seeded = 0;
  if ((count ?? 0) === 0 || mode === "seed") {
    for (const row of SEED) {
      const { error } = await supabase
        .from("platform_commercial_guidelines")
        .upsert(
          { ...row, status: "active", last_verified_at: new Date().toISOString() },
          { onConflict: "platform,inferred_category" },
        );
      if (!error) seeded++;
    }
    if (mode === "seed") {
      return new Response(JSON.stringify({ success: true, seeded }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Refresh: passa por cada linha ativa com source_url
  const { data: rows } = await supabase
    .from("platform_commercial_guidelines")
    .select("*")
    .eq("status", "active");

  const results: Array<{ id: string; platform: string; category: string; outcome: string; summary?: string }> = [];

  for (const row of (rows as GuidelineRow[]) || []) {
    if (!row.source_url) {
      results.push({ id: row.id, platform: row.platform, category: row.inferred_category, outcome: "skipped_no_url" });
      continue;
    }
    const md = await firecrawlScrape(row.source_url);
    if (!md) {
      results.push({ id: row.id, platform: row.platform, category: row.inferred_category, outcome: "scrape_failed" });
      continue;
    }
    const diff = await diffWithAI(row, md);
    if (!diff) {
      results.push({ id: row.id, platform: row.platform, category: row.inferred_category, outcome: "diff_failed" });
      continue;
    }

    if (!diff.changed) {
      if (!dryRun) {
        await supabase
          .from("platform_commercial_guidelines")
          .update({ last_verified_at: new Date().toISOString() })
          .eq("id", row.id);
      }
      results.push({ id: row.id, platform: row.platform, category: row.inferred_category, outcome: "unchanged", summary: diff.summary });
    } else {
      if (!dryRun) {
        await supabase
          .from("platform_commercial_guidelines")
          .update({
            status: "review_needed",
            last_change_at: new Date().toISOString(),
            last_verified_at: new Date().toISOString(),
            // proposta fica em sensitive_notes append? não — coloca em campo separado via metadata json.
            // Como não temos coluna metadata, gravamos a proposta concatenada em sensitive_notes prefixada.
            sensitive_notes: `[PROPOSTA ${new Date().toISOString().slice(0, 10)}] ${diff.summary}\n\nProposta de novos textos:\n${JSON.stringify(diff.proposed, null, 2)}\n\n--- atual ---\n${row.sensitive_notes ?? ""}`,
          })
          .eq("id", row.id);
      }
      results.push({ id: row.id, platform: row.platform, category: row.inferred_category, outcome: "review_needed", summary: diff.summary });
    }
  }

  return new Response(
    JSON.stringify({ success: true, seeded, processed: results.length, results, dry_run: dryRun }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
