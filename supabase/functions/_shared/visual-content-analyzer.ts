// =============================================
// VISUAL CONTENT ANALYZER v3 - WITH DETAILED LOGGING
// Uses Gemini Vision to analyze page screenshots
// and identify main content vs widgets/navigation
// =============================================

interface VisualSection {
  type: 'main-content' | 'navigation' | 'widget' | 'footer' | 'header' | 'sidebar';
  description: string;
  visibleTexts: string[]; // Texts visible in this section
  shouldImport: boolean;
  confidence: number;
  reasoning: string;
}

interface VisualAnalysisResult {
  success: boolean;
  sections: VisualSection[];
  approvedTexts: string[]; // All texts that should be imported
  rejectedTexts: string[]; // All texts that should NOT be imported (widgets, navigation)
  summary: string;
  error?: string;
}

const VISUAL_ANALYSIS_PROMPT = `Você é um especialista em análise visual de páginas web.

Analise este screenshot de uma página de e-commerce/institucional.

TAREFA:
Identifique TODAS as seções visíveis e classifique cada uma. Seu objetivo é distinguir o CONTEÚDO PRINCIPAL (que deve ser importado) dos ELEMENTOS GENÉRICOS DO TEMA (que NÃO devem ser importados).

CATEGORIAS:

1. **main-content** (IMPORTAR ✓):
   - Títulos principais da página (H1, H2 grandes e centralizados)
   - Textos descritivos sobre o assunto da página
   - Vídeos incorporados (YouTube, Vimeo)
   - Imagens de produtos/serviços específicos
   - Botões de ação (CTA) relacionados ao conteúdo
   - FAQs específicos
   - Depoimentos/testimonials

2. **widget** (NÃO IMPORTAR ✗):
   - "Mais pesquisados", "Trending", "Produtos populares"
   - Listas de categorias genéricas
   - Tags de exemplo do tema (Skin Care, Brinco, Pulseira, etc.)
   - Selos de segurança/pagamento padrão
   - Avaliações genéricas do Google/Trust
   - Banners promocionais padrão do tema

3. **navigation** (NÃO IMPORTAR ✗):
   - Menus de navegação
   - Breadcrumbs
   - Links de categorias no header
   - Barra de busca

4. **header** (NÃO IMPORTAR ✗):
   - Logo
   - Menu principal
   - Ícones de carrinho/conta

5. **footer** (NÃO IMPORTAR ✗):
   - Links institucionais
   - Redes sociais
   - Formas de pagamento
   - Copyright

6. **sidebar** (AVALIAR):
   - Se contiver informações específicas da página: IMPORTAR
   - Se contiver widgets genéricos: NÃO IMPORTAR

INSTRUÇÕES:
Para cada seção visível, liste:
1. O tipo (category acima)
2. Uma descrição curta
3. Os TEXTOS VISÍVEIS naquela seção (copie exatamente como aparecem)
4. Se deve ser importado (shouldImport: true/false)
5. Confiança (0-100)
6. Razão da classificação

RESPONDA APENAS em JSON válido:
{
  "sections": [
    {
      "type": "main-content",
      "description": "Título principal sobre calvície",
      "visibleTexts": ["GRAU DE CALVÍCIE", "Consulte aqui o seu grau de calvície"],
      "shouldImport": true,
      "confidence": 95,
      "reasoning": "Título principal centralizado, texto específico do tema da página"
    },
    {
      "type": "widget",
      "description": "Lista de termos populares do tema",
      "visibleTexts": ["Mais pesquisados", "Skin Care", "Brinco", "Pulseira"],
      "shouldImport": false,
      "confidence": 90,
      "reasoning": "Widget genérico do tema Shopify, não é conteúdo específico da página"
    }
  ],
  "summary": "Página sobre tratamento de calvície. Conteúdo principal: título, vídeo explicativo, botão CTA. Widgets a ignorar: barra de pesquisa populares, footer genérico."
}`;

/**
 * Downloads an image from URL and converts to Base64
 * Version: v3 with detailed logging
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  const startTime = Date.now();
  console.log(`[FUNC:fetchImageAsBase64] INPUT: ${JSON.stringify({ url: url.substring(0, 80) })}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[FUNC:fetchImageAsBase64] STEP: Downloaded ${arrayBuffer.byteLength} bytes`);
    
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to Base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    
    const elapsed = Date.now() - startTime;
    console.log(`[FUNC:fetchImageAsBase64] OUTPUT: ${JSON.stringify({ 
      base64Length: base64.length, 
      base64KB: Math.round(base64.length / 1024),
      elapsedMs: elapsed 
    })}`);
    
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error(`[FUNC:fetchImageAsBase64] ERROR: ${JSON.stringify({ error: String(error) })}`);
    throw error;
  }
}

/**
 * Analyzes a page screenshot using Gemini Vision to identify main content vs widgets
 */
