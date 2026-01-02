// =============================================
// AI STRATEGIC ANALYZER - Passo 1 do Sistema v5
// =============================================

import type { StrategicPlan } from './marketing/types.ts';
import { createStrategicPlanSchema } from './marketing/types.ts';
import { getIdealFramework, AVAILABLE_BLOCK_TYPES } from './marketing/frameworks.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Prompt do sistema para análise estratégica
const STRATEGIC_SYSTEM_PROMPT = `Você é um especialista em marketing digital e páginas de alta conversão.
Sua tarefa é analisar uma página de vendas e criar um PLANO ESTRATÉGICO para reconstruí-la.

## Sua Análise Deve Incluir

1. **IDENTIFICAR** o tipo de produto/serviço (beauty_health, tech_tool, lifestyle, infoproduct, ecommerce_physical, service, saas)
2. **DETECTAR** o público-alvo e suas dores principais
3. **ESCOLHER** o framework de marketing ideal:
   - **AIDA** (Atenção, Interesse, Desejo, Ação): Universal, bom para e-commerce geral
   - **PAS** (Problema, Agitação, Solução): Produtos que resolvem dores específicas
   - **BAB** (Before, After, Bridge): Transformações visuais (beleza, fitness, antes/depois)
   - **PASTOR** (Problema, Amplificar, Solução, Testemunhos, Oferta, Resposta): Infoprodutos e vendas complexas
4. **LISTAR** as seções principais e sua função no funil
5. **IDENTIFICAR** elementos de conversão (urgência, escassez, prova social, garantias, bônus)

## Tipos de Blocos Disponíveis para Extração

${AVAILABLE_BLOCK_TYPES.join(', ')}

## Regras Críticas

- Analise TODO o HTML para entender o contexto completo
- Seja específico nas dicas de extração (selectores CSS, textos chave)
- Priorize seções que convertem (Hero, Vídeos, Testimonials)
- Identifique TODOS os vídeos YouTube/Vimeo para agrupar em VideoCarousel
- Detecte depoimentos com nomes reais vs genéricos

## Output

Use a função create_strategic_plan para retornar o plano estratégico completo.`;

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

  const maxLength = options?.maxHtmlLength || 100000;
  const truncatedHtml = html.length > maxLength 
    ? html.slice(0, maxLength) + '\n\n[HTML TRUNCADO - Original: ' + html.length + ' chars]'
    : html;

  // Construir o prompt do usuário
  let userPrompt = `## URL da Página
${url}

## HTML da Página
${truncatedHtml}`;

  // Adicionar screenshot se disponível
  if (options?.screenshotBase64) {
    userPrompt += `\n\n## Screenshot
[Imagem da página anexada para referência visual]`;
  }

  userPrompt += `\n\n## Sua Tarefa
Analise esta página de vendas e crie um plano estratégico completo para importá-la.
Use a função create_strategic_plan para retornar sua análise.`;

  console.log('[Strategic Analyzer] Iniciando análise...', { 
    urlLength: url.length,
    htmlLength: html.length,
    truncatedLength: truncatedHtml.length,
    hasScreenshot: !!options?.screenshotBase64
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
        temperature: 0.3, // Baixa temperatura para consistência
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

    console.log('[Strategic Analyzer] Plano criado:', {
      productType: planArgs.productType,
      framework: planArgs.framework,
      sectionsCount: planArgs.sections.length,
      conversionElementsCount: planArgs.conversionElements?.length || 0,
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
  
  if (lowerHtml.includes('skincare') || lowerHtml.includes('beleza') || lowerHtml.includes('anti-idade')) {
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
    targetAudience: 'Público geral',
    framework,
    frameworkReason: 'Framework padrão para o tipo de produto detectado',
    mainPainPoint: 'Necessidade do cliente',
    mainPromise: 'Solução oferecida pelo produto',
    uniqueSellingProposition: 'Diferencial do produto',
    sections: [
      { type: 'Hero', function: 'attention', priority: 1, extractionHints: ['h1', 'hero', 'banner'] },
      { type: 'VideoCarousel', function: 'interest', priority: 2, extractionHints: ['youtube', 'video', 'iframe'] },
      { type: 'InfoHighlights', function: 'benefits', priority: 3, extractionHints: ['benefícios', 'vantagens', 'features'] },
      { type: 'Testimonials', function: 'testimonial', priority: 4, extractionHints: ['depoimentos', 'reviews', 'clientes'] },
      { type: 'FAQ', function: 'faq', priority: 5, extractionHints: ['faq', 'perguntas', 'dúvidas'] },
    ],
    conversionElements: [],
    confidence: 0.3,
    languageDetected: 'pt-BR',
  };
}
