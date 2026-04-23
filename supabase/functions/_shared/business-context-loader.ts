// ============================================================
// business-context-loader (Pacotes A + B + C + G)
//
// Carrega o contexto inferido do tenant e devolve um BLOCO DE PROMPT
// pronto para entrar em `contextualBlocks` da pipeline F2.
//
// Regras (espelhadas no plano aprovado):
//  1. Inferência automática é a BASE universal (catálogo bom = IA com convicção).
//  2. Manual overrides do tenant TÊM PRIORIDADE sobre a inferência.
//  3. Confiança alta → fala com convicção; média → confirma antes; baixa → pergunta.
//  4. Catálogo incompleto → MODO NEUTRO (Pacote G): IA não assume nada.
//  5. Tolerante a falha: se algo der errado aqui, retorna null e a IA segue como hoje.
// ============================================================

type Confidence = "alta" | "media" | "baixa";

interface InferredTree {
  segment?: { value: string | null; confidence: Confidence };
  audience?: { value: string | null; confidence: Confidence };
  macro_categories?: Array<{ name: string; confidence: Confidence; product_count: number }>;
  pain_points?: Array<{ name: string; synonyms?: string[]; confidence: Confidence; product_count: number }>;
}

export interface BusinessContextResult {
  /** Bloco de texto pronto pra ir no `contextualBlocks`. null = não injetar nada. */
  promptBlock: string | null;
  /** Marcadores estruturais úteis para logs/decisões */
  meta: {
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
  // Override por chave (manual sempre vence quando tem valor)
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

/**
 * Carrega o contexto do tenant e devolve um bloco textual pronto.
 * NUNCA lança — em qualquer falha, retorna { promptBlock: null }.
 */
export async function loadBusinessContextBlock(
  supabase: { from: (t: string) => any },
  tenantId: string,
): Promise<BusinessContextResult> {
  const empty: BusinessContextResult = {
    promptBlock: null,
    meta: {
      overall_confidence: null,
      catalog_incomplete: false,
      has_overrides: false,
      segment: null,
      audience: null,
      pain_point_count: 0,
    },
  };

  try {
    const { data, error } = await supabase
      .from("tenant_business_context")
      .select(
        "inferred_tree, manual_overrides, overall_confidence, catalog_incomplete, catalog_incomplete_reason",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error || !data) return empty;

    const inferred = (data.inferred_tree || null) as InferredTree | null;
    const overrides = (data.manual_overrides || null) as InferredTree | null;
    const hasOverrides = !!overrides && Object.keys(overrides).length > 0;
    const tree = mergeTree(inferred, overrides);
    const overall = (data.overall_confidence as Confidence) || "baixa";
    const incomplete = !!data.catalog_incomplete;

    // Pacote G — modo neutro
    if (incomplete) {
      const block = [
        "### CONTEXTO DO NEGÓCIO (modo neutro)",
        "Ainda não foi possível mapear o catálogo desta loja com segurança.",
        "Conduza a conversa por descoberta pura: pergunte abertamente o que o cliente procura.",
        "NÃO assuma segmento, público nem categoria. Só fale de produtos que aparecerem nas tools.",
      ].join("\n");
      return {
        promptBlock: block,
        meta: {
          overall_confidence: overall,
          catalog_incomplete: true,
          has_overrides: hasOverrides,
          segment: null,
          audience: null,
          pain_point_count: 0,
        },
      };
    }

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
        overall_confidence: overall,
        catalog_incomplete: false,
        has_overrides: hasOverrides,
        segment: segValue || null,
        audience: audValue || null,
        pain_point_count: pains.length,
      },
    };
  } catch (e) {
    console.warn("[business-context-loader] failed:", (e as Error).message);
    return empty;
  }
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
