// =============================================
// MARKETING TYPES - Sistema de Importação Enterprise v5
// =============================================

// Tipos de produto detectáveis
export type ProductType = 
  | 'beauty_health'      // Beleza, skincare, suplementos
  | 'tech_tool'          // Tecnologia, software, ferramentas
  | 'lifestyle'          // Lifestyle, moda, casa
  | 'infoproduct'        // Cursos, ebooks, mentorias
  | 'ecommerce_physical' // E-commerce de produtos físicos genéricos
  | 'service'            // Serviços
  | 'saas';              // Software as a Service

// Frameworks de marketing disponíveis
export type MarketingFramework = 'AIDA' | 'PAS' | 'BAB' | 'PASTOR';

// Função de cada bloco no funil de marketing
export type MarketingFunction = 
  | 'attention'     // Captura atenção inicial
  | 'interest'      // Gera interesse
  | 'desire'        // Cria desejo
  | 'action'        // Chamada para ação
  | 'problem'       // Apresenta o problema
  | 'agitation'     // Agita o problema
  | 'solution'      // Apresenta a solução
  | 'testimonial'   // Prova social
  | 'offer'         // Apresenta a oferta
  | 'guarantee'     // Garantia/segurança
  | 'urgency'       // Urgência/escassez
  | 'benefits'      // Benefícios
  | 'features'      // Características
  | 'faq';          // Perguntas frequentes

// Elemento de conversão identificado
export interface ConversionElement {
  type: 'urgency' | 'scarcity' | 'social_proof' | 'guarantee' | 'bonus' | 'discount';
  content: string;
  strength: 'weak' | 'medium' | 'strong';
}

// Seção identificada para extração
export interface IdentifiedSection {
  type: string;
  function: MarketingFunction;
  priority: number;
  extractionHints: string[];
  htmlSelector?: string;
}

// =============================================
// PASSO 1: ANÁLISE ESTRATÉGICA
// =============================================

export interface StrategicPlan {
  // Identificação do produto
  productType: ProductType;
  productName: string;
  targetAudience: string;
  
  // Análise de marketing
  framework: MarketingFramework;
  frameworkReason: string;
  mainPainPoint: string;
  mainPromise: string;
  uniqueSellingProposition: string;
  
  // Seções a extrair
  sections: IdentifiedSection[];
  
  // Elementos de conversão
  conversionElements: ConversionElement[];
  
  // Metadados
  confidence: number;
  languageDetected: string;
  platformDetected?: string;
}

// Schema para tool calling - create_strategic_plan
export const createStrategicPlanSchema = {
  type: 'function' as const,
  function: {
    name: 'create_strategic_plan',
    description: 'Cria um plano estratégico de importação baseado na análise da página',
    parameters: {
      type: 'object',
      properties: {
        productType: {
          type: 'string',
          enum: ['beauty_health', 'tech_tool', 'lifestyle', 'infoproduct', 'ecommerce_physical', 'service', 'saas'],
          description: 'Tipo do produto/serviço detectado'
        },
        productName: {
          type: 'string',
          description: 'Nome do produto principal'
        },
        targetAudience: {
          type: 'string',
          description: 'Descrição do público-alvo'
        },
        framework: {
          type: 'string',
          enum: ['AIDA', 'PAS', 'BAB', 'PASTOR'],
          description: 'Framework de marketing ideal para este produto'
        },
        frameworkReason: {
          type: 'string',
          description: 'Justificativa para escolha do framework'
        },
        mainPainPoint: {
          type: 'string',
          description: 'Principal dor/problema que o produto resolve'
        },
        mainPromise: {
          type: 'string',
          description: 'Principal promessa/benefício do produto'
        },
        uniqueSellingProposition: {
          type: 'string',
          description: 'O que diferencia este produto dos concorrentes'
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Tipo de bloco sugerido (Hero, VideoCarousel, Testimonials, etc.)' },
              function: { 
                type: 'string', 
                enum: ['attention', 'interest', 'desire', 'action', 'problem', 'agitation', 'solution', 'testimonial', 'offer', 'guarantee', 'urgency', 'benefits', 'features', 'faq'],
                description: 'Função desta seção no funil'
              },
              priority: { type: 'number', description: 'Prioridade de 1 (mais importante) a 10' },
              extractionHints: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Dicas para identificar esta seção no HTML'
              }
            },
            required: ['type', 'function', 'priority', 'extractionHints']
          },
          description: 'Seções identificadas para extração, em ordem de importância'
        },
        conversionElements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string', 
                enum: ['urgency', 'scarcity', 'social_proof', 'guarantee', 'bonus', 'discount'],
                description: 'Tipo do elemento de conversão'
              },
              content: { type: 'string', description: 'Conteúdo do elemento' },
              strength: { type: 'string', enum: ['weak', 'medium', 'strong'], description: 'Força do elemento' }
            },
            required: ['type', 'content', 'strength']
          },
          description: 'Elementos de conversão identificados na página'
        },
        confidence: {
          type: 'number',
          description: 'Confiança na análise de 0 a 1'
        },
        languageDetected: {
          type: 'string',
          description: 'Idioma detectado (pt-BR, en, es, etc.)'
        },
        platformDetected: {
          type: 'string',
          description: 'Plataforma detectada se identificável (Shopify, Nuvemshop, etc.)'
        }
      },
      required: ['productType', 'productName', 'targetAudience', 'framework', 'frameworkReason', 'mainPainPoint', 'mainPromise', 'uniqueSellingProposition', 'sections', 'conversionElements', 'confidence', 'languageDetected']
    }
  }
};

