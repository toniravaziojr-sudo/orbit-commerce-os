// =============================================
// PRODUCT × FUNNEL FIT GATE — Frente 4
// Pure module — recebe classificação + funil e devolve decisão soft-block.
// Não substitui o Quality Gate; roda APÓS o Quality Gate como defesa final.
// =============================================
//
// Política híbrida:
//  - Strategist deve preferir oferta adequada (pré-filtro no servidor).
//  - Se mesmo assim chegar um mismatch, este gate marca a adequação e
//    desabilita "Aprovar e gerar criativos" com mensagem amigável.

import type { CommercialClass, Confidence } from "./productCommercialClassifier.ts";

export type FunnelStage = "cold" | "warm" | "hot" | "retention" | "unknown";

/** Normaliza valores soltos (tof/bof/cold/warm/retencao/clientes) para um vocabulário único. */
export function normalizeFunnelStage(raw?: string | null): FunnelStage {
  const v = (raw || "").toString().toLowerCase().trim();
  if (!v) return "unknown";
  if (["tof", "cold", "prospecting", "frio", "prospeccao", "prospecção"].includes(v)) return "cold";
  if (["mof", "warm", "remarketing", "morno", "engaged"].includes(v)) return "warm";
  if (["bof", "hot", "quente", "lower_funnel"].includes(v)) return "hot";
  if (["retention", "clientes", "customers", "retencao", "retenção"].includes(v)) return "retention";
  return "unknown";
}

export type FitLevel = "high" | "medium" | "low" | "blocked" | "unknown_composition";

export type FitReasonCode =
  | "cold_audience_high_friction_offer"
  | "cold_audience_bundle_not_recommended"
  | "cold_audience_retention_offer_mismatch"
  | "product_funnel_mismatch"
  | "offer_stage_mismatch"
  | "product_composition_unknown_low_confidence"
  | "fit_ok";

export interface FitGateInput {
  commercial_class: CommercialClass;
  classification_confidence: Confidence;
  funnel_stage: FunnelStage;
}

export interface FitGateResult {
  fit_level: FitLevel;
  /** true ⇒ UI deve desabilitar "Aprovar e gerar criativos". */
  soft_block: boolean;
  reason_codes: FitReasonCode[];
  /** Mensagem amigável em PT-BR (já formatada para a UI). */
  user_message: string;
  /** Sugestões de ação amigáveis. */
  suggested_actions: string[];
}

const MSG = {
  cold_high_friction:
    "Esta oferta parece avançada demais para Público Frio. Recomendamos trocar para um produto de entrada ou mover esta campanha para Remarketing/Público Quente.",
  cold_retention:
    "Esta oferta é de recompra/retenção — não combina com Público Frio. Mova esta campanha para a base de Clientes ou troque o produto.",
  unknown_low_conf:
    "Não foi possível confirmar a composição deste produto. Revise o cadastro do produto antes de aprovar a estratégia.",
  cold_ok:
    "Esta oferta combina bem com Público Frio.",
  warm_hot_ok: "Esta oferta combina com o funil escolhido.",
  retention_ok: "Esta oferta combina com a base de Clientes.",
} as const;

const SUGGEST_SWAP_PRODUCT = "Trocar para produto de entrada (base ou kit unitário de apresentação)";
const SUGGEST_MOVE_REMARK = "Mover esta campanha para Remarketing / Público Quente";
const SUGGEST_MOVE_RETENTION = "Mover esta campanha para a base de Clientes / Retenção";
const SUGGEST_REVIEW_PRODUCT = "Revisar o cadastro do produto (composição/tags)";

