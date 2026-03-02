import { createClient } from "npm:@supabase/supabase-js@2";
import { aiChatCompletionJSON } from "../_shared/ai-router.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.2.0"; // Generate clean HTML for landing_page targetType instead of raw scraped HTML
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Block schema reference for the AI prompt
const BLOCK_SCHEMA_REFERENCE = `
## Available Block Types and Their Props

### Layout
- **Page**: Root container. Props: {}
- **Section**: Section wrapper. Props: { backgroundColor?: string, paddingX?: number, paddingY?: number, marginTop?: number, marginBottom?: number, gap?: number, fullWidth?: boolean }
- **Container**: Container with max-width. Props: { maxWidth: 'sm'|'md'|'lg'|'xl'|'full', padding?: number }

### Content
- **RichText**: Formatted text (HTML). Props: { content: string (HTML), fontFamily?: string, fontSize?: 'xs'|'sm'|'base'|'lg'|'xl'|'2xl', fontWeight?: 'normal'|'500'|'600'|'bold' }
- **Button**: CTA button. Props: { text: string, url: string, variant: 'primary'|'secondary'|'outline', size: 'sm'|'md'|'lg', fullWidth?: boolean, alignment: 'left'|'center'|'right' }
- **Accordion**: FAQ/accordion. Props: { title?: string, items: Array<{ question: string, answer: string }>, allowMultiple?: boolean }
- **FeatureList**: Feature list with icons. Props: { title?: string, items: Array<{ icon: string, title: string, description: string }>, layout: 'grid'|'list', columns: 2|3|4 }
- **ContentColumns**: Text + image side by side. Props: { title?: string, content: string (HTML), imageDesktop: string, imageMobile?: string, imagePosition: 'left'|'right', imageWidth: '40'|'50'|'60' }
- **StepsTimeline**: Steps/timeline. Props: { title?: string, subtitle?: string, steps: Array<{ number: number, title: string, description: string }>, layout: 'horizontal'|'vertical' }
- **StatsNumbers**: Statistics. Props: { title?: string, items: Array<{ number: string, label: string }>, layout: 'horizontal'|'vertical' }
- **CountdownTimer**: Countdown. Props: { title: string, subtitle?: string, endDate: string, backgroundColor?: string, textColor?: string }
- **Reviews**: Testimonials. Props: { title: string, reviews: Array<{ name: string, rating: number, text: string, avatar?: string }>, visibleCount?: number }
- **InfoHighlights**: Benefits bar. Props: { items: Array<{ icon: string, title: string, description: string }>, layout: 'horizontal'|'vertical' }
- **Newsletter**: Newsletter form. Props: { title: string, subtitle?: string, buttonText?: string, layout: 'horizontal'|'vertical'|'card' }

### Media
- **Banner**: Single banner or carousel. Props for single: { mode: 'single', imageDesktop: string, imageMobile?: string, title?: string, subtitle?: string, buttonText?: string, buttonUrl?: string, linkUrl?: string, height: 'auto'|'sm'|'md'|'lg'|'full', overlayOpacity?: number }. Props for carousel: { mode: 'carousel', slides: Array<{ imageDesktop: string, imageMobile?: string, title?: string, subtitle?: string, buttonText?: string, buttonUrl?: string, linkUrl?: string }>, autoplaySeconds?: number, showArrows?: boolean, showDots?: boolean }
- **Image**: Single image. Props: { imageDesktop: string, imageMobile?: string, alt?: string, linkUrl?: string, objectFit: 'cover'|'contain'|'fill', maxWidth: 'sm'|'md'|'lg'|'xl'|'full' }
- **ImageCarousel**: Image carousel. Props: { title?: string, images: Array<{ imageDesktop: string, imageMobile?: string, alt?: string }>, slidesPerView: 1|2|3|4, aspectRatio: '16:9'|'4:3'|'1:1'|'21:9'|'auto', showArrows?: boolean, showDots?: boolean, autoplay?: boolean, gap: 'sm'|'md'|'lg' }
- **ImageGallery**: Image gallery grid. Props: { title?: string, images: Array<{ imageDesktop: string, imageMobile?: string, alt?: string }>, columns: 2|3|4, gap: 'sm'|'md'|'lg', aspectRatio: '16:9'|'4:3'|'1:1' }
- **YouTubeVideo**: Single YouTube embed. Props: { title?: string, youtubeUrl: string, widthPreset: 'sm'|'md'|'lg'|'xl'|'full', aspectRatio: '16:9'|'4:3'|'1:1' }
- **VideoCarousel**: Video carousel. Props: { title?: string, videos: Array<{ url: string, title?: string }>, showControls?: boolean, aspectRatio: '16:9'|'4:3'|'1:1'|'9:16' }
- **LogosCarousel**: Partner logos. Props: { title?: string, logos: Array<{ imageDesktop: string, alt?: string, url?: string }>, autoplay?: boolean, grayscale?: boolean, columns: 3|4|5|6 }
- **TextBanners**: Text + banner images. Props: { title: string, text: string, imageDesktop1: string, imageMobile1?: string, imageDesktop2?: string, imageMobile2?: string, layout: 'text-left'|'text-right', ctaEnabled?: boolean, ctaText?: string, ctaUrl?: string }

### Layout Utilities
- **Spacer**: Vertical spacing. Props: { height: 'xs'|'sm'|'md'|'lg'|'xl' }
- **Divider**: Horizontal line. Props: { style: 'solid'|'dashed'|'dotted', color?: string }
- **Columns**: Multi-column layout. Props: { columns: 2|3|4, gap?: number, stackOnMobile?: boolean }

### Special
- **HTMLSection**: Raw HTML/CSS. Props: { htmlContent: string, cssContent?: string, blockName?: string, baseUrl?: string }

## IMPORTANT RULES:
1. The root must be { id: "root", type: "Page", props: {}, children: [...] }
2. First child must be { type: "Header", props: {} }
3. Last child must be { type: "Footer", props: {} }
4. All other content goes between Header and Footer
5. Every block MUST have a unique "id" (use descriptive lowercase with random suffix, e.g. "banner-hero-a1b2")
6. Use Section blocks to wrap groups of content blocks
7. For images, use the EXACT URLs from the source HTML. Do NOT generate placeholder URLs.
8. For YouTube videos, extract the video ID from any format (watch?v=, youtu.be/, embed/) and use the full URL format: https://www.youtube.com/watch?v=VIDEO_ID
9. Identify visual patterns: hero banners, image carousels, video sections, testimonials, FAQ, feature lists, stats, timelines, etc.
10. Map each visual pattern to the BEST matching native block type
11. Preserve the visual hierarchy and order of sections from the source
12. Use Spacer blocks between major sections for visual separation
`;

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
}

