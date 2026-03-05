// =============================================
// ENGINE PLAN V4.0 — Deterministic Decision Engine
// Backend authority for landing page generation
// All archetype/depth/visual decisions are made HERE in TypeScript
// The AI prompt receives these as non-negotiable instructions
// v4.0.0
// =============================================

// ========== TYPES ==========

export type NicheType = 'ecommerce' | 'clinica' | 'saas' | 'infoproduto' | 'servico_local' | 'servico_premium';

export type ArchetypeKey = 
  | 'lp_captura' 
  | 'lp_whatsapp' 
  | 'lp_produto_fisico' 
  | 'lp_click_through' 
  | 'sales_page_longa' 
  | 'lp_servico_premium' 
  | 'lp_saas';

export type DepthLevel = 'short' | 'medium' | 'long';
export type VisualWeight = 'minimalista' | 'comercial' | 'premium' | 'direto' | 'informativo';
export type ProofStrength = 'weak' | 'medium' | 'strong';
export type TrafficTemp = 'cold' | 'warm' | 'hot';
export type TrafficSource = 'meta' | 'google' | 'organic' | 'email' | 'remarketing' | 'direct';
export type AwarenessLevel = 'unaware' | 'pain_aware' | 'solution_aware' | 'product_aware' | 'ready';
export type ObjectiveType = 'lead' | 'whatsapp' | 'sale' | 'checkout' | 'scheduling' | 'quiz' | 'signup' | 'download';
export type PreferredCTA = 'whatsapp' | 'buy' | 'signup' | 'schedule' | 'download';
export type Restriction = 'no_countdown' | 'no_video' | 'no_comparisons';
export type HardCheckStatus = 'pass' | 'warning' | 'fail';

export interface BriefingInput {
  objective: ObjectiveType;
  trafficTemp: TrafficTemp;
  trafficSource: TrafficSource;
  awarenessLevel: AwarenessLevel;
  preferredCTA?: PreferredCTA;
  restrictions?: Restriction[];
  visualStyle?: VisualWeight;
}

export interface Assumption {
  field: string;
  value: string;
  assumedBySystem: boolean;
}

export interface EnginePlanInput {
  resolvedNiche: NicheType;
  resolvedArchetype: ArchetypeKey;
  resolvedDepth: DepthLevel;
  resolvedVisualWeight: VisualWeight;
  proofStrength: ProofStrength;
  defaultCTA: string;
  requiredSections: string[];
  optionalSections: string[];
  preferredOrder: string[];
  assumptions: Assumption[];
  briefing: BriefingInput;
}

export interface HardCheckResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface HardCheckOutput {
  hardCheckStatus: HardCheckStatus;
  needsReview: boolean;
  checks: HardCheckResult[];
}

// ========== TEMPLATE REGISTRY ==========

interface ArchetypeTemplate {
  key: ArchetypeKey;
  name: string;
  requiredSections: string[];
  optionalSections: string[];
  preferredOrder: string[];
  sectionCount: { min: number; max: number };
}

