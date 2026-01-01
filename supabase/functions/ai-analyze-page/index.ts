import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Available blocks in our Builder with their props
const AVAILABLE_BLOCKS = `
## Blocos Disponíveis no Builder

### 1. YouTubeVideo
- Para vídeos do YouTube incorporados
- Props: { youtubeUrl: string, title?: string }
- Usa: URL completa do YouTube (ex: https://www.youtube.com/watch?v=xxx)

### 2. Image
- Para imagens únicas
- Props: { imageDesktop: string, imageMobile?: string, alt: string, linkUrl?: string }
- Usa para: Imagens principais, banners, fotos de produto

### 3. Button
- Para botões de ação (CTA)
- Props: { text: string, url: string, variant: 'primary'|'secondary'|'outline', size: 'sm'|'md'|'lg' }
- Usa para: Botões "Comprar Agora", "Saiba Mais", etc.

### 4. Hero
- Para seção hero com título, subtítulo e CTA
- Props: { title: string, subtitle?: string, buttonText?: string, buttonUrl?: string, backgroundImage?: string, backgroundColor?: string }

### 5. FAQ
- Para perguntas frequentes (accordion)
- Props: { title: string, items: [{ question: string, answer: string }] }
- Usa quando: Conteúdo está em formato pergunta/resposta

### 6. Testimonials
- Para depoimentos/reviews
- Props: { title: string, items: [{ name: string, text: string, rating?: number }] }

### 7. RichText
- Para conteúdo HTML/texto formatado
- Props: { content: string } (HTML)
- Usa para: Parágrafos de texto, listas, conteúdo misto

### 8. Section (container)
- Para agrupar outros blocos com background/padding
- Props: { backgroundColor?: string, paddingY?: string }

### 9. CustomBlock
- IMPORTANTE: Use quando o visual é complexo e não pode ser reproduzido com blocos nativos
- Props: { htmlContent: string, cssContent?: string, blockName: string }
- Usa para: Layouts com CSS específico, sliders complexos, animações, grids customizados
- Benefício: Preserva 100% do visual original
`;

const SYSTEM_PROMPT = `Você é um especialista em análise de páginas web e mapeamento para um sistema de Page Builder.

Sua tarefa é analisar o HTML de uma página e decidir como mapeá-lo para blocos do nosso Builder.

${AVAILABLE_BLOCKS}

## Estratégia de Mapeamento

### PRIORIDADE 1: Preservar Visual
- Se uma seção tem layout complexo (grid, flexbox elaborado, animações), use CustomBlock
- Se os elementos dependem de CSS específico, use CustomBlock
- O objetivo é NÃO QUEBRAR o visual da página original

### PRIORIDADE 2: Usar Blocos Nativos
- Para elementos simples e reconhecíveis (um único vídeo, FAQ claro, lista de depoimentos), use blocos nativos
- Isso permite edição fácil pelo usuário

### Regras de Decisão:
1. **Vídeo YouTube isolado** → YouTubeVideo
2. **Botão de CTA visível** → Button (extraia texto e URL)
3. **Perguntas e respostas** → FAQ (se houver 2+ perguntas)
4. **Depoimentos/reviews** → Testimonials
5. **Imagem única decorativa** → Image
6. **Hero section clara** → Hero
7. **Texto/parágrafos simples** → RichText
8. **Qualquer layout visual complexo** → CustomBlock (preserve o HTML!)

### IMPORTANTE sobre CustomBlock:
- Quando usar CustomBlock, inclua TODO o HTML necessário para essa seção
- Inclua também o CSS inline se existir (extraído de <style> ou atributos style=)
- Isso garante que o visual seja preservado exatamente como no original

## Output esperado
Use a função map_page_to_blocks para retornar a estrutura identificada.`;

interface AnalyzeRequest {
  html: string;
  pageTitle: string;
  pageUrl: string;
}

