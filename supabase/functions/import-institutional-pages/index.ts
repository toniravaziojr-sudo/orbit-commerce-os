// =====================================================
// IMPORT INSTITUTIONAL PAGES - Sistema Aprimorado
// =====================================================
// COMPORTAMENTO: 
// 1. Navegar nos links do footer e header
// 2. Identificar páginas SIMPLES (texto, imagem, vídeo)
// 3. Excluir páginas com grid de produtos ou funcionalidades complexas
// 4. Extrair conteúdo na ordem e montar blocos no builder
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

// =====================================================
// TYPES
// =====================================================

interface ContentBlock {
  type: 'text' | 'image' | 'video' | 'heading';
  content: string;
  order: number;
  metadata?: {
    level?: number; // for headings
    alt?: string; // for images
    width?: number;
    height?: number;
  };
}

interface PageCandidate {
  url: string;
  slug: string;
  title: string;
  isInstitutional: boolean;
  hasProductGrid: boolean;
  hasComplexFeatures: boolean;
  contentBlocks: ContentBlock[];
}

// =====================================================
// PADRÕES DE URL INSTITUCIONAL (candidatos)
// =====================================================
const INSTITUTIONAL_URL_PATTERNS = [
  /\/(?:pages?|pagina|paginas|policies|policy|institucional)\//i,
  /\/(?:sobre|about|quem-somos|nossa-historia|about-us)/i,
  /\/(?:politica|privacy|privacidade|lgpd)/i,
  /\/(?:termos|terms|condicoes|regulamento|terms-of-service)/i,
  /\/(?:troca|devolucao|exchange|return|refund|trocas-e-devolucoes)/i,
  /\/(?:entrega|shipping|frete|envio|delivery|prazos)/i,
  /\/(?:garantia|warranty)/i,
  /\/(?:faq|perguntas|duvidas|ajuda-frequente)/i,
  /\/(?:como-comprar|how-to-buy|passo-a-passo)/i,
  /\/(?:seguranca|security)/i,
  /\/(?:pagamento|payment|formas-de-pagamento)/i,
  /\/(?:quem-somos|nossa-historia|historia|missao)/i,
];

// =====================================================
// PADRÕES DE EXCLUSÃO (páginas funcionais/complexas)
// =====================================================
const EXCLUDED_URL_PATTERNS = [
  /^\/?$/,                                    // Home
  /\/cart|\/carrinho|\/sacola|\/bag/i,        // Carrinho
  /\/checkout|\/finalizar/i,                  // Checkout
  /\/login|\/signin|\/sign-in|\/entrar/i,     // Login
  /\/register|\/signup|\/sign-up|\/cadastro/i, // Cadastro
  /\/account|\/minha-conta|\/my-account|\/perfil/i, // Conta
  /\/wishlist|\/favoritos/i,                  // Favoritos
  /\/search|\/busca|\/pesquisa/i,             // Busca
  /\/track|\/rastreio|\/rastrear|\/tracking/i, // Rastreio
  /\/blog|\/artigo|\/article|\/post|\/news/i, // Blog
  /\/contato|\/contact|\/fale-conosco/i,      // Contato (geralmente form)
  /\/produto|\/product|\/p\/|\/item\//i,      // Produto
  /\/categoria|\/category|\/colecao|\/collection|\/c\//i, // Categoria
  /\/collections?\/[^/]+/i,                   // Collections (Shopify)
  /\/departamento|\/department/i,             // Departamento
  /\/pedido|\/order|\/orders|\/meus-pedidos/i, // Pedidos
  /\/api\//i,                                 // API
  /\.(?:jpg|jpeg|png|gif|webp|svg|pdf|xml|json|css|js)$/i, // Arquivos
  /\/shop\/|\/loja\//i,                       // Shop pages (usually category)
];