export async function analyzePageVisually(
  screenshotInput: string,
  pageUrl: string,
  pageTitle: string
): Promise<VisualAnalysisResult> {
  const startTime = Date.now();
  
  console.log(`[FUNC:analyzePageVisually] INPUT: ${JSON.stringify({ 
    pageUrl, 
    pageTitle, 
    screenshotInputType: screenshotInput.startsWith('http') ? 'URL' : (screenshotInput.startsWith('data:') ? 'dataUri' : 'base64'),
    screenshotInputLength: screenshotInput.length 
  })}`);
  
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[FUNC:analyzePageVisually] ERROR: LOVABLE_API_KEY not configured');
      return {
        success: false,
        sections: [],
        approvedTexts: [],
        rejectedTexts: [],
        summary: '',
        error: 'LOVABLE_API_KEY not configured'
      };
    }

    console.log(`[FUNC:analyzePageVisually] STEP: Processing screenshot input...`);

    // Detect if screenshot is URL or Base64 and process accordingly
    let imageDataUrl: string;
    
    if (screenshotInput.startsWith('http://') || screenshotInput.startsWith('https://')) {
      // It's a URL - need to download and convert to Base64
      console.log('[FUNC:analyzePageVisually] STEP: Screenshot is HTTP URL, downloading...');
      imageDataUrl = await fetchImageAsBase64(screenshotInput);
    } else if (screenshotInput.startsWith('data:')) {
      // Already has data URI prefix
      console.log('[FUNC:analyzePageVisually] STEP: Screenshot is data URI');
      imageDataUrl = screenshotInput;
    } else {
      // Assume it's raw Base64
      console.log('[FUNC:analyzePageVisually] STEP: Screenshot is raw Base64');
      imageDataUrl = `data:image/png;base64,${screenshotInput}`;
    }

    console.log(`[FUNC:analyzePageVisually] STEP: Image ready for Gemini, size: ${Math.round(imageDataUrl.length / 1024)}KB`);

    // Prepare the message with image
    const messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${VISUAL_ANALYSIS_PROMPT}\n\nPágina: ${pageTitle}\nURL: ${pageUrl}`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageDataUrl
            }
          }
        ]
      }
    ];

    console.log(`[FUNC:analyzePageVisually] STEP: Calling Gemini Vision API...`);

    // Call Lovable AI Gateway with Gemini Vision
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash', // Vision capable, fast
        messages,
        temperature: 0.3, // Lower for more consistent classification
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[FUNC:analyzePageVisually] API_ERROR: ${JSON.stringify({ status: response.status, error: errorText.substring(0, 200) })}`);
      
      if (response.status === 429) {
        return {
          success: false,
          sections: [],
          approvedTexts: [],
          rejectedTexts: [],
          summary: '',
          error: 'Rate limit exceeded'
        };
      }
      
      return {
        success: false,
        sections: [],
        approvedTexts: [],
        rejectedTexts: [],
        summary: '',
        error: `API error: ${response.status}`
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[FUNC:analyzePageVisually] ERROR: No content in response');
      return {
        success: false,
        sections: [],
        approvedTexts: [],
        rejectedTexts: [],
        summary: '',
        error: 'No content in AI response'
      };
    }

    console.log(`[FUNC:analyzePageVisually] STEP: Received response, parsing JSON...`);
    console.log(`[FUNC:analyzePageVisually] RAW_RESPONSE_PREVIEW: ${content.substring(0, 500)}`);

    // Parse JSON from response (handle markdown code blocks)
    let jsonContent = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error(`[FUNC:analyzePageVisually] PARSE_ERROR: ${JSON.stringify({ error: String(parseError) })}`);
      console.log(`[FUNC:analyzePageVisually] RAW_CONTENT: ${content.substring(0, 1000)}`);
      return {
        success: false,
        sections: [],
        approvedTexts: [],
        rejectedTexts: [],
        summary: '',
        error: 'Failed to parse AI response'
      };
    }

    // Extract sections and approved/rejected texts
    const sections: VisualSection[] = parsed.sections || [];
    const approvedTexts: string[] = [];
    const rejectedTexts: string[] = [];

    for (const section of sections) {
      const texts = section.visibleTexts || [];
      if (section.shouldImport) {
        approvedTexts.push(...texts);
      } else {
        rejectedTexts.push(...texts);
      }
    }

    const elapsed = Date.now() - startTime;
    
    // Count section types
    const sectionTypes = sections.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`[FUNC:analyzePageVisually] OUTPUT: ${JSON.stringify({ 
      success: true,
      sectionsCount: sections.length,
      sectionTypes,
      approvedTextsCount: approvedTexts.length,
      rejectedTextsCount: rejectedTexts.length,
      approvedTextsPreview: approvedTexts.slice(0, 5),
      rejectedTextsPreview: rejectedTexts.slice(0, 5),
      summary: parsed.summary?.substring(0, 100),
      elapsedMs: elapsed 
    })}`);

    return {
      success: true,
      sections,
      approvedTexts,
      rejectedTexts,
      summary: parsed.summary || ''
    };

  } catch (error) {
    console.error(`[FUNC:analyzePageVisually] EXCEPTION: ${JSON.stringify({ error: String(error) })}`);
    return {
      success: false,
      sections: [],
      approvedTexts: [],
      rejectedTexts: [],
      summary: '',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Filters extracted elements based on visual analysis
 * Only keeps elements whose text appears in the approved list
 * v3 - with detailed logging for every element
 */
export function filterElementsByVisualAnalysis(
  elements: any[],
  visualAnalysis: VisualAnalysisResult,
  options: { 
    strictMode?: boolean; // If true, reject elements not explicitly approved
    minSimilarity?: number; // Minimum text similarity to consider a match (0-1)
  } = {}
): { approved: any[]; rejected: any[] } {
  const startTime = Date.now();
  const { strictMode = false, minSimilarity = 0.4 } = options;
  
  console.log(`[FUNC:filterElementsByVisualAnalysis] INPUT: ${JSON.stringify({ 
    elementsCount: elements.length, 
    approvedTextsCount: visualAnalysis.approvedTexts.length,
    rejectedTextsCount: visualAnalysis.rejectedTexts.length,
    visualAnalysisSuccess: visualAnalysis.success,
    strictMode,
    minSimilarity 
  })}`);
  
  if (!visualAnalysis.success || visualAnalysis.approvedTexts.length === 0) {
    console.log('[FUNC:filterElementsByVisualAnalysis] DECISION: No visual analysis, keeping ALL elements');
    return { approved: elements, rejected: [] };
  }

  const approved: any[] = [];
  const rejected: any[] = [];

  // Normalize texts for comparison
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\\w\\s]/g, '') // Remove punctuation (fixed regex)
      .replace(/\s+/g, ' ')
      .trim();
  };

  const approvedNormalized = visualAnalysis.approvedTexts.map(normalizeText);
  const rejectedNormalized = visualAnalysis.rejectedTexts.map(normalizeText);
  
  console.log(`[FUNC:filterElementsByVisualAnalysis] NORMALIZED_APPROVED_SAMPLE: ${JSON.stringify(approvedNormalized.slice(0, 3))}`);
  console.log(`[FUNC:filterElementsByVisualAnalysis] NORMALIZED_REJECTED_SAMPLE: ${JSON.stringify(rejectedNormalized.slice(0, 3))}`);

  // Simple text similarity (Jaccard-like)
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    
    return intersection / union;
  };
  
  // Check if text CONTAINS key phrases from rejected list
  const containsRejectedPhrase = (text: string): boolean => {
    const rejectedPhrases = [
      'mais pesquisados',
      'mais pesquisadas', 
      'termos pesquisados',
      'buscas populares',
      'trending',
      'top searches',
      'formas de pagamento',
      'selos de seguranca',
      'newsletter',
      'inscreva-se',
    ];
    const textLower = text.toLowerCase();
    return rejectedPhrases.some(phrase => textLower.includes(phrase));
  };

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    
    // Get text content from element
    const rawText = element.metadata?.text || element.metadata?.content || element.text || '';
    const elementText = normalizeText(rawText);
    
    console.log(`[FUNC:filterElementsByVisualAnalysis] PROCESSING[${i}]: ${JSON.stringify({ 
      type: element.type, 
      textLength: rawText.length,
      textPreview: rawText.substring(0, 50) 
    })}`);
    
    // Media types (videos, images) are ALWAYS approved
    const isMediaType = ['video', 'video-carousel', 'image', 'image-carousel'].includes(element.type);
    
    if (isMediaType) {
      console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: AUTO_APPROVED (media type: ${element.type})`);
      approved.push(element);
      continue;
    }

    if (!elementText || elementText.length < 5) {
      // Very short or empty text elements - check type
      if (['button'].includes(element.type)) {
        console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: KEPT (short button)`);
        approved.push(element);
      } else {
        console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: KEPT (too short to filter)`);
        approved.push(element);
      }
      continue;
    }
    
    // Check for obvious rejected phrases first
    if (containsRejectedPhrase(elementText)) {
      console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: REJECTED (contains blocked phrase)`);
      rejected.push(element);
      continue;
    }

    // Check if explicitly rejected by visual analysis
    let isExplicitlyRejected = false;
    let rejectedReason = '';
    
    for (const rejectedText of rejectedNormalized) {
      if (rejectedText.length < 10) continue;
      
      const includesCheck = elementText.includes(rejectedText) || rejectedText.includes(elementText);
      const similarityCheck = calculateSimilarity(elementText, rejectedText) > 0.6;
      
      if (includesCheck || similarityCheck) {
        isExplicitlyRejected = true;
        rejectedReason = `matches rejected: "${rejectedText.substring(0, 30)}"`;
        break;
      }
    }

    if (isExplicitlyRejected) {
      console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: REJECTED (${rejectedReason})`);
      rejected.push(element);
      continue;
    }

    // Check if matches approved texts
    let matchesApproved = false;
    let approvedReason = '';
    
    for (const approvedText of approvedNormalized) {
      if (approvedText.length < 5) continue;
      
      const includesCheck = elementText.includes(approvedText) || approvedText.includes(elementText);
      const similarity = calculateSimilarity(elementText, approvedText);
      
      if (includesCheck || similarity >= minSimilarity) {
        matchesApproved = true;
        approvedReason = `matches approved: "${approvedText.substring(0, 30)}" (sim: ${similarity.toFixed(2)})`;
        break;
      }
    }

    if (matchesApproved) {
      console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: APPROVED (${approvedReason})`);
      approved.push(element);
    } else if (strictMode) {
      console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: REJECTED (strict mode, no match)`);
      rejected.push(element);
    } else {
      // In non-strict mode, keep elements not explicitly rejected
      console.log(`[FUNC:filterElementsByVisualAnalysis] DECISION[${i}]: KEPT (lenient mode, no explicit rejection)`);
      approved.push(element);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:filterElementsByVisualAnalysis] OUTPUT: ${JSON.stringify({ 
    approvedCount: approved.length, 
    rejectedCount: rejected.length,
    approvedTypes: approved.reduce((acc, el) => { acc[el.type] = (acc[el.type] || 0) + 1; return acc; }, {} as Record<string, number>),
    rejectedTypes: rejected.reduce((acc, el) => { acc[el.type] = (acc[el.type] || 0) + 1; return acc; }, {} as Record<string, number>),
    elapsedMs: elapsed 
  })}`);
  
  return { approved, rejected };
}

/**
 * Check if a text should be imported based on visual analysis
 */
export function isTextApprovedByVisualAnalysis(
  text: string,
  visualAnalysis: VisualAnalysisResult
): boolean {
  console.log(`[FUNC:isTextApprovedByVisualAnalysis] INPUT: ${JSON.stringify({ 
    textLength: text.length, 
    textPreview: text.substring(0, 40) 
  })}`);
  
  if (!visualAnalysis.success || visualAnalysis.approvedTexts.length === 0) {
    console.log(`[FUNC:isTextApprovedByVisualAnalysis] OUTPUT: true (no analysis)`);
    return true; // No analysis = allow all
  }

  const normalizeText = (t: string): string => {
    return t
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\\w\\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizedInput = normalizeText(text);
  
  const isApproved = visualAnalysis.approvedTexts.some(approved => {
    const normalizedApproved = normalizeText(approved);
    return normalizedInput.includes(normalizedApproved) || 
           normalizedApproved.includes(normalizedInput);
  });

  console.log(`[FUNC:isTextApprovedByVisualAnalysis] OUTPUT: ${JSON.stringify({ isApproved })}`);
  return isApproved;
}