const TEMPLATE_REGISTRY: Record<ArchetypeKey, ArchetypeTemplate> = {
  lp_captura: {
    key: 'lp_captura',
    name: 'Lead Capture Curta',
    requiredSections: ['hero', 'beneficios', 'cta_final'],
    optionalSections: ['prova_social', 'faq'],
    preferredOrder: ['hero', 'beneficios', 'prova_social', 'cta_final', 'faq'],
    sectionCount: { min: 3, max: 5 },
  },
  lp_whatsapp: {
    key: 'lp_whatsapp',
    name: 'WhatsApp Push',
    requiredSections: ['hero', 'dor_problema', 'solucao', 'beneficios', 'cta_final'],
    optionalSections: ['prova_social', 'faq'],
    preferredOrder: ['hero', 'dor_problema', 'solucao', 'beneficios', 'prova_social', 'cta_final', 'faq'],
    sectionCount: { min: 5, max: 7 },
  },
  lp_produto_fisico: {
    key: 'lp_produto_fisico',
    name: 'Produto Físico / DTC',
    requiredSections: ['hero', 'dor_problema', 'solucao', 'produto_destaque', 'beneficios', 'prova_social', 'oferta'],
    optionalSections: ['comparativo', 'faq', 'garantia'],
    preferredOrder: ['hero', 'credibilidade', 'dor_problema', 'solucao', 'produto_destaque', 'beneficios', 'prova_social', 'comparativo', 'oferta', 'faq', 'garantia', 'cta_final'],
    sectionCount: { min: 7, max: 9 },
  },
  lp_click_through: {
    key: 'lp_click_through',
    name: 'Click-Through para Checkout',
    requiredSections: ['hero', 'beneficios', 'produto_destaque', 'oferta', 'cta_final'],
    optionalSections: ['prova_social'],
    preferredOrder: ['hero', 'beneficios', 'produto_destaque', 'prova_social', 'oferta', 'cta_final'],
    sectionCount: { min: 5, max: 6 },
  },
  sales_page_longa: {
    key: 'sales_page_longa',
    name: 'Sales Page Longa',
    requiredSections: ['hero', 'dor_problema', 'solucao', 'beneficios', 'produto_destaque', 'prova_social', 'comparativo', 'oferta', 'garantia'],
    optionalSections: ['credibilidade', 'faq', 'cta_intermediario', 'urgencia'],
    preferredOrder: ['hero', 'urgencia', 'credibilidade', 'dor_problema', 'solucao', 'beneficios', 'produto_destaque', 'prova_social', 'comparativo', 'oferta', 'garantia', 'faq', 'cta_final'],
    sectionCount: { min: 9, max: 12 },
  },
  lp_servico_premium: {
    key: 'lp_servico_premium',
    name: 'Serviço / Consultoria Premium',
    requiredSections: ['hero', 'problema_contexto', 'solucao', 'beneficios', 'prova_social', 'cta_final'],
    optionalSections: ['processo', 'faq'],
    preferredOrder: ['hero', 'problema_contexto', 'solucao', 'beneficios', 'processo', 'prova_social', 'faq', 'cta_final'],
    sectionCount: { min: 6, max: 8 },
  },
  lp_saas: {
    key: 'lp_saas',
    name: 'SaaS / Software',
    requiredSections: ['hero', 'features', 'beneficios', 'prova_social', 'pricing', 'cta_final'],
    optionalSections: ['comparativo', 'faq', 'integrações'],
    preferredOrder: ['hero', 'features', 'beneficios', 'prova_social', 'comparativo', 'pricing', 'faq', 'cta_final'],
    sectionCount: { min: 7, max: 9 },
  },
};

// ========== NICHE DETECTION ==========

const NICHE_KEYWORDS: Record<NicheType, string[]> = {
  ecommerce: ['produto', 'loja', 'varejo', 'comprar', 'desconto', 'oferta', 'cosmético', 'beleza', 'saúde', 'suplemento', 'moda', 'acessório', 'alimento', 'tech', 'eletrônico', 'casa', 'decoração'],
  clinica: ['clínica', 'consultório', 'médico', 'dentista', 'fisioterapia', 'estética', 'dermatologia', 'nutricionista', 'psicólogo', 'tratamento'],
  saas: ['software', 'app', 'plataforma', 'sistema', 'ferramenta', 'dashboard', 'api', 'automação', 'saas', 'digital', 'assinatura'],
  infoproduto: ['curso', 'ebook', 'mentoria', 'treinamento', 'masterclass', 'aula', 'formação', 'método', 'programa', 'conteúdo', 'digital'],
  servico_local: ['serviço', 'instalação', 'manutenção', 'reforma', 'delivery', 'limpeza', 'transporte', 'encanador', 'eletricista', 'pintor'],
  servico_premium: ['consultoria', 'assessoria', 'coaching', 'agência', 'advocacia', 'contabilidade', 'arquitetura', 'design', 'estratégia'],
};

function resolveNiche(productType?: string | null, tags?: string[] | null, description?: string | null): NicheType {
  const searchText = [
    productType || '',
    ...(tags || []),
    (description || '').substring(0, 500),
  ].join(' ').toLowerCase();

  let bestNiche: NicheType = 'ecommerce'; // default
  let bestScore = 0;

  for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => acc + (searchText.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      bestNiche = niche as NicheType;
    }
  }

  return bestNiche;
}

