// =============================================================================
// Structure Completeness Gate (Gestor de Tráfego IA) — v2 com ownership
//
// Cada blocker/warning agora carrega `node_type` correto:
//   - CTA/Link/Copy/headline ausentes → creative
//   - Evento/otimização/posicionamentos/região/idade/gênero → ad_set
//   - Modo de compra/tipo de orçamento/objetivo/nome → campaign
//
// Continua puro, sem IA, sem rede.
// =============================================================================

import type { CampaignStructure } from "../normalizeCampaignStructure";
import { EMPTY_GATE, type GateIssue, type GateNodeType, type GateResult } from "./types";

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

export function runStructureCompletenessGate(structure: CampaignStructure): GateResult {
  if (!structure?.is_structured_campaign) return EMPTY_GATE;

  const blockers: GateIssue[] = [];
  const warnings: GateIssue[] = [];

  // -------- Campanha --------
  const c = structure.campaign;
  if (isMissing(c.name)) blockers.push(make("campaign", "campaign", "Campanha", "campaign.name", "blocker", "A campanha precisa de um nome."));
  if (isMissing(c.objective)) blockers.push(make("campaign", "campaign", "Campanha", "campaign.objective", "blocker", "Defina o objetivo da campanha."));
  if (isMissing(c.buying_type)) warnings.push(make("campaign", "campaign", "Campanha", "campaign.buying_type", "warning", "Modo de compra não definido — será usado Leilão por padrão."));
  if (isMissing(c.budget_type)) warnings.push(make("campaign", "campaign", "Campanha", "campaign.budget_type", "warning", "Tipo de orçamento não definido — será usado Diário por padrão."));
  if (isMissing(c.daily_budget_cents)) blockers.push(make("campaign", "campaign", "Campanha", "campaign.daily_budget_cents", "blocker", "Informe o orçamento da campanha."));
  if (isMissing(c.planned_status)) warnings.push(make("campaign", "campaign", "Campanha", "campaign.planned_status", "warning", "Status inicial não definido — será criada como PAUSADA por padrão."));

  // -------- Conjuntos de anúncios --------
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
    if (needsUserInput(a.conversion_event)) {
      blockers.push(make("ad_set", nodeId, node, `${prefix}.conversion_event`, "blocker", "Confirme o evento de conversão (Pixel) antes de aprovar.", { kind: "requires_user_input" }));
    } else if (isMissing(a.conversion_event)) {
      blockers.push(make("ad_set", nodeId, node, `${prefix}.conversion_event`, "blocker", "Defina o evento de conversão (ex.: Compra, Adicionar ao carrinho)."));
    }
    if (isMissing(a.targeting_summary) && a.inclusions.length === 0) {
      warnings.push(make("ad_set", nodeId, node, `${prefix}.targeting_summary`, "warning", "Recomendado: descrever o público do conjunto."));
    }
    if (isMissing(a.daily_budget_cents) && isMissing(c.daily_budget_cents)) {
      warnings.push(make("ad_set", nodeId, node, `${prefix}.daily_budget_cents`, "warning", "Recomendado: definir orçamento por conjunto se a campanha não tiver orçamento central."));
    }
  });

  // -------- Anúncios / Criativos --------
  if (structure.ads.length === 0) {
    blockers.push(make("ad", null, "Anúncios", "ads", "blocker", "A proposta não tem nenhum anúncio."));
  }
  structure.ads.forEach((ad, idx) => {
    const nodeId = String(idx);
    const node = ad.name || `Anúncio ${idx + 1}`;
    const prefix = `ad.${idx}`;

    // Copy / headline / CTA / link / formato pertencem ao CRIATIVO
    if (isMissing(ad.headline)) blockers.push(make("creative", nodeId, node, `${prefix}.headline`, "blocker", "Defina o título do anúncio."));
    if (isMissing(ad.primary_text)) blockers.push(make("creative", nodeId, node, `${prefix}.primary_text`, "blocker", "Defina o texto principal do anúncio."));
    if (isMissing(ad.cta)) blockers.push(make("creative", nodeId, node, `${prefix}.cta`, "blocker", "Defina o botão de ação (ex.: Comprar agora, Saiba mais)."));
    if (isMissing(ad.destination_url)) blockers.push(make("creative", nodeId, node, `${prefix}.destination_url`, "blocker", "Defina a URL de destino do anúncio."));
    if (isMissing(ad.creative_format)) warnings.push(make("creative", nodeId, node, `${prefix}.creative_format`, "warning", "Recomendado: definir o formato do criativo (imagem, vídeo, carrossel)."));
  });

  const passed = blockers.length === 0;
  const summary = passed
    ? null
    : blockers.length === 1
      ? `Falta 1 campo obrigatório: ${blockers[0].message}`
      : `Faltam ${blockers.length} campos obrigatórios para liberar a aprovação.`;

  return { passed, blockers, warnings, summary };
}
