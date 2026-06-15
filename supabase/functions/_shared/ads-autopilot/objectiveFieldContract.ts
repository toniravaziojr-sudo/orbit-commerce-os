// =============================================================================
// Onda H.2.1 + H.2.2 — Contrato de campos por objetivo Meta com FASE.
//
// Mapa determinístico (sem IA, sem rede). Para cada objetivo Meta, descreve
// quais campos a proposta DEVE conter e a FASE a que cada campo pertence:
//   - h2_structural   → bloqueia a revisão H.2 (estrutura/segmentação/regra)
//   - h4_future       → é gerado na fase de Criativos (não bloqueia H.2)
//   - account_config  → vem da configuração padrão da conta Meta
//   - publication_final → é resolvido só na publicação (IDs Meta etc.)
//
// `computePendingFields` aceita budget_mode (CBO/ABO) para não exigir
// `campaign.daily_budget_cents` quando o orçamento mora nos conjuntos.
// =============================================================================

export type CanonicalObjective =
  | "sales"
  | "leads"
  | "traffic"
  | "awareness"
  | "engagement"
  | "messages"
  | "app_promotion";

export type FieldPhase =
  | "h2_structural"
  | "h4_future"
  | "account_config"
  | "publication_final";

export interface FieldSpec {
  field: string;
  phase: FieldPhase;
}

export interface ObjectiveContract {
  label_pt: string;
  campaign_required: FieldSpec[];
  adset_required: FieldSpec[];
  ad_required: FieldSpec[];
  identity_required: FieldSpec[];
}

const f = (field: string, phase: FieldPhase): FieldSpec => ({ field, phase });

// Bases reaproveitadas
const BASE_CAMPAIGN: FieldSpec[] = [
  f("name", "h2_structural"),
  f("objective", "h2_structural"),
  f("buying_type", "h2_structural"),
  f("budget_type", "h2_structural"),
  f("daily_budget_cents", "h2_structural"),
  f("planned_status", "h2_structural"),
];
const BASE_ADSET: FieldSpec[] = [
  f("name", "h2_structural"),
  f("audience", "h2_structural"),
  f("placements", "h2_structural"),
  f("daily_budget_cents", "h2_structural"),
  f("schedule", "h2_structural"),
];
const BASE_AD: FieldSpec[] = [
  // estrutura H.2
  f("creative_format", "h2_structural"),
  f("cta", "h2_structural"),
  f("destination_url", "h2_structural"),
  // conteúdo final (H.4)
  f("primary_text", "h4_future"),
  f("headline", "h4_future"),
];

export const OBJECTIVE_CONTRACTS: Record<CanonicalObjective, ObjectiveContract> = {
  sales: {
    label_pt: "Vendas",
    campaign_required: [...BASE_CAMPAIGN, f("attribution_window", "account_config")],
    adset_required: [
      ...BASE_ADSET,
      f("optimization_goal", "h2_structural"),
      f("conversion_event", "h2_structural"),
      f("audience_exclusions.customers", "h2_structural"),
    ],
    ad_required: [...BASE_AD],
    identity_required: [
      f("facebook_page_id", "account_config"),
      f("pixel_id", "account_config"),
      f("conversion_event_default", "account_config"),
    ],
  },
  leads: {
    label_pt: "Geração de leads",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, f("optimization_goal", "h2_structural"), f("conversion_event", "h2_structural"), f("lead_destination", "h2_structural")],
    ad_required: [...BASE_AD, f("lead_form_id_or_destination", "h2_structural")],
    identity_required: [f("facebook_page_id", "account_config"), f("pixel_id", "account_config")],
  },
  traffic: {
    label_pt: "Tráfego",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, f("optimization_goal", "h2_structural"), f("destination_type", "h2_structural")],
    ad_required: [...BASE_AD],
    identity_required: [f("facebook_page_id", "account_config")],
  },
  awareness: {
    label_pt: "Reconhecimento de marca",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, f("optimization_goal", "h2_structural")],
    ad_required: [...BASE_AD],
    identity_required: [f("facebook_page_id", "account_config")],
  },
  engagement: {
    label_pt: "Engajamento",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, f("optimization_goal", "h2_structural"), f("engagement_type", "h2_structural")],
    ad_required: [...BASE_AD],
    identity_required: [f("facebook_page_id", "account_config")],
  },
  messages: {
    label_pt: "Mensagens",
    campaign_required: [...BASE_CAMPAIGN],
    adset_required: [...BASE_ADSET, f("messaging_destination", "h2_structural")],
    ad_required: [...BASE_AD],
    identity_required: [f("facebook_page_id", "account_config")],
  },
  app_promotion: {
    label_pt: "Promoção de aplicativo",
    campaign_required: [...BASE_CAMPAIGN, f("app_id", "h2_structural")],
    adset_required: [...BASE_ADSET, f("optimization_goal", "h2_structural"), f("app_install_destination", "h2_structural")],
    ad_required: [...BASE_AD, f("app_deep_link", "h2_structural")],
    identity_required: [f("facebook_page_id", "account_config")],
  },
};

