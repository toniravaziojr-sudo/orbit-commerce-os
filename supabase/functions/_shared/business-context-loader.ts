// ============================================================
// business-context-loader (Pacotes A + B + C + G) — UNIFICADO
//
// Carrega o contexto inferido do tenant e devolve um BLOCO DE PROMPT
// pronto para entrar em `contextualBlocks` da pipeline F2.
//
// Precedência oficial de fontes (D6):
//   1) tenant_business_context  (fonte primária — modelo antigo, rico)
//   2) ai_business_snapshot     (fallback oficial — modelo novo, regenerável)
//   3) MODO NEUTRO              (nenhum dos dois disponível)
//
// Regras espelhadas no plano aprovado:
//  1. Inferência automática é a BASE universal.
//  2. Manual overrides do tenant TÊM PRIORIDADE sobre a inferência.
//  3. Confiança alta → fala com convicção; média → confirma; baixa → pergunta.
//  4. Catálogo incompleto / mode='neutral' → MODO NEUTRO (Pacote G).
//  5. Tolerante a falha: qualquer erro → modo neutro silencioso, nunca lança.
// ============================================================

type Confidence = "alta" | "media" | "baixa";

interface InferredTree {
  segment?: { value: string | null; confidence: Confidence };
  audience?: { value: string | null; confidence: Confidence };
  macro_categories?: Array<{ name: string; confidence: Confidence; product_count: number }>;
  pain_points?: Array<{ name: string; synonyms?: string[]; confidence: Confidence; product_count: number }>;
}

export type BusinessContextSource =
  | "tenant_business_context"
  | "ai_business_snapshot"
  | "neutral";

export interface BusinessContextResult {
  /** Bloco de texto pronto pra ir no `contextualBlocks`. null = não injetar nada. */
  promptBlock: string | null;
  /** Marcadores estruturais úteis para logs/decisões */
  meta: {
    /** Qual fonte abasteceu o contexto neste turno (para auditoria/log). */
    source: BusinessContextSource;
    overall_confidence: Confidence | null;
    catalog_incomplete: boolean;
    has_overrides: boolean;
    segment: string | null;
    audience: string | null;
    pain_point_count: number;
  };
}

const SEGMENT_LABEL: Record<string, string> = {
  beleza: "beleza/cosméticos",
  moda: "moda/vestuário",
  eletronico: "eletrônicos",
  pet: "pet shop",
  casa: "casa/decoração",
  suplemento: "suplementos",
  intimo: "produtos íntimos",
  alimento: "alimentos",
  acessorio: "acessórios",
  saude: "saúde/bem-estar",
};

const AUDIENCE_LABEL: Record<string, string> = {
  masculino: "público masculino",
  feminino: "público feminino",
  ambos: "público masculino e feminino",
  infantil: "público infantil",
};

function mergeTree(inferred: InferredTree | null, overrides: InferredTree | null): InferredTree {
  if (!inferred && !overrides) return {};
  if (!overrides) return inferred || {};
  if (!inferred) return overrides;
  return {
    segment: overrides.segment?.value ? overrides.segment : inferred.segment,
    audience: overrides.audience?.value ? overrides.audience : inferred.audience,
    macro_categories:
      (overrides.macro_categories?.length ?? 0) > 0
        ? overrides.macro_categories
        : inferred.macro_categories,
    pain_points:
      (overrides.pain_points?.length ?? 0) > 0
        ? overrides.pain_points
        : inferred.pain_points,
  };
}

// ------------------------------------------------------------
// Adapters: converte cada fonte para o formato interno comum
// (tree + overall + incomplete + hasOverrides). Sem duplicar
// a formatação textual — quem formata é renderTreeBlock().
// ------------------------------------------------------------

interface NormalizedContext {
  tree: InferredTree;
  overall: Confidence;
  incomplete: boolean;
  hasOverrides: boolean;
}

function normalizeFromTbc(row: any): NormalizedContext | null {
  if (!row) return null;
  const inferred = (row.inferred_tree || null) as InferredTree | null;
  const overrides = (row.manual_overrides || null) as InferredTree | null;
  const hasOverrides = !!overrides && Object.keys(overrides).length > 0;
  return {
    tree: mergeTree(inferred, overrides),
    overall: ((row.overall_confidence as Confidence) || "baixa"),
    incomplete: !!row.catalog_incomplete,
    hasOverrides,
  };
}

