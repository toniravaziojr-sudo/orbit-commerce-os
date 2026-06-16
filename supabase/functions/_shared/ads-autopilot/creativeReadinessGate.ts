// =============================================================================
// H.4.0 — Motor puro de prontidão para geração de criativos
//
// Princípio production-first: nenhum creative_job pode ser criado se este motor
// não retornar status === "ready". O motor é puro: recebe um payload já
// hidratado pelo loader (fora deste arquivo) e devolve um veredito determinístico.
//
// Nada aqui chama banco, IA, Meta ou cria job. Nenhum efeito colateral.
// =============================================================================

export const CREATIVE_READINESS_CONTRACT_VERSION = "h4_readiness_v1";

export type CreativeReadinessStatus = "ready" | "blocked";

export type CreativeReadinessSeverity = "blocker" | "warning";

export type CreativeReadinessNodeType =
  | "campaign"
  | "ad_set"
  | "ad"
  | "creative"
  | "brand"
  | "product"
  | "platform"
  | "pricing";

export interface CreativeReadinessIssue {
  /** Identificador canônico do campo/fonte (ex.: "brand.allowed_claims"). */
  field: string;
  /** Rótulo curto em PT-BR para a UI ("Claims permitidas"). */
  label_pt: string;
  /** Motivo em PT-BR pronto para o lojista ler. */
  reason_pt: string;
  /** Onde resolver, em PT-BR ("Configurações da marca > Identidade e claims"). */
  where_to_fix: string;
  /** Texto do botão/ação sugerido ("Abrir configurações da marca"). */
  action_label: string;
  severity: CreativeReadinessSeverity;
  node_type: CreativeReadinessNodeType;
  node_id: string | null;
}

export interface CreativeReadinessCostEstimate {
  calculable: boolean;
  total_credits: number | null;
  total_jobs: number;
  jobs_by_format: Record<string, { count: number; credits_each: number | null; service_key: string | null }>;
  source: "service_pricing" | null;
  cost_table_version: string | null;
}

export interface CreativeReadinessResult {
  contract_version: typeof CREATIVE_READINESS_CONTRACT_VERSION;
  status: CreativeReadinessStatus;
  summary: string;
  blockers: CreativeReadinessIssue[];
  warnings: CreativeReadinessIssue[];
  cost_estimate: CreativeReadinessCostEstimate;
}

// ============== INPUT (payload hidratado pelo loader) =====================

export type CreativePlannedFormat =
  | "image_single"
  | "carousel"
  | "video"
  | "test_pending"; // [Teste] sem formato real definido

export interface PlannedCreativeInput {
  /** Índice da variação planejada na proposta (0..n-1). */
  index: number;
  /** Tipo da proposta de origem ("creation" para [Criação], "test" para [Teste]). */
  origin: "creation" | "test";
  /** Formato real do criativo. "test_pending" indica que a variação ainda não tem formato escolhido. */
  format: CreativePlannedFormat;
  /** CTA real escolhido para o criativo. */
  cta: string | null;
}

export interface ProposalInput {
  id: string;
  proposal_kind: "creation" | "test";
  campaign_objective: string | null;
  destination_url: string | null;
  utm_template: string | null;
  budget_amount_cents: number | null;
  audience_defined: boolean;
  placements_defined: boolean;
  catalog_required: boolean;
  catalog_linked: boolean;
  planned_creatives: PlannedCreativeInput[];
}

export interface MetaIntegrationInput {
  oauth_active: boolean;
  ad_account_valid: boolean;
  facebook_page_linked: boolean;
  pixel_configured: boolean;
  conversion_event_set: boolean;
  attribution_window_set: boolean;
}

export interface BrandInput {
  brand_summary: string | null;
  tone_of_voice: string | null;
  visual_style_guidelines: string | null;
  logo_url: string | null;
  palette_defined: boolean;
  packshot_url: string | null;
  banned_claims: string[];
  do_not_do: string[];
  allowed_claims: string[];
  approved_main_promise: string | null;
  compliance_notes: string | null;
  no_additional_restrictions_confirmed: boolean;
}

