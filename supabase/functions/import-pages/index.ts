import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapClassificationToBlocks, type BlockNode, type ClassificationResult } from '../_shared/intelligent-block-mapper.ts';
import { composePageStructure, validatePageQuality } from '../_shared/page-composer.ts';
import { detectAndGetAdapter, cleanHtmlWithAdapter, type PlatformExtractionAdapter } from '../_shared/platform-adapters/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// INTELLIGENT PAGE IMPORTER v4 - Enterprise Grade
// =====================================================
// Supports 8 platforms: Shopify, Nuvemshop, Tray, Yampi, Bagy, 
// Loja Integrada, VTEX, WooCommerce + Generic fallback
//
// Flow:
// 1. Fetch HTML from URL (with platform-specific waitFor)
// 2. Detect platform and get adapter
// 3. Clean HTML with adapter (remove platform-specific noise)
// 4. Deep clean HTML (remove YouTube noise, interface elements)
// 5. Extract main content (using adapter's selectors)
// 6. Detect carousels (images, videos)
// 7. Segment HTML into smaller sections
// 8. Preprocess each section (remove noise)
// 9. Classify each section with AI (with platform context)
// 10. Map classifications to native blocks
// 11. Compose page structure (order, deduplicate)
// 12. Validate quality (reject noise blocks)
// 13. Save to database
// =====================================================

interface SinglePageImport {
  tenantId: string;
  url: string;
  slug?: string;
  title?: string;
}

interface MultiPageImport {
  tenantId: string;
  pages: Array<{
    title: string;
    slug: string;
    url: string;
    source?: string;
  }>;
  storeUrl?: string;
  platform?: string;
}

type ImportRequest = SinglePageImport | MultiPageImport;

function isMultiPageImport(req: ImportRequest): req is MultiPageImport {
  return 'pages' in req && Array.isArray(req.pages);
}

// =====================================================
// DEEP HTML CLEANING - Remove interface noise
// =====================================================
const YOUTUBE_NOISE_PATTERNS = [
  /More videos/gi,
  /Mais vídeos/gi,
  /You're signed out/gi,
  /Você não está conectado/gi,
  /Watch later/gi,
  /Assistir mais tarde/gi,
  /Share\s*\n/gi,
  /Compartilhar\s*\n/gi,
  /Copy link/gi,
  /Copiar link/gi,
  /Include playlist/gi,
  /Incluir playlist/gi,
  /If playback doesn't begin shortly/gi,
  /Se a reprodução não começar/gi,
  /CancelConfirm/gi,
  /An error occurred while retrieving/gi,
  /Ocorreu um erro ao recuperar/gi,
  /Videos you watch may be added/gi,
  /Os vídeos que você assiste podem ser adicionados/gi,
  /Hide more videos/gi,
  /Ocultar mais vídeos/gi,
  /Video unavailable/gi,
  /Vídeo indisponível/gi,
  /Watch on YouTube/gi,
  /Assistir no YouTube/gi,
  /Subscribe/gi,
  /Inscrever-se/gi,
  /^\d+\s*views?\s*$/gim,
  /^\d+\s*visualizações?\s*$/gim,
  /Tap to unmute/gi,
  /Toque para ativar o som/gi,
];

const INTERFACE_NOISE_PATTERNS = [
  /cookie consent/gi,
  /aceitar cookies/gi,
  /privacidade e cookies/gi,
  /LGPD/gi,
  /WhatsApp[^a-zA-Z]/gi,
  /chat online/gi,
  /fale conosco via/gi,
  /atendimento 24h/gi,
  /©\s*\d{4}/gi, // Copyright
  /CNPJ[:\s]*[\d.\-\/]+/gi,
  /CEP[:\s]*[\d.\-]+/gi,
  /Todos os direitos reservados/gi,
  /Desenvolvido por/gi,
  /Powered by/gi,
];

