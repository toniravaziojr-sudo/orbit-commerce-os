// =====================================================
// IMPORT INSTITUTIONAL PAGES - Sistema Aprimorado v2
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
    videoId?: string; // for YouTube videos
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
  /\/(?:faq|perguntas|duvidas|ajuda-frequente|perguntas-frequentes)/i,
  /\/(?:como-comprar|how-to-buy|passo-a-passo)/i,
  /\/(?:seguranca|security)/i,
  /\/(?:pagamento|payment|formas-de-pagamento)/i,
  /\/(?:como-funciona|how-it-works|funciona)/i,
  /\/(?:feedback|depoimentos|testimonials)/i,
  /\/(?:consulte|consulta)/i,
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
// YouTube/Vimeo noise patterns - text to filter out
// =====================================================
const YOUTUBE_NOISE_PATTERNS = [
  /^Tap to unmute$/i,
  /^Watch on$/i,
  /^Share$/i,
  /^Copy link$/i,
  /^Watch later$/i,
  /^Info$/i,
  /^Shopping$/i,
  /^Search$/i,
  /^Cancel$/i,
  /^Confirm$/i,
  /subscribers?$/i,
  /^If playback doesn't begin/i,
  /^You're signed out/i,
  /^Videos you watch may be added/i,
  /^To avoid this, cancel and sign in/i,
  /^An error occurred while retrieving/i,
  /^Include playlist$/i,
  /^\d+:\d+$/,
  /^Live$/i,
  /^\d+\s*subscribers?$/i,
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

// Check if text is YouTube noise
function isYouTubeNoise(text: string): boolean {
  if (!text || text.length < 3) return true;
  
  const cleanText = text.trim();
  
  // Check against known noise patterns
  for (const pattern of YOUTUBE_NOISE_PATTERNS) {
    if (pattern.test(cleanText)) return true;
  }
  
  // Check if text contains YouTube/Vimeo garbage
  if (/youtube|vimeo|youtu\.be/i.test(cleanText)) return true;
  if (/\d+:\d+\s*\/\s*\d+:\d+/.test(cleanText)) return true; // Time markers
  if (/Watch on|Tap to unmute|subscribers?/i.test(cleanText)) return true;
  
  return false;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/(?:embed|v|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return null;
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
        formats: ['html'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    
    const html = data.data?.html || data?.html || '';
    if (!html) return null;

    // =====================================================
    // STEP 1: Clean HTML - Remove iframes FIRST to avoid extracting their text
    // =====================================================
    let cleanHtml = html;
    
    // Remove ALL iframes (YouTube, Vimeo, etc.) - they pollute text extraction
    cleanHtml = cleanHtml.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '<!-- iframe-removed -->');
    
    // Remove script/style
    cleanHtml = cleanHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    cleanHtml = cleanHtml.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
    
    // Remove header/footer/nav/aside
    cleanHtml = cleanHtml.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    cleanHtml = cleanHtml.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    cleanHtml = cleanHtml.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
    cleanHtml = cleanHtml.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
    
    // Remove common product/promo sections
    cleanHtml = cleanHtml.replace(/<div[^>]*class="[^"]*(?:product-carousel|products-slider|related-products|upsell|cross-sell|announcement|promo-bar|top-bar|sticky-bar|floating)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    cleanHtml = cleanHtml.replace(/<section[^>]*class="[^"]*(?:products|shop|collection|showcase|featured)[^"]*"[^>]*>[\s\S]*?<\/section>/gi, '');

    // =====================================================
    // STEP 2: Find main content area
    // =====================================================
    const mainMatches = cleanHtml.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                       cleanHtml.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                       cleanHtml.match(/<div[^>]*class="[^"]*(?:rte|shopify-policy|page-content|main-content|entry-content|content-area|page-body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    
    const contentArea = mainMatches ? mainMatches[1] : cleanHtml;
    
    // =====================================================
    // STEP 3: Check if it's a product page (many prices/cards)
    // =====================================================
    const productPrices = contentArea.match(/<(?:div|span)[^>]*class="[^"]*price[^"]*"[^>]*>[^<]*R\$[^<]*<\/(?:div|span)>/gi) || [];
    const productCards = contentArea.match(/<(?:div|article|li)[^>]*class="[^"]*(?:product-card|product-item|card-product)[^"]*"[^>]*>/gi) || [];
    const addToCartButtons = contentArea.match(/(?:add.?to.?cart|adicionar.?ao.?carrinho|comprar)/gi) || [];
    
    const hasProductGrid = productPrices.length >= 5 || productCards.length >= 2;
    const hasComplexFeatures = productCards.length + Math.floor(addToCartButtons.length / 2) >= 4;
    
    // Check text heaviness - institutional pages have lots of text
    const textContent = contentArea.replace(/<[^>]+>/g, ' ').trim();
    const wordCount = textContent.split(/\s+/).length;
    const isTextHeavy = wordCount > 150;
    
    if (hasProductGrid && !isTextHeavy) {
      console.log(`[Pages] ✗ Product page (cards: ${productCards.length}, prices: ${productPrices.length}): ${pageUrl}`);
      return null;
    }
    
    if (hasComplexFeatures && !isTextHeavy) {
      console.log(`[Pages] ✗ Complex page: ${pageUrl}`);
      return null;
    }

    // =====================================================
    // STEP 4: Extract title - BEFORE removing iframes from original HTML
    // =====================================================
    
    // First, try to get H1 from the CLEAN content (no iframes)
    const h1Match = contentArea.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    let extractedTitle = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;
    
    // Filter out YouTube garbage from H1
    if (extractedTitle && isYouTubeNoise(extractedTitle)) {
      extractedTitle = null;
    }
    
    // Fallback: try og:title meta tag
    if (!extractedTitle) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      if (ogTitleMatch) {
        extractedTitle = ogTitleMatch[1].trim();
      }
    }
    
    // Fallback: try <title> tag but filter out garbage
    if (!extractedTitle) {
      const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
      let pageTitle = titleTagMatch ? titleTagMatch[1].trim() : null;
      
      // Remove site name suffix (e.g., "Política de Privacidade - Respeite o Homem")
      if (pageTitle) {
        pageTitle = pageTitle.split(/[|\-–—]/)[0].trim();
      }
      
      // Reject invalid titles
      if (pageTitle && (
        pageTitle.toLowerCase().includes('youtube') ||
        pageTitle.toLowerCase().includes('vimeo') ||
        pageTitle.startsWith('http') ||
        pageTitle.startsWith('www.') ||
        pageTitle.length < 3 ||
        pageTitle === 'Untitled' ||
        pageTitle === 'Document'
      )) {
        pageTitle = null;
      }
      
      extractedTitle = pageTitle;
    }
    
    // Final fallback: format slug
    const slug = extractSlug(new URL(pageUrl).pathname);
    const title = extractedTitle && extractedTitle.length > 2 && extractedTitle.length < 150
      ? extractedTitle
      : formatTitle(slug);

    // =====================================================
    // STEP 5: Extract content blocks
    // =====================================================
    const contentBlocks: ContentBlock[] = [];
    let order = 0;

    // Extract headings (h1-h6) - filter out YouTube noise
    const headingPattern = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
    let headingMatch;
    while ((headingMatch = headingPattern.exec(contentArea)) !== null) {
      const level = parseInt(headingMatch[1].charAt(1));
      const text = headingMatch[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      
      // Skip YouTube noise and very short/long headings
      if (!text || text.length < 2 || text.length > 200 || isYouTubeNoise(text)) {
        continue;
      }
      
      contentBlocks.push({
        type: 'heading',
        content: text,
        order: order++,
        metadata: { level }
      });
    }

    // Extract paragraphs - filter out YouTube noise
    const paragraphPattern = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let paragraphMatch;
    while ((paragraphMatch = paragraphPattern.exec(contentArea)) !== null) {
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
      
      // Skip YouTube noise and too short paragraphs
      if (!text || text.length < 20 || isYouTubeNoise(text)) {
        continue;
      }
      
      contentBlocks.push({
        type: 'text',
        content: text,
        order: order++
      });
    }

    // Extract list items as bullet points
    const listItemPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let listMatch;
    const listItems: string[] = [];
    while ((listMatch = listItemPattern.exec(contentArea)) !== null) {
      const text = listMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      
      if (text && text.length > 10 && !isYouTubeNoise(text)) {
        listItems.push(`• ${text}`);
      }
    }
    
    // Group list items together
    if (listItems.length > 0) {
      contentBlocks.push({
        type: 'text',
        content: listItems.join('\n'),
        order: order++
      });
    }

    // Fallback: extract plain text if no structured content found
    if (contentBlocks.filter(b => b.type === 'text' || b.type === 'heading').length === 0) {
      const plainText = contentArea
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (plainText.length > 100 && !isYouTubeNoise(plainText)) {
        // Split into paragraphs by sentence groups
        const sentences = plainText.match(/[^.!?]+[.!?]+/g) || [plainText];
        let currentParagraph = '';
        
        for (const sentence of sentences) {
          if (isYouTubeNoise(sentence)) continue;
          
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
      
      const altMatch = imageMatch[0].match(/alt="([^"]*)"/i);
      const alt = altMatch ? altMatch[1] : '';
      
      // Skip tracking pixels, icons, logos, tiny images
      if (src.includes('pixel') || 
          src.includes('tracking') || 
          src.includes('icon') ||
          src.includes('logo') ||
          src.includes('data:image') ||
          src.includes('spinner') ||
          src.includes('loading') ||
          src.includes('1x1') ||
          src.includes('placeholder') ||
          src.includes('youtube') ||
          src.includes('ytimg')) {
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

    // =====================================================
    // STEP 6: Extract YouTube videos from ORIGINAL HTML (before cleanup)
    // =====================================================
    const youtubePattern = /<iframe[^>]*src="([^"]*(?:youtube|youtu\.be|youtube-nocookie)[^"]*)"/gi;
    let videoMatch;
    while ((videoMatch = youtubePattern.exec(html)) !== null) {
      const videoUrl = videoMatch[1];
      const videoId = extractYouTubeId(videoUrl);
      
      if (videoId) {
        contentBlocks.push({
          type: 'video',
          content: `https://www.youtube.com/watch?v=${videoId}`,
          order: order++,
          metadata: { videoId }
        });
      }
    }

    // Sort blocks by order
    contentBlocks.sort((a, b) => a.order - b.order);

    // Validate: institutional pages should have at least some content
    const textBlocks = contentBlocks.filter(b => b.type === 'text' || b.type === 'heading');
    const mediaBlocks = contentBlocks.filter(b => b.type === 'image' || b.type === 'video');
    
    if (textBlocks.length === 0 && mediaBlocks.length === 0 && title.length < 3) {
      console.log(`[Pages] ✗ No content: ${pageUrl}`);
      return null;
    }

    console.log(`[Pages] ✓ Institutional page: ${pageUrl} (title: "${title}", ${textBlocks.length} text, ${mediaBlocks.length} media blocks)`);

    return {
      url: pageUrl,
      slug,
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
// BUILD PAGE CONTENT FOR BUILDER - FIXED BLOCK TYPES
// =====================================================

function buildPageContent(blocks: ContentBlock[]): any {
  const children: any[] = [];
  
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        children.push({
          id: crypto.randomUUID(),
          type: 'RichText',
          props: {
            content: `<h${block.metadata?.level || 2}>${escapeHtml(block.content)}</h${block.metadata?.level || 2}>`,
            align: 'left'
          }
        });
        break;
      
      case 'text':
        // Convert newlines to proper HTML
        const htmlContent = block.content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .map(line => `<p>${escapeHtml(line)}</p>`)
          .join('');
        
        children.push({
          id: crypto.randomUUID(),
          type: 'RichText',
          props: {
            content: htmlContent || `<p>${escapeHtml(block.content)}</p>`,
            align: 'left'
          }
        });
        break;
      
      case 'image':
        // FIXED: Use ImageBlock with imageDesktop prop
        children.push({
          id: crypto.randomUUID(),
          type: 'ImageBlock',
          props: {
            imageDesktop: block.content,
            alt: block.metadata?.alt || '',
            aspectRatio: 'auto'
          }
        });
        break;
      
      case 'video':
        // FIXED: Use YouTubeVideo with youtubeUrl prop
        children.push({
          id: crypto.randomUUID(),
          type: 'YouTubeVideo',
          props: {
            youtubeUrl: block.content,
            title: '',
            widthPreset: 'lg',
            aspectRatio: '16:9'
          }
        });
        break;
    }
  }
  
  // Wrap in standard page structure
  return {
    id: 'root',
    type: 'Page',
    props: {},
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
          paddingY: 48,
          paddingX: 16
        },
        children: [
          {
            id: crypto.randomUUID(),
            type: 'Container',
            props: {
              maxWidth: 'md',
              gap: 24
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

// Helper to escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
          content: pageContent, // Store as JSON object, not string
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
        
        console.log(`[Pages] Created: ${analysis.slug} - "${analysis.title}" (${analysis.contentBlocks.length} blocks)`);
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
