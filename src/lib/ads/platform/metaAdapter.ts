// =============================================================================
// Meta Ads — Adapter de tradução (Onda C.1)
//
// Camada pura que separa três coisas:
//   1) label PT-BR exibido na UI;
//   2) enum canônico interno (fonte de verdade do contrato);
//   3) enum oficial da Meta (usado pelo Capabilities Registry / publicação).
//
// O Platform Compatibility Gate só pode comparar enum de plataforma DEPOIS de
// traduzir pelo adapter. Comparar enum canônico ("sales") direto com a lista
// da Meta (["OUTCOME_SALES", ...]) é PROIBIDO e foi a causa do erro
// "objetivo SALES não suportado".
//
// Sem chamadas de rede, sem IA, sem leitura de banco.
// =============================================================================

// -------- Objetivo da campanha -----------------------------------------------

export type CanonicalObjective =
  | "sales"
  | "leads"
  | "traffic"
  | "awareness"
  | "engagement"
  | "app_promotion";

export const CANONICAL_OBJECTIVES: CanonicalObjective[] = [
  "sales", "leads", "traffic", "awareness", "engagement", "app_promotion",
];

const OBJECTIVE_LABELS_PTBR: Record<CanonicalObjective, string> = {
  sales: "Vendas",
  leads: "Geração de leads",
  traffic: "Tráfego",
  awareness: "Reconhecimento de marca",
  engagement: "Engajamento",
  app_promotion: "Promoção de aplicativo",
};

const META_OBJECTIVE_MAP: Record<CanonicalObjective, string> = {
  sales: "OUTCOME_SALES",
  leads: "OUTCOME_LEADS",
  traffic: "OUTCOME_TRAFFIC",
  awareness: "OUTCOME_AWARENESS",
  engagement: "OUTCOME_ENGAGEMENT",
  app_promotion: "OUTCOME_APP_PROMOTION",
};

const OBJECTIVE_ALIASES: Record<string, CanonicalObjective> = {
  // canônico (case-insensitive)
  sales: "sales", leads: "leads", traffic: "traffic", awareness: "awareness",
  engagement: "engagement", app_promotion: "app_promotion",
  // aliases legados / PT-BR
  conversions: "sales", purchase: "sales", purchases: "sales",
  vendas: "sales", sale: "sales", venda: "sales",
  lead: "leads", lead_generation: "leads", "geração de leads": "leads",
  tráfego: "traffic", trafego: "traffic",
  reach: "awareness", brand_awareness: "awareness", reconhecimento: "awareness",
  engajamento: "engagement",
  app: "app_promotion",
  // enums oficiais Meta
  outcome_sales: "sales",
  outcome_leads: "leads",
  outcome_traffic: "traffic",
  outcome_awareness: "awareness",
  outcome_engagement: "engagement",
  outcome_app_promotion: "app_promotion",
};

export function inferCanonicalObjective(raw: string | null | undefined): CanonicalObjective | null {
  if (!raw || typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  return OBJECTIVE_ALIASES[key] ?? null;
}

export function translateObjectiveToMeta(canonical: CanonicalObjective): string | null {
  return META_OBJECTIVE_MAP[canonical] ?? null;
}

export function objectiveLabelPtBr(canonical: CanonicalObjective): string {
  return OBJECTIVE_LABELS_PTBR[canonical];
}

// -------- CTA / Evento / Posicionamento / Formato ----------------------------
// Para esses campos, o enum canônico é o próprio valor já em uso no contrato
// (ex.: "SHOP_NOW", "PURCHASE", "SINGLE_IMAGE"), que coincide com o oficial
// da Meta. Mantemos a função separada para que, no futuro, Google/TikTok
// possam ter seus próprios mappers sem mudar a UI.

export function translateCtaToMeta(canonical: string | null | undefined): string | null {
  if (!canonical) return null;
  return canonical.toUpperCase();
}

export function translateConversionEventToMeta(canonical: string | null | undefined): string | null {
  if (!canonical) return null;
  return canonical.toUpperCase();
}

export function translatePlacementToMeta(canonical: string | null | undefined): string | null {
  if (!canonical) return null;
  return canonical.toLowerCase();
}

export function translateCreativeFormatToMeta(canonical: string | null | undefined): string | null {
  if (!canonical) return null;
  return canonical.toUpperCase();
}
