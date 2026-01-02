// =============================================
// MARKETING FRAMEWORKS - Definições e Ordenação
// =============================================

import type { MarketingFramework, MarketingFunction, ProductType } from './types.ts';

// Definição de cada framework de marketing
export interface FrameworkDefinition {
  name: MarketingFramework;
  fullName: string;
  description: string;
  stages: MarketingFunction[];
  idealFor: ProductType[];
  blockOrder: string[];
}

// AIDA: Atenção, Interesse, Desejo, Ação
// Universal, funciona para quase tudo
export const AIDA: FrameworkDefinition = {
  name: 'AIDA',
  fullName: 'Atenção, Interesse, Desejo, Ação',
  description: 'Framework clássico e universal. Captura atenção, gera interesse, cria desejo e converte.',
  stages: ['attention', 'interest', 'desire', 'action'],
  idealFor: ['ecommerce_physical', 'lifestyle', 'tech_tool', 'saas'],
  blockOrder: [
    // ATENÇÃO - Captura inicial
    'Hero',
    'VideoCarousel',
    'YouTubeVideo',
    
    // INTERESSE - Gera curiosidade
    'InfoHighlights',
    'StatsNumbers',
    'ContentColumns',
    'Features',
    
    // DESEJO - Cria vontade
    'BeforeAfter',
    'Testimonials',
    'ImageGallery',
    'ProductShowcase',
    
    // AÇÃO - Converte
    'FAQ',
    'CountdownTimer',
    'PricingTable',
    'Button',
  ]
};

// PAS: Problema, Agitação, Solução
// Ótimo para produtos que resolvem dores específicas
export const PAS: FrameworkDefinition = {
  name: 'PAS',
  fullName: 'Problema, Agitação, Solução',
  description: 'Identifica o problema, amplifica a dor e apresenta a solução. Ideal para produtos que resolvem dores.',
  stages: ['problem', 'agitation', 'solution', 'action'],
  idealFor: ['tech_tool', 'saas', 'service', 'infoproduct'],
  blockOrder: [
    // PROBLEMA - Identifica a dor
    'Hero',
    'ContentColumns',
    'RichText',
    
    // AGITAÇÃO - Amplifica o problema
    'StatsNumbers',
    'InfoHighlights',
    
    // SOLUÇÃO - Apresenta a resposta
    'VideoCarousel',
    'YouTubeVideo',
    'Features',
    'BeforeAfter',
    'Testimonials',
    
    // AÇÃO - Converte
    'FAQ',
    'PricingTable',
    'CountdownTimer',
    'Button',
  ]
};

// BAB: Before, After, Bridge (Antes, Depois, Ponte)
// Perfeito para transformações visuais
export const BAB: FrameworkDefinition = {
  name: 'BAB',
  fullName: 'Before, After, Bridge (Antes, Depois, Ponte)',
  description: 'Mostra o antes e o depois, com o produto como ponte. Perfeito para transformações visuais.',
  stages: ['problem', 'solution', 'desire', 'action'],
  idealFor: ['beauty_health', 'lifestyle'],
  blockOrder: [
    // ANTES - Situação atual (problema)
    'Hero',
    'ContentColumns',
    
    // DEPOIS - Resultado desejado
    'BeforeAfter',
    'VideoCarousel',
    'YouTubeVideo',
    'ImageGallery',
    
    // PONTE - Como chegar lá
    'InfoHighlights',
    'Features',
    'StatsNumbers',
    'Testimonials',
    
    // AÇÃO - Converte
    'FAQ',
    'CountdownTimer',
    'Button',
  ]
};

// PASTOR: Problema, Amplificar, Solução, Testemunhos, Oferta, Resposta
// Completo para infoprodutos e vendas complexas
export const PASTOR: FrameworkDefinition = {
  name: 'PASTOR',
  fullName: 'Problema, Amplificar, Solução, Testemunhos, Oferta, Resposta',
  description: 'Framework completo para vendas complexas. Ideal para infoprodutos e serviços de alto valor.',
  stages: ['problem', 'agitation', 'solution', 'testimonial', 'offer', 'action'],
  idealFor: ['infoproduct', 'service'],
  blockOrder: [
    // PROBLEMA
    'Hero',
    'ContentColumns',
    
    // AMPLIFICAR
    'StatsNumbers',
    'RichText',
    
    // SOLUÇÃO
    'VideoCarousel',
    'YouTubeVideo',
    'Features',
    'InfoHighlights',
    
    // TESTEMUNHOS
    'Testimonials',
    'BeforeAfter',
    
    // OFERTA
    'PricingTable',
    'ContentColumns',
    'Bonus',
    
    // RESPOSTA (FAQ + CTA)
    'FAQ',
    'CountdownTimer',
    'Button',
  ]
};

// Mapa de frameworks
export const FRAMEWORKS: Record<MarketingFramework, FrameworkDefinition> = {
  AIDA,
  PAS,
  BAB,
  PASTOR,
};

