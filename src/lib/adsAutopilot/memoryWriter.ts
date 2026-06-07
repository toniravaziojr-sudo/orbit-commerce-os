// =====================================================================
// Tenant Memory Writer — Ads Autopilot (Etapa 7.mem — Subfase C)
//
// Lógica PURA, determinística e auditável que transforma feedbacks
// humanos (A.1/A.2) em preferências aprendidas (Subfase B).
//
// Esta camada NÃO acessa o banco — apenas:
//   - deriva as evidências (suportes/contradições) de um feedback;
//   - recalcula confidence/status de uma memória dado o conjunto
//     de evidências aplicáveis no ledger.
//
// O persistidor (edge function ads-autopilot-memory-writer) consome
// este módulo e faz upsert atômico em:
//   - ads_autopilot_memory_evidence (ledger)
//   - ads_autopilot_tenant_memory   (preferências)
//
// Restrições obrigatórias desta subfase:
//   - NÃO altera o feedback original.
//   - NÃO influencia veredito, sugestão, prompt, Policy Engine,
//     Governance Layer, Action Derivation ou execução.
//   - NÃO chama Meta. NÃO ativa autoexecução.
//   - NÃO usa LLM. Cálculo é 100% determinístico.
// =====================================================================

export type MemoryStatus = "provisional" | "active" | "archived";

export interface FeedbackRow {
  id: string;
  tenant_id: string;
  sales_platform: string | null;
  ads_platform: string;
  action_type: string | null;
  objective: string | null;
  decision: "approved" | "rejected" | "needs_revision" | "edited_then_approved";
  reason_codes: string[];
  should_become_preference: boolean | null;
  decided_at: string; // ISO timestamp
}

export interface DerivedEvidence {
  sales_platform: string;
  ads_platform: string;
  memory_type: string;
  scope: string;
  key: string;
  is_supporting: boolean;
  weight: number; // 1.0 padrão; 2.0 quando should_become_preference=true
}

// ---------------------------------------------------------------------
// Mapeamento de reason_codes → tipo de memória.
// Não exaustivo nesta subfase: apenas categorias estruturais conhecidas.
// Códigos fora deste mapa NÃO geram memória por reason_code (mas o
// feedback ainda gera approved/rejected_action_pattern abaixo).
// ---------------------------------------------------------------------
const REASON_CODE_TO_MEMORY: Record<string, string> = {
  // Orçamento
  budget_too_high: "budget_preference",
  budget_too_low: "budget_preference",
  budget_ok: "budget_preference",
  good_budget_logic: "budget_preference",
  // Contexto faltante
  missing_context: "context_gap_pattern",
  insufficient_data: "context_gap_pattern",
  // Conflito estratégico
  strategy_conflict: "strategy_conflict_pattern",
  conflicts_with_strategy: "strategy_conflict_pattern",
  // Proteção de campanha vencedora
  protect_winning_campaign: "campaign_protection_candidate",
  do_not_touch_winner: "campaign_protection_candidate",
  // Priorização de produto
  prioritize_product: "product_priority_candidate",
  deprioritize_product: "product_deprioritization_candidate",
  // Criativo / Copy
  creative_style_ok: "creative_style_preference",
  creative_style_bad: "creative_style_preference",
  copy_style_ok: "copy_style_preference",
  copy_style_bad: "copy_style_preference",
  // Timing
  bad_timing: "timing_preference",
  good_timing: "timing_preference",
};

// Tipos com par "espelho" (suporte de um implica contradição do outro).
const MIRROR_TYPE: Record<string, string> = {
  approved_action_pattern: "rejected_action_pattern",
  rejected_action_pattern: "approved_action_pattern",
};

const APPROVING_DECISIONS = new Set(["approved", "edited_then_approved"]);
const REJECTING_DECISIONS = new Set(["rejected", "needs_revision"]);

/**
 * Deriva as evidências (suporte + espelhos de contradição) a partir
 * de um único feedback. Não acessa banco. É a única fonte de verdade
 * de "o que este feedback significa em termos de memória".
 */
export function deriveEvidencesFromFeedback(
  f: FeedbackRow,
): DerivedEvidence[] {
  const sales = (f.sales_platform || "unknown").trim() || "unknown";
  const ads = f.ads_platform;
  if (!ads) return [];

  const weight = f.should_become_preference === true ? 2.0 : 1.0;
  const evidences: DerivedEvidence[] = [];

  // ---- 1) Padrão de aprovação/recusa de ação --------------------
  if (f.action_type) {
    const key = `${f.action_type}|${f.objective ?? "any"}`;

    let primaryType: string | null = null;
    if (APPROVING_DECISIONS.has(f.decision)) {
      primaryType = "approved_action_pattern";
    } else if (REJECTING_DECISIONS.has(f.decision)) {
      primaryType = "rejected_action_pattern";
    }

    if (primaryType) {
      evidences.push({
        sales_platform: sales,
        ads_platform: ads,
        memory_type: primaryType,
        scope: "action",
        key,
        is_supporting: true,
        weight,
      });
      const mirror = MIRROR_TYPE[primaryType];
      if (mirror) {
        evidences.push({
          sales_platform: sales,
          ads_platform: ads,
          memory_type: mirror,
          scope: "action",
          key,
          is_supporting: false,
          weight,
        });
      }
    }
  }

  // ---- 2) Padrões por reason_code --------------------------------
  for (const code of f.reason_codes || []) {
    const memType = REASON_CODE_TO_MEMORY[code];
    if (!memType) continue;
    evidences.push({
      sales_platform: sales,
      ads_platform: ads,
      memory_type: memType,
      scope: "reason_code",
      key: `${code}|${f.action_type ?? "any"}`,
      // Reason codes contam como suporte do próprio padrão observado.
      // Contradição entre reason_codes opostos virá em subfase futura
      // quando o catálogo declarar pares antagônicos formalmente.
      is_supporting: true,
      weight,
    });
  }

  return evidences;
}

