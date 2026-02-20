// =============================================
// AI MARKETING OPTIMIZER - Passo 3 do Sistema v5
// =============================================

import type { StrategicPlan, ExtractionResult, OptimizationResult, ExtractedBlock } from './marketing/types.ts';
import { optimizePageSchema } from './marketing/types.ts';
import { FRAMEWORKS, validateFrameworkCompliance } from './marketing/frameworks.ts';
import { aiChatCompletion, resetAIRouterCache } from './ai-router.ts';

// Prompt do sistema para otimização
const OPTIMIZATION_SYSTEM_PROMPT = `Você é um copywriter especialista em conversão e páginas de alta performance.
Sua tarefa é analisar os blocos extraídos e sugerir otimizações para máxima conversão.

## Sua Análise Deve Avaliar

1. **Conformidade com o Framework**: Os blocos seguem a ordem e estrutura do framework escolhido?
2. **Elementos de Conversão**: Há elementos de urgência, escassez, prova social, garantias?
3. **Qualidade do Conteúdo**: Os textos são persuasivos? Os depoimentos são reais?
4. **Estrutura da Página**: Hero atrativo? CTA claro? FAQ para objeções?
5. **Elementos Faltantes**: O que aumentaria a conversão se adicionado?

## Critérios de Pontuação (0-100)

- **90-100**: Página excelente, pronta para converter
- **70-89**: Boa página, pequenos ajustes necessários
- **50-69**: Página média, precisa de melhorias
- **30-49**: Página fraca, muitas oportunidades perdidas
- **0-29**: Página problemática, reconstrução necessária

## Elementos Essenciais por Framework

### AIDA
- Hero impactante (Atenção)
- Vídeo ou imagens de qualidade (Interesse)
- Benefícios claros e depoimentos (Desejo)
- CTA visível e urgência (Ação)

### PAS
- Apresentação clara do problema
- Amplificação da dor (estatísticas, consequências)
- Solução como resposta natural
- CTA que alivia a dor

### BAB
- Situação "Antes" claramente mostrada
- Transformação "Depois" visualmente atraente
- Produto como ponte
- Prova social com resultados

### PASTOR
- Problema bem definido
- Amplificação emocional
- Solução detalhada
- Testemunhos fortes
- Oferta irrecusável
- Chamada para ação urgente

## Output

Use a função optimize_page para retornar sua análise e sugestões.`;

