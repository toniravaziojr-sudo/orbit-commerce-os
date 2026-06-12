// =====================================================================
// Onda G.6 — Audience Budget Fit (LITE).
//
// Sem IA, sem rede. Sem chamada à Meta (delivery_estimate/reachestimate).
// Usa apenas dados históricos do tenant já sincronizados:
//   gasto, impressões, alcance, frequência, CPM, CTR, conversões, CPA, ROAS.
//
// Classifica cada campanha/conjunto/público em uma das 5 categorias:
//   - under_funded
//   - adequate
//   - over_funded_small_audience
//   - saturation_risk
//   - insufficient_data
//
// Retorna explicação textual + (quando aplicável) sugestão de faixa de
// orçamento. NÃO bloqueia o plano por falta de fit; é sinal estratégico.
// =====================================================================

export type AudienceBudgetFit =
  | "under_funded"
  | "adequate"
  | "over_funded_small_audience"
  | "saturation_risk"
  | "insufficient_data";

export interface AudienceBudgetFitInput {
  current_daily_budget_cents: number;
  impressions_30d?: number | null;
  reach_30d?: number | null;
  frequency_avg?: number | null;
  cpm_cents?: number | null;
  ctr_pct?: number | null;
  conversions_30d?: number | null;
  cpa_cents?: number | null;
  roas?: number | null;
  audience_size_estimate?: number | null;
  spend_30d_cents?: number | null;
}

export interface AudienceBudgetFitResult {
  fit: AudienceBudgetFit;
  saturation_score: number | null;
  under_funding_score: number | null;
  recommended_action: string;
  suggested_budget_range_cents: { min_cents: number; max_cents: number } | null;
  explanation: string;
}

const MIN_IMPRESSIONS = 1000;
const MIN_SPEND_CENTS = 1000; // R$ 10

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function evaluateAudienceBudgetFit(input: AudienceBudgetFitInput): AudienceBudgetFitResult {
  const impressions = input.impressions_30d || 0;
  const spend = input.spend_30d_cents || 0;
  const reach = input.reach_30d || 0;
  const freq = input.frequency_avg ?? (reach > 0 ? impressions / reach : 0);
  const conv = input.conversions_30d || 0;
  const roas = input.roas || 0;

  if (impressions < MIN_IMPRESSIONS || spend < MIN_SPEND_CENTS) {
    return {
      fit: "insufficient_data",
      saturation_score: null,
      under_funding_score: null,
      recommended_action: "Aguardar acúmulo de dados antes de ajustar orçamento.",
      suggested_budget_range_cents: null,
      explanation: `Dados insuficientes (impressões=${impressions}, gasto=R$ ${(spend / 100).toFixed(2)}).`,
    };
  }

  // Saturation score (0..1) baseado em frequência
  let saturation_score = 0;
  if (freq >= 5) saturation_score = 1;
  else if (freq >= 3) saturation_score = clamp01(0.6 + (freq - 3) * 0.2);
  else if (freq >= 2) saturation_score = 0.3;
  else saturation_score = clamp01(freq / 6);

  // Under-funding score (0..1) — ROAS bom + poucas conversões/gasto
  let under_funding_score = 0;
  const spendBrl = spend / 100;
  if (roas >= 2 && conv >= 5 && spendBrl < 1500) under_funding_score = 0.8;
  else if (roas >= 1.5 && conv >= 3 && spendBrl < 800) under_funding_score = 0.5;
  else if (roas >= 1.2 && conv >= 2 && spendBrl < 400) under_funding_score = 0.3;

  let fit: AudienceBudgetFit = "adequate";
  let recommended_action = "Manter orçamento atual e monitorar.";
  let suggested_budget_range_cents: AudienceBudgetFitResult["suggested_budget_range_cents"] = null;

  const reachSmall = reach > 0 && reach < 50000;

  if (saturation_score >= 0.8 && reachSmall) {
    fit = "over_funded_small_audience";
    recommended_action = "Reduzir orçamento ou ampliar público — frequência alta em alcance pequeno.";
    const reduce = Math.max(2000, Math.round(input.current_daily_budget_cents * 0.6));
    suggested_budget_range_cents = { min_cents: reduce, max_cents: input.current_daily_budget_cents };
  } else if (saturation_score >= 0.8) {
    fit = "saturation_risk";
    recommended_action = "Renovar criativo ou expandir público — risco de fadiga (frequência alta).";
    const reduce = Math.max(2000, Math.round(input.current_daily_budget_cents * 0.7));
    suggested_budget_range_cents = { min_cents: reduce, max_cents: input.current_daily_budget_cents };
  } else if (under_funding_score >= 0.5) {
    fit = "under_funded";
    recommended_action = "Escalar gradualmente (até +20%/dia) — performance positiva e espaço para crescer.";
    const scale = Math.max(input.current_daily_budget_cents + 1000, Math.round(input.current_daily_budget_cents * 1.2));
    suggested_budget_range_cents = { min_cents: input.current_daily_budget_cents, max_cents: scale };
  }

  return {
    fit,
    saturation_score: Math.round(saturation_score * 100) / 100,
    under_funding_score: Math.round(under_funding_score * 100) / 100,
    recommended_action,
    suggested_budget_range_cents,
    explanation: [
      `Frequência: ${freq ? freq.toFixed(2) : "n/d"}`,
      `Alcance 30d: ${reach || "n/d"}`,
      `Conversões 30d: ${conv}`,
      `ROAS: ${roas ? roas.toFixed(2) + "x" : "n/d"}`,
      `Gasto 30d: R$ ${spendBrl.toFixed(2)}`,
    ].join(" | "),
  };
}