export interface ProductInput {
  id: string;
  name: string | null;
  description: string | null;
  benefits: string[]; // diferenciais/benefícios principais
  is_physical: boolean;
  primary_image_url: string | null; // imagem do produto
  regulatory_category: "cosmetic_hair" | "supplement" | "other" | null;
  commercial_restrictions: string | null;
  no_additional_restrictions_confirmed: boolean;
}

export interface PricingEntry {
  service_key: string;
  credits_per_unit: number;
}

export interface PricingInput {
  /** Mapa formato → service_key candidato (decisão da plataforma, não da IA). */
  format_to_service_key: Record<Exclude<CreativePlannedFormat, "test_pending">, string | null>;
  /** Tabela de preços ativa, indexada por service_key. */
  table: Record<string, PricingEntry>;
  cost_table_version: string | null;
}

export interface CreativeReadinessInput {
  proposal: ProposalInput;
  meta: MetaIntegrationInput;
  brand: BrandInput;
  product: ProductInput;
  pricing: PricingInput;
}

// ============== Helpers ===================================================

const isBlank = (s: string | null | undefined): boolean =>
  !s || s.trim().length === 0;

const arrEmpty = (a: unknown[] | null | undefined): boolean =>
  !a || a.length === 0;

const SENSITIVE_CATEGORIES = new Set(["cosmetic_hair", "supplement"]);

// ============== Motor =====================================================