interface BlockSection {
  order: number;
  blockType: string;
  props: Record<string, unknown>;
  htmlContent?: string;
  cssContent?: string;
  reasoning: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const body: AnalyzeRequest = await req.json();
    const { html, pageTitle, pageUrl } = body;

    if (!html) {
      return new Response(
        JSON.stringify({ error: 'HTML content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI-ANALYZE] Starting analysis for: ${pageTitle} (${html.length} chars)`);

    // Truncate HTML if too long (keep first 80k chars for context)
    const maxHtmlLength = 80000;
    const truncatedHtml = html.length > maxHtmlLength 
      ? html.substring(0, maxHtmlLength) + "\n<!-- [CONTEÚDO TRUNCADO] -->"
      : html;

    const userPrompt = `Analise esta página e mapeie o conteúdo para blocos do Builder.

## Página
- Título: ${pageTitle}
- URL: ${pageUrl}

## HTML da Página
\`\`\`html
${truncatedHtml}
\`\`\`

Identifique todas as seções visuais da página e para cada uma decida qual bloco usar.
Lembre-se: para layouts complexos ou com estilo visual específico, use CustomBlock para preservar 100% do visual.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "map_page_to_blocks",
              description: "Mapeia o conteúdo da página para blocos do Builder",
              parameters: {
                type: "object",
                properties: {
                  sections: {
                    type: "array",
                    description: "Lista de seções identificadas na página",
                    items: {
                      type: "object",
                      properties: {
                        order: { 
                          type: "number", 
                          description: "Ordem da seção na página (1, 2, 3...)" 
                        },
                        blockType: { 
                          type: "string", 
                          description: "Tipo do bloco: YouTubeVideo, Image, Button, Hero, FAQ, Testimonials, RichText, Section, CustomBlock" 
                        },
                        props: { 
                          type: "object", 
                          description: "Props específicas do bloco conforme sua definição" 
                        },
                        htmlContent: { 
                          type: "string", 
                          description: "HTML completo da seção (OBRIGATÓRIO para CustomBlock)" 
                        },
                        cssContent: { 
                          type: "string", 
                          description: "CSS inline/específico da seção (para CustomBlock)" 
                        },
                        reasoning: { 
                          type: "string", 
                          description: "Explicação de por que escolheu este bloco" 
                        }
                      },
                      required: ["order", "blockType", "props", "reasoning"],
                      additionalProperties: false
                    }
                  },
                  pageComplexity: {
                    type: "string",
                    enum: ["simple", "moderate", "complex"],
                    description: "Nível de complexidade visual da página"
                  },
                  summary: {
                    type: "string",
                    description: "Resumo da análise (1-2 frases)"
                  }
                },
                required: ["sections", "pageComplexity", "summary"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "map_page_to_blocks" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI-ANALYZE] API error:', response.status, errorText);
      
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
    console.log('[AI-ANALYZE] Raw response:', JSON.stringify(data).substring(0, 500));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function?.name !== 'map_page_to_blocks') {
      console.error('[AI-ANALYZE] No valid tool call in response');
      return new Response(
        JSON.stringify({ 
          error: 'AI did not return expected structure',
          fallback: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error('[AI-ANALYZE] Failed to parse tool arguments:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to parse AI response',
          fallback: true 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AI-ANALYZE] Success: ${result.sections?.length || 0} sections, complexity: ${result.pageComplexity}`);
    console.log(`[AI-ANALYZE] Summary: ${result.summary}`);

    // Validate sections
    const validSections = (result.sections || []).filter((s: BlockSection) => {
      if (!s.blockType || !s.props) return false;
      if (s.blockType === 'CustomBlock' && !s.htmlContent) {
        console.warn(`[AI-ANALYZE] CustomBlock without htmlContent, skipping`);
        return false;
      }
      return true;
    });

    return new Response(
      JSON.stringify({
        success: true,
        sections: validSections,
        pageComplexity: result.pageComplexity || 'moderate',
        summary: result.summary || 'Análise concluída',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[AI-ANALYZE] Error:', error);
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
