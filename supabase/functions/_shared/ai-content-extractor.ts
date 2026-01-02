// =============================================
// AI CONTENT EXTRACTOR - Passo 2 do Sistema v5
// =============================================

import type { StrategicPlan, ExtractionResult, ExtractedBlock } from './marketing/types.ts';
import { extractPageBlocksSchema } from './marketing/types.ts';
import { FRAMEWORKS, BLOCK_MARKETING_FUNCTIONS } from './marketing/frameworks.ts';

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

// Prompt do sistema para extração de conteúdo
const EXTRACTION_SYSTEM_PROMPT = `Você é um especialista em extração de conteúdo de páginas web.
Recebeu um PLANO ESTRATÉGICO e deve extrair o conteúdo para blocos nativos.

## REGRAS CRÍTICAS

1. **NUNCA** use conteúdo genérico:
   - ❌ "Cliente 1", "Cliente satisfeito", "João S."
   - ❌ "Excelente produto!", "Muito bom!", "Recomendo!"
   - ✅ Extraia nomes REAIS: "Maria Fernanda Silva", "Carlos Eduardo"
   - ✅ Extraia depoimentos REAIS: O texto completo que está na página

2. **AGRUPE** múltiplos vídeos YouTube em um único VideoCarousel:
   - Se encontrar 3 vídeos YouTube, crie UM bloco VideoCarousel com 3 items
   - Cada item tem: url, title (extraído do HTML), thumbnail (se disponível)

3. **IGNORE** ruído de interface:
   - Cookies, LGPD, popups
   - Controles de player de vídeo
   - Menus de navegação
   - Headers e footers genéricos

4. **SIGA** a ordem do framework de marketing:
   - Os blocos devem seguir a ordem estratégica definida
   - Hero sempre primeiro
   - CTA/Button sempre por último

5. **EXTRAIA** URLs completas:
   - Imagens: URLs absolutas ou relativas
   - Vídeos: URLs do YouTube/Vimeo
   - Links: URLs de destino

## Tipos de Blocos e Suas Props

### Hero
{ title, subtitle, imageDesktop, imageMobile, buttonText, buttonUrl, alignment }

### YouTubeVideo
{ url, title, autoplay }

### VideoCarousel
{ items: [{ url, title, thumbnail }], autoplay }

### InfoHighlights
{ items: [{ icon, title, description }], columns, variant }

### Testimonials
{ items: [{ name, text, rating, avatar, location }], variant }

### FAQ
{ items: [{ question, answer }], variant }

### StatsNumbers
{ items: [{ value, label, prefix, suffix }] }

### ContentColumns
{ title, text, imageDesktop, imageMobile, imagePosition, features }

### BeforeAfter
{ beforeImage, afterImage, beforeLabel, afterLabel }

### CountdownTimer
{ endDate, title, subtitle }

### RichText
{ content } - Use APENAS como último recurso para texto que não se encaixa em outros blocos

### Image
{ src, alt, caption }

### Button
{ text, url, variant, size }

## Output

Use a função extract_page_blocks para retornar os blocos extraídos.`;

// Função principal de extração de conteúdo
export async function extractPageContent(
  html: string,
  strategicPlan: StrategicPlan,
  options?: {
    maxHtmlLength?: number;
  }
): Promise<{ result: ExtractionResult; rawResponse?: unknown }> {
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não configurada');
  }

  const maxLength = options?.maxHtmlLength || 120000;
  const truncatedHtml = html.length > maxLength 
    ? html.slice(0, maxLength) + '\n\n[HTML TRUNCADO]'
    : html;

  const frameworkDef = FRAMEWORKS[strategicPlan.framework];

  // Construir prompt do usuário com contexto estratégico
  const userPrompt = `## PLANO ESTRATÉGICO

**Tipo de Produto:** ${strategicPlan.productType}
**Produto:** ${strategicPlan.productName}
**Público-Alvo:** ${strategicPlan.targetAudience}
**Framework:** ${strategicPlan.framework} - ${frameworkDef.fullName}
**Dor Principal:** ${strategicPlan.mainPainPoint}
**Promessa Principal:** ${strategicPlan.mainPromise}

### Seções a Extrair (em ordem de prioridade)
${strategicPlan.sections.map((s, i) => `${i + 1}. ${s.type} (${s.function}) - Dicas: ${s.extractionHints.join(', ')}`).join('\n')}

### Elementos de Conversão Identificados
${strategicPlan.conversionElements?.map(e => `- ${e.type}: ${e.content}`).join('\n') || 'Nenhum identificado'}

### Ordem de Blocos do Framework ${strategicPlan.framework}
${frameworkDef.blockOrder.join(' → ')}

---

## HTML DA PÁGINA

${truncatedHtml}

---

## SUA TAREFA

1. Extraia o conteúdo REAL da página para os blocos nativos
2. Siga a ordem do framework ${strategicPlan.framework}
3. Agrupe vídeos YouTube em VideoCarousel
4. Extraia nomes e depoimentos REAIS (nunca genéricos)
5. Use a função extract_page_blocks para retornar os blocos`;

  console.log('[Content Extractor] Iniciando extração...', { 
    framework: strategicPlan.framework,
    sectionsToExtract: strategicPlan.sections.length,
    htmlLength: truncatedHtml.length
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
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [extractPageBlocksSchema],
        tool_choice: { type: 'function', function: { name: 'extract_page_blocks' } },
        temperature: 0.2, // Baixa temperatura para extração precisa
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Content Extractor] Erro na API:', response.status, errorText);
      
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
    
    console.log('[Content Extractor] Resposta recebida em', elapsedMs, 'ms');

    // Extrair argumentos da função
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'extract_page_blocks') {
      console.error('[Content Extractor] Resposta inválida:', JSON.stringify(data).slice(0, 500));
      throw new Error('IA não retornou blocos válidos');
    }

    let extractionArgs: ExtractionResult;
    try {
      extractionArgs = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[Content Extractor] Erro ao parsear argumentos:', toolCall.function.arguments);
      throw new Error('Erro ao processar resposta da IA');
    }

    // Validar e normalizar blocos
    const normalizedBlocks = normalizeBlocks(extractionArgs.blocks || []);

    const result: ExtractionResult = {
      blocks: normalizedBlocks,
      extractionQuality: extractionArgs.extractionQuality || 70,
      warnings: extractionArgs.warnings || [],
      videosGrouped: extractionArgs.videosGrouped || false,
      testimonialsWithRealNames: extractionArgs.testimonialsWithRealNames || false,
    };

    console.log('[Content Extractor] Extração concluída:', {
      blocksCount: result.blocks.length,
      quality: result.extractionQuality,
      warningsCount: result.warnings.length,
      videosGrouped: result.videosGrouped,
      testimonialsWithRealNames: result.testimonialsWithRealNames
    });

    return { result, rawResponse: data };

  } catch (error) {
    console.error('[Content Extractor] Erro:', error);
    throw error;
  }
}