export function evaluateCreativeReadiness(
  input: CreativeReadinessInput,
): CreativeReadinessResult {
  const blockers: CreativeReadinessIssue[] = [];
  const warnings: CreativeReadinessIssue[] = [];

  const push = (i: CreativeReadinessIssue) => blockers.push(i);

  // ---- Bloco Meta / canal ------------------------------------------------
  if (!input.meta.oauth_active) {
    push({
      field: "meta.oauth_active",
      label_pt: "Conexão com o Meta",
      reason_pt: "A conexão com o Meta não está ativa ou expirou.",
      where_to_fix: "Integrações > Meta",
      action_label: "Reconectar Meta",
      severity: "blocker",
      node_type: "platform",
      node_id: "meta",
    });
  }
  if (!input.meta.ad_account_valid) {
    push({
      field: "meta.ad_account",
      label_pt: "Conta de anúncios",
      reason_pt: "Nenhuma conta de anúncios válida selecionada.",
      where_to_fix: "Integrações > Meta > Conta de anúncios",
      action_label: "Selecionar conta",
      severity: "blocker", node_type: "platform", node_id: "meta",
    });
  }
  if (!input.meta.facebook_page_linked) {
    push({
      field: "meta.facebook_page",
      label_pt: "Página do Facebook",
      reason_pt: "Nenhuma Página do Facebook está vinculada.",
      where_to_fix: "Integrações > Meta > Página",
      action_label: "Vincular Página",
      severity: "blocker", node_type: "platform", node_id: "meta",
    });
  }
  if (!input.meta.pixel_configured) {
    push({
      field: "meta.pixel",
      label_pt: "Pixel do Meta",
      reason_pt: "O Pixel não está configurado para esta conta.",
      where_to_fix: "Integrações > Meta > Pixel",
      action_label: "Configurar Pixel",
      severity: "blocker", node_type: "platform", node_id: "meta",
    });
  }
  if (!input.meta.conversion_event_set) {
    push({
      field: "meta.conversion_event",
      label_pt: "Evento de conversão",
      reason_pt: "Defina o evento de conversão padrão antes de gerar criativos.",
      where_to_fix: "Integrações > Meta > Configuração de produção",
      action_label: "Definir evento",
      severity: "blocker", node_type: "platform", node_id: "meta",
    });
  }
  if (!input.meta.attribution_window_set) {
    push({
      field: "meta.attribution_window",
      label_pt: "Janela de atribuição",
      reason_pt: "Defina a janela de atribuição antes de gerar criativos.",
      where_to_fix: "Integrações > Meta > Configuração de produção",
      action_label: "Definir janela",
      severity: "blocker", node_type: "platform", node_id: "meta",
    });
  }

  // ---- Bloco Campanha / proposta -----------------------------------------
  if (isBlank(input.proposal.utm_template)) {
    push({
      field: "proposal.utm_template", label_pt: "Modelo de UTM",
      reason_pt: "Modelo de UTM não definido para rastrear cliques.",
      where_to_fix: "Configurações de tráfego > Padrões de UTM",
      action_label: "Definir UTMs",
      severity: "blocker", node_type: "campaign", node_id: input.proposal.id,
    });
  }
  if (isBlank(input.proposal.destination_url)) {
    push({
      field: "proposal.destination_url", label_pt: "URL de destino",
      reason_pt: "Defina a URL de destino dos anúncios.",
      where_to_fix: "Proposta > Destino",
      action_label: "Definir URL",
      severity: "blocker", node_type: "campaign", node_id: input.proposal.id,
    });
  }
  if (!input.proposal.budget_amount_cents || input.proposal.budget_amount_cents <= 0) {
    push({
      field: "proposal.budget", label_pt: "Orçamento",
      reason_pt: "Defina um orçamento válido para a campanha.",
      where_to_fix: "Proposta > Orçamento",
      action_label: "Definir orçamento",
      severity: "blocker", node_type: "campaign", node_id: input.proposal.id,
    });
  }
  if (!input.proposal.audience_defined) {
    push({
      field: "proposal.audience", label_pt: "Público",
      reason_pt: "Defina o público antes de gerar criativos.",
      where_to_fix: "Proposta > Público",
      action_label: "Definir público",
      severity: "blocker", node_type: "ad_set", node_id: null,
    });
  }
  if (!input.proposal.placements_defined) {
    push({
      field: "proposal.placements", label_pt: "Posicionamentos",
      reason_pt: "Defina onde os anúncios serão exibidos.",
      where_to_fix: "Proposta > Posicionamentos",
      action_label: "Escolher posicionamentos",
      severity: "blocker", node_type: "ad_set", node_id: null,
    });
  }
  if (input.proposal.catalog_required && !input.proposal.catalog_linked) {
    push({
      field: "proposal.catalog", label_pt: "Catálogo",
      reason_pt: "Esta proposta exige catálogo vinculado.",
      where_to_fix: "Integrações > Meta > Catálogo",
      action_label: "Vincular catálogo",
      severity: "blocker", node_type: "campaign", node_id: input.proposal.id,
    });
  }

  // ---- Criativos planejados: formato real e CTA --------------------------
  if (arrEmpty(input.proposal.planned_creatives)) {
    push({
      field: "proposal.planned_creatives", label_pt: "Variações de criativo",
      reason_pt: "Nenhuma variação de criativo planejada na proposta.",
      where_to_fix: "Proposta > Variações",
      action_label: "Adicionar variações",
      severity: "blocker", node_type: "creative", node_id: null,
    });
  } else {
    input.proposal.planned_creatives.forEach((pc) => {
      if (pc.format === "test_pending") {
        push({
          field: `creative.${pc.index}.format`,
          label_pt: "Formato da variação",
          reason_pt: "Defina os formatos das variações antes de gerar criativos.",
          where_to_fix: "Proposta > Variações",
          action_label: "Escolher formato",
          severity: "blocker", node_type: "creative", node_id: String(pc.index),
        });
      }
      if (isBlank(pc.cta)) {
        push({
          field: `creative.${pc.index}.cta`,
          label_pt: "CTA da variação",
          reason_pt: "Defina o botão de ação (CTA) desta variação.",
          where_to_fix: "Proposta > Variações",
          action_label: "Escolher CTA",
          severity: "blocker", node_type: "creative", node_id: String(pc.index),
        });
      }
    });
  }

  // ---- Bloco Produto / oferta --------------------------------------------
  if (isBlank(input.product.description)) {
    push({
      field: "product.description", label_pt: "Descrição do produto",
      reason_pt: "O produto/oferta precisa de descrição suficiente para a IA.",
      where_to_fix: "Cadastro de produto > Descrição",
      action_label: "Abrir produto",
      severity: "blocker", node_type: "product", node_id: input.product.id,
    });
  }
  if (arrEmpty(input.product.benefits)) {
    push({
      field: "product.benefits", label_pt: "Diferenciais/benefícios",
      reason_pt: "Liste pelo menos um diferencial ou benefício principal.",
      where_to_fix: "Cadastro de produto > Diferenciais",
      action_label: "Editar diferenciais",
      severity: "blocker", node_type: "product", node_id: input.product.id,
    });
  }
  if (!input.product.regulatory_category) {
    push({
      field: "product.regulatory_category", label_pt: "Categoria regulatória",
      reason_pt: "Defina a categoria regulatória/comercial do produto.",
      where_to_fix: "Cadastro de produto > Categoria regulatória",
      action_label: "Definir categoria",
      severity: "blocker", node_type: "product", node_id: input.product.id,
    });
  } else if (SENSITIVE_CATEGORIES.has(input.product.regulatory_category)) {
    const hasProductRestriction =
      !isBlank(input.product.commercial_restrictions) ||
      input.product.no_additional_restrictions_confirmed;
    if (!hasProductRestriction) {
      push({
        field: "product.commercial_restrictions",
        label_pt: "Restrições do produto",
        reason_pt:
          "Categoria sensível: declare restrições ou confirme explicitamente que não há restrições adicionais.",
        where_to_fix: "Cadastro de produto > Restrições",
        action_label: "Declarar restrições",
        severity: "blocker", node_type: "product", node_id: input.product.id,
      });
    }
  }

  // Identidade visual mínima: logo + paleta + imagem confiável
  if (isBlank(input.brand.logo_url)) {
    push({
      field: "brand.logo_url", label_pt: "Logo da marca",
      reason_pt: "Envie o logo da marca para gerar criativos.",
      where_to_fix: "Configurações > Marca > Identidade",
      action_label: "Enviar logo",
      severity: "blocker", node_type: "brand", node_id: null,
    });
  }
  if (!input.brand.palette_defined) {
    push({
      field: "brand.palette", label_pt: "Paleta de cores",
      reason_pt: "Defina a paleta de cores da marca.",
      where_to_fix: "Configurações > Marca > Identidade",
      action_label: "Definir paleta",
      severity: "blocker", node_type: "brand", node_id: null,
    });
  }
  const hasReliableImage =
    (input.product.is_physical && !isBlank(input.product.primary_image_url)) ||
    !isBlank(input.brand.packshot_url) ||
    (!input.product.is_physical && !isBlank(input.product.primary_image_url));
  if (!hasReliableImage) {
    push({
      field: "brand.visual_reference", label_pt: "Imagem de referência",
      reason_pt:
        "É preciso pelo menos uma imagem confiável do produto ou packshot da marca.",
      where_to_fix: "Cadastro de produto OU Configurações > Marca > Packshot",
      action_label: "Enviar imagem",
      severity: "blocker", node_type: "brand", node_id: null,
    });
  }

  // Tom de voz
  if (isBlank(input.brand.tone_of_voice)) {
    push({
      field: "brand.tone_of_voice", label_pt: "Tom de comunicação",
      reason_pt: "Defina o tom de comunicação da marca.",
      where_to_fix: "Configurações > Marca > Tom de voz",
      action_label: "Definir tom",
      severity: "blocker", node_type: "brand", node_id: null,
    });
  }

  // Claims e promessa (fonte de verdade dedicada)
  if (isBlank(input.brand.approved_main_promise)) {
    push({
      field: "brand.approved_main_promise",
      label_pt: "Promessa principal aprovada",
      reason_pt: "Cadastre a promessa principal aprovada para a marca.",
      where_to_fix: "Configurações > Marca > Promessa e claims",
      action_label: "Cadastrar promessa",
      severity: "blocker", node_type: "brand", node_id: null,
    });
  }
  if (arrEmpty(input.brand.allowed_claims)) {
    push({
      field: "brand.allowed_claims",
      label_pt: "Claims permitidas",
      reason_pt: "Cadastre ao menos uma claim permitida.",
      where_to_fix: "Configurações > Marca > Promessa e claims",
      action_label: "Cadastrar claims",
      severity: "blocker", node_type: "brand", node_id: null,
    });
  }

  // Claims proibidas / restrições da marca: precisa ter algo declarado OU confirmação explícita
  const hasBrandRestrictionDeclared =
    !arrEmpty(input.brand.banned_claims) ||
    !arrEmpty(input.brand.do_not_do) ||
    input.brand.no_additional_restrictions_confirmed;
  if (!hasBrandRestrictionDeclared) {
    push({
      field: "brand.restrictions",
      label_pt: "Claims proibidas/restrições",
      reason_pt:
        "Declare claims proibidas/restrições ou confirme explicitamente que não há restrições adicionais.",
      where_to_fix: "Configurações > Marca > Promessa e claims",
      action_label: "Declarar restrições",
      severity: "blocker", node_type: "brand", node_id: null,
    });
  }

  // ---- Custo estimado ----------------------------------------------------
  const cost = computeCostEstimate(input);
  if (!cost.calculable) {
    push({
      field: "pricing.cost_table",
      label_pt: "Custo de IA",
      reason_pt:
        "Não foi possível estimar o custo de IA para esta geração. Configure a tabela de créditos antes de gerar criativos.",
      where_to_fix: "Plataforma > Preços de IA",
      action_label: "Configurar preços",
      severity: "blocker", node_type: "pricing", node_id: null,
    });
  }

  const status: CreativeReadinessStatus = blockers.length === 0 ? "ready" : "blocked";

  const summary =
    status === "ready"
      ? `Pronta para gerar ${cost.total_jobs} criativo(s). Custo estimado: ${cost.total_credits} créditos.`
      : `Antes de gerar criativos, complete ${blockers.length} configuração(ões) pendente(s).`;

  return {
    contract_version: CREATIVE_READINESS_CONTRACT_VERSION,
    status,
    summary,
    blockers,
    warnings,
    cost_estimate: cost,
  };
}

