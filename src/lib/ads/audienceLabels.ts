// =====================================================================
// Frontend label normalization for Ads audience/funnel.
// (Frente 2 — Labels amigáveis)
//
// O valor técnico (cold/warm/hot/tof/mof/bof/customers/...) PERMANECE
// salvo no banco/payload. Esta camada apenas TRADUZ para exibição na UI.
//
// Use em cards, modais e listas. Não traduzir antes de persistir.
// =====================================================================

export type FunnelLabelInfo = {
  /** Human-friendly label in PT-BR */
  label: string;
  /** Tailwind classes for badge styling */
  color: string;
  /** Canonical bucket for downstream UI grouping */
  bucket: "cold" | "warm" | "hot" | "customers" | "retention" | "test" | "leads" | "unknown";
};

const FUNNEL_LABEL_MAP: Record<string, FunnelLabelInfo> = {
  // COLD / TOF / PROSPECTING
  tof: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", bucket: "cold" },
  cold: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", bucket: "cold" },
  frio: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", bucket: "cold" },
  prospecting: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", bucket: "cold" },
  prospect: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", bucket: "cold" },
  prospeccao: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20", bucket: "cold" },

  // WARM / MOF / REMARKETING
  mof: { label: "Remarketing", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", bucket: "warm" },
  warm: { label: "Remarketing", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", bucket: "warm" },
  morno: { label: "Remarketing", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20", bucket: "warm" },
  remarketing: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20", bucket: "warm" },
  retargeting: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20", bucket: "warm" },

  // HOT / BOF
  bof: { label: "Público Quente", color: "bg-red-500/10 text-red-700 border-red-500/20", bucket: "hot" },
  hot: { label: "Público Quente", color: "bg-red-500/10 text-red-700 border-red-500/20", bucket: "hot" },
  quente: { label: "Público Quente", color: "bg-red-500/10 text-red-700 border-red-500/20", bucket: "hot" },

  // CUSTOMERS
  customers: { label: "Clientes", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", bucket: "customers" },
  customer: { label: "Clientes", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", bucket: "customers" },
  clientes: { label: "Clientes", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", bucket: "customers" },
  compradores: { label: "Clientes", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", bucket: "customers" },

  // RETENTION
  retention: { label: "Retenção / Recompra", color: "bg-teal-500/10 text-teal-700 border-teal-500/20", bucket: "retention" },
  repurchase: { label: "Retenção / Recompra", color: "bg-teal-500/10 text-teal-700 border-teal-500/20", bucket: "retention" },
  recompra: { label: "Retenção / Recompra", color: "bg-teal-500/10 text-teal-700 border-teal-500/20", bucket: "retention" },

  // TEST
  test: { label: "Teste", color: "bg-purple-500/10 text-purple-700 border-purple-500/20", bucket: "test" },
  teste: { label: "Teste", color: "bg-purple-500/10 text-purple-700 border-purple-500/20", bucket: "test" },

  // LEADS
  leads: { label: "Captação de Leads", color: "bg-green-500/10 text-green-700 border-green-500/20", bucket: "leads" },
  lead: { label: "Captação de Leads", color: "bg-green-500/10 text-green-700 border-green-500/20", bucket: "leads" },
};

const UNKNOWN: FunnelLabelInfo = {
  label: "Público não classificado",
  color: "bg-muted text-muted-foreground",
  bucket: "unknown",
};

/** Normalize any funnel/audience stage string into a friendly label. */
export function getFunnelLabel(raw: unknown): FunnelLabelInfo {
  const key = String(raw ?? "").toLowerCase().trim();
  if (!key) return UNKNOWN;
  return FUNNEL_LABEL_MAP[key] || UNKNOWN;
}

/** Best-effort describe an excluded-audience entry as "Clientes" if it matches. */
export function describeExclusion(entry: any): string | null {
  if (!entry) return null;
  const name = String(entry?.name || entry?.audience_name || "").trim();
  if (!name) return entry?.id ? `Público #${entry.id}` : null;
  // Map common system names to a friendlier label
  if (/clientes?/i.test(name)) return "Clientes";
  if (/compradores?/i.test(name)) return "Compradores";
  if (/customers?/i.test(name)) return "Clientes";
  return name;
}

/**
 * Extract the customer-exclusion summary line from an action payload.
 * Returns null when no exclusion was applied (or no metadata present).
 */
export function getCustomerExclusionLine(
  data: any,
  preview: any,
): { applied: boolean; label: string; missing?: boolean; hint?: string } | null {
  const strategicActions = [
    ...(Array.isArray(data?.planned_actions) ? data.planned_actions : []),
    ...(Array.isArray(preview?.planned_actions) ? preview.planned_actions : []),
  ];
  for (const action of strategicActions) {
    const adsets = Array.isArray(action?.adsets) ? action.adsets : [];
    for (const adset of adsets) {
      if (adset?.audience_exclusions?.customers) {
        return { applied: true, label: "Exclui clientes/compradores" };
      }
      if (adset?.audience_exclusions?.pending_dependency === "customer_audience_not_detected" || adset?.audience_exclusions?.pending_dependency === "customer_audience_missing") {
        return {
          applied: false,
          missing: true,
          label: "Pendência: público de clientes não detectado",
          hint: "Conjunto de público frio/prospecção precisa desse público antes da aprovação.",
        };
      }
    }
  }

  const strategicActions = [
    ...(Array.isArray(data?.planned_actions) ? data.planned_actions : []),
    ...(Array.isArray(preview?.planned_actions) ? preview.planned_actions : []),
  ];
  const coldAction = strategicActions.find((action: any) => {
    const campaignType = String(action?.campaign_type || "").toLowerCase();
    const stage = String(action?.funnel_stage || "").toLowerCase();
    return ["prospecting", "catalog_prospecting", "tof", "cold"].includes(campaignType) || ["tof", "cold"].includes(stage);
  });
  const coldExclusion = coldAction?.audience_exclusions;
  if (coldExclusion?.customers) {
    return { applied: true, label: "Exclui clientes/compradores" };
  }
  if (coldExclusion?.pending_dependency === "customer_audience_not_detected" || coldExclusion?.pending_dependency === "customer_audience_missing") {
    return {
      applied: false,
      missing: true,
      label: "Pendência: público de clientes não detectado",
      hint: "Campanha de público frio/prospecção precisa desse público antes da aprovação.",
    };
  }

  const meta =
    (data && (data as any).customer_audience_exclusion) ||
    (preview && (preview as any).customer_audience_exclusion) ||
    null;
  if (meta) {
    if (meta.customer_audience_exclusion_enabled) {
      const name = meta.customer_audience_name || "Clientes";
      return { applied: true, label: `Excluindo: ${describeExclusion({ name }) || name}` };
    }
    if (meta.customer_audience_missing) {
      return {
        applied: false,
        missing: true,
        label: "Sem público de Clientes nesta conta",
        hint: "Crie ou sincronize o público de Clientes antes de propor campanhas frias.",
      };
    }
  }
  // Fallback: any excluded_audience_ids entry matching a customer-ish name?
  const excluded = (preview?.excluded_audience_ids || data?.excluded_audience_ids || []) as any[];
  if (Array.isArray(excluded) && excluded.length > 0) {
    const customerLike = excluded.find((e) => {
      const n = String(e?.name || "").toLowerCase();
      return /clientes?|compradores?|customers?/.test(n);
    });
    if (customerLike) {
      return { applied: true, label: `Excluindo: ${describeExclusion(customerLike) || "Clientes"}` };
    }
  }
  return null;
}