// ========== ARCHETYPE RESOLUTION ==========

function resolveArchetype(objective: ObjectiveType, niche: NicheType): ArchetypeKey {
  // Matrix: objective × niche → archetype
  if (objective === 'lead' || objective === 'signup' || objective === 'download' || objective === 'quiz') {
    return 'lp_captura';
  }
  if (objective === 'whatsapp') {
    return 'lp_whatsapp';
  }
  if (objective === 'scheduling') {
    return niche === 'clinica' ? 'lp_servico_premium' : 'lp_whatsapp';
  }
  if (objective === 'checkout') {
    return 'lp_click_through';
  }
  // objective === 'sale'
  if (niche === 'saas') return 'lp_saas';
  if (niche === 'servico_premium') return 'lp_servico_premium';
  if (niche === 'infoproduto') return 'sales_page_longa';
  if (niche === 'clinica') return 'lp_servico_premium';
  if (niche === 'servico_local') return 'lp_whatsapp';
  // ecommerce default
  return 'lp_produto_fisico';
}

// ========== DEPTH RESOLUTION ==========

function resolveDepth(trafficTemp: TrafficTemp, priceInReais?: number | null): DepthLevel {
  const isHighTicket = priceInReais != null && priceInReais > 200;
  
  if (trafficTemp === 'cold') {
    return isHighTicket ? 'long' : 'medium';
  }
  if (trafficTemp === 'warm') {
    return isHighTicket ? 'medium' : 'medium';
  }
  // hot
  return isHighTicket ? 'medium' : 'short';
}

// ========== VISUAL WEIGHT RESOLUTION ==========

function resolveVisualWeight(niche: NicheType, trafficSource: TrafficSource): VisualWeight {
  const nicheWeights: Record<NicheType, VisualWeight> = {
    ecommerce: 'comercial',
    clinica: 'premium',
    saas: 'informativo',
    infoproduto: 'direto',
    servico_local: 'direto',
    servico_premium: 'premium',
  };

  let weight = nicheWeights[niche] || 'comercial';

  // Adjust for traffic source
  if (trafficSource === 'organic' || trafficSource === 'google') {
    // Users from search/organic expect more informational content
    if (weight === 'direto') weight = 'informativo';
  }
  if (trafficSource === 'meta') {
    // Meta traffic expects more visual/commercial content
    if (weight === 'informativo') weight = 'comercial';
  }

  return weight;
}

// ========== PROOF STRENGTH ==========

function resolveProofStrength(reviewCount: number): ProofStrength {
  if (reviewCount === 0) return 'weak';
  if (reviewCount <= 5) return 'medium';
  return 'strong';
}

// ========== DEFAULT CTA ==========

function resolveDefaultCTA(objective: ObjectiveType, preferredCTA?: PreferredCTA): string {
  if (preferredCTA) {
    const ctaMap: Record<PreferredCTA, string> = {
      whatsapp: 'Falar no WhatsApp',
      buy: 'Comprar Agora',
      signup: 'Cadastrar Grátis',
      schedule: 'Agendar Consulta',
      download: 'Baixar Agora',
    };
    return ctaMap[preferredCTA];
  }

  const defaultCTAs: Record<ObjectiveType, string> = {
    lead: 'Quero Receber',
    whatsapp: 'Falar no WhatsApp',
    sale: 'Comprar Agora',
    checkout: 'Ir para o Checkout',
    scheduling: 'Agendar Agora',
    quiz: 'Fazer o Quiz',
    signup: 'Cadastrar Grátis',
    download: 'Baixar Agora',
  };

  return defaultCTAs[objective] || 'Comprar Agora';
}

// ========== MAIN: resolveEnginePlan ==========

export interface ResolveEnginePlanParams {
  briefing?: BriefingInput | null;
  productType?: string | null;
  tags?: string[] | null;
  description?: string | null;
  price?: number | null;
  reviewCount?: number;
}

