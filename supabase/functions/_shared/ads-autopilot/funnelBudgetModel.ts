// =====================================================================
// Onda G.1 — Modelo determinístico de Orçamento por Funil.
//
// Sem IA, sem rede. Recebe:
//   - orçamento total diário (cents);
//   - splits configurados pelo usuário (cold/remarketing/tests/leads);
//   - campanhas existentes (id, status, daily_budget_cents) com sugestão
//     opcional de funil já inferido.
//
// Produz funnel_budget_state com planejado / ocupado / livre por funil
// e a projeção sequencial de disponibilidade após ações planejadas.
//
// A regra de negócio é: campanha nova só usa orçamento maior depois que
// uma redução/pausa anterior na sequência liberar verba.
// =====================================================================

export type FunnelKey = "cold" | "remarketing" | "tests" | "leads";
export type FunnelBucketKey = FunnelKey | "unknown";

export interface CampaignBudgetInput {
  id: string;
  name: string;
  status: string;
  daily_budget_cents: number;
  inferred_funnel?: FunnelBucketKey;
  objective?: string | null;
}

export interface FunnelBucket {
  planned_pct: number;
  planned_cents: number;
  occupied_cents: number;
  free_cents: number;
  occupied_campaigns: Array<{ id: string; name: string; budget_cents: number }>;
}

export interface FunnelBudgetState {
  total_daily_cents: number;
  per_funnel: Record<FunnelBucketKey, FunnelBucket>;
  unallocated_cents: number;
  splits_source: "user_config" | "defaults";
}

export interface PlannedActionBudget {
  action_index: number;
  action_type: string;
  funnel: FunnelBucketKey;
  budget_delta_cents: number; // + para criar/escalar, - para pausar/reduzir
  references_release_from_action_index?: number;
}

export interface SequentialAvailabilityRow {
  action_index: number;
  funnel: FunnelBucketKey;
  before_free_cents: number;
  after_free_cents: number;
  uses_release_from_action_index?: number;
  ok: boolean;
  reason?: "exceeds_free_budget" | "negative_funnel_budget";
}

const DEFAULT_SPLITS: Record<FunnelKey, number> = {
  cold: 60,
  remarketing: 25,
  tests: 15,
  leads: 0,
};

const COLD_PATTERNS = /(tof|cold|frio|prospec|aquisi|broad|amplo|lookalike|lal\b|interesse)/i;
const REMARKETING_PATTERNS = /(remarket|retarget|bof|hot|quente|catalog|catálogo|carrinho|abandon|revisit|vc\b|view_content)/i;
const LEADS_PATTERNS = /(\blead\b|leads\b|geração de lead|lead_gen)/i;
const TEST_PATTERNS = /(\bteste\b|\btest\b|\bbeta\b|experim)/i;

export function inferCampaignFunnel(c: { name?: string | null; objective?: string | null }): FunnelBucketKey {
  const name = c.name || "";
  const obj = (c.objective || "").toLowerCase();
  if (REMARKETING_PATTERNS.test(name) || obj.includes("catalog")) return "remarketing";
  if (LEADS_PATTERNS.test(name) || obj.includes("lead")) return "leads";
  if (TEST_PATTERNS.test(name)) return "tests";
  if (COLD_PATTERNS.test(name)) return "cold";
  return "unknown";
}

function normalizeSplits(
  splits: Partial<Record<FunnelKey, number>> | null | undefined,
): { splits: Record<FunnelKey, number>; source: "user_config" | "defaults" } {
  if (!splits || Object.values(splits).every(v => !v)) {
    return { splits: { ...DEFAULT_SPLITS }, source: "defaults" };
  }
  return {
    splits: {
      cold: splits.cold ?? 0,
      remarketing: splits.remarketing ?? 0,
      tests: splits.tests ?? 0,
      leads: splits.leads ?? 0,
    },
    source: "user_config",
  };
}

