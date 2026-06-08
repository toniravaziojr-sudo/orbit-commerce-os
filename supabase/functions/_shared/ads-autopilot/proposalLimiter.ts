// =====================================================================
// Ads Autopilot — Controle de volume de sugestões create_campaign.
//
// Funções puras (sem I/O) que dão suporte ao Strategist para:
//   • Pontuar (rankear) uma proposta create_campaign deterministicamente.
//   • Calcular a "chave de template" (product_id|funnel|format) para dedup.
//   • Aplicar limite por ciclo, limite por produto/ciclo e cooldown 24h.
//
// O módulo NÃO toca banco, NÃO chama LLM, NÃO chama Meta. Apenas decide
// se uma proposta deve ser: aceita (`accept`), substituir uma proposta
// existente de menor score (`replace`) ou ser arquivada como
// `superseded` (`supersede_self`).
//
// Versão estável referenciada em docs/telemetria.
// =====================================================================

export const PROPOSAL_LIMITER_VERSION = "1.0.0";

export const DEFAULT_MAX_PROPOSALS_PER_CYCLE = 3;
export const DEFAULT_MAX_PROPOSALS_PER_PRODUCT_PER_CYCLE = 1;
export const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

export type ProposalSupersedeReason =
  | "cycle_cap_reached"
  | "product_cap_reached"
  | "duplicate_template"
  | "cooldown_active"
  | "excessive_campaign_suggestions_after_pipeline_validation";

export interface ProposalArgsLite {
  product_id?: string | null;
  product_name?: string | null;
  funnel_stage?: string | null;
  ad_format?: string | null;
  campaign_name?: string | null;
  headlines?: string[] | null;
  headline?: string | null;
  primary_texts?: string[] | null;
  primary_text?: string | null;
  destination_url?: string | null;
  creative_asset_id?: string | null;
  creative_url?: string | null;
  daily_budget_cents?: number | null;
  objective?: string | null;
}

export interface ScoreContext {
  /** Resultado do Quality Gate para esta proposta. */
  qualityGateOk: boolean;
  /** true quando o creative_asset_id selecionado bate com o product_id da campanha. */
  creativeMatchesProduct: boolean;
  /** Produtos já cobertos por outras propostas pending nesta rodada. */
  productsAlreadyInCycle: Set<string>;
}

export interface ExistingPendingProposal {
  id: string;
  product_id: string | null;
  funnel_stage: string | null;
  ad_format: string | null;
  campaign_name: string | null;
  score: number;
  created_at: string; // ISO
}

export interface LimiterConfig {
  maxPerCycle?: number;
  maxPerProductPerCycle?: number;
  cooldownMs?: number;
  now?: () => number;
}

export interface LimiterDecision {
  decision: "accept" | "replace" | "supersede_self";
  /** IDs de propostas existentes que devem ser marcadas como `superseded`. */
  supersedeIds: string[];
  /** Motivo quando `supersede_self`. */
  reason?: ProposalSupersedeReason;
  /** Score calculado da proposta nova. */
  score: number;
  /** Chave de template usada para dedup. */
  templateKey: string;
}

// --------------------------------------------------------------------
// Score determinístico — quanto maior, melhor.
// --------------------------------------------------------------------
export function scoreProposal(
  args: ProposalArgsLite,
  ctx: ScoreContext,
): number {
  let s = 0;

  // Quality Gate aprovou (pré-requisito forte).
  if (ctx.qualityGateOk) s += 50;

  // Criativo vinculado ao mesmo produto.
  if (ctx.creativeMatchesProduct && (args.creative_asset_id || args.creative_url)) {
    s += 25;
  } else if (args.creative_asset_id || args.creative_url) {
    s += 10;
  }

  // Completude da proposta.
  const headlineCount = (args.headlines?.length || 0) + (args.headline ? 1 : 0);
  const primaryCount = (args.primary_texts?.length || 0) + (args.primary_text ? 1 : 0);
  if (headlineCount >= 2) s += 6;
  if (headlineCount >= 3) s += 2;
  if (primaryCount >= 2) s += 6;
  if (primaryCount >= 3) s += 2;
  if (args.destination_url) s += 5;
  if (args.objective) s += 2;

  // Diversidade: bônus se nenhum outro pending desta rodada cobre este produto.
  const pid = args.product_id || "";
  if (pid && !ctx.productsAlreadyInCycle.has(pid)) s += 10;

  // Orçamento menos agressivo (penaliza budgets muito altos em frio).
  const budget = Number(args.daily_budget_cents || 0);
  const funnel = String(args.funnel_stage || "").toLowerCase();
  const isCold = funnel === "tof" || funnel === "cold" || funnel === "prospecting";
  if (budget > 0 && budget <= 5000) s += 4; // até R$ 50/dia
  if (isCold && budget >= 20000) s -= 8; // R$ 200/dia em frio é arriscado

  return s;
}