function deepCleanHtml(html: string): string {
  let cleaned = html;
  
  // 1. Remove YouTube player noise patterns
  for (const pattern of YOUTUBE_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // 2. Remove interface noise
  for (const pattern of INTERFACE_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  // 3. Remove YouTube player controls and overlays
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*(?:ytp-|youtube-player)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // 4. Remove cookie consent banners
  cleaned = cleaned.replace(/<div[^>]*(?:class|id)="[^"]*(?:cookie|lgpd|consent|gdpr)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // 5. Remove chat widgets
  cleaned = cleaned.replace(/<div[^>]*(?:class|id)="[^"]*(?:whatsapp|chat-widget|tawk|zendesk|intercom|crisp)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
  
  // 6. Remove hidden elements
  cleaned = cleaned.replace(/<[^>]+style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
  cleaned = cleaned.replace(/<[^>]+hidden[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
  
  // 7. Remove empty iframes (lazy-loaded placeholders)
  cleaned = cleaned.replace(/<iframe[^>]*src=""[^>]*>[\s\S]*?<\/iframe>/gi, '');
  cleaned = cleaned.replace(/<iframe[^>]*data-src="[^"]*"[^>]*><\/iframe>/gi, '');
  
  // 8. Remove noscript tags
  cleaned = cleaned.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');
  
  // 9. Remove inline onclick handlers that are just tracking
  cleaned = cleaned.replace(/\s*onclick="[^"]*(?:gtag|fbq|ga\(|analytics)[^"]*"/gi, '');
  
  // 10. Clean up resulting empty lines
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  console.log(`[DEEP_CLEAN] Cleaned HTML: ${html.length} -> ${cleaned.length} chars (removed ${html.length - cleaned.length})`);
  
  return cleaned;
}

// =====================================================
// CAROUSEL DETECTION
// =====================================================
interface CarouselDetection {
  type: 'image' | 'video' | 'banner';
  items: string[]; // URLs
  position: 'hero' | 'content' | 'testimonial';
}

interface DetectionResult {
  carousels: CarouselDetection[];
  cleanedHtml: string;
}

function detectCarousels(html: string): DetectionResult {
  const carousels: CarouselDetection[] = [];
  let cleanedHtml = html;
  
  // 1. Detect YouTube video groups (more than 2 from same pattern)
  const youtubeMatches = [
    ...html.matchAll(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/gi)
  ];
  const uniqueVideoIds = [...new Set(youtubeMatches.map(m => m[1]))];
  
  if (uniqueVideoIds.length >= 2) {
    console.log(`[CAROUSEL] Detected ${uniqueVideoIds.length} YouTube videos -> VideoCarousel`);
    carousels.push({
      type: 'video',
      items: uniqueVideoIds.map(id => `https://www.youtube.com/watch?v=${id}`),
      position: uniqueVideoIds.length > 3 ? 'testimonial' : 'content',
    });
  }
  
  // 2. Detect image sliders/carousels
  const sliderPatterns = [
    // Swiper
    /<div[^>]*class="[^"]*swiper[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
    // Slick
    /<div[^>]*class="[^"]*slick[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    // Owl Carousel
    /<div[^>]*class="[^"]*owl-[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    // Generic carousel
    /<div[^>]*class="[^"]*carousel[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    // Embla
    /<div[^>]*class="[^"]*embla[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];
  
  for (const pattern of sliderPatterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const sliderContent = match[1] || match[0];
      // Extract images from slider
      const imgMatches = [...sliderContent.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi)];
      if (imgMatches.length >= 2) {
        const imageUrls = imgMatches.map(m => m[1]).filter(url => 
          !url.includes('data:image') && 
          !url.includes('placeholder') &&
          !url.includes('loading')
        );
        if (imageUrls.length >= 2) {
          console.log(`[CAROUSEL] Detected image slider with ${imageUrls.length} images -> ImageCarousel`);
          carousels.push({
            type: 'image',
            items: imageUrls,
            position: 'hero',
          });
        }
      }
    }
  }
  
  // 3. Detect banner rotators (multiple large images in sequence)
  const bannerPattern = /<a[^>]*>\s*<img[^>]*(?:width|height)=["']?(?:100%|\d{3,})[^>]*src="([^"]+)"[^>]*>\s*<\/a>/gi;
  const bannerMatches = [...html.matchAll(bannerPattern)];
  if (bannerMatches.length >= 2) {
    const bannerUrls = bannerMatches.map(m => m[1]);
    console.log(`[CAROUSEL] Detected banner rotator with ${bannerUrls.length} banners`);
    carousels.push({
      type: 'banner',
      items: bannerUrls,
      position: 'hero',
    });
  }
  
  return { carousels, cleanedHtml };
}

// =====================================================
// HTML FETCHING - Platform-aware
// =====================================================
async function fetchHtml(url: string, adapter?: PlatformExtractionAdapter): Promise<{ html: string; title: string }> {
  console.log(`[FETCH] Fetching URL: ${url}`);
  
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  const waitFor = adapter?.getFirecrawlOptions().waitFor || 3000;
  
  if (firecrawlKey) {
    try {
      console.log(`[FETCH] Using Firecrawl (waitFor: ${waitFor}ms)...`);
      const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          pageOptions: {
            onlyMainContent: false,
            includeHtml: true,
            waitFor: waitFor,
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.html) {
          console.log(`[FETCH] Firecrawl success: ${data.data.html.length} chars`);
          return {
            html: data.data.html,
            title: data.data.metadata?.title || extractTitleFromHtml(data.data.html) || 'Página Importada',
          };
        }
      }
      console.warn('[FETCH] Firecrawl failed, falling back to direct fetch');
    } catch (err) {
      console.warn('[FETCH] Firecrawl error:', err);
    }
  }
  
  // Direct fetch fallback
  console.log('[FETCH] Using direct fetch...');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }
  
  const html = await response.text();
  console.log(`[FETCH] Direct fetch success: ${html.length} chars`);
  
  return {
    html,
    title: extractTitleFromHtml(html) || 'Página Importada',
  };
}

function extractTitleFromHtml(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim().split('|')[0].split('-')[0].trim();
  }
  return null;
}

// =====================================================
// HTML SEGMENTATION (Simple)
// =====================================================
function extractMainContent(html: string): string {
  // Try to find <main>
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    console.log('[SEGMENT] Found <main> tag');
    return mainMatch[1];
  }
  
  // Try article
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    console.log('[SEGMENT] Found <article> tag');
    return articleMatch[1];
  }
  
  // Fallback: extract body content, remove obvious nav/footer
  let content = html;
  
  // Remove header/nav
  content = content.replace(/<header[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  
  // Remove footer
  content = content.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  
  // Remove scripts and styles
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  
  // Try to find body
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }
  
  console.log(`[SEGMENT] Extracted content: ${content.length} chars`);
  return content;
}

interface Section {
  html: string;
  index: number;
}

function segmentHtml(html: string): Section[] {
  const sections: Section[] = [];
  
  // =====================================================
  // MULTI-PLATFORM SEGMENTATION
  // Supports: Shopify, Dooca, VTEX, Nuvemshop, WooCommerce, Generic
  // =====================================================
  
  // 1. Try Shopify sections first
  const shopifyRegex = /(<div[^>]*(?:class="[^"]*shopify-section[^"]*"|id="shopify-section-[^"]*")[^>]*>[\s\S]*?)(?=<div[^>]*(?:class="[^"]*shopify-section|id="shopify-section-)|$)/gi;
  let matches = [...html.matchAll(shopifyRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[1].trim().length > 100) {
        sections.push({ html: match[1], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] Shopify: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  
  // 2. Try Dooca/Tray sections
  const doocaRegex = /<(?:section|div)[^>]*(?:class="[^"]*(?:section-|dooca-|tray-)[^"]*")[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(doocaRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] Dooca/Tray: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 3. Try VTEX sections
  const vtexRegex = /<(?:section|div)[^>]*(?:class="[^"]*vtex[^"]*"|data-vtex[^>]*)[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(vtexRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] VTEX: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 4. Try Nuvemshop sections
  const nuvemRegex = /<(?:section|div)[^>]*(?:class="[^"]*(?:js-|nuvem-|section)[^"]*"|id="section-[^"]*")[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(nuvemRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] Nuvemshop: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 5. Try WooCommerce/WordPress sections
  const wooRegex = /<(?:section|div)[^>]*class="[^"]*(?:wp-block-|woocommerce-|elementor-)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(wooRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] WooCommerce/WordPress: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 6. Try generic <section> tags
  const sectionMatches = html.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/gi);
  for (const match of sectionMatches) {
    if (match[0].trim().length > 100) {
      sections.push({ html: match[0], index: sections.length });
    }
  }
  if (sections.length >= 2) {
    console.log(`[SEGMENT] Generic <section>: ${sections.length} sections`);
    return subdivideIfNeeded(sections);
  }
  sections.length = 0;
  
  // 7. Try splitting by semantic dividers (h2, h3, hr, large row divs)
  const semanticParts = html.split(/(?=<h[23][^>]*>)|<hr[^>]*>|(?=<div[^>]*class="[^"]*(?:row|container|wrapper)[^"]*"[^>]*>)/gi);
  for (const part of semanticParts) {
    if (part.trim().length > 200) {
      sections.push({ html: part.trim(), index: sections.length });
    }
  }
  if (sections.length >= 2) {
    console.log(`[SEGMENT] Semantic split: ${sections.length} sections`);
    return subdivideIfNeeded(sections);
  }
  
  // 8. Last resort: treat entire content as one section but try to subdivide
  console.log('[SEGMENT] Using entire content, attempting subdivision');
  return subdivideIfNeeded([{ html, index: 0 }]);
}

// Subdivide large sections (>3000 chars) by headings - REDUCED threshold
function subdivideIfNeeded(sections: Section[]): Section[] {
  const result: Section[] = [];
  const MAX_SECTION_SIZE = 3000; // Reduced from 4000 for better granularity
  
  for (const section of sections) {
    if (section.html.length > MAX_SECTION_SIZE) {
      // Try to split by h2/h3/h4
      const parts = section.html.split(/(?=<h[2-4][^>]*>)/gi);
      if (parts.length > 1) {
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length > 100 && trimmed.length <= MAX_SECTION_SIZE * 2) {
            result.push({ html: trimmed, index: result.length });
          } else if (trimmed.length > MAX_SECTION_SIZE * 2) {
            // Still too large, split by divs with common classes
            const subParts = trimmed.split(/(?=<div[^>]*class="[^"]*(?:row|container|wrapper|section|block)[^"]*"[^>]*>)/gi);
            for (const subPart of subParts) {
              if (subPart.trim().length > 100) {
                result.push({ html: subPart.trim(), index: result.length });
              }
            }
          }
        }
        console.log(`[SEGMENT] Subdivided large section (${section.html.length} chars) into ${result.length - result.length + parts.length} parts`);
        continue;
      }
    }
    result.push({ ...section, index: result.length });
  }
  
  return result;
}

// Preprocess section HTML to remove noise before AI analysis
function preprocessSection(html: string): string {
  return html
    // Remove scripts, styles, noscript
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove SVGs (often decorative)
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove empty tags
    .replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '')
    // Remove inline styles (reduce noise)
    .replace(/\s*style="[^"]*"/gi, '')
    // Remove data attributes (reduce noise)
    .replace(/\s*data-[a-z-]+="[^"]*"/gi, '')
    // Remove aria attributes
    .replace(/\s*aria-[a-z-]+="[^"]*"/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// =====================================================
// AI CLASSIFICATION - Platform-aware
// =====================================================
async function classifySection(
  html: string,
  pageTitle: string,
  sectionIndex: number,
  totalSections: number,
  platformContext?: string
): Promise<ClassificationResult | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[CLASSIFY] Missing Supabase config');
    return null;
  }
  
  try {
    console.log(`[CLASSIFY] Classifying section ${sectionIndex + 1}/${totalSections} (${html.length} chars)`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/classify-content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        pageContext: {
          title: pageTitle,
          sectionIndex,
          totalSections,
        },
        platformContext, // Pass platform-specific AI context
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CLASSIFY] API error: ${response.status}`, errorText);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success || !data.classification) {
      console.warn('[CLASSIFY] Classification failed:', data.error);
      return null;
    }
    
    console.log(`[CLASSIFY] Result: type=${data.classification.sectionType}, conf=${data.classification.confidence}`);
    return data.classification;
    
  } catch (error) {
    console.error('[CLASSIFY] Error:', error);
    return null;
  }
}

// =====================================================
// PAGE BUILDING
// =====================================================
function buildPageContent(blocks: BlockNode[]): BlockNode {
  return {
    id: `page-${Date.now().toString(36)}`,
    type: 'Page',
    props: {},
    children: blocks,
  };
}

// =====================================================
// CAROUSEL BLOCK CREATION
// =====================================================
function createCarouselBlocks(carousels: CarouselDetection[]): BlockNode[] {
  const blocks: BlockNode[] = [];
  
  for (const carousel of carousels) {
    if (carousel.type === 'video' && carousel.items.length >= 2) {
      blocks.push({
        id: `video-carousel-${Date.now().toString(36)}`,
        type: 'VideoCarousel',
        props: {
          videos: carousel.items.map((url, i) => ({
            id: `video-${i}`,
            type: 'youtube' as const,
            url,
            title: `Vídeo ${i + 1}`,
          })),
          autoplay: true,
          interval: 5000,
          showNavigation: true,
          showPagination: true,
          aspectRatio: '16:9',
        },
      });
    } else if (carousel.type === 'image' && carousel.items.length >= 2) {
      blocks.push({
        id: `image-carousel-${Date.now().toString(36)}`,
        type: 'ImageCarousel',
        props: {
          images: carousel.items.map((url, i) => ({
            id: `img-${i}`,
            imageDesktop: url,
            imageMobile: url,
            alt: `Imagem ${i + 1}`,
            linkUrl: '',
          })),
          autoplay: true,
          interval: 4000,
          aspectRatio: '16:9',
          showNavigation: true,
          showPagination: true,
        },
      });
    } else if (carousel.type === 'banner' && carousel.items.length >= 2) {
      blocks.push({
        id: `banner-carousel-${Date.now().toString(36)}`,
        type: 'ImageCarousel',
        props: {
          images: carousel.items.map((url, i) => ({
            id: `banner-${i}`,
            imageDesktop: url,
            imageMobile: url,
            alt: `Banner ${i + 1}`,
            linkUrl: '',
          })),
          autoplay: true,
          interval: 5000,
          aspectRatio: '21:9',
          showNavigation: true,
          showPagination: true,
        },
      });
    }
  }
  
  return blocks;
}

// =====================================================
// SLUG GENERATION
// =====================================================
function generateSlug(url: string, title?: string): string {
  // Prefer title-based slug
  if (title) {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  return `pagina-${Date.now().toString(36)}`;
}

// =====================================================
// MULTI-PAGE IMPORT HANDLER
// =====================================================
async function handleMultiPageImport(request: MultiPageImport): Promise<Response> {
  const { tenantId, pages, storeUrl } = request;
  
  console.log(`[IMPORT] Starting multi-page import for tenant ${tenantId}: ${pages.length} pages`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const results = {
    imported: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{ title: string; status: 'imported' | 'skipped' | 'failed'; reason?: string }>
  };
  
  for (const page of pages) {
    try {
      // Resolve relative URLs
      let fullUrl = page.url;
      if (fullUrl.startsWith('/') && storeUrl) {
        fullUrl = new URL(fullUrl, storeUrl).toString();
      }
      
      // Skip external URLs or anchor links
      if (fullUrl.startsWith('#') || (!fullUrl.startsWith('http') && !fullUrl.startsWith('/'))) {
        results.skipped++;
        results.details.push({ title: page.title, status: 'skipped', reason: 'URL inválida' });
        continue;
      }
      
      // Skip if page already exists
      const { data: existingPage } = await supabase
        .from('store_pages')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', page.slug)
        .single();
      
      if (existingPage) {
        results.skipped++;
        results.details.push({ title: page.title, status: 'skipped', reason: 'Página já existe' });
        continue;
      }
      
      // Fetch the page content and check if it's a simple text page
      let pageContent: any = { type: 'root', children: [] };
      let shouldSkipPage = false;
      
      try {
        const { html, title } = await fetchHtml(fullUrl);
        
        // =====================================================
        // SMART PAGE FILTER v2 - Institutional vs Functional
        // =====================================================
        // Extract main content only (remove header/footer/nav) before checking
        // This avoids false positives from newsletter forms in footer
        let mainContentForCheck = html;
        
        // Remove header/nav/footer before checking for forms
        mainContentForCheck = mainContentForCheck.replace(/<header[\s\S]*?<\/header>/gi, '');
        mainContentForCheck = mainContentForCheck.replace(/<nav[\s\S]*?<\/nav>/gi, '');
        mainContentForCheck = mainContentForCheck.replace(/<footer[\s\S]*?<\/footer>/gi, '');
        // Remove common footer classes (Shopify, etc)
        mainContentForCheck = mainContentForCheck.replace(/<div[^>]*class="[^"]*(?:footer|site-footer|page-footer|main-footer)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
        // Remove newsletter sections
        mainContentForCheck = mainContentForCheck.replace(/<(?:section|div)[^>]*class="[^"]*(?:newsletter|subscribe|mailing)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi, '');
        
        // Now check for forms in the MAIN CONTENT ONLY
        const mainFormCount = (mainContentForCheck.match(/<form\s/gi) || []).length;
        const mainInputCount = (mainContentForCheck.match(/<input\s/gi) || []).length;
        const mainTextareaCount = (mainContentForCheck.match(/<textarea\s/gi) || []).length;
        const mainSelectCount = (mainContentForCheck.match(/<select\s/gi) || []).length;
        
        // An iframe in main content (not YouTube) is a red flag
        const hasMainIframe = /<iframe\s/i.test(mainContentForCheck) && !/<iframe[^>]*youtube/i.test(mainContentForCheck);
        
        // Check slug for functional page patterns (high priority)
        const functionalSlugPatterns = [
          /login/i, /cadastro/i, /register/i, /signup/i, /sign-up/i,
          /checkout/i, /carrinho/i, /cart/i, /pagamento/i, /payment/i,
          /minha-conta/i, /my-account/i, /account/i, /dashboard/i,
          /wishlist/i, /favoritos/i, /lista-de-desejos/i,
          /compare/i, /comparar/i,
          /rastreio/i, /rastrear/i, /tracking/i, /rastreamento/i,
          /pedidos/i, /orders/i,
        ];
        
        const isSlugFunctional = functionalSlugPatterns.some(pattern => pattern.test(page.slug));
        
        // Check URL path for functional patterns
        const urlPath = new URL(fullUrl).pathname.toLowerCase();
        const isFunctionalPath = functionalSlugPatterns.some(pattern => pattern.test(urlPath));
        
        // Determine if truly functional:
        // 1. Slug/URL clearly indicates functional page
        // 2. Main content has significant form elements (not just 1 contact form)
        // 3. Has non-YouTube iframe in main content
        const hasSignificantForm = mainFormCount >= 2 || (mainFormCount >= 1 && (mainInputCount > 5 || mainSelectCount > 2 || mainTextareaCount > 1));
        const isFunctionalPage = isSlugFunctional || isFunctionalPath || hasMainIframe || hasSignificantForm;
        
        if (isFunctionalPage) {
          console.log(`[IMPORT] Skipping functional page ${page.title}: slug=${isSlugFunctional}, path=${isFunctionalPath}, forms=${mainFormCount}, inputs=${mainInputCount}`);
          results.skipped++;
          results.details.push({ 
            title: page.title, 
            status: 'skipped', 
            reason: 'Página com formulário ou funcionalidade complexa' 
          });
          continue;
        }
        
        console.log(`[IMPORT] Processing institutional page ${page.title}: forms=${mainFormCount}, inputs=${mainInputCount}`);
        
        const adapter = detectAndGetAdapter(html, fullUrl);
        const cleanedHtml = deepCleanHtml(cleanHtmlWithAdapter(html, adapter));
        const mainContent = extractMainContent(cleanedHtml);
        const sections = segmentHtml(mainContent);
        
        const allBlocks: BlockNode[] = [];
        const platformContext = adapter.getAIContext();
        
        for (const section of sections.slice(0, 5)) { // Limit to 5 sections for speed
          const preprocessedHtml = preprocessSection(section.html);
          if (preprocessedHtml.length < 100) continue;
          
          const classification = await classifySection(
            preprocessedHtml,
            page.title || title,
            section.index,
            sections.length,
            platformContext
          );
          
          if (classification) {
            const blocks = mapClassificationToBlocks(classification);
            allBlocks.push(...blocks);
          }
        }
        
        const composedBlocks = composePageStructure(allBlocks);
        if (composedBlocks.length > 0) {
          pageContent = buildPageContent(composedBlocks);
        }
      } catch (fetchError) {
        console.warn(`[IMPORT] Failed to fetch content for ${page.title}:`, fetchError);
        // Create empty page with just title
      }
      
      if (shouldSkipPage) continue;
      
      // Insert the page
      const { error: insertError } = await supabase
        .from('store_pages')
        .insert({
          tenant_id: tenantId,
          title: page.title,
          slug: page.slug,
          content: pageContent,
          status: 'draft',
          is_published: false,
          type: 'institutional',
          seo_title: page.title,
          seo_description: `Página ${page.title}`,
        });
      
      if (insertError) {
        results.failed++;
        results.details.push({ title: page.title, status: 'failed', reason: insertError.message });
      } else {
        results.imported++;
        results.details.push({ title: page.title, status: 'imported' });
      }
      
    } catch (error) {
      console.error(`[IMPORT] Error importing page ${page.title}:`, error);
      results.failed++;
      results.details.push({ 
        title: page.title, 
        status: 'failed', 
        reason: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  }
  
  console.log(`[IMPORT] Multi-page import complete: ${results.imported} imported, ${results.skipped} skipped, ${results.failed} failed`);
  
  return new Response(
    JSON.stringify({
      success: true,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
  );
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const requestData = await req.json() as ImportRequest;
    
    // Validate tenantId
    if (!requestData.tenantId) {
      return new Response(
        JSON.stringify({ success: false, code: 'MISSING_TENANT', error: 'tenantId é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    // Check if multi-page import
    if (isMultiPageImport(requestData)) {
      return handleMultiPageImport(requestData);
    }
    
    // Single page import
    const { tenantId, url, slug: customSlug, title: customTitle } = requestData as SinglePageImport;
    
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, code: 'MISSING_URL', error: 'url é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    console.log(`[IMPORT] Starting single page import for tenant ${tenantId}: ${url}`);
    
    // 1. Initial fetch to detect platform
    const initialFetch = await fetchHtml(url);
    
    // 2. Detect platform and get adapter
    const adapter = detectAndGetAdapter(initialFetch.html, url);
    console.log(`[IMPORT] Platform detected: ${adapter.platform}`);
    
    // 3. Re-fetch with platform-specific options if needed (for SPAs)
    let html = initialFetch.html;
    let extractedTitle = initialFetch.title;
    
    const firecrawlOptions = adapter.getFirecrawlOptions();
    if (firecrawlOptions.waitFor && firecrawlOptions.waitFor > 3000) {
      console.log(`[IMPORT] Re-fetching with extended waitFor (${firecrawlOptions.waitFor}ms) for ${adapter.platform}`);
      const refetch = await fetchHtml(url, adapter);
      html = refetch.html;
      extractedTitle = refetch.title;
    }
    
    const pageTitle = customTitle || extractedTitle;
    
    // 4. Clean HTML with platform adapter (remove platform-specific noise)
    const adapterCleanedHtml = cleanHtmlWithAdapter(html, adapter);
    console.log(`[IMPORT] Adapter cleaned: ${html.length} -> ${adapterCleanedHtml.length} chars`);
    
    // 5. Deep clean HTML (remove YouTube noise, interface elements)
    const cleanedHtml = deepCleanHtml(adapterCleanedHtml);
    
    // 6. Detect carousels before extracting main content
    const { carousels } = detectCarousels(cleanedHtml);
    const carouselBlocks = createCarouselBlocks(carousels);
    console.log(`[IMPORT] Detected ${carousels.length} carousels -> ${carouselBlocks.length} blocks`);
    
    // 7. Extract main content
    const mainContent = extractMainContent(cleanedHtml);
    
    // 8. Segment into sections
    const sections = segmentHtml(mainContent);
    console.log(`[IMPORT] Found ${sections.length} sections`);
    
    // 9. Get platform context for AI
    const platformContext = adapter.getAIContext();
    
    // 10. Classify each section and build blocks
    const allBlocks: BlockNode[] = [...carouselBlocks]; // Start with carousel blocks
    
    for (const section of sections) {
      // Preprocess section to remove noise
      const preprocessedHtml = preprocessSection(section.html);
      
      // Skip sections that are too small after cleaning
      if (preprocessedHtml.length < 100) {
        console.log(`[IMPORT] Section ${section.index + 1}: skipped (too small after preprocessing)`);
        continue;
      }
      
      const classification = await classifySection(
        preprocessedHtml,
        pageTitle,
        section.index,
        sections.length,
        platformContext // Pass platform context to AI
      );
      
      if (classification) {
        const blocks = mapClassificationToBlocks(classification);
        allBlocks.push(...blocks);
        console.log(`[IMPORT] Section ${section.index + 1}: ${classification.sectionType} -> ${blocks.length} blocks`);
      } else {
        console.log(`[IMPORT] Section ${section.index + 1}: classification failed, skipping`);
      }
    }
    
    // 11. Compose page structure (order + deduplicate)
    const composedBlocks = composePageStructure(allBlocks);
    console.log(`[IMPORT] Composed: ${allBlocks.length} raw blocks -> ${composedBlocks.length} ordered blocks`);
    
    // 12. Validate quality
    const quality = validatePageQuality(composedBlocks);
    console.log(`[IMPORT] Quality: score=${quality.score}, valid=${quality.valid}`);
    if (quality.issues.length > 0) {
      console.log(`[IMPORT] Quality issues: ${quality.issues.join(', ')}`);
    }
    
    // 9. Build page content
    if (composedBlocks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'EMPTY_CONTENT',
          error: 'Não foi possível extrair conteúdo da página. A página pode estar vazia ou protegida.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    const pageContent = buildPageContent(composedBlocks);
    const slug = customSlug || generateSlug(url, pageTitle);
    
    // 10. Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check for existing page with same slug
    const { data: existingPage } = await supabase
      .from('store_pages')
      .select('id, slug')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .single();
    
    if (existingPage) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          code: 'DUPLICATE_SLUG',
          error: `Já existe uma página com o slug "${slug}"`,
          existingPageId: existingPage.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    // Create the page
    const { data: newPage, error: insertError } = await supabase
      .from('store_pages')
      .insert({
        tenant_id: tenantId,
        title: pageTitle,
        slug,
        content: pageContent,
        status: 'draft',
        is_published: false,
        type: 'institutional',
        seo_title: pageTitle,
        seo_description: `Página ${pageTitle}`,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[IMPORT] Database error:', insertError);
      return new Response(
        JSON.stringify({ success: false, code: 'DATABASE_ERROR', error: `Erro ao salvar: ${insertError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    
    console.log(`[IMPORT] Success! Page created: ${newPage.id} (${slug})`);
    
    return new Response(
      JSON.stringify({
        success: true,
        page: {
          id: newPage.id,
          slug: newPage.slug,
          title: newPage.title,
        },
        stats: {
          sectionsFound: sections.length,
          blocksCreated: composedBlocks.length,
          rawBlocks: allBlocks.length,
          carouselsDetected: carousels.length,
          qualityScore: quality.score,
          qualityIssues: quality.issues,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        code: 'UNEXPECTED_ERROR',
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