function mapSnapshotConfidence(level: string | null | undefined): Confidence {
  if (level === "high") return "alta";
  if (level === "medium") return "media";
  return "baixa";
}

function normalizeFromSnapshot(row: any): NormalizedContext | null {
  if (!row) return null;

  const overall = mapSnapshotConfidence(row.confidence_level);
  const isNeutralMode = row.mode === "neutral";
  const hasOverrides = !!row.has_manual_overrides;

  // Modo neutro explícito do snapshot (catálogo insuficiente)
  if (isNeutralMode || (!row.niche_primary && !row.business_summary)) {
    return {
      tree: {},
      overall,
      incomplete: true,
      hasOverrides,
    };
  }

  // Snapshot rico (mode='active' + niche_primary)
  const inferredData = (row.inferred_data || {}) as Record<string, unknown>;
  const macros = Array.isArray((inferredData as any).macro_categories)
    ? (inferredData as any).macro_categories
    : [];
  const pains = Array.isArray((inferredData as any).pain_points)
    ? (inferredData as any).pain_points
    : [];

  const tree: InferredTree = {
    segment: row.niche_primary
      ? { value: String(row.niche_primary), confidence: overall }
      : undefined,
    audience: row.audience_summary
      ? { value: String(row.audience_summary), confidence: overall }
      : undefined,
    macro_categories: macros.length ? macros : undefined,
    pain_points: pains.length ? pains : undefined,
  };

  return { tree, overall, incomplete: false, hasOverrides };
}

// ------------------------------------------------------------
// Renderização única do bloco textual (não duplicar fora daqui)
// ------------------------------------------------------------
function renderTreeBlock(
  norm: NormalizedContext,
  source: BusinessContextSource,
): BusinessContextResult {
  // Pacote G — modo neutro
  if (norm.incomplete) {
    const block = [
      "### CONTEXTO DO NEGÓCIO (modo neutro)",
      "Ainda não foi possível mapear o catálogo desta loja com segurança.",
      "Conduza a conversa por descoberta pura: pergunte abertamente o que o cliente procura.",
      "NÃO assuma segmento, público nem categoria. Só fale de produtos que aparecerem nas tools.",
    ].join("\n");
    return {
      promptBlock: block,
      meta: {
        source,
        overall_confidence: norm.overall,
        catalog_incomplete: true,
        has_overrides: norm.hasOverrides,
        segment: null,
        audience: null,
        pain_point_count: 0,
      },
    };
  }

  const { tree, overall } = norm;
  const lines: string[] = ["### CONTEXTO DO NEGÓCIO (use isso pra atender com naturalidade)"];

  // Segmento + público
  const segValue = tree.segment?.value;
  const segConf = tree.segment?.confidence || "baixa";
  if (segValue) {
    const label = SEGMENT_LABEL[segValue] || segValue;
    const verb =
      segConf === "alta"
        ? "Esta loja vende"
        : segConf === "media"
          ? "Esta loja parece vender principalmente"
          : "Esta loja pode ser de";
    lines.push(`- ${verb} **${label}**.`);
  }

  const audValue = tree.audience?.value;
  const audConf = tree.audience?.confidence || "baixa";
  if (audValue) {
    const label = AUDIENCE_LABEL[audValue] || audValue;
    if (audConf !== "baixa") {
      lines.push(`- Foco no ${label}.`);
    }
  }

  // Macro categorias (até 6, ordenadas por volume)
  const macros = (tree.macro_categories || [])
    .filter((m) => m && m.name && m.product_count > 0)
    .slice(0, 6);
  if (macros.length) {
    const list = macros.map((m) => `${m.name} (${m.product_count})`).join(", ");
    lines.push(`- Linhas de produto principais: ${list}.`);
  }

  // Mapa de dores/objetivos resolvidos (até 8)
  const pains = (tree.pain_points || [])
    .filter((p) => p && p.name)
    .sort((a, b) => (b.product_count || 0) - (a.product_count || 0))
    .slice(0, 8);
  if (pains.length) {
    lines.push("- Problemas/objetivos que esta loja resolve:");
    for (const p of pains) {
      const syn =
        p.synonyms && p.synonyms.length
          ? ` _(também: ${p.synonyms.slice(0, 3).join(", ")})_`
          : "";
      lines.push(`  • ${p.name}${syn}`);
    }
  }

  // Regras de uso conforme confiança global
  lines.push("");
  lines.push("### COMO USAR ESSE CONTEXTO");
  if (overall === "alta") {
    lines.push(
      "- Você JÁ SABE o tipo de loja. Não pergunte 'qual uso/faixa de preço/tamanho' de cara.",
      "- Se o cliente disser um termo amplo (ex.: 'shampoo', 'tênis', 'fone'), liste as opções reais da loja agrupadas pela DOR/OBJETIVO que resolvem e pergunte qual é a dor dele.",
      "- Quando o cliente descrever uma dor, conecte direto ao produto certo da loja.",
    );
  } else if (overall === "media") {
    lines.push(
      "- Você tem uma boa ideia do tipo de loja, mas confirme antes de assumir.",
      "- Para termos amplos, liste opções reais e pergunte pela dor/objetivo.",
      "- Evite perguntas genéricas de 'faixa de preço' antes de entender a dor.",
    );
  } else {
    lines.push(
      "- O contexto da loja ainda está fraco. Conduza por descoberta: pergunte abertamente o que o cliente busca.",
      "- Não invente segmento nem público.",
    );
  }

  // Anti-system-speak (regra D do plano)
  lines.push(
    "",
    "### LINGUAGEM",
    "- NUNCA diga 'consultei o catálogo', 'deixa eu ver', 'vou buscar', 'um momento enquanto pesquiso'. Atue como vendedor que conhece a loja.",
  );

  return {
    promptBlock: lines.join("\n"),
    meta: {
      source,
      overall_confidence: overall,
      catalog_incomplete: false,
      has_overrides: norm.hasOverrides,
      segment: segValue || null,
      audience: audValue || null,
      pain_point_count: pains.length,
    },
  };
}