const ALIASES: Record<string, CanonicalObjective> = {
  sales: "sales", outcome_sales: "sales", conversions: "sales", purchase: "sales", purchases: "sales", vendas: "sales",
  leads: "leads", outcome_leads: "leads", lead_generation: "leads",
  traffic: "traffic", outcome_traffic: "traffic", "tráfego": "traffic", trafego: "traffic",
  awareness: "awareness", outcome_awareness: "awareness", brand_awareness: "awareness", reach: "awareness",
  engagement: "engagement", outcome_engagement: "engagement", engajamento: "engagement",
  messages: "messages", outcome_messages: "messages", mensagens: "messages",
  app_promotion: "app_promotion", outcome_app_promotion: "app_promotion", app: "app_promotion",
};

export function inferCanonicalObjective(raw: unknown): CanonicalObjective | null {
  if (typeof raw !== "string") return null;
  return ALIASES[raw.trim().toLowerCase()] ?? null;
}

// ----- PT-BR labels por campo -----------------------------------------------

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

// ----- Avaliação ------------------------------------------------------------

function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

function readPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

export interface PendingField {
  level: "identity" | "campaign" | "adset" | "ad";
  index?: number;
  field: string;
  label_pt: string;
  /** H.2.2 — fase a que o campo pertence. */
  phase: FieldPhase;
}

export interface MetaStepChecklistItemV2 {
  step: "identity" | "campaign" | "adset" | "ad";
  label_pt: string;
  total: number;
  filled: number;
  /** Quantos campos obrigatórios estão faltando NO TOTAL (todas as fases). */
  missing_count: number;
  /** H.2.2 — quantos pertencem à fase H.2 (são os que realmente bloqueiam a revisão). */
  h2_missing_count: number;
  /** H.2.2 — quantos serão resolvidos só na geração de criativos. */
  h4_missing_count: number;
  /** H.2.2 — quantos dependem da configuração da conta. */
  account_config_missing_count: number;
}

export interface PendingFieldsReport {
  objective: CanonicalObjective | null;
  contract_label_pt: string | null;
  pending: PendingField[];
  total: number;
  meta_step_checklist: MetaStepChecklistItemV2[];
  /** Versão do contrato/checklist; consumida pela UI para saber que pode confiar nos campos h2_/h4_/account_config. */
  contract_phase_version: "h22_v1";
}

export interface ComputePendingInput {
  campaign: Record<string, any>;
  adsets: Array<Record<string, any>>;
  planned_creatives: Array<Record<string, any>>;
  identity: Record<string, any>;
  /** H.2.2 — quando "ABO", suprime exigência de daily_budget_cents na campanha. */
  budget_mode?: "CBO" | "ABO" | null;
}