// --------------------------------------------------------------------
// Chave de template usada para detectar variações quase iguais.
// --------------------------------------------------------------------
export function templateKey(args: ProposalArgsLite): string {
  const pid = args.product_id || "no_product";
  const funnel = (args.funnel_stage || "no_funnel").toLowerCase();
  const format = (args.ad_format || "no_format").toLowerCase();
  return `${pid}|${funnel}|${format}`;
}

// --------------------------------------------------------------------
// Decisão central: aceitar, substituir ou suprimir.
// --------------------------------------------------------------------
export function applyLimits(input: {
  args: ProposalArgsLite;
  newScore: number;
  existingPending: ExistingPendingProposal[];
  config?: LimiterConfig;
}): LimiterDecision {
  const cfg = input.config || {};
  const maxCycle = cfg.maxPerCycle ?? DEFAULT_MAX_PROPOSALS_PER_CYCLE;
  const maxProduct = cfg.maxPerProductPerCycle ?? DEFAULT_MAX_PROPOSALS_PER_PRODUCT_PER_CYCLE;
  const cooldownMs = cfg.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const now = (cfg.now ?? Date.now)();

  const key = templateKey(input.args);
  const pid = input.args.product_id || null;

  // 1) Cooldown 24h por produto+funil+format.
  const sameTemplateInCooldown = input.existingPending.filter((p) => {
    if (templateKey({
      product_id: p.product_id,
      funnel_stage: p.funnel_stage,
      ad_format: p.ad_format,
    }) !== key) return false;
    const age = now - new Date(p.created_at).getTime();
    return age <= cooldownMs;
  });
  if (sameTemplateInCooldown.length > 0) {
    // Se a nova proposta é claramente melhor, substitui a de menor score.
    const weakest = [...sameTemplateInCooldown].sort((a, b) => a.score - b.score)[0];
    if (weakest && input.newScore > weakest.score + 5) {
      return {
        decision: "replace",
        supersedeIds: sameTemplateInCooldown.map((p) => p.id),
        score: input.newScore,
        templateKey: key,
      };
    }
    return {
      decision: "supersede_self",
      supersedeIds: [],
      reason: "duplicate_template",
      score: input.newScore,
      templateKey: key,
    };
  }

  // 2) Cap por produto/ciclo.
  if (pid) {
    const sameProduct = input.existingPending.filter((p) => p.product_id === pid);
    if (sameProduct.length >= maxProduct) {
      const weakest = [...sameProduct].sort((a, b) => a.score - b.score)[0];
      if (weakest && input.newScore > weakest.score + 5) {
        return {
          decision: "replace",
          supersedeIds: [weakest.id],
          score: input.newScore,
          templateKey: key,
        };
      }
      return {
        decision: "supersede_self",
        supersedeIds: [],
        reason: "product_cap_reached",
        score: input.newScore,
        templateKey: key,
      };
    }
  }

  // 3) Cap global por ciclo.
  if (input.existingPending.length >= maxCycle) {
    const weakest = [...input.existingPending].sort((a, b) => a.score - b.score)[0];
    if (weakest && input.newScore > weakest.score + 5) {
      return {
        decision: "replace",
        supersedeIds: [weakest.id],
        score: input.newScore,
        templateKey: key,
      };
    }
    return {
      decision: "supersede_self",
      supersedeIds: [],
      reason: "cycle_cap_reached",
      score: input.newScore,
      templateKey: key,
    };
  }

  return {
    decision: "accept",
    supersedeIds: [],
    score: input.newScore,
    templateKey: key,
  };
}
