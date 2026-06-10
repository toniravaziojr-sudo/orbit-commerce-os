// =============================================================================
// Platform Compatibility Gate (Gestor de Tráfego IA) — v2 com adapter Meta
//
// Mudanças principais (Onda C.1):
//  - Compara enums DEPOIS de traduzir o canônico interno via metaAdapter.
//  - Nunca exibe "SALES não suportado" como erro técnico: se o objetivo não
//    estiver mapeado, devolve uma mensagem amigável em PT-BR.
//  - Todo blocker/warning carrega node_type/node_id corretos para alimentar o
//    "Ajustar proposta" no editor.
// =============================================================================

import type { CampaignStructure } from "../normalizeCampaignStructure";
import {
  inferCanonicalObjective,
  objectiveLabelPtBr,
  translateConversionEventToMeta,
  translateCreativeFormatToMeta,
  translateCtaToMeta,
  translateObjectiveToMeta,
  translatePlacementToMeta,
} from "../platform/metaAdapter";
import { EMPTY_GATE, type GateIssue, type GateNodeType, type GateResult } from "./types";

export interface PlatformCapabilitiesRow {
  platform: string;
  status: string; // verificado | nao_verificado | revisao_necessaria | vencido | verificacao_falhou
  capabilities_version: string;
  adapter_version: string;
  last_verified_at: string | null;
  capabilities_json: Record<string, any> | null;
}

const MAX_DAYS_SINCE_VERIFICATION = 60;

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
    node_type, node_id, node, field, severity, message,
    technical_reason: opts.technical_reason ?? null,
    suggested_action: opts.suggested_action ?? null,
    kind: opts.kind ?? (severity === "blocker" ? "required" : "recommended"),
  };
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

