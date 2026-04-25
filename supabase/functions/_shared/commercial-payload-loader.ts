// ============================================================
// commercial-payload-loader (Sub-fase 1.4 — Pacote H consumido)
//
// Carrega o ai_product_commercial_payload do produto em foco
// e devolve um BLOCO DE PROMPT pronto para entrar em
// `contextualBlocks` da pipeline F2.
//
// Regras:
//  1. Só injeta quando há foco de produto (productFocus.product_id).
//  2. Estados relevantes: recommendation, product_detail, decision,
//     checkout_assist. Em outros estados, retorna null (não polui prompt).
//  3. Manual overrides do tenant TÊM PRIORIDADE sobre inferência.
//  4. Tolerante a falha: se algo der errado, retorna null e o
//     ai-support-chat segue normalmente sem o bloco.
//  5. Bloco é curto e direcional — instrui a IA a USAR pitch e dor,
//     pedir variante com a frase do tenant, citar diferenciais.
// ============================================================

import type { PipelineState } from "./sales-pipeline/states.ts";

const STATES_THAT_USE_PAYLOAD: PipelineState[] = [
  "recommendation",
  "product_detail",
  "decision",
  "checkout_assist",
];

interface VariantSummaryItem {
  axis: string;
  options: string[];
}

interface CommercialPayloadRow {
  product_id: string;
  commercial_name: string | null;
  commercial_role: string | null;
  short_pitch: string | null;
  medium_pitch: string | null;
  differentials: string[] | null;
  comparison_arguments: string | null;
  target_audience: string | null;
  social_proof_snippet: string | null;
  has_mandatory_variants: boolean;
  variant_ask_rule: string | null;
  variants_summary: VariantSummaryItem[] | Record<string, unknown> | null;
  when_not_to_indicate: string | null;
  manual_overrides: Record<string, unknown> | null;
  main_pain_id: string | null;
}

export interface CommercialPayloadResult {
  promptBlock: string | null;
  meta: {
    product_id: string | null;
    has_payload: boolean;
    has_overrides: boolean;
    has_pitch: boolean;
    has_main_pain: boolean;
    has_variant_rule: boolean;
  };
}

const EMPTY: CommercialPayloadResult = {
  promptBlock: null,
  meta: {
    product_id: null,
    has_payload: false,
    has_overrides: false,
    has_pitch: false,
    has_main_pain: false,
    has_variant_rule: false,
  },
};

function applyOverrides(row: CommercialPayloadRow): CommercialPayloadRow {
  const overrides = row.manual_overrides;
  if (!overrides || typeof overrides !== "object") return row;
  const merged: any = { ...row };
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== null && v !== undefined && v !== "") {
      merged[k] = v;
    }
  }
  return merged as CommercialPayloadRow;
}

function normalizeVariants(
  v: VariantSummaryItem[] | Record<string, unknown> | null,
): VariantSummaryItem[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.filter(
      (x) =>
        x &&
        typeof x.axis === "string" &&
        Array.isArray(x.options) &&
        x.options.length > 0,
    );
  }
  // Compat com payloads antigos no formato { tamanho: ["P","M","G"] }
  return Object.entries(v)
    .filter(([_, opts]) => Array.isArray(opts) && (opts as unknown[]).length > 0)
    .map(([axis, opts]) => ({
      axis,
      options: (opts as unknown[]).map((o) => String(o)),
    }));
}

