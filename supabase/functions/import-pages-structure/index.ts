import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Types
interface ContentPrimitive {
  type: 'heading' | 'paragraph' | 'image' | 'video' | 'button' | 'list';
  content: string;
  level?: number; // for headings (h1=1, h2=2, etc)
  src?: string; // for images/videos
  alt?: string; // for images
  href?: string; // for buttons
  items?: string[]; // for lists
}

interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BlockNode[];
}

// Generate unique block ID
function generateBlockId(prefix: string = 'block'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract content primitives from HTML (deterministic, no AI)
function extractContentPrimitives(html: string): ContentPrimitive[] {
  const primitives: ContentPrimitive[] = [];
  
  // Find main content area
  let mainContent = html;
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    mainContent = mainMatch[1];
  }
  
  // Remove script, style, nav, header, footer, aside tags
  mainContent = mainContent
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove hidden elements
  mainContent = mainContent.replace(/<[^>]*(hidden|display:\s*none|aria-hidden="true")[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
  
  // Remove common footer patterns (CNPJ, policies, etc.)
  const footerPatterns = [
    /CNPJ[:\s]*[\d.\/-]+/gi,
    /políticas?\s*(de\s*)?(privacidade|devolução|troca)/gi,
    /termos\s*de\s*(uso|serviço)/gi,
    /mais\s*pesquisad[oa]s/gi,
    /trending/gi,
  ];
  for (const pattern of footerPatterns) {
    if (pattern.test(mainContent)) {
      // If footer content detected, try to cut it
      const idx = mainContent.search(pattern);
      if (idx > mainContent.length * 0.6) {
        mainContent = mainContent.substring(0, idx);
      }
    }
  }
  
  // Extract headings (h1-h3)
  const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = headingRegex.exec(mainContent)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 2 && text.length < 500) {
      primitives.push({ type: 'heading', content: text, level });
    }
  }
  
  // Extract paragraphs
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = paragraphRegex.exec(mainContent)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 10 && text.length < 2000) {
      // Filter out noise
      if (!/^(share|compartilhar|1\/1|carregando)/i.test(text)) {
        primitives.push({ type: 'paragraph', content: text });
      }
    }
  }
  
  // Extract YouTube videos
  const youtubeRegex = /(youtube\.com\/embed\/[a-zA-Z0-9_-]+|youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/gi;
  while ((match = youtubeRegex.exec(mainContent)) !== null) {
    const videoUrl = match[1].startsWith('http') ? match[1] : `https://www.${match[1]}`;
    const videoId = extractYouTubeId(videoUrl);
    if (videoId) {
      primitives.push({ 
        type: 'video', 
        content: `https://www.youtube.com/embed/${videoId}`,
        src: videoId
      });
    }
  }
  
  // Extract images (main content images only)
  const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  while ((match = imageRegex.exec(mainContent)) !== null) {
    const src = match[1];
    const alt = match[2] || '';
    // Filter out icons, logos, tracking pixels
    if (src && !src.includes('icon') && !src.includes('logo') && !src.includes('1x1') && !src.includes('pixel')) {
      if (src.startsWith('http') || src.startsWith('//')) {
        const fullSrc = src.startsWith('//') ? `https:${src}` : src;
        primitives.push({ type: 'image', content: alt || 'Imagem', src: fullSrc, alt });
      }
    }
  }
  
  // Extract buttons/CTAs
  const buttonRegex = /<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*btn[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = buttonRegex.exec(mainContent)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text && text.length > 2 && text.length < 100 && href) {
      primitives.push({ type: 'button', content: text, href });
    }
  }
  
  // Also check for buttons with common CTA patterns
  const ctaPatterns = [
    /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?(consulte|comprar|saiba mais|ver mais|clique aqui|fale conosco|whatsapp)[\s\S]*?)<\/a>/gi,
  ];
  for (const pattern of ctaPatterns) {
    while ((match = pattern.exec(mainContent)) !== null) {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim();
      if (text && text.length > 2 && text.length < 100 && href) {
        // Avoid duplicates
        const exists = primitives.some(p => p.type === 'button' && p.content === text);
        if (!exists) {
          primitives.push({ type: 'button', content: text, href });
        }
      }
    }
  }
  
  console.log(`[STRUCTURE-IMPORT] Extracted ${primitives.length} primitives:`, 
    primitives.map(p => `${p.type}${p.level ? `(h${p.level})` : ''}`).join(', '));
  
  return primitives;
}