function computeCostEstimate(input: CreativeReadinessInput): CreativeReadinessCostEstimate {
  const jobs_by_format: CreativeReadinessCostEstimate["jobs_by_format"] = {};
  let total_credits = 0;
  let calculable = true;

  const real = input.proposal.planned_creatives.filter((pc) => pc.format !== "test_pending");
  for (const pc of real) {
    const fmt = pc.format as Exclude<CreativePlannedFormat, "test_pending">;
    const serviceKey = input.pricing.format_to_service_key[fmt] ?? null;
    const entry = serviceKey ? input.pricing.table[serviceKey] : undefined;
    const credits = entry?.credits_per_unit ?? null;

    if (!jobs_by_format[fmt]) {
      jobs_by_format[fmt] = { count: 0, credits_each: credits, service_key: serviceKey };
    }
    jobs_by_format[fmt].count += 1;
    if (credits === null) {
      calculable = false;
    } else {
      total_credits += credits;
    }
  }

  const total_jobs = real.length;
  // Sem variações reais → não há o que custear, mas o gate trata isso como blocker em outro lugar.
  if (total_jobs === 0) calculable = false;

  return {
    calculable,
    total_credits: calculable ? total_credits : null,
    total_jobs,
    jobs_by_format,
    source: calculable ? "service_pricing" : null,
    cost_table_version: input.pricing.cost_table_version,
  };
}
