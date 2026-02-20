import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =============================================
// AI CLASSIFIER/DECISOR - NOT A CONVERTER
// =============================================
// The AI's job is to THINK, not IMPLEMENT:
// 1. Classify page type and complexity
// 2. Segment into logical sections
// 3. Decide mode per section
// 4. Identify editable elements (CTAs/buttons)
// =============================================

const SYSTEM_PROMPT = `Você é um especialista em análise de estrutura de páginas web.

Sua tarefa é ANALISAR e CLASSIFICAR uma página, NÃO convertê-la.

## Seu Papel

Você é o "cérebro decisor" do sistema de importação. Você analisa o HTML e decide:
1. Qual é o TIPO desta página (landing page custom complexa? institucional simples?)
2. Quais são as SEÇÕES lógicas desta página
3. Para cada seção: qual MODO de importação usar
4. Quais elementos são EDITÁVEIS (botões, CTAs)

## REGRA CRÍTICA: PIXEL-PERFECT É O FALLBACK DOMINANTE

O objetivo principal do sistema é ficar **100% igual visualmente**.
Editabilidade é SECUNDÁRIA.

**Só use "native-blocks" quando você tiver ALTA CONFIANÇA (>85%) de que:**
- A seção é claramente um padrão reconhecível (FAQ com perguntas/respostas explícitas, depoimentos estruturados)
- A conversão NÃO vai perder fidelidade visual
- A seção NÃO depende de CSS específico para seu layout

**Na DÚVIDA, sempre escolha "pixel-perfect".**

## Modos de Importação

### MODE: native-blocks (ALTA CONFIANÇA - confidence > 85)
- APENAS quando a seção é CLARAMENTE mapeável sem perda visual
- Exemplos válidos: FAQ com estrutura <details>, Depoimentos em blockquotes
- Exemplos INVÁLIDOS: Hero (use pixel-perfect), grids (use pixel-perfect), seções com design custom (use pixel-perfect)
- Use SOMENTE se tiver certeza de que blocos nativos reproduzem o visual fielmente

### MODE: pixel-perfect (FALLBACK PADRÃO)
- Quando houver QUALQUER dúvida sobre a fidelidade visual
- Quando a seção depende de CSS/layout específico
- Quando a seção tem design complexo ou customizado
- Este é o modo PREFERIDO - garante 100% igual ao original
- Resultado: clone visual exato (CustomBlock isolado com iframe)

### MODE: hybrid
- Raro - use apenas quando parte da seção é claramente blocável E parte precisa pixel-perfect
- Na maioria dos casos, prefira pixel-perfect completo

## Confidence Score (0-100)

- 90-100: Certeza absoluta (FAQ com structure clara, depoimentos em blockquotes)
- 70-89: Alguma dúvida → USE PIXEL-PERFECT
- 0-69: Dúvida significativa → USE PIXEL-PERFECT

## O Que Você NÃO Deve Fazer

- NÃO extraia conteúdo HTML para colocar em blocos
- NÃO tente converter texto para HTML
- NÃO crie props detalhadas de blocos
- NÃO escolha native-blocks quando tiver dúvida
- Apenas CLASSIFIQUE e DECIDA

## Output Esperado

Use a função classify_page para retornar sua análise.
Quando em dúvida, prefira pixel-perfect e confidence baixa.`;

interface AnalyzeRequest {
  html: string;
  pageTitle: string;
  pageUrl: string;
}

interface SectionAnalysis {
  id: string;
  name: string;
  startMarker: string; // CSS selector or text marker to identify this section
  endMarker?: string;
  mode: 'native-blocks' | 'pixel-perfect' | 'hybrid';
  confidence: number; // 0-100
  reasoning: string;
  suggestedBlockTypes?: string[]; // For native-blocks mode
  editableElements?: EditableElement[]; // CTAs/buttons to extract
}

interface EditableElement {
  type: 'button' | 'link' | 'cta';
  text: string;
  selector: string; // CSS selector to find this element
  reasoning: string;
}

interface PageClassification {
  pageType: 'landing-custom' | 'institutional' | 'hybrid' | 'simple';
  complexity: 'low' | 'medium' | 'high';
  hasDesktopMobileVariants: boolean;
  dependsOnExternalCss: boolean;
  sections: SectionAnalysis[];
  globalEditables: EditableElement[];
  summary: string;
  recommendedStrategy: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    resetAIRouterCache();

    const body: AnalyzeRequest = await req.json();
    const { html, pageTitle, pageUrl } = body;

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI-CLASSIFY] Starting classification for: ${pageTitle} (${html.length} chars)`);

    // Truncate HTML if too long (keep first 40k chars for analysis)
    const maxHtmlLength = 40000;
    const truncatedHtml = html.length > maxHtmlLength 
      ? html.substring(0, maxHtmlLength) + "\n<!-- [TRUNCADO] -->"
      : html;
    
    console.log(`[AI-CLASSIFY] Using ${truncatedHtml.length} chars for analysis`);

    const userPrompt = `Analise esta página e CLASSIFIQUE sua estrutura.

Página: ${pageTitle}
URL: ${pageUrl}

IMPORTANTE: Você deve APENAS analisar e classificar. NÃO tente extrair ou converter conteúdo.

Identifique:
1. Tipo da página (landing custom complexa? institucional simples?)
2. Seções lógicas (onde cada uma começa/termina)
3. Modo para cada seção (native-blocks, pixel-perfect, hybrid)
4. Elementos editáveis (botões/CTAs que devem ser extraídos)