// Função principal de otimização
export async function optimizePage(
  strategicPlan: StrategicPlan,
  extraction: ExtractionResult,
  options?: {
    skipIfHighQuality?: boolean;
  }
): Promise<{ result: OptimizationResult; rawResponse?: unknown }> {
  // Se a qualidade já é alta e skipIfHighQuality está ativado, retornar otimização básica
  if (options?.skipIfHighQuality && extraction.extractionQuality >= 85) {
    console.log('[Marketing Optimizer] Qualidade alta, pulando otimização de IA');
    return {
      result: createQuickOptimization(strategicPlan, extraction),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  resetAIRouterCache();

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Construir resumo dos blocos para o prompt
  const blocksummary = extraction.blocks.map((block, i) => 
    `${i + 1}. ${block.type} (${block.marketingFunction}) - Confiança: ${Math.round(block.confidence * 100)}%`
  ).join('\n');

  const userPrompt = `## CONTEXTO

**Framework:** ${strategicPlan.framework} - ${frameworkDef.fullName}
**Tipo de Produto:** ${strategicPlan.productType}
**Produto:** ${strategicPlan.productName}
**Público-Alvo:** ${strategicPlan.targetAudience}
**Dor Principal:** ${strategicPlan.mainPainPoint}
**Promessa Principal:** ${strategicPlan.mainPromise}

## BLOCOS EXTRAÍDOS

${blocksummary}

### Detalhes dos Blocos
\`\`\`json
${JSON.stringify(extraction.blocks.map(b => ({ type: b.type, props: b.props })), null, 2).slice(0, 10000)}
\`\`\`

## MÉTRICAS DA EXTRAÇÃO

- Qualidade da Extração: ${extraction.extractionQuality}/100
- Vídeos Agrupados: ${extraction.videosGrouped ? 'Sim' : 'Não'}
- Depoimentos com Nomes Reais: ${extraction.testimonialsWithRealNames ? 'Sim' : 'Não'}
- Avisos: ${extraction.warnings.length > 0 ? extraction.warnings.join(', ') : 'Nenhum'}

## SUA TAREFA

1. Avalie a conformidade com o framework ${strategicPlan.framework}
2. Identifique problemas e oportunidades
3. Sugira melhorias específicas
4. Liste elementos faltantes que aumentariam conversão
5. Calcule o score de qualidade (0-100)

Use a função optimize_page para retornar sua análise.`;

  console.log('[Marketing Optimizer] Iniciando otimização...', { 
    framework: strategicPlan.framework,
    blocksCount: extraction.blocks.length,
    currentQuality: extraction.extractionQuality
  });

  const startTime = Date.now();

  try {
    const response = await aiChatCompletion('google/gemini-2.5-flash', {
      messages: [
        { role: 'system', content: OPTIMIZATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      tools: [optimizePageSchema],
      tool_choice: { type: 'function', function: { name: 'optimize_page' } },
      temperature: 0.4,
    }, {
      supabaseUrl,
      supabaseServiceKey,
      logPrefix: '[Marketing Optimizer]',
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Marketing Optimizer] Erro na API:', response.status, errorText);
      
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
    
    console.log('[Marketing Optimizer] Resposta recebida em', elapsedMs, 'ms');

    // Extrair argumentos da função
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'optimize_page') {
      console.error('[Marketing Optimizer] Resposta inválida:', JSON.stringify(data).slice(0, 500));
      // Retornar otimização básica em caso de falha
      return { result: createQuickOptimization(strategicPlan, extraction) };
    }

    let optimizationArgs: OptimizationResult;
    try {
      optimizationArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[Marketing Optimizer] Erro ao parsear argumentos:', toolCall.function.arguments);
      return { result: createQuickOptimization(strategicPlan, extraction) };
    }

    console.log('[Marketing Optimizer] Otimização concluída:', {
      qualityScore: optimizationArgs.qualityScore,
      frameworkCompliance: optimizationArgs.frameworkCompliance,
      issuesCount: optimizationArgs.issues?.length || 0,
      suggestionsCount: optimizationArgs.suggestions?.length || 0,
      missingElementsCount: optimizationArgs.missingElements?.length || 0
    });

    return { result: optimizationArgs, rawResponse: data };

  } catch (error) {
    console.error('[Marketing Optimizer] Erro:', error);
    // Retornar otimização básica em caso de erro
    return { result: createQuickOptimization(strategicPlan, extraction) };
  }
}

// Cria uma otimização rápida sem chamar IA
function createQuickOptimization(
  strategicPlan: StrategicPlan,
  extraction: ExtractionResult
): OptimizationResult {
  const { score, issues } = validateFrameworkCompliance(
    extraction.blocks,
    strategicPlan.framework
  );

  const suggestions: string[] = [];
  const missingElements: OptimizationResult['missingElements'] = [];

  // Verificar elementos essenciais
  const blockTypes = extraction.blocks.map(b => b.type);

  if (!blockTypes.includes('Testimonials')) {
    suggestions.push('Adicionar depoimentos de clientes para aumentar prova social');
    missingElements.push({
      type: 'Testimonials',
      reason: 'Prova social aumenta confiança e conversão',
      impact: 'high',
      suggestedPosition: Math.floor(extraction.blocks.length * 0.7)
    });
  }

  if (!blockTypes.includes('FAQ')) {
    suggestions.push('Adicionar FAQ para eliminar objeções comuns');
    missingElements.push({
      type: 'FAQ',
      reason: 'FAQ reduz objeções e aumenta confiança',
      impact: 'medium',
      suggestedPosition: extraction.blocks.length - 1
    });
  }

  if (!blockTypes.includes('CountdownTimer') && !blockTypes.includes('Button')) {
    suggestions.push('Adicionar elemento de urgência ou CTA claro');
    missingElements.push({
      type: 'Button',
      reason: 'CTA claro é essencial para conversão',
      impact: 'high',
      suggestedPosition: extraction.blocks.length
    });
  }

  // Calcular score baseado na extração
  let qualityScore = extraction.extractionQuality;
  
  if (extraction.testimonialsWithRealNames) qualityScore += 5;
  if (extraction.videosGrouped) qualityScore += 3;
  if (blockTypes.includes('Hero')) qualityScore += 5;
  if (blockTypes.includes('Testimonials')) qualityScore += 5;
  
  qualityScore = Math.min(100, qualityScore);

  return {
    qualityScore,
    frameworkCompliance: score,
    issues,
    suggestions,
    missingElements,
  };
}

// Aplica otimizações aos blocos
export function applyOptimizations(
  blocks: ExtractedBlock[],
  optimization: OptimizationResult
): ExtractedBlock[] {
  if (!optimization.optimizedBlocks || optimization.optimizedBlocks.length === 0) {
    return blocks;
  }

  const optimizedBlocks = [...blocks];

  for (const opt of optimization.optimizedBlocks) {
    if (opt.blockIndex >= 0 && opt.blockIndex < optimizedBlocks.length) {
      optimizedBlocks[opt.blockIndex] = {
        ...optimizedBlocks[opt.blockIndex],
        props: {
          ...optimizedBlocks[opt.blockIndex].props,
          ...opt.changes,
        },
      };
    }
  }

  return optimizedBlocks;
}