// Determina o framework ideal baseado no tipo de produto
export function getIdealFramework(productType: ProductType): MarketingFramework {
  switch (productType) {
    case 'beauty_health':
      return 'BAB'; // Transformações visuais
    case 'infoproduct':
      return 'PASTOR'; // Vendas complexas
    case 'tech_tool':
    case 'saas':
      return 'PAS'; // Resolve problemas
    case 'service':
      return 'PASTOR'; // Vendas complexas
    case 'lifestyle':
    case 'ecommerce_physical':
    default:
      return 'AIDA'; // Universal
  }
}

// Ordena blocos conforme o framework escolhido
export function orderBlocksByFramework(
  blocks: Array<{ type: string; marketingFunction?: MarketingFunction }>,
  framework: MarketingFramework
): Array<{ type: string; marketingFunction?: MarketingFunction; order: number }> {
  const frameworkDef = FRAMEWORKS[framework];
  const blockOrder = frameworkDef.blockOrder;
  
  return blocks
    .map(block => {
      const orderIndex = blockOrder.indexOf(block.type);
      return {
        ...block,
        order: orderIndex >= 0 ? orderIndex : 999
      };
    })
    .sort((a, b) => a.order - b.order);
}

// Valida se a estrutura segue o framework
export function validateFrameworkCompliance(
  blocks: Array<{ type: string; marketingFunction?: MarketingFunction }>,
  framework: MarketingFramework
): { score: number; issues: string[] } {
  const frameworkDef = FRAMEWORKS[framework];
  const issues: string[] = [];
  let score = 100;
  
  // Verifica se tem Hero no início
  if (blocks.length > 0 && blocks[0].type !== 'Hero') {
    issues.push('Página não começa com Hero - pode perder atenção inicial');
    score -= 10;
  }
  
  // Verifica se tem CTA no final
  const lastBlocks = blocks.slice(-3).map(b => b.type);
  if (!lastBlocks.includes('Button') && !lastBlocks.includes('CountdownTimer')) {
    issues.push('Página não termina com chamada para ação clara');
    score -= 15;
  }
  
  // Verifica prova social
  const hasTestimonials = blocks.some(b => b.type === 'Testimonials');
  if (!hasTestimonials) {
    issues.push('Falta prova social (depoimentos)');
    score -= 10;
  }
  
  // Verifica FAQ
  const hasFAQ = blocks.some(b => b.type === 'FAQ');
  if (!hasFAQ) {
    issues.push('Falta FAQ para eliminar objeções');
    score -= 5;
  }
  
  // Validações específicas por framework
  switch (framework) {
    case 'BAB':
      if (!blocks.some(b => b.type === 'BeforeAfter')) {
        issues.push('Framework BAB requer seção Antes/Depois');
        score -= 20;
      }
      break;
      
    case 'PASTOR':
      if (!hasTestimonials) {
        issues.push('Framework PASTOR requer testemunhos fortes');
        score -= 15;
      }
      break;
      
    case 'PAS':
      if (!blocks.some(b => b.marketingFunction === 'problem')) {
        issues.push('Framework PAS requer apresentação clara do problema');
        score -= 15;
      }
      break;
  }
  
  return { score: Math.max(0, score), issues };
}

// Tipos de blocos disponíveis para extração
export const AVAILABLE_BLOCK_TYPES = [
  // Layout
  'Section',
  'Container',
  'Columns',
  'Spacer',
  'Divider',
  
  // Conteúdo principal
  'Hero',
  'RichText',
  'Image',
  'Button',
  
  // Vídeo
  'YouTubeVideo',
  'VideoCarousel',
  
  // Prova social
  'Testimonials',
  'StatsNumbers',
  
  // Informação
  'InfoHighlights',
  'Features',
  'FAQ',
  'ContentColumns',
  
  // Transformação
  'BeforeAfter',
  'ImageGallery',
  
  // Conversão
  'CountdownTimer',
  'PricingTable',
  
  // Produto
  'ProductShowcase',
  'BuyTogether',
] as const;

// Mapeamento de blocos para funções de marketing
export const BLOCK_MARKETING_FUNCTIONS: Record<string, MarketingFunction[]> = {
  Hero: ['attention'],
  YouTubeVideo: ['attention', 'interest'],
  VideoCarousel: ['attention', 'interest', 'desire'],
  InfoHighlights: ['interest', 'benefits', 'features'],
  Features: ['interest', 'features'],
  StatsNumbers: ['interest', 'desire'],
  ContentColumns: ['interest', 'problem', 'solution'],
  BeforeAfter: ['desire', 'solution'],
  Testimonials: ['desire', 'testimonial'],
  ImageGallery: ['desire'],
  FAQ: ['faq', 'action'],
  CountdownTimer: ['urgency', 'action'],
  PricingTable: ['offer', 'action'],
  Button: ['action'],
  RichText: ['interest', 'problem', 'solution'],
  ProductShowcase: ['desire', 'offer'],
};
