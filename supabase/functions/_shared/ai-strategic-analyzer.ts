// =============================================
// AI STRATEGIC ANALYZER - Análise de Contexto SIMPLIFICADA
// Retorna APENAS categorias/tipos - NUNCA textos prontos
// =============================================

import type { StrategicPlan } from './marketing/types.ts';
import { getIdealFramework, AVAILABLE_BLOCK_TYPES } from './marketing/frameworks.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Schema simplificado - apenas categorias, não textos
const createStrategicPlanSchema = {
  type: 'function' as const,
  function: {
    name: 'create_strategic_plan',
    description: 'Cria um plano estratégico identificando APENAS categorias e tipos - NUNCA textos literais',
    parameters: {
      type: 'object',
      properties: {
        productType: {
          type: 'string',
          enum: ['beauty_health', 'tech_tool', 'lifestyle', 'infoproduct', 'ecommerce_physical', 'service', 'saas'],
          description: 'Categoria do produto/serviço'
        },
        productCategory: {
          type: 'string',
          description: 'Categoria genérica do produto (ex: "shampoo anti-calvície", "curso de marketing", "software de gestão")'
        },
        audienceType: {
          type: 'string',
          description: 'Tipo de público em poucas palavras (ex: "homens 25-50 preocupados com aparência")'
        },
        framework: {
          type: 'string',
          enum: ['AIDA', 'PAS', 'BAB', 'PASTOR'],
          description: 'Framework de marketing ideal'
        },
        frameworkReason: {
          type: 'string',
          description: 'Justificativa curta para escolha do framework'
        },
        problemCategory: {
          type: 'string',
          description: 'Categoria do problema (ex: "autoestima", "produtividade", "saúde")'
        },
        solutionCategory: {
          type: 'string',
          description: 'Categoria da solução (ex: "tratamento capilar", "ferramenta digital", "suplementação")'
        },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              function: { 
                type: 'string', 
                enum: ['attention', 'interest', 'desire', 'action', 'problem', 'agitation', 'solution', 'testimonial', 'offer', 'guarantee', 'urgency', 'benefits', 'features', 'faq']
              },
              priority: { type: 'number' }
            },
            required: ['type', 'function', 'priority']
          }
        },
        confidence: {
          type: 'number',
          description: 'Confiança na análise de 0 a 1'
        },
        languageDetected: {
          type: 'string',
          description: 'Idioma detectado'
        }
      },
      required: ['productType', 'productCategory', 'audienceType', 'framework', 'frameworkReason', 'problemCategory', 'solutionCategory', 'sections', 'confidence', 'languageDetected']
    }
  }
};

// Prompt do sistema - APENAS categorização
const STRATEGIC_SYSTEM_PROMPT = `Você é um analista de marketing que CATEGORIZA páginas de vendas.

## SUA ÚNICA TAREFA
Identificar CATEGORIAS e TIPOS - NUNCA extrair textos literais.

## O QUE VOCÊ DEVE RETORNAR
- productType: categoria geral (beauty_health, tech_tool, etc.)
- productCategory: categoria específica ("shampoo anti-calvície", não "Shampoo Calvície Zero")
- audienceType: tipo de público ("homens 25-50", não descrição longa)
- problemCategory: categoria do problema ("autoestima", "queda de cabelo")
- solutionCategory: categoria da solução ("tratamento capilar")
- framework: AIDA, PAS, BAB ou PASTOR
- sections: blocos sugeridos

## O QUE VOCÊ NÃO DEVE FAZER
- NÃO extrair títulos, slogans ou textos da página
- NÃO copiar nomes de produtos
- NÃO extrair depoimentos
- NÃO incluir preços ou ofertas específicas

## EXEMPLOS DE CATEGORIZAÇÃO CORRETA

Página de shampoo anti-queda:
- productType: "beauty_health"
- productCategory: "shampoo para tratamento capilar masculino"
- audienceType: "homens adultos preocupados com calvície"
- problemCategory: "queda de cabelo e autoestima"
- solutionCategory: "tratamento capilar"

Página de curso de marketing:
- productType: "infoproduct"
- productCategory: "curso online de marketing digital"
- audienceType: "empreendedores iniciantes"
- problemCategory: "falta de vendas online"
- solutionCategory: "educação em marketing"`;

