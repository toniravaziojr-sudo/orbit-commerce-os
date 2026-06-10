// =============================================================================
// Structure Completeness Gate (Gestor de Tráfego IA)
//
// Valida se uma proposta estruturada tem dados suficientes para aprovação da
// estratégia. Pura, sem chamadas externas. Não consome IA, não persiste nada.
//
// Regras:
//  - Roda APENAS quando is_structured_campaign === true (proposta de campanha).
//  - Campo obrigatório ausente → blocker (impede "Aprovar estratégia e gerar criativos").
//  - Campo "requires_user_input" → blocker amigável.
//  - Campo recomendado ausente → warning.
//  - Campo opcional ausente → ignorado.
// =============================================================================

import type { CampaignStructure } from "../normalizeCampaignStructure";
import { EMPTY_GATE, type GateIssue, type GateResult } from "./types";

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

function blocker(field: string, node: string, message: string, kind: GateIssue["kind"] = "required"): GateIssue {
  return { field, node, severity: "blocker", message, kind };
}
function warn(field: string, node: string, message: string, kind: GateIssue["kind"] = "recommended"): GateIssue {
  return { field, node, severity: "warning", message, kind };
}

export function runStructureCompletenessGate(structure: CampaignStructure): GateResult {
  if (!structure?.is_structured_campaign) return EMPTY_GATE;

  const blockers: GateIssue[] = [];
  const warnings: GateIssue[] = [];

  // -------- Campanha --------
  const c = structure.campaign;
  if (isMissing(c.name)) blockers.push(blocker("campaign.name", "Campanha", "A campanha precisa de um nome."));
  if (isMissing(c.objective)) blockers.push(blocker("campaign.objective", "Campanha", "Defina o objetivo da campanha."));
  if (isMissing(c.daily_budget_cents)) blockers.push(blocker("campaign.budget", "Campanha", "Informe o orçamento da campanha."));
  if (isMissing(c.destination_url)) warnings.push(warn("campaign.destination_url", "Campanha", "Recomendado: definir a URL de destino padrão da campanha."));
  if (isMissing(c.planned_status)) warnings.push(warn("campaign.planned_status", "Campanha", "Status inicial não definido — será criada como PAUSADA por padrão."));

  // -------- Conjuntos de anúncios --------
  if (structure.ad_sets.length === 0) {
    blockers.push(blocker("ad_sets", "Conjuntos de anúncios", "A proposta não tem nenhum conjunto de anúncios."));
  }
  structure.ad_sets.forEach((a, idx) => {
    const node = a.name || `Conjunto ${idx + 1}`;
    const prefix = `adset.${idx}`;

    if (isMissing(a.name)) warnings.push(warn(`${prefix}.name`, node, "Recomendado: dar um nome ao conjunto."));
    if (isMissing(a.location)) blockers.push(blocker(`${prefix}.location`, node, "Defina a região/país do conjunto."));
    if (isMissing(a.age_range)) blockers.push(blocker(`${prefix}.age_range`, node, "Defina a faixa etária do conjunto."));
    if (isMissing(a.gender)) blockers.push(blocker(`${prefix}.gender`, node, "Defina o gênero do conjunto."));
    if (isMissing(a.placements)) blockers.push(blocker(`${prefix}.placements`, node, "Defina os posicionamentos do conjunto (use Automático/Advantage+ se não souber)."));
    if (isMissing(a.optimization_goal)) blockers.push(blocker(`${prefix}.optimization_goal`, node, "Defina a meta de otimização do conjunto."));
    if (needsUserInput(a.conversion_event)) {
      blockers.push(blocker(`${prefix}.conversion_event`, node, "Confirme o evento de conversão (Pixel) antes de aprovar.", "requires_user_input"));
    } else if (isMissing(a.conversion_event)) {
      blockers.push(blocker(`${prefix}.conversion_event`, node, "Defina o evento de conversão (ex.: Compra, Adicionar ao carrinho)."));
    }
    if (isMissing(a.targeting_summary) && a.inclusions.length === 0) {
      warnings.push(warn(`${prefix}.targeting_summary`, node, "Recomendado: descrever o público do conjunto."));
    }
    if (isMissing(a.daily_budget_cents) && isMissing(c.daily_budget_cents)) {
      warnings.push(warn(`${prefix}.daily_budget_cents`, node, "Recomendado: definir orçamento por conjunto se a campanha não tiver orçamento central."));
    }
  });

  // -------- Anúncios --------
  if (structure.ads.length === 0) {
    blockers.push(blocker("ads", "Anúncios", "A proposta não tem nenhum anúncio."));
  }
  structure.ads.forEach((ad, idx) => {
    const node = ad.name || `Anúncio ${idx + 1}`;
    const prefix = `ad.${idx}`;

    if (isMissing(ad.headline)) blockers.push(blocker(`${prefix}.headline`, node, "Defina o título do anúncio."));
    if (isMissing(ad.primary_text)) blockers.push(blocker(`${prefix}.primary_text`, node, "Defina o texto principal do anúncio."));
    if (isMissing(ad.cta)) blockers.push(blocker(`${prefix}.cta`, node, "Defina o botão de ação (ex.: Comprar agora, Saiba mais)."));
    if (isMissing(ad.destination_url)) blockers.push(blocker(`${prefix}.destination_url`, node, "Defina a URL de destino do anúncio."));
    if (isMissing(ad.creative_format)) warnings.push(warn(`${prefix}.creative_format`, node, "Recomendado: definir o formato do criativo (imagem, vídeo, carrossel)."));
  });

  const passed = blockers.length === 0;
  const summary = passed
    ? null
    : blockers.length === 1
      ? `Falta 1 campo obrigatório: ${blockers[0].message}`
      : `Faltam ${blockers.length} campos obrigatórios para liberar a aprovação.`;

  return { passed, blockers, warnings, summary };
}
