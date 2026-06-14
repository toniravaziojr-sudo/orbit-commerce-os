// =============================================================================
// Onda H.2.1 — Contrato de campos por objetivo Meta
//
// Mapa determinístico (sem IA, sem rede) que descreve, para cada objetivo Meta,
// quais campos a proposta de campanha DEVE conter para refletir o passo a passo
// real do Gerenciador de Anúncios. A função pure `computePendingFields` lê o
// snapshot já construído (campaign + adsets + planned_creatives + identity) e
// devolve a lista de pendências em PT-BR para exibir na UI.
//
// Não é gate: a proposta continua sendo gerada mesmo com pendências; a UI
// destaca o que falta para o usuário aprovar/ajustar.
// =============================================================================

export type CanonicalObjective =
  | "sales"
  | "leads"
  | "traffic"
  | "awareness"
  | "engagement"
  | "messages"
  | "app_promotion";

export interface ObjectiveContract {
  /** Rótulo PT-BR do objetivo. */
  label_pt: string;
  /** Campos obrigatórios no nível CAMPANHA. */
  campaign_required: string[];
  /** Campos obrigatórios no nível CONJUNTO. */
  adset_required: string[];
  /** Campos obrigatórios no nível ANÚNCIO/CRIATIVO. */
  ad_required: string[];
  /** Identidade necessária para publicar (página, IG, pixel etc.). */
  identity_required: string[];
}

const BASE_CAMPAIGN = ["name", "objective", "buying_type", "budget_type", "daily_budget_cents", "planned_status"];
const BASE_ADSET = ["name", "audience", "placements", "daily_budget_cents", "schedule"];
const BASE_AD = ["primary_text", "headline", "cta", "destination_url", "creative_format"];

export const OBJECTIVE_CONTRACTS: Record<CanonicalObjective, ObjectiveContract> = {
  sales: {
    label_pt: "Vendas",
    campaign_required: [...BASE_CAMPAIGN, "attribution_window"],
    adset_required: [...BASE_ADSET, "optimization_goal", "conversion_event", "audience_exclusions.customers"],
    ad_required: [...BASE_AD],
    identity_required: ["facebook_page_id", "pixel_id", "conversion_event_default"],
  },
  leads: {
    label_pt: "Geração de leads",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, "optimization_goal", "conversion_event", "lead_destination"],
    ad_required: [...BASE_AD, "lead_form_id_or_destination"],
    identity_required: ["facebook_page_id", "pixel_id"],
  },
  traffic: {
    label_pt: "Tráfego",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, "optimization_goal", "destination_type"],
    ad_required: [...BASE_AD],
    identity_required: ["facebook_page_id"],
  },
  awareness: {
    label_pt: "Reconhecimento de marca",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, "optimization_goal"],
    ad_required: [...BASE_AD],
    identity_required: ["facebook_page_id"],
  },
  engagement: {
    label_pt: "Engajamento",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, "optimization_goal", "engagement_type"],
    ad_required: [...BASE_AD],
    identity_required: ["facebook_page_id"],
  },
  messages: {
    label_pt: "Mensagens",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, "messaging_destination"],
    ad_required: [...BASE_AD],
    identity_required: ["facebook_page_id"],
  },
  app_promotion: {
    label_pt: "Promoção de aplicativo",
    campaign_required: [...BASE_CAMPAIGN, "app_id"],
    adset_required: [...BASE_ADSET, "optimization_goal", "app_install_destination"],
    ad_required: [...BASE_AD, "app_deep_link"],
    identity_required: ["facebook_page_id"],
  },
};

const ALIASES: Record<string, CanonicalObjective> = {
  sales: "sales", outcome_sales: "sales", conversions: "sales", purchase: "sales", vendas: "sales",
  leads: "leads", outcome_leads: "leads", lead_generation: "leads",
  traffic: "traffic", outcome_traffic: "traffic", tráfego: "traffic", trafego: "traffic",
  awareness: "awareness", outcome_awareness: "awareness", brand_awareness: "awareness", reach: "awareness",
  engagement: "engagement", outcome_engagement: "engagement", engajamento: "engagement",
  messages: "messages", outcome_messages: "messages", mensagens: "messages",
  app_promotion: "app_promotion", outcome_app_promotion: "app_promotion", app: "app_promotion",
};

export function inferCanonicalObjective(raw: unknown): CanonicalObjective | null {
  if (typeof raw !== "string") return null;
  return ALIASES[raw.trim().toLowerCase()] ?? null;
}

// ----- PT-BR labels por campo (para mensagens de pendência amigáveis) --------

