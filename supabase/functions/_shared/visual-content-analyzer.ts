// =============================================
// VISUAL CONTENT ANALYZER
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
 * Version: 2026-01-01-v2 - force redeploy
 */
async function fetchImageAsBase64(url: string): Promise<string> {
  // FORCE REDEPLOY v2
  console.log(`[VISUAL-v2] fetchImageAsBase64 CALLED`);
  console.log(`[VISUAL-v2] Downloading from: ${url.substring(0, 80)}...`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    console.log(`[VISUAL-v2] Downloaded ${arrayBuffer.byteLength} bytes`);
    
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to Base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    
    console.log(`[VISUAL-v2] Converted to Base64: ${Math.round(base64.length / 1024)}KB`);
    return `data:image/png;base64,${base64}`;
  } catch (error) {
    console.error(`[VISUAL-v2] Download FAILED:`, error);
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
  
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.error('[VISUAL] LOVABLE_API_KEY not configured');
      return {
        success: false,
        sections: [],
        approvedTexts: [],
        rejectedTexts: [],
        summary: '',
        error: 'LOVABLE_API_KEY not configured'
      };
    }

    // FORCE REDEPLOY v2 - 2026-01-01
    console.log(`[VISUAL-v2] === VISUAL ANALYZER v2 ACTIVE ===`);
    console.log(`[VISUAL-v2] Analyzing: ${pageTitle} (${pageUrl})`);
    console.log(`[VISUAL-v2] Input type check: ${screenshotInput.substring(0, 30)}...`);

    // Detect if screenshot is URL or Base64 and process accordingly
    let imageDataUrl: string;
    
    if (screenshotInput.startsWith('http://') || screenshotInput.startsWith('https://')) {
      // It's a URL - need to download and convert to Base64
      console.log('[VISUAL-v2] Screenshot is HTTP URL, will download...');
      imageDataUrl = await fetchImageAsBase64(screenshotInput);
    } else if (screenshotInput.startsWith('data:')) {
      // Already has data URI prefix
      console.log('[VISUAL-v2] Screenshot is data URI');
      imageDataUrl = screenshotInput;
    } else {
      // Assume it's raw Base64
      console.log('[VISUAL-v2] Screenshot is raw Base64');
      imageDataUrl = `data:image/png;base64,${screenshotInput}`;
    }

    console.log(`[VISUAL-v2] Image ready for Gemini: ${Math.round(imageDataUrl.length / 1024)}KB`);

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
      console.error(`[VISUAL] API error: ${response.status}`, errorText);
      
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
      console.error('[VISUAL] No content in response');
      return {
        success: false,
        sections: [],
        approvedTexts: [],
        rejectedTexts: [],
        summary: '',
        error: 'No content in AI response'
      };
    }

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
      console.error('[VISUAL] Failed to parse JSON:', parseError);
      console.log('[VISUAL] Raw content:', content.substring(0, 500));
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
    console.log(`[VISUAL] Analysis complete in ${elapsed}ms`);
    console.log(`[VISUAL] Sections: ${sections.length}`);
    console.log(`[VISUAL] Approved texts: ${approvedTexts.length}`);
    console.log(`[VISUAL] Rejected texts: ${rejectedTexts.length}`);
    
    // Log section breakdown
    const sectionTypes = sections.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[VISUAL] Section types:`, sectionTypes);

    return {
      success: true,
      sections,
      approvedTexts,
      rejectedTexts,
      summary: parsed.summary || ''
    };

  } catch (error) {
    console.error('[VISUAL] Exception:', error);
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
 */
export function filterElementsByVisualAnalysis(
  elements: any[],
  visualAnalysis: VisualAnalysisResult,
  options: { 
    strictMode?: boolean; // If true, reject elements not explicitly approved
    minSimilarity?: number; // Minimum text similarity to consider a match (0-1)
  } = {}
): { approved: any[]; rejected: any[] } {
  const { strictMode = false, minSimilarity = 0.6 } = options;
  
  if (!visualAnalysis.success || visualAnalysis.approvedTexts.length === 0) {
    console.log('[VISUAL-FILTER] No visual analysis available, keeping all elements');
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
      .replace(/[^\\w\\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
  };

  const approvedNormalized = visualAnalysis.approvedTexts.map(normalizeText);
  const rejectedNormalized = visualAnalysis.rejectedTexts.map(normalizeText);

  // Simple text similarity (Jaccard-like)
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = new Set(text1.split(' ').filter(w => w.length > 2));
    const words2 = new Set(text2.split(' ').filter(w => w.length > 2));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = new Set([...words1, ...words2]).size;
    
    return intersection / union;
  };

  for (const element of elements) {
    // Get text content from element
    const elementText = normalizeText(
      element.metadata?.text || 
      element.metadata?.content || 
      element.text || 
      ''
    );

    if (!elementText || elementText.length < 3) {
      // Very short or empty elements - keep them (could be images/videos)
      approved.push(element);
      continue;
    }

    // Check if explicitly rejected
    const isExplicitlyRejected = rejectedNormalized.some(rejected => 
      elementText.includes(rejected) || rejected.includes(elementText) ||
      calculateSimilarity(elementText, rejected) > 0.7
    );

    if (isExplicitlyRejected) {
      console.log(`[VISUAL-FILTER] REJECTED: "${elementText.substring(0, 50)}..." (matched rejected list)`);
      rejected.push(element);
      continue;
    }

    // Check if matches approved texts
    const matchesApproved = approvedNormalized.some(approvedText => 
      elementText.includes(approvedText) || approvedText.includes(elementText) ||
      calculateSimilarity(elementText, approvedText) >= minSimilarity
    );

    if (matchesApproved) {
      console.log(`[VISUAL-FILTER] APPROVED: "${elementText.substring(0, 50)}..." (matched approved list)`);
      approved.push(element);
    } else if (strictMode) {
      console.log(`[VISUAL-FILTER] REJECTED (strict): "${elementText.substring(0, 50)}..." (not in approved list)`);
      rejected.push(element);
    } else {
      // In non-strict mode, keep elements not explicitly rejected
      console.log(`[VISUAL-FILTER] KEPT (non-strict): "${elementText.substring(0, 50)}..."`);
      approved.push(element);
    }
  }

  console.log(`[VISUAL-FILTER] Final: ${approved.length} approved, ${rejected.length} rejected out of ${elements.length} total`);
  
  return { approved, rejected };
}

/**
 * Check if a text should be imported based on visual analysis
 */
export function isTextApprovedByVisualAnalysis(
  text: string,
  visualAnalysis: VisualAnalysisResult
): boolean {
  if (!visualAnalysis.success || visualAnalysis.approvedTexts.length === 0) {
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

  const normalized = normalizeText(text);
  
  // Check rejected first
  for (const rejected of visualAnalysis.rejectedTexts) {
    const rejectedNorm = normalizeText(rejected);
    if (normalized.includes(rejectedNorm) || rejectedNorm.includes(normalized)) {
      return false;
    }
  }

  // Check approved
  for (const approved of visualAnalysis.approvedTexts) {
    const approvedNorm = normalizeText(approved);
    if (normalized.includes(approvedNorm) || approvedNorm.includes(normalized)) {
      return true;
    }
  }

  // Not explicitly mentioned - default to allow (non-strict)
  return true;
}