export function evaluateProductFunnelFit(input: FitGateInput): FitGateResult {
  const { commercial_class: cls, classification_confidence: conf, funnel_stage: fs } = input;

  // Composição desconhecida com baixa confiança → marca, não bloqueia, alerta.
  if (cls === "desconhecido" || conf === "low") {
    return {
      fit_level: "unknown_composition",
      soft_block: fs === "cold", // só bloqueia em frio
      reason_codes: ["product_composition_unknown_low_confidence"],
      user_message: MSG.unknown_low_conf,
      suggested_actions: [SUGGEST_REVIEW_PRODUCT],
    };
  }

  if (fs === "cold") {
    if (cls === "kit_quantidade" || cls === "upsell_manutencao") {
      return {
        fit_level: "blocked",
        soft_block: true,
        reason_codes: ["cold_audience_bundle_not_recommended", "cold_audience_high_friction_offer"],
        user_message: MSG.cold_high_friction,
        suggested_actions: [SUGGEST_SWAP_PRODUCT, SUGGEST_MOVE_REMARK],
      };
    }
    if (cls === "recompra_retencao") {
      return {
        fit_level: "blocked",
        soft_block: true,
        reason_codes: ["cold_audience_retention_offer_mismatch", "product_funnel_mismatch"],
        user_message: MSG.cold_retention,
        suggested_actions: [SUGGEST_SWAP_PRODUCT, SUGGEST_MOVE_RETENTION],
      };
    }
    // produto_base / produto_principal_simples / kit_unitario_apresentacao
    return {
      fit_level: "high",
      soft_block: false,
      reason_codes: ["fit_ok"],
      user_message: MSG.cold_ok,
      suggested_actions: [],
    };
  }

  if (fs === "warm") {
    if (cls === "recompra_retencao") {
      return {
        fit_level: "low",
        soft_block: false,
        reason_codes: ["offer_stage_mismatch"],
        user_message: "Esta é uma oferta de recompra — funciona melhor com a base de Clientes.",
        suggested_actions: [SUGGEST_MOVE_RETENTION],
      };
    }
    return { fit_level: "high", soft_block: false, reason_codes: ["fit_ok"], user_message: MSG.warm_hot_ok, suggested_actions: [] };
  }

  if (fs === "hot") {
    return { fit_level: "high", soft_block: false, reason_codes: ["fit_ok"], user_message: MSG.warm_hot_ok, suggested_actions: [] };
  }

  if (fs === "retention") {
    if (cls === "produto_base" || cls === "produto_principal_simples") {
      return {
        fit_level: "medium",
        soft_block: false,
        reason_codes: ["offer_stage_mismatch"],
        user_message: "Para a base de Clientes, ofertas de recompra/upsell ou kits maiores funcionam melhor.",
        suggested_actions: [],
      };
    }
    return { fit_level: "high", soft_block: false, reason_codes: ["fit_ok"], user_message: MSG.retention_ok, suggested_actions: [] };
  }

  // unknown funnel
  return {
    fit_level: "medium",
    soft_block: false,
    reason_codes: ["offer_stage_mismatch"],
    user_message: "Não foi possível confirmar o tipo de público desta campanha.",
    suggested_actions: [],
  };
}

/** Etiqueta amigável do nível de adequação para badges/UI. */
export function fitLevelLabel(level: FitLevel): { label: string; tone: "success" | "warning" | "destructive" | "info" | "muted" } {
  switch (level) {
    case "high": return { label: "Adequação alta", tone: "success" };
    case "medium": return { label: "Adequação média", tone: "info" };
    case "low": return { label: "Adequação baixa", tone: "warning" };
    case "blocked": return { label: "Bloqueada", tone: "destructive" };
    case "unknown_composition": return { label: "Composição incerta", tone: "warning" };
  }
}

/** Etiqueta amigável da classe comercial. */
export function commercialClassLabel(cls: CommercialClass): string {
  switch (cls) {
    case "produto_base": return "Produto base";
    case "produto_principal_simples": return "Produto principal";
    case "kit_unitario_apresentacao": return "Kit unitário de apresentação";
    case "kit_quantidade": return "Kit de quantidade";
    case "recompra_retencao": return "Oferta de recompra/retenção";
    case "upsell_manutencao": return "Oferta de upsell/manutenção";
    case "desconhecido": return "Composição não identificada";
  }
}