const FIELD_LABELS_PT: Record<string, string> = {
  name: "Nome",
  objective: "Objetivo",
  buying_type: "Modo de compra",
  budget_type: "Tipo de orçamento",
  daily_budget_cents: "Orçamento diário",
  planned_status: "Status inicial",
  attribution_window: "Janela de atribuição",
  audience: "Público",
  placements: "Posicionamentos",
  schedule: "Período de veiculação",
  optimization_goal: "Meta de otimização",
  conversion_event: "Evento de conversão",
  "audience_exclusions.customers": "Exclusão de clientes existentes",
  lead_destination: "Destino do lead (formulário ou site)",
  destination_type: "Destino do tráfego",
  engagement_type: "Tipo de engajamento",
  messaging_destination: "Canal de mensagem (WhatsApp/Messenger/Instagram)",
  app_id: "Aplicativo",
  app_install_destination: "Loja de aplicativos",
  app_deep_link: "Deep link do app",
  lead_form_id_or_destination: "Formulário de lead",
  primary_text: "Texto principal",
  headline: "Título",
  cta: "Botão de ação",
  destination_url: "Link de destino",
  creative_format: "Formato do criativo",
  facebook_page_id: "Página do Facebook",
  pixel_id: "Pixel",
  conversion_event_default: "Evento de conversão padrão",
  instagram_actor_id: "Conta do Instagram",
};

function pretty(field: string): string {
  return FIELD_LABELS_PT[field] || field;
}

// ----- Avaliação de pendências ----------------------------------------------

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true; // booleanos contam como preenchidos (true ou false)
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function readPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

export interface PendingField {
  level: "identity" | "campaign" | "adset" | "ad";
  index?: number; // só para adset/ad
  field: string;
  label_pt: string;
}

export interface PendingFieldsReport {
  objective: CanonicalObjective | null;
  contract_label_pt: string | null;
  pending: PendingField[];
  total: number;
  /** Passo-a-passo Meta com status: identidade → campanha → conjuntos → anúncios. */
  meta_step_checklist: Array<{
    step: "identity" | "campaign" | "adset" | "ad";
    label_pt: string;
    total: number;
    filled: number;
    missing_count: number;
  }>;
}

export function computePendingFields(input: {
  campaign: Record<string, any>;
  adsets: Array<Record<string, any>>;
  planned_creatives: Array<Record<string, any>>;
  identity: Record<string, any>;
}): PendingFieldsReport {
  const objective = inferCanonicalObjective(input.campaign?.objective);
  if (!objective) {
    return {
      objective: null,
      contract_label_pt: null,
      pending: [],
      total: 0,
      meta_step_checklist: [],
    };
  }
  const contract = OBJECTIVE_CONTRACTS[objective];
  const pending: PendingField[] = [];

  const stepIdentity = { step: "identity" as const, label_pt: "Identidade da conta", total: contract.identity_required.length, filled: 0, missing_count: 0 };
  for (const f of contract.identity_required) {
    if (isFilled(readPath(input.identity, f))) stepIdentity.filled += 1;
    else { pending.push({ level: "identity", field: f, label_pt: pretty(f) }); stepIdentity.missing_count += 1; }
  }

  const stepCampaign = { step: "campaign" as const, label_pt: "Campanha", total: contract.campaign_required.length, filled: 0, missing_count: 0 };
  for (const f of contract.campaign_required) {
    if (isFilled(readPath(input.campaign, f))) stepCampaign.filled += 1;
    else { pending.push({ level: "campaign", field: f, label_pt: pretty(f) }); stepCampaign.missing_count += 1; }
  }

  const stepAdset = { step: "adset" as const, label_pt: `Conjuntos (${input.adsets.length})`, total: contract.adset_required.length * Math.max(1, input.adsets.length), filled: 0, missing_count: 0 };
  if (input.adsets.length === 0) {
    pending.push({ level: "adset", field: "adsets", label_pt: "Pelo menos 1 conjunto de anúncios" });
    stepAdset.missing_count += 1;
  } else {
    input.adsets.forEach((adset, i) => {
      for (const f of contract.adset_required) {
        if (isFilled(readPath(adset, f))) stepAdset.filled += 1;
        else { pending.push({ level: "adset", index: i, field: f, label_pt: pretty(f) }); stepAdset.missing_count += 1; }
      }
    });
  }

  const stepAd = { step: "ad" as const, label_pt: `Anúncios planejados (${input.planned_creatives.length})`, total: contract.ad_required.length * Math.max(1, input.planned_creatives.length), filled: 0, missing_count: 0 };
  if (input.planned_creatives.length === 0) {
    pending.push({ level: "ad", field: "planned_creatives", label_pt: "Pelo menos 1 anúncio planejado por conjunto" });
    stepAd.missing_count += 1;
  } else {
    input.planned_creatives.forEach((ad, i) => {
      for (const f of contract.ad_required) {
        if (isFilled(readPath(ad, f))) stepAd.filled += 1;
        else { pending.push({ level: "ad", index: i, field: f, label_pt: pretty(f) }); stepAd.missing_count += 1; }
      }
    });
  }

  return {
    objective,
    contract_label_pt: contract.label_pt,
    pending,
    total: pending.length,
    meta_step_checklist: [stepIdentity, stepCampaign, stepAdset, stepAd],
  };
}