export function resolveEnginePlan(params: ResolveEnginePlanParams): EnginePlanInput {
  const {
    productType,
    tags,
    description,
    price,
    reviewCount = 0,
  } = params;

  // Use briefing or defaults
  const briefing: BriefingInput = params.briefing || {
    objective: 'sale',
    trafficTemp: 'cold',
    trafficSource: 'meta',
    awarenessLevel: 'pain_aware',
  };

  const assumptions: Assumption[] = [];

  // Track if briefing was provided or defaulted
  if (!params.briefing) {
    assumptions.push(
      { field: 'objective', value: briefing.objective, assumedBySystem: true },
      { field: 'trafficTemp', value: briefing.trafficTemp, assumedBySystem: true },
      { field: 'trafficSource', value: briefing.trafficSource, assumedBySystem: true },
      { field: 'awarenessLevel', value: briefing.awarenessLevel, assumedBySystem: true },
    );
  }

  const resolvedNiche = resolveNiche(productType, tags, description);
  const resolvedArchetype = resolveArchetype(briefing.objective, resolvedNiche);
  const resolvedDepth = resolveDepth(briefing.trafficTemp, price);
  // Use briefing.visualStyle as override if provided
  const resolvedVisualWeight = briefing.visualStyle || resolveVisualWeight(resolvedNiche, briefing.trafficSource);
  const proofStrength = resolveProofStrength(reviewCount);
  const defaultCTA = resolveDefaultCTA(briefing.objective, briefing.preferredCTA);

  const template = TEMPLATE_REGISTRY[resolvedArchetype];

  return {
    resolvedNiche,
    resolvedArchetype,
    resolvedDepth,
    resolvedVisualWeight,
    proofStrength,
    defaultCTA,
    requiredSections: template.requiredSections,
    optionalSections: template.optionalSections,
    preferredOrder: template.preferredOrder,
    assumptions,
    briefing,
  };
}

// ========== HARD CHECKS ==========