HTML:
${truncatedHtml}`;

    const response = await aiChatCompletion("google/gemini-2.5-flash", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      tools: [
          {
            type: "function",
            function: {
              name: "classify_page",
              description: "Classifica a estrutura da página para decidir como importar",
              parameters: {
                type: "object",
                properties: {
                  pageType: {
                    type: "string",
                    enum: ["landing-custom", "institutional", "hybrid", "simple"],
                    description: "Tipo geral da página"
                  },
                  complexity: {
                    type: "string",
                    enum: ["low", "medium", "high"],
                    description: "Complexidade visual/estrutural"
                  },
                  hasDesktopMobileVariants: {
                    type: "boolean",
                    description: "Se a página tem elementos duplicados para desktop/mobile"
                  },
                  dependsOnExternalCss: {
                    type: "boolean",
                    description: "Se o layout depende fortemente de CSS externo/theme"
                  },
                  sections: {
                    type: "array",
                    description: "Seções identificadas na página",
                    items: {
                      type: "object",
                      properties: {
                        id: {
                          type: "string",
                          description: "Identificador único da seção (ex: hero, benefits, faq)"
                        },
                        name: {
                          type: "string",
                          description: "Nome descritivo da seção"
                        },
                        startMarker: {
                          type: "string",
                          description: "Seletor CSS ou texto para identificar início da seção"
                        },
                        endMarker: {
                          type: "string",
                          description: "Seletor CSS ou texto para identificar fim da seção"
                        },
                        mode: {
                          type: "string",
                          enum: ["native-blocks", "pixel-perfect", "hybrid"],
                          description: "Modo de importação recomendado"
                        },
                        confidence: {
                          type: "number",
                          description: "Confiança na decisão (0-100)"
                        },
                        reasoning: {
                          type: "string",
                          description: "Por que escolheu este modo"
                        },
                        suggestedBlockTypes: {
                          type: "array",
                          items: { type: "string" },
                          description: "Tipos de blocos sugeridos (para native-blocks)"
                        },
                        editableElements: {
                          type: "array",
                          description: "Elementos editáveis dentro desta seção",
                          items: {
                            type: "object",
                            properties: {
                              type: {
                                type: "string",
                                enum: ["button", "link", "cta"]
                              },
                              text: {
                                type: "string",
                                description: "Texto do elemento"
                              },
                              selector: {
                                type: "string",
                                description: "Seletor CSS para encontrar"
                              },
                              reasoning: {
                                type: "string",
                                description: "Por que este elemento deve ser editável"
                              }
                            },
                            required: ["type", "text", "selector", "reasoning"]
                          }
                        }
                      },
                      required: ["id", "name", "startMarker", "mode", "confidence", "reasoning"]
                    }
                  },
                  globalEditables: {
                    type: "array",
                    description: "Elementos editáveis globais (não em seção específica)",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["button", "link", "cta"]
                        },
                        text: {
                          type: "string"
                        },
                        selector: {
                          type: "string"
                        },
                        reasoning: {
                          type: "string"
                        }
                      },
                      required: ["type", "text", "selector", "reasoning"]
                    }
                  },
                  summary: {
                    type: "string",
                    description: "Resumo da análise em 1-2 frases"
                  },
                  recommendedStrategy: {
                    type: "string",
                    description: "Estratégia geral recomendada para importar esta página"
                  }
                },
                required: ["pageType", "complexity", "hasDesktopMobileVariants", "dependsOnExternalCss", "sections", "summary", "recommendedStrategy"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "classify_page" } }
      }, {
        supabaseUrl,
        supabaseServiceKey,
        logPrefix: "[AI-CLASSIFY]",
      });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-CLASSIFY] API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required for AI features." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[AI-CLASSIFY] Raw response received');

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function?.name !== 'classify_page') {
      console.error('[AI-CLASSIFY] No valid tool call in response');
      return new Response(
        JSON.stringify({ 
          error: 'AI did not return expected structure',
          fallback: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: PageClassification;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[AI-CLASSIFY] Failed to parse tool arguments:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse AI response',
          fallback: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI-CLASSIFY] Success:`);
    console.log(`  - Type: ${result.pageType}`);
    console.log(`  - Complexity: ${result.complexity}`);
    console.log(`  - Sections: ${result.sections?.length || 0}`);
    console.log(`  - Desktop/Mobile: ${result.hasDesktopMobileVariants}`);
    console.log(`  - Strategy: ${result.recommendedStrategy?.substring(0, 100)}...`);

    // Validate sections
    const validSections = (result.sections || []).filter(s => {
      if (!s.id || !s.mode) return false;
      if (!['native-blocks', 'pixel-perfect', 'hybrid'].includes(s.mode)) return false;
      return true;
    });

    return new Response(
      JSON.stringify({
        success: true,
        classification: {
          pageType: result.pageType || 'hybrid',
          complexity: result.complexity || 'medium',
          hasDesktopMobileVariants: result.hasDesktopMobileVariants ?? false,
          dependsOnExternalCss: result.dependsOnExternalCss ?? true,
          sections: validSections,
          globalEditables: result.globalEditables || [],
          summary: result.summary || 'Análise concluída',
          recommendedStrategy: result.recommendedStrategy || 'Usar modo híbrido',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-CLASSIFY] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        fallback: true 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