// =============================================
// PASSO 2: EXTRAÇÃO DE CONTEÚDO
// =============================================

export interface ExtractedBlock {
  type: string;
  props: Record<string, unknown>;
  marketingFunction: MarketingFunction;
  order: number;
  confidence: number;
}

export interface ExtractionResult {
  blocks: ExtractedBlock[];
  extractionQuality: number;
  warnings: string[];
  videosGrouped: boolean;
  testimonialsWithRealNames: boolean;
}

// Schema para tool calling - extract_page_blocks
export const extractPageBlocksSchema = {
  type: 'function' as const,
  function: {
    name: 'extract_page_blocks',
    description: 'Extrai o conteúdo da página para blocos nativos seguindo o plano estratégico',
    parameters: {
      type: 'object',
      properties: {
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { 
                type: 'string',
                description: 'Tipo do bloco (Hero, YouTubeVideo, VideoCarousel, InfoHighlights, Testimonials, FAQ, CountdownTimer, StatsNumbers, ContentColumns, BeforeAfter, RichText, Image, Button, etc.)'
              },
              props: {
                type: 'object',
                description: 'Propriedades do bloco com conteúdo REAL extraído da página'
              },
              marketingFunction: {
                type: 'string',
                enum: ['attention', 'interest', 'desire', 'action', 'problem', 'agitation', 'solution', 'testimonial', 'offer', 'guarantee', 'urgency', 'benefits', 'features', 'faq'],
                description: 'Função deste bloco no funil de marketing'
              },
              order: {
                type: 'number',
                description: 'Ordem do bloco na página (1 = primeiro)'
              },
              confidence: {
                type: 'number',
                description: 'Confiança na extração de 0 a 1'
              }
            },
            required: ['type', 'props', 'marketingFunction', 'order', 'confidence']
          },
          description: 'Blocos extraídos em ordem estratégica'
        },
        extractionQuality: {
          type: 'number',
          description: 'Qualidade geral da extração de 0 a 100'
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Avisos sobre problemas encontrados durante a extração'
        },
        videosGrouped: {
          type: 'boolean',
          description: 'Se múltiplos vídeos foram agrupados em VideoCarousel'
        },
        testimonialsWithRealNames: {
          type: 'boolean',
          description: 'Se os depoimentos têm nomes reais (não genéricos como "Cliente 1")'
        }
      },
      required: ['blocks', 'extractionQuality', 'warnings', 'videosGrouped', 'testimonialsWithRealNames']
    }
  }
};

// =============================================
// PASSO 3: OTIMIZAÇÃO
// =============================================

export interface MissingElement {
  type: string;
  reason: string;
  impact: 'high' | 'medium' | 'low';
  suggestedPosition: number;
}

export interface BlockOptimization {
  blockIndex: number;
  changes: Record<string, unknown>;
  reason: string;
}

export interface OptimizationResult {
  qualityScore: number;
  frameworkCompliance: number;
  issues: string[];
  suggestions: string[];
  missingElements: MissingElement[];
  optimizedBlocks?: BlockOptimization[];
}

// Schema para tool calling - optimize_page
export const optimizePageSchema = {
  type: 'function' as const,
  function: {
    name: 'optimize_page',
    description: 'Otimiza os blocos extraídos para máxima conversão',
    parameters: {
      type: 'object',
      properties: {
        qualityScore: {
          type: 'number',
          description: 'Score de qualidade geral de 0 a 100'
        },
        frameworkCompliance: {
          type: 'number',
          description: 'Aderência ao framework de marketing escolhido de 0 a 100'
        },
        issues: {
          type: 'array',
          items: { type: 'string' },
          description: 'Problemas identificados na estrutura atual'
        },
        suggestions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sugestões de melhoria para aumentar conversão'
        },
        missingElements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Tipo de elemento faltante' },
              reason: { type: 'string', description: 'Por que este elemento aumentaria conversão' },
              impact: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Impacto esperado' },
              suggestedPosition: { type: 'number', description: 'Posição sugerida na página' }
            },
            required: ['type', 'reason', 'impact', 'suggestedPosition']
          },
          description: 'Elementos que aumentariam a conversão se adicionados'
        },
        optimizedBlocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              blockIndex: { type: 'number', description: 'Índice do bloco a otimizar' },
              changes: { type: 'object', description: 'Mudanças sugeridas nas props' },
              reason: { type: 'string', description: 'Justificativa da mudança' }
            },
            required: ['blockIndex', 'changes', 'reason']
          },
          description: 'Blocos com sugestões de otimização'
        }
      },
      required: ['qualityScore', 'frameworkCompliance', 'issues', 'suggestions', 'missingElements']
    }
  }
};

// =============================================
// RESULTADO FINAL DA IMPORTAÇÃO
// =============================================

export interface ImportV5Result {
  success: boolean;
  page?: {
    id: string;
    title: string;
    slug: string;
  };
  strategicPlan?: StrategicPlan;
  extraction?: ExtractionResult;
  optimization?: OptimizationResult;
  stats?: {
    blocksCreated: number;
    aiCallsCount: number;
    processingTimeMs: number;
  };
  error?: string;
}