export function computeFunnelBudgetState(input: {
  totalDailyCents: number;
  funnelSplits: Partial<Record<FunnelKey, number>> | null | undefined;
  campaigns: CampaignBudgetInput[];
}): FunnelBudgetState {
  const totalDailyCents = Math.max(0, Math.round(input.totalDailyCents || 0));
  const { splits, source } = normalizeSplits(input.funnelSplits);

  const per_funnel: Record<FunnelBucketKey, FunnelBucket> = {
    cold: { planned_pct: splits.cold, planned_cents: Math.round((totalDailyCents * splits.cold) / 100), occupied_cents: 0, free_cents: 0, occupied_campaigns: [] },
    remarketing: { planned_pct: splits.remarketing, planned_cents: Math.round((totalDailyCents * splits.remarketing) / 100), occupied_cents: 0, free_cents: 0, occupied_campaigns: [] },
    tests: { planned_pct: splits.tests, planned_cents: Math.round((totalDailyCents * splits.tests) / 100), occupied_cents: 0, free_cents: 0, occupied_campaigns: [] },
    leads: { planned_pct: splits.leads, planned_cents: Math.round((totalDailyCents * splits.leads) / 100), occupied_cents: 0, free_cents: 0, occupied_campaigns: [] },
    unknown: { planned_pct: 0, planned_cents: 0, occupied_cents: 0, free_cents: 0, occupied_campaigns: [] },
  };

  for (const c of input.campaigns || []) {
    if ((c.status || "").toUpperCase() !== "ACTIVE") continue;
    const f = c.inferred_funnel || inferCampaignFunnel(c);
    const bucket = per_funnel[f] ?? per_funnel.unknown;
    bucket.occupied_cents += Math.max(0, Math.round(c.daily_budget_cents || 0));
    bucket.occupied_campaigns.push({
      id: c.id,
      name: c.name || c.id,
      budget_cents: Math.max(0, Math.round(c.daily_budget_cents || 0)),
    });
  }

  for (const key of Object.keys(per_funnel) as FunnelBucketKey[]) {
    per_funnel[key].free_cents = per_funnel[key].planned_cents - per_funnel[key].occupied_cents;
  }

  const totalPlanned =
    per_funnel.cold.planned_cents +
    per_funnel.remarketing.planned_cents +
    per_funnel.tests.planned_cents +
    per_funnel.leads.planned_cents;

  return {
    total_daily_cents: totalDailyCents,
    per_funnel,
    unallocated_cents: totalDailyCents - totalPlanned,
    splits_source: source,
  };
}

export function projectSequentialAvailability(
  state: FunnelBudgetState,
  actions: PlannedActionBudget[],
): SequentialAvailabilityRow[] {
  const freeBy: Record<string, number> = {};
  (Object.keys(state.per_funnel) as FunnelBucketKey[]).forEach(k => {
    freeBy[k] = state.per_funnel[k].free_cents;
  });

  const rows: SequentialAvailabilityRow[] = [];
  for (const action of actions) {
    const before = freeBy[action.funnel] ?? 0;
    let ok = true;
    let reason: SequentialAvailabilityRow["reason"];
    if (action.budget_delta_cents > 0 && action.budget_delta_cents > before) {
      ok = false;
      reason = "exceeds_free_budget";
    }
    const after = before - action.budget_delta_cents;
    if (after < 0 && !reason) reason = "negative_funnel_budget";
    freeBy[action.funnel] = after;
    rows.push({
      action_index: action.action_index,
      funnel: action.funnel,
      before_free_cents: before,
      after_free_cents: after,
      uses_release_from_action_index: action.references_release_from_action_index,
      ok,
      reason,
    });
  }
  return rows;
}

/** Formatador humano para uso no prompt da IA e na UI. */
export function formatFunnelBudgetStatePtBr(state: FunnelBudgetState): string {
  const reais = (c: number) => `R$ ${(c / 100).toFixed(2)}`;
  const lines: string[] = [];
  lines.push(`Total diário: ${reais(state.total_daily_cents)} | Origem dos splits: ${state.splits_source === "user_config" ? "configuração do usuário" : "default"}`);
  const order: FunnelBucketKey[] = ["cold", "remarketing", "tests", "leads", "unknown"];
  for (const f of order) {
    const b = state.per_funnel[f];
    if (f === "unknown" && b.occupied_cents === 0) continue;
    if (b.planned_pct === 0 && b.occupied_cents === 0) continue;
    const label =
      f === "cold" ? "Frio" :
      f === "remarketing" ? "Remarketing" :
      f === "tests" ? "Testes" :
      f === "leads" ? "Leads" :
      "Sem funil identificado";
    lines.push(
      `- ${label}: planejado ${reais(b.planned_cents)} (${b.planned_pct}%), ocupado ${reais(b.occupied_cents)}, livre ${reais(b.free_cents)}` +
      (b.occupied_campaigns.length ? ` | campanhas ativas: ${b.occupied_campaigns.map(c => `${c.name}=${reais(c.budget_cents)}`).join(", ")}` : ""),
    );
  }
  if (state.unallocated_cents !== 0) {
    lines.push(`- Não alocado pelos splits: ${reais(state.unallocated_cents)}`);
  }
  return lines.join("\n");
}