export function computePendingFields(input: ComputePendingInput): PendingFieldsReport {
  const objective = inferCanonicalObjective(input.campaign?.objective);
  if (!objective) {
    return {
      objective: null,
      contract_label_pt: null,
      pending: [],
      total: 0,
      meta_step_checklist: [],
      contract_phase_version: "h22_v1",
    };
  }
  const contract = OBJECTIVE_CONTRACTS[objective];
  const pending: PendingField[] = [];

  const mkStep = (
    step: "identity" | "campaign" | "adset" | "ad",
    label_pt: string,
    total: number,
  ): MetaStepChecklistItemV2 => ({
    step, label_pt, total, filled: 0,
    missing_count: 0, h2_missing_count: 0, h4_missing_count: 0, account_config_missing_count: 0,
  });

  const bump = (s: MetaStepChecklistItemV2, p: FieldPhase) => {
    s.missing_count += 1;
    if (p === "h2_structural") s.h2_missing_count += 1;
    else if (p === "h4_future") s.h4_missing_count += 1;
    else if (p === "account_config") s.account_config_missing_count += 1;
  };

  const stepIdentity = mkStep("identity", "Identidade da conta", contract.identity_required.length);
  for (const fs of contract.identity_required) {
    if (isFilled(readPath(input.identity, fs.field))) stepIdentity.filled += 1;
    else { pending.push({ level: "identity", field: fs.field, label_pt: pretty(fs.field), phase: fs.phase }); bump(stepIdentity, fs.phase); }
  }

  // H.2.2: em ABO, não exigir orçamento na campanha.
  const filteredCampaignReq = contract.campaign_required.filter((fs) => {
    if (input.budget_mode === "ABO" && fs.field === "daily_budget_cents") return false;
    return true;
  });
  const stepCampaign = mkStep("campaign", "Campanha", filteredCampaignReq.length);
  for (const fs of filteredCampaignReq) {
    if (isFilled(readPath(input.campaign, fs.field))) stepCampaign.filled += 1;
    else { pending.push({ level: "campaign", field: fs.field, label_pt: pretty(fs.field), phase: fs.phase }); bump(stepCampaign, fs.phase); }
  }

  const stepAdset = mkStep("adset", `Conjuntos (${input.adsets.length})`, contract.adset_required.length * Math.max(1, input.adsets.length));
  if (input.adsets.length === 0) {
    pending.push({ level: "adset", field: "adsets", label_pt: "Pelo menos 1 conjunto de anúncios", phase: "h2_structural" });
    bump(stepAdset, "h2_structural");
  } else {
    input.adsets.forEach((adset, i) => {
      // CBO: não exigir daily_budget_cents do conjunto.
      const fields = contract.adset_required.filter((fs) => {
        if (input.budget_mode === "CBO" && fs.field === "daily_budget_cents") return false;
        return true;
      });
      for (const fs of fields) {
        if (isFilled(readPath(adset, fs.field))) stepAdset.filled += 1;
        else { pending.push({ level: "adset", index: i, field: fs.field, label_pt: pretty(fs.field), phase: fs.phase }); bump(stepAdset, fs.phase); }
      }
    });
  }

  const stepAd = mkStep("ad", `Anúncios planejados (${input.planned_creatives.length})`, contract.ad_required.length * Math.max(1, input.planned_creatives.length));
  if (input.planned_creatives.length === 0) {
    pending.push({ level: "ad", field: "planned_creatives", label_pt: "Pelo menos 1 anúncio planejado por conjunto", phase: "h2_structural" });
    bump(stepAd, "h2_structural");
  } else {
    input.planned_creatives.forEach((ad, i) => {
      for (const fs of contract.ad_required) {
        if (isFilled(readPath(ad, fs.field))) stepAd.filled += 1;
        else { pending.push({ level: "ad", index: i, field: fs.field, label_pt: pretty(fs.field), phase: fs.phase }); bump(stepAd, fs.phase); }
      }
    });
  }

  return {
    objective,
    contract_label_pt: contract.label_pt,
    pending,
    total: pending.length,
    meta_step_checklist: [stepIdentity, stepCampaign, stepAdset, stepAd],
    contract_phase_version: "h22_v1",
  };
}