// =====================================================
// COMPLEX FEATURE PATTERNS (exclusão)
// =====================================================
const COMPLEX_FEATURE_PATTERNS = [
  // Product grids
  /<(?:div|article|li)[^>]*class="[^"]*(?:product|item)-card[^"]*"/gi,
  /<ul[^>]*class="[^"]*products[^"]*"/gi,
  /<div[^>]*class="[^"]*product-grid[^"]*"/gi,
  // Forms (complex)
  /<form[^>]*(?:action|method)[^>]*>/gi,
  // Login/register
  /<input[^>]*type="(?:password|email)"[^>]*>/gi,
  // Shopping features
  /(?:add.?to.?cart|adicionar.?ao.?carrinho)/gi,
  /data-product-id=/gi,
  // Price indicators (multiple = product listing)
  /R\$\s*\d+[,.]?\d*/g,
];

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function discoverLinks(storeUrl: string): Promise<string[]> {
  if (!FIRECRAWL_API_KEY) return [];

  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: storeUrl,
        formats: ['html', 'links'],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    if (!response.ok) return [];
    const data = await response.json();
    
    // Also extract links from footer specifically
    const html = data.data?.html || data?.html || '';
    const links = data.data?.links || data?.links || [];
    
    // Extract footer links specifically
    const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
    if (footerMatch) {
      const footerHtml = footerMatch[1];
      const linkPattern = /href="([^"]+)"/gi;
      let match;
      while ((match = linkPattern.exec(footerHtml)) !== null) {
        const href = match[1];
        if (href && !links.includes(href)) {
          links.push(href);
        }
      }
    }
    
    return links;
  } catch {
    return [];
  }
}

function extractSlug(pathname: string): string {
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length === 0) return '';

  const platformPrefixes = ['pages', 'pagina', 'paginas', 'institucional', 'policies', 'policy', 'info'];
  let slugParts = pathParts;
  if (platformPrefixes.includes(pathParts[0].toLowerCase())) {
    slugParts = pathParts.slice(1);
  }

  return slugParts.join('-').toLowerCase() || pathParts[pathParts.length - 1].toLowerCase();
}