// ---------------------------------------------------------------------
// Recálculo de confidence / status a partir do ledger de evidências.
// ---------------------------------------------------------------------

export interface EvidenceRecord {
  is_supporting: boolean;
  weight: number;
  processed_at: string; // ISO
  should_become_preference?: boolean | null;
}

export interface RecomputeResult {
  evidence_count: number;       // total de evidências aplicadas (suportes + contradições)
  supporting_count: number;     // só as que sustentam
  contradiction_count: number;  // só as que contradizem
  recent_contradictions: number;// contradições nos últimos 30 dias
  spp_count: number;            // evidências marcadas should_become_preference
  consistency: number;          // supporting / total
  confidence: number;           // 0..1, arredondado em 4 casas
  status: MemoryStatus;         // provisional | active | archived
  last_confirmed_at: string | null;
  last_contradicted_at: string | null;
}

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const ACTIVE_MIN_EVIDENCES = 5;
const ACTIVE_MIN_CONSISTENCY = 0.8;
const ACTIVE_MAX_RECENT_CONTRADICTIONS = 3;
const PROVISIONAL_MIN_EVIDENCES = 2;

export function recomputeMemoryFromEvidences(
  evidences: EvidenceRecord[],
  now: Date = new Date(),
  previousStatus: MemoryStatus = "provisional",
): RecomputeResult {
  const total = evidences.length;
  const supporting = evidences.filter((e) => e.is_supporting);
  const contradicting = evidences.filter((e) => !e.is_supporting);

  const nowMs = now.getTime();
  const recentContradictions = contradicting.filter(
    (e) => nowMs - new Date(e.processed_at).getTime() <= RECENT_WINDOW_MS,
  ).length;

  const sppCount = evidences.filter((e) => e.should_become_preference === true)
    .length;

  const consistency = total === 0 ? 0 : supporting.length / total;

  // Cálculo determinístico de confidence:
  //   base       = consistency
  //   volume     = min(supporting / ACTIVE_MIN_EVIDENCES, 1)
  //   spp_bonus  = min(spp_count * 0.05, 0.15)
  //   penalty    = min(recent_contradictions * 0.1, 0.4)
  const volume = Math.min(supporting.length / ACTIVE_MIN_EVIDENCES, 1);
  const sppBonus = Math.min(sppCount * 0.05, 0.15);
  const penalty = Math.min(recentContradictions * 0.1, 0.4);
  let confidence = consistency * volume + sppBonus - penalty;
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));
  confidence = Math.round(confidence * 10000) / 10000;

  // Promoção / rebaixamento
  let status: MemoryStatus;
  // "Pelo menos 5 evidências reais e consistentes" (spec): total >= 5 com
  // consistência >= 80% e sem 3 contradições recentes.
  const canBeActive =
    total >= ACTIVE_MIN_EVIDENCES &&
    consistency >= ACTIVE_MIN_CONSISTENCY &&
    recentContradictions < ACTIVE_MAX_RECENT_CONTRADICTIONS;

  if (previousStatus === "archived") {
    status = "archived";
  } else if (canBeActive) {
    status = "active";
  } else if (
    previousStatus === "active" &&
    recentContradictions >= ACTIVE_MAX_RECENT_CONTRADICTIONS
  ) {
    // Rebaixamento explícito por contradições recentes
    status = "provisional";
  } else if (supporting.length >= PROVISIONAL_MIN_EVIDENCES) {
    status = "provisional";
  } else {
    // 0..1 evidência de suporte: registramos como provisional de baixíssima
    // confiança (não vira active, conforme regra A do prompt).
    status = "provisional";
  }

  const lastConfirmedAt = supporting.length === 0
    ? null
    : supporting
        .map((e) => e.processed_at)
        .sort()
        .at(-1) ?? null;

  const lastContradictedAt = contradicting.length === 0
    ? null
    : contradicting
        .map((e) => e.processed_at)
        .sort()
        .at(-1) ?? null;

  return {
    evidence_count: total,
    supporting_count: supporting.length,
    contradiction_count: contradicting.length,
    recent_contradictions: recentContradictions,
    spp_count: sppCount,
    consistency: Math.round(consistency * 10000) / 10000,
    confidence,
    status,
    last_confirmed_at: lastConfirmedAt,
    last_contradicted_at: lastContradictedAt,
  };
}

export const __THRESHOLDS__ = {
  ACTIVE_MIN_EVIDENCES,
  ACTIVE_MIN_CONSISTENCY,
  ACTIVE_MAX_RECENT_CONTRADICTIONS,
  PROVISIONAL_MIN_EVIDENCES,
  RECENT_WINDOW_MS,
};
