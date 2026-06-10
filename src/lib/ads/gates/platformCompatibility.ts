// =============================================================================
// Platform Compatibility Gate inicial (Gestor de Tráfego IA)
//
// Valida se a proposta é compatível com a capacidade registrada da plataforma.
// Pura. Recebe o snapshot do registro de capacidades como entrada.
//
// Regras nesta entrega (Onda B mínima):
//  - status "nao_verificado" → blocker: não permite aprovar nem gerar criativo.
//  - status "verificacao_falhou" / "revisao_necessaria" → blocker.
//  - status "vencido" OU last_verified_at > 60 dias → blocker.
//  - objetivo, evento de conversão e formato fora dos suportados → blocker.
//  - posicionamento / CTA fora dos suportados → warning.
// =============================================================================

import type { CampaignStructure } from "../normalizeCampaignStructure";
import { EMPTY_GATE, type GateIssue, type GateResult } from "./types";

export interface PlatformCapabilitiesRow {
  platform: string;
  status: string; // verificado | nao_verificado | revisao_necessaria | vencido | verificacao_falhou
  capabilities_version: string;
  adapter_version: string;
  last_verified_at: string | null;
  capabilities_json: Record<string, any> | null;
}

const MAX_DAYS_SINCE_VERIFICATION = 60;

function blocker(field: string, node: string, message: string): GateIssue {
  return { field, node, severity: "blocker", message, kind: "required" };
}
function warn(field: string, node: string, message: string): GateIssue {
  return { field, node, severity: "warning", message, kind: "recommended" };
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
    blockers.push(blocker(
      "platform.status",
      "Plataforma",
      "Capacidades da plataforma ainda não foram registradas. Aprovação bloqueada até verificação humana.",
    ));
    return { passed: false, blockers, warnings, summary: blockers[0].message };
  }

  const status = capability.status;
  if (status === "nao_verificado") {
    blockers.push(blocker(
      "platform.status",
      "Plataforma",
      "Esta plataforma ainda não foi verificada pela equipe. Geração de criativos e publicação ficam bloqueadas até a verificação.",
    ));
  } else if (status === "revisao_necessaria") {
    blockers.push(blocker(
      "platform.status",
      "Plataforma",
      "A plataforma marcou revisão necessária após uma mudança detectada. Aprovação bloqueada até revisão humana.",
    ));
  } else if (status === "vencido" || status === "verificacao_falhou") {
    blockers.push(blocker(
      "platform.status",
      "Plataforma",
      "A verificação de compatibilidade falhou ou está vencida. Aprovação bloqueada até nova verificação.",
    ));
  } else {
    const age = daysSince(capability.last_verified_at);
    if (age !== null && age > MAX_DAYS_SINCE_VERIFICATION) {
      blockers.push(blocker(
        "platform.status",
        "Plataforma",
        `A última verificação da plataforma foi há ${age} dias. Acima de ${MAX_DAYS_SINCE_VERIFICATION} dias bloqueia aprovação até nova verificação.`,
      ));
    }
  }

  // ---- 2) Compatibilidade do conteúdo (se ainda vale validar) -------------
  const caps = capability.capabilities_json || {};
  const objectives: string[] = Array.isArray(caps.supported_objectives) ? caps.supported_objectives : [];
  const events: string[] = Array.isArray(caps.supported_conversion_events) ? caps.supported_conversion_events : [];
  const placements: string[] = Array.isArray(caps.supported_placements) ? caps.supported_placements : [];
  const ctas: string[] = Array.isArray(caps.supported_ctas) ? caps.supported_ctas : [];
  const formats: string[] = Array.isArray(caps.supported_creative_formats) ? caps.supported_creative_formats : [];

  const obj = (structure.campaign.objective || "").toUpperCase();
  if (objectives.length > 0 && obj && !objectives.includes(obj)) {
    blockers.push(blocker("campaign.objective", "Campanha", `O objetivo "${obj}" não está na lista suportada para esta plataforma.`));
  }

  structure.ad_sets.forEach((a, idx) => {
    const node = a.name || `Conjunto ${idx + 1}`;
    const ev = (a.conversion_event || "").toUpperCase();
    if (events.length > 0 && ev && ev !== "REQUIRES_USER_INPUT" && !events.includes(ev)) {
      blockers.push(blocker(`adset.${idx}.conversion_event`, node, `Evento "${ev}" não é suportado pela plataforma.`));
    }
    if (placements.length > 0 && a.placements && a.placements.length > 0) {
      const unsupported = a.placements.filter((p) => !placements.includes(p));
      if (unsupported.length > 0) {
        warnings.push(warn(`adset.${idx}.placements`, node, `Posicionamentos não reconhecidos: ${unsupported.join(", ")}.`));
      }
    }
  });

  structure.ads.forEach((ad, idx) => {
    const node = ad.name || `Anúncio ${idx + 1}`;
    if (ctas.length > 0 && ad.cta && !ctas.includes(ad.cta)) {
      warnings.push(warn(`ad.${idx}.cta`, node, `Botão de ação "${ad.cta}" não reconhecido pela plataforma.`));
    }
    const fmt = (ad.creative_format || "").toUpperCase();
    if (formats.length > 0 && fmt && !formats.includes(fmt)) {
      warnings.push(warn(`ad.${idx}.creative_format`, node, `Formato "${fmt}" não está entre os suportados.`));
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
