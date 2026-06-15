// =============================================================================
// Structure Completeness Gate — Onda D (gates por etapa)
//
// Etapas:
//   - "strategy"  → Aprovar estratégia: exige Campanha, Conjunto e Anúncio/Criativo
//                   minimamente definidos. NÃO exige Pixel/Evento/Página.
//   - "creative"  → Gerar criativos: exige apenas o Criativo do anúncio
//                   (produto, link, CTA, copy/headline, formato, prompt/referência).
//   - "publish"   → Publicar campanha: exige Página, Pixel/Evento e demais
//                   pré-requisitos finais da plataforma.
//
// Função pura, sem IA, sem rede.
// =============================================================================

import type { CampaignStructure } from "../normalizeCampaignStructure";
import { EMPTY_GATE, type GateIssue, type GateNodeType, type GateResult } from "./types";

export type GateStage = "strategy" | "creative" | "publish";

const REQUIRES_INPUT = "requires_user_input";

function isMissing(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" || s === "—" || s.toLowerCase() === REQUIRES_INPUT;
  }
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function needsUserInput(v: unknown): boolean {
  return typeof v === "string" && v.trim().toLowerCase() === REQUIRES_INPUT;
}

function make(
  node_type: GateNodeType,
  node_id: string | null,
  node: string,
  field: string,
  severity: "blocker" | "warning",
  message: string,
  opts: { kind?: GateIssue["kind"]; technical_reason?: string; suggested_action?: string } = {},
): GateIssue {
  return {
    node_type,
    node_id,
    node,
    field,
    severity,
    message,
    technical_reason: opts.technical_reason ?? null,
    suggested_action: opts.suggested_action ?? null,
    kind: opts.kind ?? (severity === "blocker" ? "required" : "recommended"),
  };
}

/**
 * Executa o gate para a etapa indicada. Default = "strategy" (compatível
 * com chamadores existentes do modal de proposta).
 */
