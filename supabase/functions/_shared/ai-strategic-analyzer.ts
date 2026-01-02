// =============================================
// AI STRATEGIC ANALYZER - Análise de Contexto
// NÃO extrai conteúdo - apenas ANALISA estrutura e negócio
// =============================================

import type { StrategicPlan } from './marketing/types.ts';
import { createStrategicPlanSchema } from './marketing/types.ts';
import { getIdealFramework, AVAILABLE_BLOCK_TYPES } from './marketing/frameworks.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Prompt do sistema para análise estratégica
const STRATEGIC_SYSTEM_PROMPT = `Você é um especialista em marketing digital e análise de negócios.
Sua tarefa é ANALISAR uma página de vendas e identificar o CONTEXTO DO NEGÓCIO.

## ⚠️ REGRA CRÍTICA: VOCÊ NÃO EXTRAI CONTEÚDO!

Você NÃO deve extrair:
- Títulos literais da página
- Textos de depoimentos
- Descrições de produtos
- Nenhum texto literal da página

Você DEVE identificar:
- O tipo de negócio/produto
- O público-alvo
- As dores que o produto resolve
- A promessa principal
- O diferencial competitivo
- O framework de marketing ideal

## Sua Análise Deve Incluir

1. **TIPO DE PRODUTO**: (beauty_health, tech_tool, lifestyle, infoproduct, ecommerce_physical, service, saas)
2. **PÚBLICO-ALVO**: Descreva em 1-2 frases quem é o cliente ideal
3. **DOR PRINCIPAL**: Qual problema o produto resolve?
4. **PROMESSA**: O que o cliente ganha ao comprar?
5. **USP**: Qual o diferencial único deste produto?
6. **FRAMEWORK**: Qual framework de marketing é ideal?
   - **AIDA**: Universal, bom para e-commerce geral
   - **PAS**: Produtos que resolvem dores específicas
   - **BAB**: Transformações visuais (beleza, fitness)
   - **PASTOR**: Infoprodutos e vendas complexas

## Frameworks de Marketing

- **AIDA** (Atenção, Interesse, Desejo, Ação): Para produtos gerais
- **PAS** (Problema, Agitação, Solução): Para produtos que resolvem dores
- **BAB** (Before, After, Bridge): Para transformações
- **PASTOR** (Problema, Amplificar, Solução, Testemunhos, Oferta, Resposta): Para infoprodutos

## Tipos de Blocos Disponíveis

${AVAILABLE_BLOCK_TYPES.join(', ')}

## Output

Use a função create_strategic_plan para retornar sua ANÁLISE.
Lembre-se: você analisa o contexto, não extrai conteúdo literal.`;

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

  // HTML mínimo apenas para contexto - não para extração
  const maxLength = options?.maxHtmlLength || 30000;
  const truncatedHtml = html.length > maxLength 
    ? html.slice(0, maxLength) + '\n\n[TRUNCADO]'
    : html;

  // Extrair apenas metadados básicos para contexto
  const youtubeCount = (html.match(/youtube\.com|youtu\.be/gi) || []).length;
  const hasTestimonials = /depoimento|testimonial|review|cliente/i.test(html);
  const hasFaq = /faq|perguntas?\s*frequentes|dúvidas/i.test(html);

  // Construir o prompt do usuário
  const userPrompt = `## URL da Página
${url}

## Contexto Estrutural (NÃO extraia textos!)
- Vídeos YouTube detectados: ${youtubeCount}
- Seção de depoimentos detectada: ${hasTestimonials ? 'Sim' : 'Não'}
- Seção de FAQ detectada: ${hasFaq ? 'Sim' : 'Não'}

## HTML (apenas para entender o TIPO de negócio)
${truncatedHtml}

## Sua Tarefa

ANALISE esta página e identifique:
1. Que tipo de produto/serviço é vendido?
2. Quem é o público-alvo?
3. Qual dor o produto resolve?
4. Qual é a promessa principal?
5. Qual o diferencial único?
6. Qual framework de marketing é ideal?

⚠️ NÃO EXTRAIA TEXTOS LITERAIS DA PÁGINA!
Você deve COMPREENDER o negócio e descrever em suas próprias palavras.

Use a função create_strategic_plan para retornar sua análise.`;

  console.log('[Strategic Analyzer] Iniciando análise de contexto...', { 
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
    
    console.log('[Strategic Analyzer] Resposta recebida em', elapsedMs, 'ms');

    // Extrair argumentos da função
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'create_strategic_plan') {
      console.error('[Strategic Analyzer] Resposta inválida:', JSON.stringify(data).slice(0, 500));
      throw new Error('IA não retornou um plano estratégico válido');
    }

    let planArgs: StrategicPlan;
    try {
      planArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[Strategic Analyzer] Erro ao parsear argumentos:', toolCall.function.arguments);
      throw new Error('Erro ao processar resposta da IA');
    }

    // Validar campos obrigatórios
    if (!planArgs.productType || !planArgs.framework || !planArgs.sections) {
      console.error('[Strategic Analyzer] Plano incompleto:', planArgs);
      throw new Error('Plano estratégico incompleto');
    }

    console.log('[Strategic Analyzer] Análise concluída:', {
      productType: planArgs.productType,
      framework: planArgs.framework,
      sectionsCount: planArgs.sections.length,
      confidence: planArgs.confidence
    });

    return { plan: planArgs, rawResponse: data };

  } catch (error) {
    console.error('[Strategic Analyzer] Erro:', error);
    throw error;
  }
}

// Função auxiliar para criar um plano de fallback
export function createFallbackPlan(url: string, html: string): StrategicPlan {
  // Detectar tipo de produto por keywords simples
  const lowerHtml = html.toLowerCase();
  let productType: StrategicPlan['productType'] = 'ecommerce_physical';
  
  if (lowerHtml.includes('skincare') || lowerHtml.includes('beleza') || lowerHtml.includes('anti-idade') || lowerHtml.includes('cabelo')) {
    productType = 'beauty_health';
  } else if (lowerHtml.includes('curso') || lowerHtml.includes('ebook') || lowerHtml.includes('mentoria')) {
    productType = 'infoproduct';
  } else if (lowerHtml.includes('software') || lowerHtml.includes('app') || lowerHtml.includes('ferramenta')) {
    productType = 'tech_tool';
  }

  const framework = getIdealFramework(productType);

  return {
    productType,
    productName: 'Produto',
    targetAudience: 'Clientes interessados em soluções de qualidade',
    framework,
    frameworkReason: 'Framework padrão para o tipo de produto detectado',
    mainPainPoint: 'Busca por uma solução eficaz',
    mainPromise: 'Resultados comprovados e satisfação garantida',
    uniqueSellingProposition: 'Qualidade e eficácia comprovadas',
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