export function runHardChecks(
  html: string,
  plan: EnginePlanInput,
  productNames: string[],
  productImageUrls: string[],
): HardCheckOutput {
  const checks: HardCheckResult[] = [];

  // 1. Has <h1>?
  const hasH1 = /<h1[\s>]/i.test(html);
  checks.push({
    name: 'has_h1',
    passed: hasH1,
    message: hasH1 ? 'H1 tag found' : 'Missing H1 tag in generated HTML',
  });

  // 2. Has CTA button?
  const hasCTA = /class="[^"]*cta[^"]*"|cta-button|btn-cta|<button/i.test(html) ||
    html.toLowerCase().includes(plan.defaultCTA.toLowerCase());
  checks.push({
    name: 'has_cta',
    passed: hasCTA,
    message: hasCTA ? 'CTA element found' : 'No CTA button detected',
  });

  // 3. Contains product name?
  const mainProductName = productNames[0];
  const hasProductName = mainProductName
    ? html.toLowerCase().includes(mainProductName.toLowerCase())
    : true; // skip if no product
  checks.push({
    name: 'has_product_name',
    passed: hasProductName,
    message: hasProductName
      ? `Product name "${mainProductName}" found`
      : `Product name "${mainProductName}" NOT found — possible hallucination`,
  });

  // 4. Contains product image URLs?
  const usedImages = productImageUrls.filter(url => html.includes(url));
  const hasImages = productImageUrls.length === 0 || usedImages.length > 0;
  checks.push({
    name: 'has_product_images',
    passed: hasImages,
    message: hasImages
      ? `${usedImages.length}/${productImageUrls.length} product images used`
      : 'NO product images found in HTML — AI may have used fake URLs',
  });

  // 5. No prohibited patterns?
  const prohibitedPatterns = [
    { pattern: /placeholder\.com/i, name: 'placeholder.com' },
    { pattern: /via\.placeholder/i, name: 'via.placeholder' },
    { pattern: /lorem ipsum/i, name: 'lorem ipsum' },
    { pattern: /unsplash\.com/i, name: 'unsplash.com' },
    { pattern: /example\.com/i, name: 'example.com' },
  ];

  for (const { pattern, name } of prohibitedPatterns) {
    const found = pattern.test(html);
    checks.push({
      name: `no_${name.replace(/[^a-z]/g, '_')}`,
      passed: !found,
      message: found ? `Prohibited pattern "${name}" found in HTML` : `No "${name}" detected`,
    });
  }

  // 6. Required sections heuristic (check by class/id/heading text)
  const sectionHeuristics: Record<string, RegExp> = {
    hero: /class="[^"]*hero[^"]*"|id="[^"]*hero[^"]*"|<section[^>]*hero/i,
    beneficios: /benefício|beneficio|benefit|vantage/i,
    prova_social: /depoimento|testimonial|avalia[çc][ãa]o|review|prova.social/i,
    faq: /faq|perguntas?.frequentes|dúvidas/i,
    oferta: /oferta|preço|pricing|comprar/i,
    garantia: /garantia|devolu[çc][ãa]o|reembolso/i,
  };

  const missingRequired: string[] = [];
  for (const section of plan.requiredSections) {
    const heuristic = sectionHeuristics[section];
    if (heuristic && !heuristic.test(html)) {
      missingRequired.push(section);
    }
  }

  const allRequiredPresent = missingRequired.length === 0;
  checks.push({
    name: 'required_sections',
    passed: allRequiredPresent,
    message: allRequiredPresent
      ? 'All required sections detected'
      : `Missing sections (heuristic): ${missingRequired.join(', ')}`,
  });

  // === LAYOUT HARD CHECKS (v4.2) — run on raw AI output, BEFORE document wrapping ===
  // These detect layout leaks that cause rendering issues in iframes

  // has_no_footer: detects <footer tag (real tag only, NOT class names containing "footer")
  const hasFooterTag = /<footer[\s>]/i.test(html);
  checks.push({
    name: 'has_no_footer',
    passed: !hasFooterTag,
    message: hasFooterTag
      ? 'AI generated a <footer> tag — platform renders footer separately'
      : 'No <footer> tag detected (correct)',
  });

  // has_no_document_shell: detects <!DOCTYPE, <html, <head — AI should return body-only
  const hasDocumentShell = /<!DOCTYPE|<html[\s>]|<head[\s>]/i.test(html);
  checks.push({
    name: 'has_no_document_shell',
    passed: !hasDocumentShell,
    message: hasDocumentShell
      ? 'AI included document shell (<!DOCTYPE/html/head) — contract violation'
      : 'No document shell detected (correct body-only output)',
  });

  // has_no_large_vh: detects height >= 80vh which causes iframe resize loops
  const hasLargeVh = /height\s*:\s*(8\d|9\d|100)(\.\d+)?vh/i.test(html);
  checks.push({
    name: 'has_no_large_vh',
    passed: !hasLargeVh,
    message: hasLargeVh
      ? 'Found height >= 80vh — causes iframe resize feedback loop'
      : 'No large vh heights detected',
  });

  // has_no_position_fixed: detects position: fixed which breaks iframe layout
  const hasPositionFixed = /position\s*:\s*fixed/i.test(html);
  checks.push({
    name: 'has_no_position_fixed',
    passed: !hasPositionFixed,
    message: hasPositionFixed
      ? 'Found position: fixed — breaks iframe rendering'
      : 'No position: fixed detected',
  });

  // has_no_external_images: detects external image hosts (imgur, postimg, imgbb, cloudinary)
  const hasExternalImages = /imgur\.com|postimg\.cc|imgbb\.com|cloudinary\.com/i.test(html);
  checks.push({
    name: 'has_no_external_images',
    passed: !hasExternalImages,
    message: hasExternalImages
      ? 'Found external image host (imgur/postimg/imgbb/cloudinary) — AI should only use provided URLs'
      : 'No external image hosts detected',
  });

  // Determine overall status
  const failedChecks = checks.filter(c => !c.passed);
  // Layout checks are warnings only, never critical fails
  const criticalFails = failedChecks.filter(c =>
    ['has_h1', 'has_cta', 'has_product_name'].includes(c.name)
  );

  let hardCheckStatus: HardCheckStatus;
  let needsReview: boolean;

  if (criticalFails.length > 0) {
    hardCheckStatus = 'fail';
    needsReview = true;
  } else if (failedChecks.length > 0) {
    hardCheckStatus = 'warning';
    needsReview = true;
  } else {
    hardCheckStatus = 'pass';
    needsReview = false;
  }

  return { hardCheckStatus, needsReview, checks };
}