function neutralResult(source: BusinessContextSource): BusinessContextResult {
  return renderTreeBlock(
    { tree: {}, overall: "baixa", incomplete: true, hasOverrides: false },
    source,
  );
}

/**
 * Loader unificado de contexto de negócio para o F2.
 * Precedência: tenant_business_context → ai_business_snapshot → neutral.
 * NUNCA lança — em qualquer falha cai em modo neutro silencioso.
 */
export async function loadBusinessContextBlock(
  supabase: { from: (t: string) => any },
  tenantId: string,
): Promise<BusinessContextResult> {
  // ---- Fonte 1: tenant_business_context ----
  try {
    const { data, error } = await supabase
      .from("tenant_business_context")
      .select(
        "inferred_tree, manual_overrides, overall_confidence, catalog_incomplete, catalog_incomplete_reason",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!error && data) {
      const norm = normalizeFromTbc(data);
      if (norm) return renderTreeBlock(norm, "tenant_business_context");
    }
  } catch (e) {
    console.warn("[business-context-loader] tbc lookup failed:", (e as Error).message);
  }

  // ---- Fonte 2 (fallback): ai_business_snapshot ----
  try {
    const { data, error } = await supabase
      .from("ai_business_snapshot")
      .select(
        "mode, niche_primary, audience_summary, business_summary, confidence_level, has_manual_overrides, inferred_data",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!error && data) {
      const norm = normalizeFromSnapshot(data);
      if (norm) return renderTreeBlock(norm, "ai_business_snapshot");
    }
  } catch (e) {
    console.warn("[business-context-loader] snapshot lookup failed:", (e as Error).message);
  }

  // ---- Fonte 3: nenhum dos dois — modo neutro explícito ----
  return neutralResult("neutral");
}

/**
 * Dispara regeneração do contexto em background (fire-and-forget).
 * Usado quando detectamos que o contexto está stale.
 * NUNCA lança.
 */
export function triggerContextRegeneration(
  supabaseUrl: string,
  serviceRoleKey: string,
  tenantId: string,
): void {
  try {
    fetch(`${supabaseUrl}/functions/v1/infer-business-context`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    }).catch((e) => {
      console.warn("[business-context-loader] regen trigger failed:", e?.message || e);
    });
  } catch (e) {
    console.warn("[business-context-loader] regen call failed:", (e as Error).message);
  }
}