function formatTitle(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// =====================================================
// PAGE ANALYSIS & CONTENT EXTRACTION
// =====================================================

async function analyzePage(pageUrl: string): Promise<PageCandidate | null> {
  if (!FIRECRAWL_API_KEY) return null;

  try {
    console.log(`[Pages] Analyzing: ${pageUrl}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: pageUrl,
        formats: ['html', 'markdown'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    const html = data.data?.html || data?.html || '';
    const markdown = data.data?.markdown || data?.markdown || '';
    
    if (!html) return null;

    // Extract main content (remove header/footer/nav/sidebars/scripts)
    let mainContent = html;
    
    // Remove common wrapper elements that contain products
    mainContent = mainContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    mainContent = mainContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    mainContent = mainContent.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    mainContent = mainContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    mainContent = mainContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    // Remove common product showcase sections (header/footer ads, related products, etc.)
    mainContent = mainContent.replace(/<div[^>]*class="[^"]*(?:product-carousel|products-slider|related-products|upsell|cross-sell|announcement|promo-bar|top-bar|sticky-bar|floating)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    mainContent = mainContent.replace(/<section[^>]*class="[^"]*(?:products|shop|collection|showcase|featured)[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '');
    mainContent = mainContent.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

    // Try to find the actual main content area FIRST
    const mainAreaMatch = mainContent.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                          mainContent.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                          mainContent.match(/<div[^>]*class="[^"]*(?:page-content|main-content|entry-content|content-area|page-body|rte|shopify-policy)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    // If we found a specific content area, analyze only that
    const contentToAnalyze = mainAreaMatch ? mainAreaMatch[1] : mainContent;
    
    // Check for complex features (product grids, forms, etc.) - ONLY in content area
    let complexFeatureCount = 0;
    let priceCount = 0;
    
    // Count only prices that are in product card context
    const productPricePattern = /<(?:div|span)[^>]*class="[^"]*price[^"]*"[^>]*>[^<]*R\$[^<]*<\/(?:div|span)>/gi;
    const productPrices = contentToAnalyze.match(productPricePattern) || [];
    priceCount = productPrices.length;
    
    // Check for product card structures
    const productCards = contentToAnalyze.match(/<(?:div|article|li)[^>]*class="[^"]*(?:product-card|product-item|card-product)[^"]*"[^>]*>/gi) || [];
    
    // Check for add to cart buttons
    const addToCartButtons = contentToAnalyze.match(/(?:add.?to.?cart|adicionar.?ao.?carrinho|comprar)/gi) || [];
    
    complexFeatureCount = productCards.length + Math.floor(addToCartButtons.length / 2);
    
    // If page has actual product cards or many prices in product context, it's not institutional
    const hasProductGrid = priceCount >= 5 || productCards.length >= 2;
    const hasComplexFeatures = complexFeatureCount >= 4;
    
    // More lenient check - institutional pages can have SOME product mentions if it's mostly text
    const textContent = contentToAnalyze.replace(/<[^>]+>/g, ' ').trim();
    const wordCount = textContent.split(/\s+/).length;
    const isTextHeavy = wordCount > 200; // Significant text content
    
    // If it's text-heavy, be more lenient with product detection
    if (hasProductGrid && !isTextHeavy) {
      console.log(`[Pages] ✗ Product page (cards: ${productCards.length}, prices: ${priceCount}): ${pageUrl}`);
      return null;
    }
    
    if (hasComplexFeatures && !isTextHeavy) {
      console.log(`[Pages] ✗ Complex page (features: ${complexFeatureCount}): ${pageUrl}`);
      return null;
    }

    // Extract page title
    const titleMatch = mainContent.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                       html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : formatTitle(extractSlug(new URL(pageUrl).pathname));

    // Extract content blocks in order
    const contentBlocks: ContentBlock[] = [];
    let order = 0;

    // Find the main content area - more patterns for Shopify specifically
    const mainMatches = mainContent.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                       mainContent.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                       mainContent.match(/<div[^>]*class="[^"]*(?:rte|shopify-policy|page-content|main-content|entry-content|content-area|page-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
                       mainContent.match(/<div[^>]*class="[^"]*(?:page|policy|terms|privacy)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    const contentArea = mainMatches ? mainMatches[1] : mainContent;

    // Extract headings - more flexible pattern that handles inner tags
    const headingPattern = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let headingMatch;
    while ((headingMatch = headingPattern.exec(contentArea)) !== null) {
      const level = parseInt(headingMatch[1].charAt(1));
      // Strip all inner HTML tags to get text
      const text = headingMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (text && text.length > 1 && text.length < 200) { // Reasonable heading length
        contentBlocks.push({
          type: 'heading',
          content: text,
          order: order++,
          metadata: { level }
        });
      }
    }

    // Extract paragraphs - more flexible pattern
    const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let paragraphMatch;
    while ((paragraphMatch = paragraphPattern.exec(contentArea)) !== null) {
      // Strip HTML tags and normalize whitespace
      const text = paragraphMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (text && text.length > 15) { // Lower threshold
        contentBlocks.push({
          type: 'text',
          content: text,
          order: order++
        });
      }
    }

    // Also extract list items as text
    const listItemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let listMatch;
    while ((listMatch = listItemPattern.exec(contentArea)) !== null) {
      const text = listMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (text && text.length > 10) {
        contentBlocks.push({
          type: 'text',
          content: `• ${text}`,
          order: order++
        });
      }
    }

    // Extract divs with text content (fallback for poorly structured pages)
    if (contentBlocks.filter(b => b.type === 'text' || b.type === 'heading').length === 0) {
      // Try to extract any meaningful text content
      const plainText = contentArea
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (plainText.length > 100) {
        // Split into paragraphs by sentence groups
        const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [plainText];
        let currentParagraph = '';
        
        for (const sentence of sentences) {
          currentParagraph += sentence + ' ';
          if (currentParagraph.length > 200) {
            contentBlocks.push({
              type: 'text',
              content: currentParagraph.trim(),
              order: order++
            });
            currentParagraph = '';
          }
        }
        
        if (currentParagraph.trim().length > 30) {
          contentBlocks.push({
            type: 'text',
            content: currentParagraph.trim(),
            order: order++
          });
        }
      }
    }

    // Extract images (not icons, not tracking pixels)
    const imagePattern = /<img[^>]*src="([^"]+)"[^>]*>/gi;
    let imageMatch;
    const origin = new URL(pageUrl).origin;
    
    while ((imageMatch = imagePattern.exec(contentArea)) !== null) {
      let src = imageMatch[1];
      
      // Extract alt from the full match
      const altMatch = imageMatch[0].match(/alt="([^"]*)"/i);
      const alt = altMatch ? altMatch[1] : '';
      
      // Skip tracking pixels, icons, logos
      if (src.includes('pixel') || 
          src.includes('tracking') || 
          src.includes('icon') ||
          src.includes('logo') ||
          src.includes('data:image') ||
          src.includes('spinner') ||
          src.includes('loading') ||
          src.includes('1x1') ||
          src.includes('placeholder')) {
        continue;
      }
      
      // Normalize URL
      if (src.startsWith('//')) src = `https:${src}`;
      else if (src.startsWith('/')) src = `${origin}${src}`;
      
      contentBlocks.push({
        type: 'image',
        content: src,
        order: order++,
        metadata: { alt }
      });
    }

    // Extract videos (YouTube, Vimeo, HTML5)
    const videoPatterns = [
      /<iframe[^>]*src="([^"]*(?:youtube|vimeo|youtu\.be)[^"]*)"/gi,
      /<video[^>]*>[\s\S]*?<source[^>]*src="([^"]+)"/gi,
    ];
    
    for (const pattern of videoPatterns) {
      let videoMatch;
      while ((videoMatch = pattern.exec(contentArea)) !== null) {
        contentBlocks.push({
          type: 'video',
          content: videoMatch[1],
          order: order++
        });
      }
    }

    // Sort blocks by their position in HTML
    contentBlocks.sort((a, b) => a.order - b.order);

    // Validate: institutional pages should have at least some text
    const textBlocks = contentBlocks.filter(b => b.type === 'text' || b.type === 'heading');
    const mediaBlocks = contentBlocks.filter(b => b.type === 'image' || b.type === 'video');
    
    // More lenient: accept if there's any text OR if there's a title
    if (textBlocks.length === 0 && title.length < 3) {
      console.log(`[Pages] ✗ No text content: ${pageUrl}`);
      return null;
    }

    console.log(`[Pages] ✓ Institutional page: ${pageUrl} (${textBlocks.length} text, ${mediaBlocks.length} media blocks)`);

    return {
      url: pageUrl,
      slug: extractSlug(new URL(pageUrl).pathname),
      title,
      isInstitutional: true,
      hasProductGrid: false,
      hasComplexFeatures: false,
      contentBlocks
    };
  } catch (error) {
    console.error(`[Pages] Error analyzing ${pageUrl}:`, error);
    return null;
  }
}

// =====================================================
// BUILD PAGE CONTENT FOR BUILDER
// =====================================================

function buildPageContent(blocks: ContentBlock[]): any {
  // Create builder-compatible structure
  const children: any[] = [];
  
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        children.push({
          id: crypto.randomUUID(),
          type: 'RichText',
          props: {
            content: `<h${block.metadata?.level || 2}>${block.content}</h${block.metadata?.level || 2}>`,
            alignment: 'left'
          }
        });
        break;
      
      case 'text':
        children.push({
          id: crypto.randomUUID(),
          type: 'RichText',
          props: {
            content: `<p>${block.content}</p>`,
            alignment: 'left'
          }
        });
        break;
      
      case 'image':
        children.push({
          id: crypto.randomUUID(),
          type: 'Image',
          props: {
            src: block.content,
            alt: block.metadata?.alt || '',
            width: 'full'
          }
        });
        break;
      
      case 'video':
        children.push({
          id: crypto.randomUUID(),
          type: 'Video',
          props: {
            url: block.content,
            autoplay: false
          }
        });
        break;
    }
  }
  
  // Wrap in standard page structure
  return {
    id: 'root',
    type: 'Page',
    children: [
      {
        id: crypto.randomUUID(),
        type: 'Header',
        props: {}
      },
      {
        id: crypto.randomUUID(),
        type: 'Section',
        props: {
          padding: 'lg'
        },
        children: [
          {
            id: crypto.randomUUID(),
            type: 'Container',
            props: {
              maxWidth: 'md'
            },
            children
          }
        ]
      },
      {
        id: crypto.randomUUID(),
        type: 'Footer',
        props: {}
      }
    ]
  };
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, storeUrl } = await req.json();

    if (!tenantId || !storeUrl) {
      return jsonResponse({
        success: false,
        error: 'tenantId e storeUrl são obrigatórios',
        pages: [],
        skipped: [],
      });
    }

    if (!FIRECRAWL_API_KEY) {
      return jsonResponse({
        success: false,
        error: 'FIRECRAWL_API_KEY não configurada',
        pages: [],
        skipped: [],
      });
    }

    console.log(`[Pages] Starting import: ${storeUrl} for tenant ${tenantId}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Normalize URL
    let normalizedUrl = storeUrl.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const origin = new URL(normalizedUrl).origin;

    // 1. DISCOVER ALL LINKS (focusing on footer)
    const allLinks = await discoverLinks(normalizedUrl);
    console.log(`[Pages] Links discovered: ${allLinks.length}`);

    if (allLinks.length === 0) {
      return jsonResponse({
        success: false,
        error: 'Não foi possível descobrir links do site',
        pages: [],
        skipped: [],
      });
    }

    // 2. FILTER CANDIDATES
    const seen = new Set<string>();
    const candidateUrls: Array<{ url: string; slug: string }> = [];

    for (const link of allLinks) {
      if (!link.startsWith(origin)) continue;

      const cleanUrl = link.split('?')[0].split('#')[0].replace(/\/$/, '');
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);

      let pathname: string;
      try {
        pathname = new URL(cleanUrl).pathname.toLowerCase();
      } catch {
        continue;
      }

      // Exclude functional pages
      if (EXCLUDED_URL_PATTERNS.some(p => p.test(pathname))) continue;

      // Check if matches institutional patterns
      if (!INSTITUTIONAL_URL_PATTERNS.some(p => p.test(pathname))) continue;

      const slug = extractSlug(pathname);
      if (!slug || slug.length < 2) continue;

      candidateUrls.push({ url: cleanUrl, slug });
    }

    console.log(`[Pages] Candidates to analyze: ${candidateUrls.length}`);

    // 3. GET EXISTING SLUGS
    const { data: existingPages } = await supabase
      .from('store_pages')
      .select('slug')
      .eq('tenant_id', tenantId);

    const existingSlugs = new Set((existingPages || []).map(p => p.slug));

    // 4. ANALYZE EACH CANDIDATE AND EXTRACT CONTENT
    const importedPages: Array<{ id: string; title: string; slug: string; blocksCount: number }> = [];
    const skippedPages: Array<{ url: string; reason: string }> = [];

    // Limit to 20 pages to avoid timeout
    const limitedCandidates = candidateUrls.slice(0, 20);

    for (const candidate of limitedCandidates) {
      if (existingSlugs.has(candidate.slug)) {
        skippedPages.push({ url: candidate.url, reason: 'Slug já existe' });
        continue;
      }

      // Analyze page content
      const analysis = await analyzePage(candidate.url);
      
      if (!analysis) {
        skippedPages.push({ url: candidate.url, reason: 'Não é página institucional' });
        continue;
      }

      // Build page content for builder
      const pageContent = buildPageContent(analysis.contentBlocks);

      // Create page with extracted content
      const { data, error } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: tenantId,
          slug: analysis.slug,
          title: analysis.title,
          content: JSON.stringify(pageContent),
          status: 'draft',
          is_published: false,
          builder_enabled: true,
          show_in_menu: true,
          menu_label: analysis.title,
        })
        .select('id, title, slug')
        .single();

      if (error) {
        console.error(`[Pages] Error creating ${analysis.slug}:`, error.message);
        skippedPages.push({ url: candidate.url, reason: error.message });
        continue;
      }

      if (data) {
        importedPages.push({
          ...data,
          blocksCount: analysis.contentBlocks.length
        });
        existingSlugs.add(analysis.slug);
        
        // Register in import_items for cleanup tracking
        await supabase.from('import_items').upsert({
          tenant_id: tenantId,
          job_id: null,
          module: 'pages',
          internal_id: data.id,
          external_id: candidate.url,
          status: 'success',
          data: { 
            slug: analysis.slug, 
            title: analysis.title,
            blocksCount: analysis.contentBlocks.length 
          }
        }, {
          onConflict: 'tenant_id,module,external_id',
          ignoreDuplicates: false
        });
        
        console.log(`[Pages] Created: ${analysis.slug} (${analysis.contentBlocks.length} blocks)`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[Pages] Imported: ${importedPages.length}, Skipped: ${skippedPages.length}`);

    return jsonResponse({
      success: true,
      pages: importedPages,
      skipped: skippedPages,
      stats: {
        linksDiscovered: allLinks.length,
        candidates: candidateUrls.length,
        imported: importedPages.length,
        skipped: skippedPages.length,
      },
    });

  } catch (error) {
    console.error('[Pages] Error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
      pages: [],
      skipped: [],
    });
  }
});