// ========== NICHE RULES FOR PROMPT ==========

const NICHE_PROMPT_RULES: Record<NicheType, string> = {
  ecommerce: `### Regras de Nicho: E-commerce
- Foco em CONVERSÃO DIRETA: preço, desconto, escassez, prova social com volume
- Visual COMERCIAL: badges de desconto, selos de segurança, parcelas, frete grátis
- CTAs orientados a compra: "Comprar Agora", "Garantir o Meu", "Aproveitar Oferta"
- Seção de garantia obrigatória próxima ao preço
- Preços devem ter âncora visual (de/por) quando houver compare_at_price`,

  clinica: `### Regras de Nicho: Clínica/Saúde
- Tom de AUTORIDADE MÉDICA: linguagem profissional mas acessível
- Visual PREMIUM e LIMPO: branco, azul médico, tipografia elegante
- Credenciais e certificações em destaque (CRM, CRO, especializações)
- Depoimentos com foco em RESULTADOS e CONFIANÇA
- CTA orientado a agendamento: "Agendar Consulta", "Marcar Avaliação"
- Seção "Como Funciona" (processo step-by-step) obrigatória`,

  saas: `### Regras de Nicho: SaaS/Software
- Foco em FEATURES e RESULTADOS mensuráveis: números, métricas, ROI
- Visual MODERNO e INFORMATIVO: gradientes sutis, ícones, screenshots
- Seção de features com ícones e descrições curtas
- Comparativo com concorrentes ou alternativas
- Pricing table clara com CTA em cada plano
- Trial/freemium como CTA principal: "Testar Grátis", "Começar Agora"`,

  infoproduto: `### Regras de Nicho: Infoproduto
- Copy DIRETO e PERSUASIVO: PAS agressivo, storytelling de transformação
- Visual de URGÊNCIA: timers, badges, depoimentos em volume
- Seção de "O que você vai aprender" com módulos/aulas listados
- Bônus e garantia em destaque
- Prova social com screenshots de resultados de alunos
- CTA de inscrição: "Garantir Minha Vaga", "Quero Aprender"`,

  servico_local: `### Regras de Nicho: Serviço Local
- Foco em PRATICIDADE e CONFIANÇA: orçamento grátis, atendimento rápido
- Visual DIRETO e LIMPO: sem excesso visual, foco no essencial
- Informações de contato em destaque (telefone, WhatsApp, endereço)
- Área de atuação e horários de atendimento
- Depoimentos de clientes locais
- CTA de contato: "Pedir Orçamento", "Chamar no WhatsApp"`,

  servico_premium: `### Regras de Nicho: Serviço Premium/Consultoria
- Tom de EXCLUSIVIDADE e EXPERTISE: linguagem sofisticada
- Visual PREMIUM: paleta neutra/escura, tipografia elegante, whitespace generoso
- Cases de sucesso com resultados numéricos
- Processo de trabalho em timeline/steps elegante
- CTA consultivo: "Agendar Reunião", "Solicitar Proposta"
- Seção sobre o profissional/equipe (credenciais)`,
};

export function getNicheRules(niche: NicheType): string {
  return NICHE_PROMPT_RULES[niche] || NICHE_PROMPT_RULES.ecommerce;
}

// ========== TRAFFIC STRATEGY RULES ==========

