// =============================================================================
// Onda H.2.5 — Resolver determinístico de "Formato do criativo"
//
// Cascata global (Meta Ads + Vendas manual, não-[Teste], não-catálogo):
//   1) explicit  — formato vindo da estratégia/proposta (se válido)
//   2) account   — default da conta Meta (se configurado e válido)
//   3) contract  — default contratual seguro: "Imagem única"
//
// Casos especiais:
//   - [Teste]/ABO     → formato é variável da etapa H.4, NÃO preenche aqui.
//   - Catálogo obrig. → só usa "catalog" se houver catálogo válido; senão
//                       reporta pendência de configuração (NÃO cai para single_image).
//   - Outros escopos  → ausência fica como "unsupported_format" (mantém pendência).
//
// Função PURA. Sem rede, sem banco, sem IA.
// =============================================================================

export type CreativeFormatValue =
  | "single_image"
  | "single_video"
  | "carousel"
  | "collection"
  | "catalog";

export type CreativeFormatSource =
  | "strategy_explicit_format"
  | "account_default_format"
  | "meta_sales_manual_contract_default"
  | "catalog_required"
  | "testing_h4_variable"
  | "missing_catalog_config"
  | "unsupported_format";

export type CreativeFormatPhase = "h2_structural" | "h4_future" | "account_config";

export interface ResolvedCreativeFormat {
  value: CreativeFormatValue | null;
  label: string | null;
  source: CreativeFormatSource;
  resolution_phase: CreativeFormatPhase;
  missing_reason: string | null;
  source_label_pt: string | null;
}

const LABEL: Record<CreativeFormatValue, string> = {
  single_image: "Imagem única",
  single_video: "Vídeo único",
  carousel: "Carrossel",
  collection: "Coleção",
  catalog: "Catálogo",
};

const SOURCE_LABEL_PT: Record<CreativeFormatSource, string | null> = {
  strategy_explicit_format: "Definido pela estratégia",
  account_default_format: "Padrão da conta Meta",
  meta_sales_manual_contract_default: "Padrão do contrato Meta Vendas",
  catalog_required: "Exigido pelo tipo de campanha (catálogo)",
  testing_h4_variable: null,
  missing_catalog_config: null,
  unsupported_format: null,
};

const ALIAS_MAP: Record<string, CreativeFormatValue> = {
  image: "single_image",
  images: "single_image",
  single_image: "single_image",
  "imagem única": "single_image",
  "imagem unica": "single_image",
  video: "single_video",
  single_video: "single_video",
  "vídeo": "single_video",
  videos: "single_video",
  carousel: "carousel",
  carrossel: "carousel",
  collection: "collection",
  "coleção": "collection",
  "colecao": "collection",
  catalog: "catalog",
  "catálogo": "catalog",
  "catalogo": "catalog",
};

export function normalizeCreativeFormat(raw: unknown): CreativeFormatValue | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase();
  if (!k) return null;
  return ALIAS_MAP[k] ?? null;
}

export interface ResolveCreativeFormatArgs {
  explicit?: unknown;
  accountDefault?: unknown;
  isTesting: boolean;
  requiresCatalog: boolean;
  hasValidCatalog: boolean;
  platform: string;
  objectiveCanonical: string | null;
}

export function resolveCreativeFormat(args: ResolveCreativeFormatArgs): ResolvedCreativeFormat {
  // 1) [Teste]/ABO — variável de H.4
  if (args.isTesting) {
    return {
      value: null,
      label: null,
      source: "testing_h4_variable",
      resolution_phase: "h4_future",
      missing_reason: null,
      source_label_pt: null,
    };
  }

  // 2) Catálogo obrigatório — regra própria
  if (args.requiresCatalog) {
    if (args.hasValidCatalog) {
      return {
        value: "catalog",
        label: LABEL.catalog,
        source: "catalog_required",
        resolution_phase: "h2_structural",
        missing_reason: null,
        source_label_pt: SOURCE_LABEL_PT.catalog_required,
      };
    }
    return {
      value: null,
      label: null,
      source: "missing_catalog_config",
      resolution_phase: "account_config",
      missing_reason: "Catálogo de produtos não configurado na conta Meta.",
      source_label_pt: null,
    };
  }

  // 3) Explícito da estratégia
  const explicit = normalizeCreativeFormat(args.explicit);
  if (explicit) {
    return {
      value: explicit,
      label: LABEL[explicit],
      source: "strategy_explicit_format",
      resolution_phase: "h2_structural",
      missing_reason: null,
      source_label_pt: SOURCE_LABEL_PT.strategy_explicit_format,
    };
  }

  // 4) Padrão da conta
  const acc = normalizeCreativeFormat(args.accountDefault);
  if (acc) {
    return {
      value: acc,
      label: LABEL[acc],
      source: "account_default_format",
      resolution_phase: "h2_structural",
      missing_reason: null,
      source_label_pt: SOURCE_LABEL_PT.account_default_format,
    };
  }

  // 5) Default contratual global — só Meta + Vendas manual
  if (args.platform === "meta" && args.objectiveCanonical === "sales") {
    return {
      value: "single_image",
      label: LABEL.single_image,
      source: "meta_sales_manual_contract_default",
      resolution_phase: "h2_structural",
      missing_reason: null,
      source_label_pt: SOURCE_LABEL_PT.meta_sales_manual_contract_default,
    };
  }

  // 6) Fora do escopo coberto pelo default contratual
  return {
    value: null,
    label: null,
    source: "unsupported_format",
    resolution_phase: "h2_structural",
    missing_reason: "Formato do criativo sem default contratual para este escopo.",
    source_label_pt: null,
  };
}