export function runStructureCompletenessGate(
  structure: CampaignStructure,
  opts: { stage?: GateStage } = {},
): GateResult {
  const stage: GateStage = opts.stage ?? "strategy";
  if (!structure?.is_structured_campaign) return EMPTY_GATE;

  const blockers: GateIssue[] = [];
  const warnings: GateIssue[] = [];

  // ----- Etapa B (gerar criativo) — escopo restrito ao criativo -----
  if (stage === "creative") {
    structure.ads.forEach((ad, idx) => {
      const nodeId = String(idx);
      const node = ad.name || `Anúncio ${idx + 1}`;
      const prefix = `ad.${idx}`;
      if (isMissing(ad.product_name)) blockers.push(make("creative", nodeId, node, `${prefix}.product_name`, "blocker", "Selecione o produto/oferta do anúncio."));
      if (isMissing(ad.destination_url)) blockers.push(make("creative", nodeId, node, `${prefix}.destination_url`, "blocker", "Defina o link do produto."));
      if (isMissing(ad.cta)) blockers.push(make("creative", nodeId, node, `${prefix}.cta`, "blocker", "Defina o botão de ação."));
      if (isMissing(ad.primary_text) && isMissing(ad.creative_prompt)) {
        blockers.push(make("creative", nodeId, node, `${prefix}.primary_text`, "blocker", "Defina o texto principal ou o prompt do criativo."));
      }
      if (isMissing(ad.creative_format)) blockers.push(make("creative", nodeId, node, `${prefix}.creative_format`, "blocker", "Defina o formato do criativo (ex.: 1:1, 9:16)."));
      if (isMissing(ad.reference_image_url) && isMissing(ad.creative_prompt)) {
        warnings.push(make("creative", nodeId, node, `${prefix}.reference_image_url`, "warning", "Recomendado: imagem de referência do produto ou prompt detalhado."));
      }
    });
    return summarize(blockers, warnings);
  }

  // ----- Etapa C (publicar) — exige plataforma pronta -----
  if (stage === "publish") {
    structure.ad_sets.forEach((a, idx) => {
      const nodeId = String(idx);
      const node = a.name || `Conjunto ${idx + 1}`;
      const prefix = `adset.${idx}`;
      if (needsUserInput(a.conversion_event) || isMissing(a.conversion_event)) {
        blockers.push(make("ad_set", nodeId, node, `${prefix}.conversion_event`, "blocker", "Confirme o evento de conversão (Pixel) antes de publicar.", { kind: "requires_user_input" }));
      }
    });
    // Página e Pixel são validados em outro lugar (configuração de produção).
    return summarize(blockers, warnings);
  }

  // ===== Etapa A (estratégia) — default =====
  const c = structure.campaign;

  // Onda H.2.1 — contrato v1.1: detecta orçamento misto CBO+ABO no payload.
  // Se a campanha tem orçamento E algum conjunto também tem, e o budget_mode
  // não foi explicitamente declarado, isso é incoerência técnica (bloqueia).
  if (c.budget_mode == null) {
    const campaignHasBudget = typeof c.daily_budget_cents === "number" && c.daily_budget_cents > 0;
    const someAdsetHasBudget = structure.ad_sets.some((a) => typeof a.daily_budget_cents === "number" && (a.daily_budget_cents as number) > 0);
    if (campaignHasBudget && someAdsetHasBudget) {
      blockers.push(make("campaign", "campaign", "Campanha", "campaign.budget_mode", "blocker",
        "Esta proposta tem orçamento ao mesmo tempo na campanha e nos conjuntos, sem indicar qual deles é o real. Ajuste a proposta antes de aprovar.",
        { technical_reason: "mixed_budget_modes" }));
    }
  }

  if (isMissing(c.name)) blockers.push(make("campaign", "campaign", "Campanha", "campaign.name", "blocker", "A campanha precisa de um nome."));
  if (isMissing(c.objective)) blockers.push(make("campaign", "campaign", "Campanha", "campaign.objective", "blocker", "Defina o objetivo da campanha."));
  if (isMissing(c.buying_type)) warnings.push(make("campaign", "campaign", "Campanha", "campaign.buying_type", "warning", "Modo de compra não definido — será usado Leilão por padrão."));
  if (isMissing(c.budget_type)) warnings.push(make("campaign", "campaign", "Campanha", "campaign.budget_type", "warning", "Tipo de orçamento não definido — será usado Diário por padrão."));
  // Em CBO, orçamento fica na campanha; em ABO, fica nos conjuntos.
  if (c.budget_mode === "ABO") {
    const anyAdsetBudget = structure.ad_sets.some((a) => typeof a.daily_budget_cents === "number" && (a.daily_budget_cents as number) > 0);
    if (!anyAdsetBudget) {
      blockers.push(make("campaign", "campaign", "Campanha", "ad_sets.daily_budget_cents", "blocker", "Em ABO, informe o orçamento de pelo menos um conjunto."));
    }
  } else if (isMissing(c.daily_budget_cents)) {
    blockers.push(make("campaign", "campaign", "Campanha", "campaign.daily_budget_cents", "blocker", "Informe o orçamento da campanha."));
  }
  if (isMissing(c.planned_status)) warnings.push(make("campaign", "campaign", "Campanha", "campaign.planned_status", "warning", "Status inicial não definido — será criada como Pausada por padrão."));

  if (structure.ad_sets.length === 0) {
    blockers.push(make("ad_set", null, "Conjuntos de anúncios", "ad_sets", "blocker", "A proposta não tem nenhum conjunto de anúncios."));
  }
  structure.ad_sets.forEach((a, idx) => {
    const nodeId = String(idx);
    const node = a.name || `Conjunto ${idx + 1}`;
    const prefix = `adset.${idx}`;

    if (isMissing(a.name)) warnings.push(make("ad_set", nodeId, node, `${prefix}.name`, "warning", "Recomendado: dar um nome ao conjunto."));
    if (isMissing(a.location)) blockers.push(make("ad_set", nodeId, node, `${prefix}.location`, "blocker", "Defina a região/país do conjunto."));
    if (isMissing(a.age_range)) blockers.push(make("ad_set", nodeId, node, `${prefix}.age_range`, "blocker", "Defina a faixa etária do conjunto."));
    if (isMissing(a.gender)) blockers.push(make("ad_set", nodeId, node, `${prefix}.gender`, "blocker", "Defina o gênero do conjunto."));
    if (isMissing(a.placements)) blockers.push(make("ad_set", nodeId, node, `${prefix}.placements`, "blocker", "Defina os posicionamentos do conjunto (use Automático/Advantage+ se não souber)."));
    if (isMissing(a.optimization_goal)) blockers.push(make("ad_set", nodeId, node, `${prefix}.optimization_goal`, "blocker", "Defina a meta de otimização do conjunto."));
    // Evento de conversão NÃO bloqueia aprovação da estratégia (Onda D).
    // É exigido apenas na etapa de publicação. Aqui só avisamos.
    if (needsUserInput(a.conversion_event)) {
      warnings.push(make("ad_set", nodeId, node, `${prefix}.conversion_event`, "warning", "Confirme o evento de conversão (Pixel) antes de publicar.", { kind: "requires_user_input" }));
    }
    if (isMissing(a.targeting_summary) && a.inclusions.length === 0) {
      warnings.push(make("ad_set", nodeId, node, `${prefix}.targeting_summary`, "warning", "Recomendado: descrever o público do conjunto."));
    }
    if (isMissing(a.daily_budget_cents) && isMissing(c.daily_budget_cents)) {
      warnings.push(make("ad_set", nodeId, node, `${prefix}.daily_budget_cents`, "warning", "Recomendado: definir orçamento por conjunto se a campanha não tiver orçamento central."));
    }
  });

  if (structure.ads.length === 0) {
    blockers.push(make("ad", null, "Anúncios", "ads", "blocker", "A proposta não tem nenhum anúncio."));
  }
  structure.ads.forEach((ad, idx) => {
    const nodeId = String(idx);
    const node = ad.name || `Anúncio ${idx + 1}`;
    const prefix = `ad.${idx}`;

    if (isMissing(ad.headline)) blockers.push(make("creative", nodeId, node, `${prefix}.headline`, "blocker", "Defina o título do anúncio."));
    if (isMissing(ad.primary_text)) blockers.push(make("creative", nodeId, node, `${prefix}.primary_text`, "blocker", "Defina o texto principal do anúncio."));
    if (isMissing(ad.cta)) blockers.push(make("creative", nodeId, node, `${prefix}.cta`, "blocker", "Defina o botão de ação (ex.: Comprar agora, Saiba mais)."));
    if (isMissing(ad.destination_url)) blockers.push(make("creative", nodeId, node, `${prefix}.destination_url`, "blocker", "Defina a URL de destino do anúncio."));
    if (isMissing(ad.creative_format)) warnings.push(make("creative", nodeId, node, `${prefix}.creative_format`, "warning", "Recomendado: definir o formato do criativo (imagem, vídeo, carrossel)."));
  });

  return summarize(blockers, warnings);
}

function summarize(blockers: GateIssue[], warnings: GateIssue[]): GateResult {
  const passed = blockers.length === 0;
  const summary = passed
    ? null
    : blockers.length === 1
      ? `Falta 1 campo obrigatório: ${blockers[0].message}`
      : `Faltam ${blockers.length} campos obrigatórios para liberar a aprovação.`;
  return { passed, blockers, warnings, summary };
}