Deno.serve(async (req) => {
  console.log(`[ai-import-page][${VERSION}] Request received`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url, tenantId, pageId, targetType } = await req.json();

    if (!url || !tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL e tenantId são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-import-page][${VERSION}] Processing URL: ${url} for tenant: ${tenantId}`);

    // Step 1: Scrape the URL with Firecrawl
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl não configurado. Conecte o Firecrawl nas configurações.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log(`[ai-import-page][${VERSION}] Step 1: Scraping with Firecrawl...`);
    
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['html', 'markdown', 'links', 'screenshot'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error(`[ai-import-page][${VERSION}] Firecrawl error:`, scrapeData);
      return new Response(
        JSON.stringify({ success: false, error: `Falha ao acessar a URL: ${scrapeData.error || 'Erro desconhecido'}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = scrapeData.data?.html || scrapeData.html || '';
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    if (!html && !markdown) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível extrair conteúdo da URL' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ai-import-page][${VERSION}] Step 2: Analyzing with AI (HTML: ${html.length} chars, MD: ${markdown.length} chars)`);

    // Step 2: Use Gemini to analyze and map to BlockNode
    const systemPrompt = `Você é um especialista em converter páginas web em estruturas de blocos nativos para um builder visual de e-commerce.

Sua tarefa é analisar o HTML/conteúdo de uma página web e convertê-lo em uma árvore JSON de BlockNode que utiliza EXCLUSIVAMENTE os blocos nativos do nosso sistema.

${BLOCK_SCHEMA_REFERENCE}

## Processo de Análise:
1. Identifique CADA seção visual da página (banners, carrosséis, textos, vídeos, FAQs, etc.)
2. Para cada seção, determine o bloco nativo mais adequado
3. Extraia TODAS as URLs de imagens e vídeos exatamente como estão no HTML original
4. Preserve a ordem visual das seções
5. Use Section + Container para organizar blocos de conteúdo
6. Adicione Spacer entre seções principais para separação visual

## Regras Críticas:
- NUNCA invente URLs de imagens. Use EXATAMENTE as URLs encontradas no HTML.
- Para vídeos do YouTube, extraia o ID e use formato: https://www.youtube.com/watch?v=VIDEO_ID
- Se encontrar um carrossel de imagens, use ImageCarousel com slidesPerView adequado
- Se encontrar banners grandes no topo, use Banner (mode: single ou carousel)
- Se encontrar depoimentos/reviews, use Reviews
- Se encontrar FAQ/perguntas, use Accordion
- Se encontrar lista de benefícios com ícones, use FeatureList ou InfoHighlights
- Se encontrar estatísticas numéricas, use StatsNumbers
- Se encontrar timeline/passos, use StepsTimeline
- Se encontrar texto formatado longo, use RichText com HTML limpo
- Se encontrar vídeos do YouTube, use YouTubeVideo ou VideoCarousel
- Se encontrar logos de parceiros/marcas, use LogosCarousel
- Para seções que não se encaixam em nenhum bloco nativo, use HTMLSection como último recurso
- Headers e Footers da página original NÃO devem ser extraídos como conteúdo (nosso sistema tem Header/Footer próprios)

Responda APENAS com o JSON do BlockNode. Sem explicações, sem markdown, sem code blocks. Apenas o JSON puro.`;

    const userPrompt = `Analise esta página e converta em blocos nativos.

URL Original: ${formattedUrl}
Título da página: ${metadata.title || 'Sem título'}

## HTML da Página (principais seções):
${html.substring(0, 80000)}

## Conteúdo em Markdown (referência):
${markdown.substring(0, 20000)}

Gere a árvore BlockNode JSON completa, mapeando CADA seção visual para o bloco nativo mais adequado. Lembre-se: use as URLs de imagem EXATAS do HTML.`;

    const aiResponse = await aiChatCompletionJSON(
      "google/gemini-2.5-pro",
      {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        supabaseUrl: SUPABASE_URL,
        supabaseServiceKey: SUPABASE_SERVICE_KEY,
        logPrefix: '[ai-import-page]',
      }
    );

    if (!aiResponse?.data) {
      console.error(`[ai-import-page][${VERSION}] AI response empty`);
      return new Response(
        JSON.stringify({ success: false, error: 'IA não retornou resposta válida' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the AI response - extract JSON from the response
    let blockNodeJson: any;
    const responseContent = aiResponse.data.choices?.[0]?.message?.content || '';
    
    console.log(`[ai-import-page][${VERSION}] AI response length: ${responseContent.length}`);

    try {
      // Try direct parse first
      blockNodeJson = JSON.parse(responseContent);
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        blockNodeJson = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try finding JSON object pattern
        const firstBrace = responseContent.indexOf('{');
        const lastBrace = responseContent.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          blockNodeJson = JSON.parse(responseContent.substring(firstBrace, lastBrace + 1));
        } else {
          throw new Error('Não foi possível extrair JSON da resposta da IA');
        }
      }
    }

    // Validate the structure
    if (!blockNodeJson || blockNodeJson.type !== 'Page') {
      // If the AI didn't wrap in Page, wrap it
      if (blockNodeJson && Array.isArray(blockNodeJson.children)) {
        blockNodeJson = {
          id: 'root',
          type: 'Page',
          props: {},
          children: blockNodeJson.children,
        };
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Estrutura de blocos inválida retornada pela IA' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Ensure root has id
    blockNodeJson.id = blockNodeJson.id || 'root';

    // Ensure Header is first child and Footer is last child
    const children = blockNodeJson.children || [];
    const hasHeader = children.some((c: any) => c.type === 'Header');
    const hasFooter = children.some((c: any) => c.type === 'Footer');
    
    if (!hasHeader) {
      children.unshift({ id: generateId('header'), type: 'Header', props: {} });
    }
    if (!hasFooter) {
      children.push({ id: generateId('footer'), type: 'Footer', props: {} });
    }

    // Ensure all nodes have IDs
    function ensureIds(node: any, prefix = 'block') {
      if (!node.id) {
        node.id = generateId(prefix);
      }
      if (node.children) {
        node.children.forEach((child: any) => ensureIds(child, child.type?.toLowerCase() || 'child'));
      }
    }
    ensureIds(blockNodeJson);

    // Count sections for reporting
    const sectionCount = children.filter((c: any) => c.type !== 'Header' && c.type !== 'Footer').length;

    console.log(`[ai-import-page][${VERSION}] Successfully generated ${sectionCount} sections`);

    // Step 3: Save based on targetType
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let savedPageId = pageId || null;

    if (targetType === 'landing_page') {
      // ===== LANDING PAGE MODE: Generate clean HTML and save to ai_landing_pages =====
      console.log(`[ai-import-page][${VERSION}] Step 3: Generating clean HTML for AI Landing Page`);
      
      // Use AI to generate a clean, self-contained HTML page from the scraped content
      const htmlGenPrompt = `Você é um especialista em criar landing pages de alta conversão.
Sua tarefa é recriar fielmente a página web abaixo como um HTML completo, moderno, responsivo e self-contained.

## REGRAS OBRIGATÓRIAS:
1. Gere HTML completo começando com <!DOCTYPE html>
2. Use CSS inline ou em tags <style> dentro do HTML
3. O design deve ser FIEL ao original: mesmas cores, layout, estrutura visual
4. COPIE E COLE as URLs de imagens EXATAS do HTML original - NUNCA use placeholder
5. Extraia vídeos do YouTube e use iframes com embed
6. O HTML deve ser self-contained (não depender de arquivos externos exceto Google Fonts e CDNs de imagem)
7. Use fontes do Google Fonts via @import quando apropriado
8. Mantenha responsividade (mobile-first com media queries)
9. NÃO inclua header/footer/nav do site original - apenas o CONTEÚDO principal
10. Preserve textos, títulos, descrições, preços e CTAs do original
11. Mantenha a mesma hierarquia visual e ordem das seções
12. Use animações CSS sutis para melhorar a experiência
13. Otimize para conversão mantendo CTAs visíveis e atraentes

## IMPORTANTE:
- Retorne APENAS o HTML completo, sem explicações ou markdown
- O HTML DEVE começar com <!DOCTYPE html>`;

      const htmlGenUserPrompt = `Recrie fielmente esta página como HTML self-contained:

URL Original: ${formattedUrl}
Título: ${metadata.title || 'Sem título'}

## HTML Original (seções principais):
${html.substring(0, 100000)}

## Conteúdo em Markdown (referência adicional):
${markdown.substring(0, 30000)}

Gere o HTML completo, mantendo fidelidade visual ao original. Use as URLs de imagem EXATAS do HTML.`;

      const htmlAiResponse = await aiChatCompletionJSON(
        "google/gemini-2.5-pro",
        {
          messages: [
            { role: "system", content: htmlGenPrompt },
            { role: "user", content: htmlGenUserPrompt },
          ],
        },
        {
          supabaseUrl: SUPABASE_URL,
          supabaseServiceKey: SUPABASE_SERVICE_KEY,
          logPrefix: '[ai-import-page-html]',
        }
      );

      let generatedHtml = '';
      if (htmlAiResponse?.data?.choices?.[0]?.message?.content) {
        generatedHtml = htmlAiResponse.data.choices[0].message.content
          .replace(/^```html?\n?/i, "")
          .replace(/\n?```$/i, "")
          .trim();
      }
      
      // Fallback to raw HTML if AI generation fails
      if (!generatedHtml || !generatedHtml.includes('<!DOCTYPE') && !generatedHtml.includes('<html')) {
        console.log(`[ai-import-page][${VERSION}] HTML generation fallback to raw scraped HTML`);
        generatedHtml = html.substring(0, 500000);
      }

      console.log(`[ai-import-page][${VERSION}] Generated clean HTML: ${generatedHtml.length} chars`);
      
      const pageTitle = metadata.title || 'Landing Page Importada';
      const baseSlug = pageTitle
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .substring(0, 50);
      const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;
      
      // Get user ID from claims
      const userId = claimsData.claims.sub;

      if (pageId) {
        // Update existing landing page
        const { error: updateError } = await adminClient
          .from('ai_landing_pages')
          .update({
            generated_html: generatedHtml,
            initial_prompt: `Importado de: ${formattedUrl}`,
            reference_url: formattedUrl,
            status: 'draft',
            updated_at: new Date().toISOString(),
          })
          .eq('id', pageId)
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error(`[ai-import-page][${VERSION}] LP update error:`, updateError);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao atualizar: ${updateError.message}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        savedPageId = pageId;
        console.log(`[ai-import-page][${VERSION}] Landing page updated: ${savedPageId}`);
      } else {
        // Create new landing page
        const { data: newLP, error: insertError } = await adminClient
          .from('ai_landing_pages')
          .insert({
            tenant_id: tenantId,
            name: pageTitle,
            slug: uniqueSlug,
            status: 'draft',
            is_published: false,
            generated_html: generatedHtml,
            initial_prompt: `Importado de: ${formattedUrl}`,
            reference_url: formattedUrl,
            created_by: userId,
            current_version: 1,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[ai-import-page][${VERSION}] LP create error:`, insertError);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao criar landing page: ${insertError.message}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        savedPageId = newLP.id;
        console.log(`[ai-import-page][${VERSION}] Landing page created: ${savedPageId}`);
      }
    } else {
      // ===== STORE PAGE MODE: Save to store_pages =====
      if (pageId) {
        // Update existing page
        console.log(`[ai-import-page][${VERSION}] Step 3: Saving to existing page ${pageId}`);
        
        const { error: updateError } = await adminClient
          .from('store_pages')
          .update({
            content: blockNodeJson,
            template_id: null,
            individual_content: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', pageId)
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error(`[ai-import-page][${VERSION}] Save error:`, updateError);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao salvar: ${updateError.message}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log(`[ai-import-page][${VERSION}] Existing page updated successfully`);
      } else {
        // Create new page automatically
        console.log(`[ai-import-page][${VERSION}] Step 3: Creating new page`);
        
        const pageTitle = metadata.title || 'Página Importada';
        const baseSlug = pageTitle
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
          .substring(0, 50);
        const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

        const { data: newPage, error: insertError } = await adminClient
          .from('store_pages')
          .insert({
            tenant_id: tenantId,
            title: pageTitle,
            slug: uniqueSlug,
            type: 'institutional',
            status: 'draft',
            content: blockNodeJson,
            template_id: null,
            individual_content: null,
            is_published: false,
          })
          .select('id')
          .single();

        if (insertError) {
          console.error(`[ai-import-page][${VERSION}] Create error:`, insertError);
          return new Response(
            JSON.stringify({ success: false, error: `Erro ao criar página: ${insertError.message}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        savedPageId = newPage.id;
        console.log(`[ai-import-page][${VERSION}] New page created: ${savedPageId}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          content: blockNodeJson,
          sectionsCount: sectionCount,
          sourceUrl: formattedUrl,
          sourceTitle: metadata.title || '',
          pageId: savedPageId,
          targetType: targetType || 'page',
          provider: aiResponse.provider,
          model: aiResponse.model,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[ai-import-page][${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