// Convert primitives to native blocks
function primitivesToBlocks(primitives: ContentPrimitive[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  for (const primitive of primitives) {
    switch (primitive.type) {
      case 'heading':
        const headingTag = primitive.level === 1 ? 'h1' : primitive.level === 2 ? 'h2' : 'h3';
        blocks.push({
          id: generateBlockId('heading'),
          type: 'RichText',
          props: {
            content: `<${headingTag}>${primitive.content}</${headingTag}>`,
            textAlign: 'center',
          },
        });
        break;
        
      case 'paragraph':
        blocks.push({
          id: generateBlockId('text'),
          type: 'RichText',
          props: {
            content: `<p>${primitive.content}</p>`,
            textAlign: 'left',
          },
        });
        break;
        
      case 'video':
        blocks.push({
          id: generateBlockId('video'),
          type: 'YouTubeVideo',
          props: {
            youtubeUrl: primitive.content,
            widthPreset: 'xl',
            aspectRatio: '16:9',
          },
        });
        break;
        
      case 'image':
        blocks.push({
          id: generateBlockId('image'),
          type: 'Image',
          props: {
            imageDesktop: primitive.src,
            imageMobile: primitive.src,
            alt: primitive.alt || primitive.content,
            aspectRatio: 'auto',
          },
        });
        break;
        
      case 'button':
        blocks.push({
          id: generateBlockId('button'),
          type: 'Button',
          props: {
            text: primitive.content,
            url: primitive.href || '#',
            variant: 'primary',
            size: 'lg',
            fullWidth: false,
            backgroundColor: '#000000',
            textColor: '#ffffff',
          },
        });
        break;
        
      case 'list':
        if (primitive.items && primitive.items.length > 0) {
          const listHtml = `<ul>${primitive.items.map(item => `<li>${item}</li>`).join('')}</ul>`;
          blocks.push({
            id: generateBlockId('list'),
            type: 'RichText',
            props: {
              content: listHtml,
              textAlign: 'left',
            },
          });
        }
        break;
    }
  }
  
  return blocks;
}

// Wrap blocks in a proper page structure
function createPageStructure(blocks: BlockNode[]): BlockNode {
  return {
    id: generateBlockId('page'),
    type: 'Page',
    props: {},
    children: [
      {
        id: generateBlockId('header'),
        type: 'Header',
        props: {},
      },
      {
        id: generateBlockId('main-section'),
        type: 'Section',
        props: {
          paddingY: 48,
          paddingX: 16,
          gap: 24,
        },
        children: [
          {
            id: generateBlockId('container'),
            type: 'Container',
            props: {
              maxWidth: 'lg',
              padding: 0,
              gap: 24,
            },
            children: blocks,
          },
        ],
      },
      {
        id: generateBlockId('footer'),
        type: 'Footer',
        props: {},
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, url, slug, createAsDraft = true } = await req.json();

    console.log(`[STRUCTURE-IMPORT] Starting import for tenant=${tenantId}, url=${url}, slug=${slug}`);

    if (!tenantId || !url) {
      throw new Error('tenantId and url are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if slug already exists
    const { data: existingPage } = await supabase
      .from('store_pages')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .single();

    if (existingPage) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Página com slug "${slug}" já existe. Escolha outro slug.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch page HTML
    let html = '';
    
    if (firecrawlApiKey) {
      console.log('[STRUCTURE-IMPORT] Using Firecrawl for extraction');
      const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['html'],
          waitFor: 3000,
        }),
      });
      
      if (firecrawlResponse.ok) {
        const data = await firecrawlResponse.json();
        html = data.data?.html || '';
      }
    }
    
    if (!html) {
      console.log('[STRUCTURE-IMPORT] Fallback to direct fetch');
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      html = await response.text();
    }

    if (!html || html.length < 500) {
      throw new Error('Não foi possível extrair conteúdo da página');
    }

    console.log(`[STRUCTURE-IMPORT] Fetched HTML: ${html.length} chars`);

    // Extract content primitives
    const primitives = extractContentPrimitives(html);
    
    if (primitives.length === 0) {
      throw new Error('Nenhum conteúdo válido encontrado na página');
    }

    // Convert to native blocks
    const blocks = primitivesToBlocks(primitives);
    
    console.log(`[STRUCTURE-IMPORT] Created ${blocks.length} native blocks:`, 
      blocks.map(b => b.type).join(', '));

    // Create page structure
    const pageContent = createPageStructure(blocks);

    // Generate title from first heading or URL
    let pageTitle = 'Página Importada';
    const firstHeading = primitives.find(p => p.type === 'heading');
    if (firstHeading) {
      pageTitle = firstHeading.content.substring(0, 100);
    } else {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          pageTitle = pathParts[pathParts.length - 1]
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        }
      } catch {}
    }

    // Insert into database
    const { data: newPage, error: insertError } = await supabase
      .from('store_pages')
      .insert({
        tenant_id: tenantId,
        title: pageTitle,
        slug,
        content: pageContent,
        status: createAsDraft ? 'draft' : 'published',
        is_published: !createAsDraft,
        type: 'institutional',
        seo_title: pageTitle,
        seo_description: `${pageTitle} - Página importada`,
      })
      .select('id, title, slug')
      .single();

    if (insertError) {
      console.error('[STRUCTURE-IMPORT] Insert error:', insertError);
      throw new Error(`Erro ao salvar página: ${insertError.message}`);
    }

    console.log(`[STRUCTURE-IMPORT] SUCCESS: Created page id=${newPage.id}, slug=${newPage.slug}`);

    return new Response(
      JSON.stringify({
        success: true,
        pageId: newPage.id,
        pageTitle: newPage.title,
        pageSlug: newPage.slug,
        blocksCount: blocks.length,
        primitivesExtracted: primitives.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[STRUCTURE-IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