export async function loadCommercialPayloadBlock(
  supabase: { from: (t: string) => any },
  args: {
    tenantId: string;
    productId: string | null | undefined;
    pipelineState: PipelineState;
  },
): Promise<CommercialPayloadResult> {
  try {
    if (!args.productId) return EMPTY;
    if (!STATES_THAT_USE_PAYLOAD.includes(args.pipelineState)) return EMPTY;

    const { data, error } = await supabase
      .from("ai_product_commercial_payload")
      .select(
        "product_id, commercial_name, commercial_role, short_pitch, medium_pitch, differentials, comparison_arguments, target_audience, social_proof_snippet, has_mandatory_variants, variant_ask_rule, variants_summary, when_not_to_indicate, manual_overrides, main_pain_id",
      )
      .eq("tenant_id", args.tenantId)
      .eq("product_id", args.productId)
      .maybeSingle();

    if (error || !data) return EMPTY;

    const raw = data as CommercialPayloadRow;
    const row = applyOverrides(raw);
    const hasOverrides =
      !!raw.manual_overrides && Object.keys(raw.manual_overrides).length > 0;

    // Carrega rótulo da dor principal (opcional)
    let mainPainLabel: string | null = null;
    if (row.main_pain_id) {
      try {
        const { data: pain } = await supabase
          .from("ai_context_tree")
          .select("label")
          .eq("id", row.main_pain_id)
          .maybeSingle();
        mainPainLabel = (pain?.label as string | null) || null;
      } catch (_) { /* tolerante */ }
    }

    const variants = normalizeVariants(row.variants_summary ?? null);

    const lines: string[] = [
      "### PRODUTO EM FOCO (use o pitch e a dor desta loja, não invente argumento)",
    ];

    if (row.commercial_name) {
      const role = row.commercial_role && row.commercial_role !== "regular"
        ? ` _(papel comercial: ${row.commercial_role})_`
        : "";
      lines.push(`- Nome comercial: **${row.commercial_name}**${role}`);
    }

    const pitch = row.short_pitch || row.medium_pitch;
    if (pitch) {
      lines.push(`- Pitch curto: "${pitch.trim()}"`);
    }

    if (mainPainLabel) {
      lines.push(`- Dor principal que resolve: **${mainPainLabel}**.`);
    }

    if (row.target_audience) {
      lines.push(`- Para quem é: ${row.target_audience}`);
    }

    if (row.differentials && row.differentials.length) {
      const top = row.differentials.slice(0, 4);
      lines.push(`- Diferenciais: ${top.join(" • ")}`);
    }

    if (row.comparison_arguments) {
      lines.push(`- Quando comparar com alternativas: ${row.comparison_arguments}`);
    }

    if (row.social_proof_snippet) {
      lines.push(`- Prova social: ${row.social_proof_snippet}`);
    }

    if (row.when_not_to_indicate) {
      lines.push(`- NÃO indicar quando: ${row.when_not_to_indicate}`);
    }

    // Regra de variante — fala da loja, prioritária sobre formulações genéricas
    if (row.has_mandatory_variants) {
      const variantList = variants.length
        ? variants
            .map((v) => `${v.axis}: ${v.options.slice(0, 6).join(", ")}`)
            .join(" | ")
        : null;
      if (row.variant_ask_rule) {
        lines.push(
          `- **Variante obrigatória.** Antes de adicionar ao carrinho, pergunte exatamente assim: "${row.variant_ask_rule.trim()}"`,
        );
      } else {
        lines.push(
          "- **Variante obrigatória.** Antes de adicionar ao carrinho, peça ao cliente para escolher a opção.",
        );
      }
      if (variantList) {
        lines.push(`  Opções disponíveis: ${variantList}`);
      }
    } else if (variants.length) {
      // Variante existe mas não é obrigatória (auto-resolve)
      const variantList = variants
        .map((v) => `${v.axis}: ${v.options.slice(0, 6).join(", ")}`)
        .join(" | ");
      lines.push(
        `- Variantes disponíveis (não obrigatórias, pode adicionar direto): ${variantList}`,
      );
    }

    return {
      promptBlock: lines.join("\n"),
      meta: {
        product_id: row.product_id,
        has_payload: true,
        has_overrides: hasOverrides,
        has_pitch: !!pitch,
        has_main_pain: !!mainPainLabel,
        has_variant_rule: !!row.variant_ask_rule,
      },
    };
  } catch (e) {
    console.warn("[commercial-payload-loader] failed:", (e as Error).message);
    return EMPTY;
  }
}