// Normaliza e valida os blocos extraídos
function normalizeBlocks(blocks: ExtractedBlock[]): ExtractedBlock[] {
  return blocks
    .filter(block => block && block.type && block.props)
    .map((block, index) => ({
      ...block,
      order: block.order || index + 1,
      confidence: block.confidence || 0.7,
      marketingFunction: block.marketingFunction || inferMarketingFunction(block.type),
      props: normalizeBlockProps(block.type, block.props),
    }))
    .sort((a, b) => a.order - b.order);
}

// Infere a função de marketing baseado no tipo de bloco
function inferMarketingFunction(blockType: string): ExtractedBlock['marketingFunction'] {
  const functions = BLOCK_MARKETING_FUNCTIONS[blockType];
  return functions?.[0] || 'interest';
}

// Normaliza as props de um bloco
function normalizeBlockProps(type: string, props: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...props };

  switch (type) {
    case 'Hero':
      // Garantir que tem pelo menos título
      if (!normalized.title) {
        normalized.title = '';
      }
      break;

    case 'VideoCarousel':
      // Garantir que items é um array
      if (!Array.isArray(normalized.items)) {
        normalized.items = [];
      }
      // Validar cada item do carrossel
      normalized.items = (normalized.items as unknown[]).filter((item: unknown) => {
        if (typeof item !== 'object' || item === null) return false;
        const i = item as Record<string, unknown>;
        return i.url && typeof i.url === 'string';
      });
      break;

    case 'Testimonials':
      // Garantir que items é um array
      if (!Array.isArray(normalized.items)) {
        normalized.items = [];
      }
      // Filtrar depoimentos genéricos
      normalized.items = (normalized.items as unknown[]).filter((item: unknown) => {
        if (typeof item !== 'object' || item === null) return false;
        const i = item as Record<string, unknown>;
        const name = String(i.name || '').toLowerCase();
        const text = String(i.text || '').toLowerCase();
        
        // Rejeitar nomes genéricos
        const genericNames = ['cliente 1', 'cliente 2', 'cliente 3', 'joão s.', 'maria s.', 'cliente satisfeito'];
        if (genericNames.some(g => name.includes(g))) return false;
        
        // Rejeitar textos genéricos muito curtos
        if (text.length < 20) return false;
        
        return true;
      });
      break;

    case 'InfoHighlights':
    case 'FAQ':
    case 'StatsNumbers':
      // Garantir que items é um array
      if (!Array.isArray(normalized.items)) {
        normalized.items = [];
      }
      break;

    case 'YouTubeVideo':
      // Extrair video ID se necessário
      if (normalized.url && typeof normalized.url === 'string') {
        normalized.url = normalizeYouTubeUrl(normalized.url);
      }
      break;
  }

  return normalized;
}

// Normaliza URL do YouTube
function normalizeYouTubeUrl(url: string): string {
  try {
    // Extrair video ID de diferentes formatos
    const patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return `https://www.youtube.com/watch?v=${match[1]}`;
      }
    }

    return url;
  } catch {
    return url;
  }
}

// Função de fallback para extração básica
export function createFallbackExtraction(html: string): ExtractionResult {
  const blocks: ExtractedBlock[] = [];
  
  // Extrair título H1 para Hero
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    blocks.push({
      type: 'Hero',
      props: { title: h1Match[1].trim() },
      marketingFunction: 'attention',
      order: 1,
      confidence: 0.5,
    });
  }

  // Extrair vídeos YouTube
  const youtubeMatches = html.matchAll(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/g);
  const videoUrls = [...youtubeMatches].map(m => `https://www.youtube.com/watch?v=${m[1]}`);
  
  if (videoUrls.length > 0) {
    if (videoUrls.length === 1) {
      blocks.push({
        type: 'YouTubeVideo',
        props: { url: videoUrls[0] },
        marketingFunction: 'interest',
        order: 2,
        confidence: 0.6,
      });
    } else {
      blocks.push({
        type: 'VideoCarousel',
        props: { 
          items: videoUrls.map(url => ({ url, title: '' }))
        },
        marketingFunction: 'interest',
        order: 2,
        confidence: 0.6,
      });
    }
  }

  return {
    blocks,
    extractionQuality: 30,
    warnings: ['Extração de fallback utilizada - qualidade reduzida'],
    videosGrouped: videoUrls.length > 1,
    testimonialsWithRealNames: false,
  };
}