const TRAFFIC_PROMPT_RULES: Record<TrafficSource, string> = {
  meta: `### Estratégia de Tráfego: Meta Ads
- Usuário vem de scroll social — Hero deve PARAR o scroll imediatamente
- Headline deve ser EMOCIONAL e conectar com a dor/desejo
- Primeiro CTA deve aparecer above the fold (em até 2 scrolls)
- Visual impactante: imagem hero grande, cores vibrantes`,

  google: `### Estratégia de Tráfego: Google Ads/Search
- Usuário pesquisou ativamente — já tem intenção
- Headline deve CONFIRMAR a busca: "Sim, você encontrou [solução]"
- Foco em informação rápida: benefícios claros, preço visível
- Trust signals fortes: selos, avaliações, anos de mercado`,

  organic: `### Estratégia de Tráfego: Orgânico/SEO
- Usuário chegou por conteúdo — não está pronto para comprar ainda
- Conteúdo educacional ANTES da venda: contexto, explicação, autoridade
- CTA suave no início, mais forte conforme desce a página
- Seção de FAQ robusta para capturar long-tail`,

  email: `### Estratégia de Tráfego: Email Marketing
- Usuário já conhece a marca — pule introdução
- Foco DIRETO na oferta: preço, benefícios, CTA
- Urgência é efetiva: "Oferta exclusiva para assinantes"
- Layout mais curto — o email já fez o pré-aquecimento`,

  remarketing: `### Estratégia de Tráfego: Remarketing
- Usuário JÁ VIU o produto — não repita a apresentação
- Foco em OBJEÇÕES: por que não comprou? preço? confiança?
- Oferta especial para retorno: desconto, frete grátis, bônus
- Prova social forte e garantia em destaque
- CTA urgente: "Última chance", "Preço especial"`,

  direct: `### Estratégia de Tráfego: Direto
- Usuário acessou diretamente — confiança alta mas intenção variada
- Layout completo: apresentação, benefícios, prova, oferta
- Equilibre informação e persuasão`,
};

export function getTrafficRules(trafficSource: TrafficSource): string {
  return TRAFFIC_PROMPT_RULES[trafficSource] || TRAFFIC_PROMPT_RULES.direct;
}

// ========== AWARENESS LEVEL COPY RULES ==========

const AWARENESS_COPY_RULES: Record<AwarenessLevel, string> = {
  unaware: `### Copy por Consciência: Inconsciente
- O público NÃO sabe que tem um problema
- Hero deve REVELAR o problema: "Você sabia que X% das pessoas sofrem com [problema]?"
- Use storytelling para criar consciência antes de apresentar solução
- Página mais longa: precisa educar antes de vender
- CTA inicial suave: "Descubra mais", "Entenda como"`,

  pain_aware: `### Copy por Consciência: Ciente da Dor
- O público SABE que tem um problema mas não sabe a solução
- Hero deve VALIDAR a dor: "Cansado de [problema]?"
- Use PAS (Problema-Agitação-Solução) como framework principal
- Apresente a solução como descoberta natural
- CTA orientado à solução: "Resolver Agora", "Descobrir a Solução"`,

  solution_aware: `### Copy por Consciência: Ciente da Solução
- O público sabe que existem soluções mas não conhece a sua
- Hero deve DIFERENCIAR: "A única [categoria] que [diferencial exclusivo]"
- Foco em comparativo e diferenciação
- Prova social e resultados específicos
- CTA comparativo: "Ver Por Que Somos Diferentes"`,

  product_aware: `### Copy por Consciência: Ciente do Produto
- O público CONHECE seu produto mas ainda não comprou
- Hero deve quebrar a OBJEÇÃO principal
- Foco em garantia, preço, oferta especial
- Depoimentos de pessoas similares ao lead
- CTA direto: "Comprar Agora", "Garantir o Meu"`,

  ready: `### Copy por Consciência: Pronto para Comprar
- O público QUER comprar — precisa apenas de confirmação e facilidade
- Hero deve confirmar a decisão: "Você está fazendo a escolha certa"
- Layout CURTO e DIRETO: preço + CTA logo no início
- Destaque para facilidades: parcelamento, frete, entrega rápida
- CTA urgente e confiante: "Finalizar Compra", "Comprar com Desconto"`,
};

export function getAwarenessCopyRules(level: AwarenessLevel): string {
  return AWARENESS_COPY_RULES[level] || AWARENESS_COPY_RULES.pain_aware;
}
