// =============================================
// PRODUCT COMMERCIAL CLASSIFIER — Frente 4 (lógica produto×funil)
// Pure module — sem I/O. Recebe snapshot já lido do banco.
// =============================================
//
// Classes (em ordem de preferência para Público Frio):
//   produto_base                  produto único vendido sozinho
//   produto_principal_simples     base com sinal de "principal" (tag/flag/preço de entrada)
//   kit_unitario_apresentacao     composição com N bases diferentes, 1 unidade de cada
//   kit_quantidade                composição com >1 unidade de QUALQUER base, ou multipack do mesmo SKU
//   recompra_retencao             oferta marcada como recompra/manutenção/recorrência
//   upsell_manutencao             ticket acima da linha base + tag de upsell
//   desconhecido                  sem dados suficientes (confiança baixa)
//
// Regra-chave: se qualquer componente tem quantity > 1 OU houver mais de uma
// linha do mesmo produto base → kit_quantidade.
//
// A fonte de verdade da composição é product_components. Tags/preço só entram
// como sinal complementar ou fallback conservador.

export type CommercialClass =
  | "produto_base"
  | "produto_principal_simples"
  | "kit_unitario_apresentacao"
  | "kit_quantidade"
  | "recompra_retencao"
  | "upsell_manutencao"
  | "desconhecido";

export type Confidence = "high" | "medium" | "low";

export interface ProductSnapshot {
  id: string;
  name?: string | null;
  price?: number | null;
  product_format?: string | null; // "simple" | "with_composition" | ...
  tags?: string[] | null;
  category_names?: string[] | null;
  // ai_product_commercial_payload (opcional)
  is_base_candidate?: boolean | null;
  base_product_id?: string | null;
}

export interface ComponentRow {
  component_product_id: string;
  quantity: number;
}

export interface ClassificationInput {
  product: ProductSnapshot;
  components?: ComponentRow[]; // composição real (fonte de verdade)
  basePriceFloor?: number | null; // menor preço base do catálogo (para upsell)
}

export interface ClassificationResult {
  commercial_class: CommercialClass;
  confidence: Confidence;
  signals: string[]; // por que chegou nessa classe
  composition_summary?: {
    unique_components: number;
    max_quantity: number;
    total_units: number;
  };
}

const RETENTION_TOKENS = [
  "recompra",
  "recorrencia",
  "recorrência",
  "manutencao",
  "manutenção",
  "assinatura",
  "subscription",
  "retencao",
  "retenção",
];

const UPSELL_TOKENS = ["upsell", "premium", "platinum", "pro", "advanced"];

const PRINCIPAL_TOKENS = [
  "principal",
  "carro-chefe",
  "carro chefe",
  "best seller",
  "bestseller",
  "produto principal",
  "entrada",
];

function lower(s?: string | null): string {
  return (s || "").toString().toLowerCase();
}

function hasToken(haystack: string[], tokens: string[]): boolean {
  return haystack.some((h) => tokens.some((t) => h.includes(t)));
}

function textPool(p: ProductSnapshot): string[] {
  return [lower(p.name), ...(p.tags || []).map(lower), ...(p.category_names || []).map(lower)];
}

/**
 * Detecta multipack do mesmo SKU pelo nome ("(2x)", "kit 3", "3 unidades").
 * Usado apenas como fallback quando não há composição.
 */
function nameSignalsMultipack(name: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  if (/\(\s*[2-9]\s*x\s*\)/.test(n)) return true;
  if (/\b(?:kit|combo|leve|pack)\s*\d{1,2}\b/.test(n)) return true;
  if (/\b\d{1,2}\s*(?:unidades?|unid|un)\b/.test(n)) return true;
  return false;
}

export function classifyProduct(input: ClassificationInput): ClassificationResult {
  const { product, components, basePriceFloor } = input;
  const pool = textPool(product);
  const signals: string[] = [];

  // 1) Sinais explícitos de retenção/upsell vencem composição (são intenção comercial).
  if (hasToken(pool, RETENTION_TOKENS)) {
    return {
      commercial_class: "recompra_retencao",
      confidence: "medium",
      signals: ["tag_or_name_indicates_retention"],
    };
  }

  // 2) Composição real é fonte de verdade quando disponível.
  if (components && components.length > 0) {
    const totalUnits = components.reduce((acc, c) => acc + (Number(c.quantity) || 0), 0);
    const maxQty = components.reduce(
      (acc, c) => Math.max(acc, Number(c.quantity) || 0),
      0,
    );
    // duplicates of same component already collapsed by db; check both
    const distinctBases = new Set(components.map((c) => c.component_product_id));
    const composition_summary = {
      unique_components: distinctBases.size,
      max_quantity: maxQty,
      total_units: totalUnits,
    };

    // Regra-chave: qualquer quantidade > 1 → kit_quantidade
    if (maxQty > 1) {
      signals.push("component_quantity_gt_1");
      // upsell se preço bem acima do base floor + tag
      if (basePriceFloor && product.price && product.price > basePriceFloor * 2.5 && hasToken(pool, UPSELL_TOKENS)) {
        return { commercial_class: "upsell_manutencao", confidence: "medium", signals: [...signals, "price_and_upsell_tag"], composition_summary };
      }
      return { commercial_class: "kit_quantidade", confidence: "high", signals, composition_summary };
    }

    // Todas as quantidades = 1
    if (distinctBases.size >= 2) {
      signals.push("multi_distinct_components_qty_1");
      return { commercial_class: "kit_unitario_apresentacao", confidence: "high", signals, composition_summary };
    }

    // 1 componente, quantidade 1 → comporta como base/principal
    signals.push("single_component_qty_1");
  }

  // 3) Sem composição → analisa nome (fallback conservador).
  if (product.product_format === "with_composition") {
    // Marcado como kit mas sem rows → ambíguo
    if (nameSignalsMultipack(product.name || "")) {
      signals.push("name_signals_multipack");
      return { commercial_class: "kit_quantidade", confidence: "medium", signals };
    }
    signals.push("composition_missing_from_kit_product");
    return { commercial_class: "desconhecido", confidence: "low", signals };
  }

  // 4) Produto simples (sem composição esperada).
  if (nameSignalsMultipack(product.name || "")) {
    signals.push("simple_product_name_signals_multipack");
    return { commercial_class: "kit_quantidade", confidence: "medium", signals };
  }

  // 5) Base puro vs principal simples — sinal de preço/tag.
  const isPrincipal =
    hasToken(pool, PRINCIPAL_TOKENS) ||
    (basePriceFloor != null && product.price != null && product.price <= basePriceFloor * 1.15);
  if (isPrincipal) {
    signals.push("price_or_tag_indicates_principal");
    return { commercial_class: "produto_principal_simples", confidence: "medium", signals };
  }

  if (product.is_base_candidate === true) {
    signals.push("ai_payload_marks_base_candidate");
    return { commercial_class: "produto_base", confidence: "medium", signals };
  }

  signals.push("default_base_fallback");
  return { commercial_class: "produto_base", confidence: "low", signals };
}