// Função principal de análise estratégica
export async function analyzePageStrategically(
  html: string,
  url: string,
  options?: {
    screenshotBase64?: string;
    maxHtmlLength?: number;
  }
): Promise<{ plan: StrategicPlan; rawResponse?: unknown }> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  // HTML mínimo apenas para identificar categoria
  const maxLength = options?.maxHtmlLength || 15000;
  const truncatedHtml = html.length > maxLength 
    ? html.slice(0, maxLength) + '\n\n[TRUNCADO]'
    : html;

  // Extrair apenas metadados estruturais
  const youtubeCount = (html.match(/youtube\.com|youtu\.be/gi) || []).length;
  const hasTestimonials = /depoimento|testimonial|review|cliente/i.test(html);
  const hasFaq = /faq|perguntas?\s*frequentes|dúvidas/i.test(html);

  const userPrompt = `## URL
${url}

## CONTEXTO ESTRUTURAL
- Vídeos: ${youtubeCount}
- Depoimentos: ${hasTestimonials ? 'Sim' : 'Não'}
- FAQ: ${hasFaq ? 'Sim' : 'Não'}

## HTML (apenas para CATEGORIZAR - NÃO extrair textos)
${truncatedHtml}

## SUA TAREFA
Identifique as CATEGORIAS:
1. Que TIPO de produto é? (categoria genérica, não nome específico)
2. Que TIPO de público é? (perfil demográfico)
3. Que TIPO de problema resolve? (categoria)
4. Que TIPO de solução oferece? (categoria)
5. Qual framework de marketing é ideal?

⚠️ RETORNE APENAS CATEGORIAS - NUNCA TEXTOS LITERAIS DA PÁGINA`;

  console.log('[Strategic Analyzer] Categorizando página...', { 
    url,
    htmlLength: html.length,
    youtubeCount,
    hasTestimonials,
    hasFaq
  });

  const startTime = Date.now();

  try {
    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: STRATEGIC_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [createStrategicPlanSchema],
        tool_choice: { type: 'function', function: { name: 'create_strategic_plan' } },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Strategic Analyzer] Erro na API:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit excedido. Tente novamente em alguns segundos.');
      }
      if (response.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos ao workspace.');
      }
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const data = await response.json();
    const elapsedMs = Date.now() - startTime;
    
    console.log('[Strategic Analyzer] Categorização concluída em', elapsedMs, 'ms');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_strategic_plan') {
      console.error('[Strategic Analyzer] Resposta inválida:', JSON.stringify(data).slice(0, 500));
      throw new Error('IA não retornou um plano estratégico válido');
    }

    let planArgs: Record<string, unknown>;
    try {
      planArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[Strategic Analyzer] Erro ao parsear argumentos:', toolCall.function.arguments);
      throw new Error('Erro ao processar resposta da IA');
    }

    // Converter para o formato StrategicPlan esperado
    const plan: StrategicPlan = {
      productType: planArgs.productType as StrategicPlan['productType'],
      productName: planArgs.productCategory as string || 'Produto',
      targetAudience: planArgs.audienceType as string || 'Clientes',
      framework: planArgs.framework as StrategicPlan['framework'],
      frameworkReason: planArgs.frameworkReason as string || '',
      // CATEGORIAS - não textos prontos
      mainPainPoint: planArgs.problemCategory as string || 'problema do cliente',
      mainPromise: planArgs.solutionCategory as string || 'solução eficaz',
      uniqueSellingProposition: planArgs.solutionCategory as string || 'diferencial único',
      sections: (planArgs.sections as StrategicPlan['sections']) || [
        { type: 'Hero', function: 'attention', priority: 1, extractionHints: [] },
        { type: 'ContentColumns', function: 'interest', priority: 2, extractionHints: [] },
        { type: 'Testimonials', function: 'testimonial', priority: 3, extractionHints: [] },
        { type: 'FAQ', function: 'faq', priority: 4, extractionHints: [] },
      ],
      conversionElements: [],
      confidence: planArgs.confidence as number || 0.7,
      languageDetected: planArgs.languageDetected as string || 'pt-BR',
    };

    console.log('[Strategic Analyzer] Plano criado:', {
      productType: plan.productType,
      productCategory: planArgs.productCategory,
      audienceType: planArgs.audienceType,
      framework: plan.framework,
      confidence: plan.confidence
    });

    return { plan, rawResponse: data };

  } catch (error) {
    console.error('[Strategic Analyzer] Erro:', error);
    throw error;
  }
}

// Função auxiliar para criar um plano de fallback
export function createFallbackPlan(url: string, html: string): StrategicPlan {
  const lowerHtml = html.toLowerCase();
  let productType: StrategicPlan['productType'] = 'ecommerce_physical';
  let productCategory = 'produto físico';
  let problemCategory = 'necessidade do cliente';
  let solutionCategory = 'solução prática';
  
  if (lowerHtml.includes('skincare') || lowerHtml.includes('beleza') || lowerHtml.includes('anti-idade') || lowerHtml.includes('cabelo') || lowerHtml.includes('calvic')) {
    productType = 'beauty_health';
    productCategory = 'produto de cuidados pessoais';
    problemCategory = 'autoestima e aparência';
    solutionCategory = 'tratamento especializado';
  } else if (lowerHtml.includes('curso') || lowerHtml.includes('ebook') || lowerHtml.includes('mentoria')) {
    productType = 'infoproduct';
    productCategory = 'curso ou mentoria online';
    problemCategory = 'falta de conhecimento';
    solutionCategory = 'educação especializada';
  } else if (lowerHtml.includes('software') || lowerHtml.includes('app') || lowerHtml.includes('ferramenta')) {
    productType = 'tech_tool';
    productCategory = 'ferramenta digital';
    problemCategory = 'ineficiência de processos';
    solutionCategory = 'automação e produtividade';
  }

  const framework = getIdealFramework(productType);

  return {
    productType,
    productName: productCategory,
    targetAudience: 'clientes interessados',
    framework,
    frameworkReason: 'Framework padrão para o tipo de produto detectado',
    mainPainPoint: problemCategory,
    mainPromise: solutionCategory,
    uniqueSellingProposition: solutionCategory,
    sections: [
      { type: 'Hero', function: 'attention', priority: 1, extractionHints: [] },
      { type: 'ContentColumns', function: 'interest', priority: 2, extractionHints: [] },
      { type: 'InfoHighlights', function: 'benefits', priority: 3, extractionHints: [] },
      { type: 'Testimonials', function: 'testimonial', priority: 4, extractionHints: [] },
      { type: 'FAQ', function: 'faq', priority: 5, extractionHints: [] },
    ],
    conversionElements: [],
    confidence: 0.3,
    languageDetected: 'pt-BR',
  };
}
