// =============================================================================
// UTM Gate — Onda F
// Bloqueia aprovação de proposta detalhada de Anúncio sem UTM no link final.
// Aponta para o nó `creative`/`ad` (UTM pertence ao Anúncio, não à Campanha).
// =============================================================================

import type { CampaignStructure } from "../normalizeCampaignStructure";
import { EMPTY_GATE, type GateIssue, type GateResult } from "./types";
import { hasRequiredUtm, REQUIRED_UTM_KEYS } from "../utm";

function summarize(blockers: GateIssue[], warnings: GateIssue[]): GateResult {
  const passed = blockers.length === 0;
  const summary = passed
    ? null
    : blockers.length === 1
      ? "Este anúncio precisa de UTM no link final antes de ser aprovado."
      : `Faltam UTMs em ${blockers.length} anúncios.`;
  return { passed, blockers, warnings, summary };
}

export function runUtmGate(structure: CampaignStructure): GateResult {
  if (!structure?.is_structured_campaign) return EMPTY_GATE;
  const blockers: GateIssue[] = [];
  const warnings: GateIssue[] = [];

  structure.ads.forEach((ad, idx) => {
    const nodeId = String(idx);
    const node = ad.name || `Anúncio ${idx + 1}`;
    const prefix = `ad.${idx}`;
    const url = (ad.destination_url || "").trim();
    if (!url) return; // structureCompleteness já bloqueia a ausência do link

    if (!hasRequiredUtm(url)) {
      blockers.push({
        node_type: "creative",
        node_id: nodeId,
        node,
        field: `${prefix}.destination_url`,
        severity: "blocker",
        message: "Este anúncio precisa de UTM no link final antes de ser aprovado.",
        technical_reason: `Required UTM keys missing: ${REQUIRED_UTM_KEYS.join(", ")}`,
        suggested_action: "Aplique o modelo padrão de UTM no link do anúncio.",
        kind: "required",
      });
    }
  });

  return summarize(blockers, warnings);
}