export function runPlatformCompatibilityGate(
  structure: CampaignStructure,
  capability: PlatformCapabilitiesRow | null | undefined,
): GateResult {
  if (!structure?.is_structured_campaign) return EMPTY_GATE;

  const blockers: GateIssue[] = [];
  const warnings: GateIssue[] = [];

  // ---- 1) Estado da plataforma --------------------------------------------
  if (!capability) {
    blockers.push(make(
      "platform", "platform", "Plataforma", "platform.status", "blocker",
      "As regras da plataforma de anúncios ainda não foram registradas. A aprovação fica bloqueada até a verificação humana.",
      { technical_reason: "platform_capabilities not seeded" },
    ));
    return { passed: false, blockers, warnings, summary: blockers[0].message };
  }

  const status = capability.status;
  if (status === "nao_verificado") {
    blockers.push(make("platform", "platform", "Plataforma", "platform.status", "blocker",
      "Esta plataforma ainda não foi verificada pela equipe. Geração de criativos e publicação ficam bloqueadas até a verificação.",
      { technical_reason: `capabilities status=${status}` }));
  } else if (status === "revisao_necessaria") {
    blockers.push(make("platform", "platform", "Plataforma", "platform.status", "blocker",
      "A plataforma marcou revisão necessária após uma mudança detectada. Aprovação bloqueada até revisão humana.",
      { technical_reason: `capabilities status=${status}` }));
  } else if (status === "vencido" || status === "verificacao_falhou") {
    blockers.push(make("platform", "platform", "Plataforma", "platform.status", "blocker",
      "A verificação de compatibilidade falhou ou está vencida. Aprovação bloqueada até nova verificação.",
      { technical_reason: `capabilities status=${status}` }));
  } else {
    const age = daysSince(capability.last_verified_at);
    if (age !== null && age > MAX_DAYS_SINCE_VERIFICATION) {
      blockers.push(make("platform", "platform", "Plataforma", "platform.status", "blocker",
        `A última verificação da plataforma foi há ${age} dias. Acima de ${MAX_DAYS_SINCE_VERIFICATION} dias bloqueia aprovação até nova verificação.`,
        { technical_reason: `last_verified_at age=${age}d` }));
    }
  }

  // ---- 2) Compatibilidade do conteúdo via ADAPTER -------------------------
  const caps = capability.capabilities_json || {};
  const supportedObjectives: string[] = Array.isArray(caps.supported_objectives) ? caps.supported_objectives : [];
  const supportedEvents: string[] = Array.isArray(caps.supported_conversion_events) ? caps.supported_conversion_events : [];
  const supportedPlacements: string[] = Array.isArray(caps.supported_placements) ? caps.supported_placements : [];
  const supportedCtas: string[] = Array.isArray(caps.supported_ctas) ? caps.supported_ctas : [];
  const supportedFormats: string[] = Array.isArray(caps.supported_creative_formats) ? caps.supported_creative_formats : [];

  // Objetivo: passa pelo adapter ANTES de comparar
  const rawObjective = structure.campaign.objective;
  const canonical = inferCanonicalObjective(rawObjective);
  if (rawObjective && !canonical) {
    blockers.push(make("campaign", "campaign", "Campanha", "campaign.objective", "blocker",
      "Não conseguimos identificar o objetivo da campanha. Selecione um objetivo conhecido (Vendas, Leads, Tráfego…) antes de aprovar.",
      { technical_reason: `inferCanonicalObjective(${rawObjective})=null` }));
  } else if (canonical) {
    const metaEnum = translateObjectiveToMeta(canonical);
    if (!metaEnum) {
      blockers.push(make("platform", "platform", "Plataforma", "campaign.objective", "blocker",
        `Objetivo de ${objectiveLabelPtBr(canonical)} ainda não está mapeado para esta plataforma. Revise a configuração da plataforma antes de aprovar.`,
        { technical_reason: `translateObjectiveToMeta(${canonical})=null` }));
    } else if (supportedObjectives.length > 0 && !supportedObjectives.includes(metaEnum)) {
      blockers.push(make("platform", "platform", "Plataforma", "campaign.objective", "blocker",
        `Objetivo de ${objectiveLabelPtBr(canonical)} não está liberado nesta plataforma no momento. Verifique a configuração antes de aprovar.`,
        { technical_reason: `meta=${metaEnum} not in ${supportedObjectives.join(",")}` }));
    }
  }

  // Conjunto: evento e posicionamentos via adapter
  structure.ad_sets.forEach((a, idx) => {
    const nodeId = String(idx);
    const node = a.name || `Conjunto ${idx + 1}`;
    if (a.conversion_event && a.conversion_event.toLowerCase() !== "requires_user_input") {
      const metaEvent = translateConversionEventToMeta(a.conversion_event);
      if (supportedEvents.length > 0 && metaEvent && !supportedEvents.includes(metaEvent)) {
        blockers.push(make("ad_set", nodeId, node, `adset.${idx}.conversion_event`, "blocker",
          "O evento de conversão escolhido não é suportado pela plataforma. Selecione outro evento antes de aprovar.",
          { technical_reason: `meta=${metaEvent} not in ${supportedEvents.join(",")}` }));
      }
    }
    if (a.placements && a.placements.length > 0 && supportedPlacements.length > 0) {
      const unsupported = a.placements
        .map((p) => ({ raw: p, meta: translatePlacementToMeta(p) }))
        .filter((p) => p.meta && !supportedPlacements.includes(p.meta));
      if (unsupported.length > 0) {
        warnings.push(make("ad_set", nodeId, node, `adset.${idx}.placements`, "warning",
          `Posicionamentos não reconhecidos pela plataforma: ${unsupported.map((u) => u.raw).join(", ")}.`));
      }
    }
  });

  // Anúncio/Criativo: CTA e formato via adapter
  structure.ads.forEach((ad, idx) => {
    const nodeId = String(idx);
    const node = ad.name || `Anúncio ${idx + 1}`;
    if (ad.cta && supportedCtas.length > 0) {
      const metaCta = translateCtaToMeta(ad.cta);
      if (metaCta && !supportedCtas.includes(metaCta)) {
        warnings.push(make("creative", nodeId, node, `ad.${idx}.cta`, "warning",
          "O botão de ação escolhido não é reconhecido pela plataforma. Escolha outro botão antes de publicar."));
      }
    }
    if (ad.creative_format && supportedFormats.length > 0) {
      const metaFmt = translateCreativeFormatToMeta(ad.creative_format);
      if (metaFmt && !supportedFormats.includes(metaFmt)) {
        warnings.push(make("creative", nodeId, node, `ad.${idx}.creative_format`, "warning",
          "O formato do criativo não está entre os suportados pela plataforma."));
      }
    }
  });

  const passed = blockers.length === 0;
  const summary = passed
    ? null
    : blockers.length === 1
      ? blockers[0].message
      : `${blockers.length} bloqueios de compatibilidade com a plataforma.`;
  return { passed, blockers, warnings, summary };
}
