import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  mapSectionToBlocks, 
  type ClassificationResult, 
  type ContentPrimitive as IntelligentPrimitive,
  type BlockNode as IntelligentBlockNode 
} from "../_shared/intelligent-block-mapper.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================
// TYPES
// ============================================================

interface ContentPrimitive {
  type: 'heading' | 'paragraph' | 'image' | 'video' | 'button' | 'list';
  content: string;
  level?: number;
  src?: string;
  alt?: string;
  href?: string;
  items?: string[];
}

interface Section {
  index: number;
  titleHint: string;
  htmlFragment: string;
  primitives: ContentPrimitive[];
  classification?: ClassificationResult;
  stats: {
    textLen: number;
    headings: number;
    images: number;
    videos: number;
    ctas: number;
  };
}

interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children?: BlockNode[];
}

// ============================================================
// UTILS
// ============================================================

function generateBlockId(prefix: string = 'block'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 6)}`;
}

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

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove UTM and empty params
    const paramsToRemove: string[] = [];
    urlObj.searchParams.forEach((value, key) => {
      if (key.startsWith('utm_') || value === '') {
        paramsToRemove.push(key);
      }
    });
    paramsToRemove.forEach(k => urlObj.searchParams.delete(k));
    // Clean trailing ? if no params
    let result = urlObj.toString();
    if (result.endsWith('?')) {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return url;
  }
}

function isCorePage(url: string): { blocked: boolean; reason: string } {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.toLowerCase();
    
    // Block home
    if (path === '/' || path === '') {
      return { blocked: true, reason: 'Página inicial (home) não pode ser importada por este modo' };
    }
    
    // Block core commerce pages
    const corePatterns = [
      /^\/products\/?/,
      /^\/collections\/?/,
      /^\/cart\/?/,
      /^\/checkout\/?/,
      /^\/account\/?/,
      /^\/search\/?/,
      /^\/blogs?\/?$/,
      /^\/orders?\/?/,
    ];
    
    for (const pattern of corePatterns) {
      if (pattern.test(path)) {
        return { blocked: true, reason: `Página core (${path}) não pode ser importada por este modo` };
      }
    }
    
    return { blocked: false, reason: '' };
  } catch {
    return { blocked: false, reason: '' };
  }
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

// ============================================================
// SECTIONIZER - The core of structure-based import
// ============================================================

const FOOTER_BLACKLIST = [
  /cnpj[:\s]*[\d.\/-]+/i,
  /políticas?\s*(de\s*)?(privacidade|devolução|troca)/i,
  /termos\s*de\s*(uso|serviço)/i,
  /mais\s*pesquisad[oa]s/i,
  /trending/i,
  /sobre\s*nós/i,
  /fale\s*conosco/i,
  /atendimento\s*ao\s*cliente/i,
  /siga[-\s]?nos/i,
  /redes\s*sociais/i,
  /newsletter/i,
  /inscreva-se/i,
  /copyright/i,
  /©\s*\d{4}/i,
  /todos\s*os\s*direitos/i,
];

function isFooterContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  for (const pattern of FOOTER_BLACKLIST) {
    if (pattern.test(lowerText)) {
      return true;
    }
  }
  return false;
}

function cleanHtmlFragment(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*(hidden|display:\s*none|aria-hidden=\"true\")[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
}

function extractMainContent(html: string): string {
  // Try to find main content area
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    return cleanHtmlFragment(mainMatch[1]);
  }
  
  // Fallback: try role="main"
  const roleMainMatch = html.match(/<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (roleMainMatch) {
    return cleanHtmlFragment(roleMainMatch[1]);
  }
  
  // Last resort: use body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    return cleanHtmlFragment(bodyMatch[1]);
  }
  
  return cleanHtmlFragment(html);
}

function detectPlatform(html: string): 'shopify' | 'generic' {
  if (html.includes('Shopify.theme') || 
      html.includes('shopify-section') || 
      html.includes('data-shopify-editor') ||
      html.includes('cdn.shopify.com')) {
    return 'shopify';
  }
  return 'generic';
}

// Shopify-specific sectionizer
function sectionizeShopify(mainContent: string): Section[] {
  const sections: Section[] = [];
  
  // Find all shopify sections
  // Pattern: <div id="shopify-section-..." class="shopify-section ...">
  // Or: <section class="shopify-section ...">
  const sectionRegex = /<(?:div|section)[^>]*(?:class=["'][^"']*shopify-section[^"']*["']|id=["']shopify-section-[^"']*["'])[^>]*>([\s\S]*?)(?=<(?:div|section)[^>]*(?:class=["'][^"']*shopify-section|id=["']shopify-section-)|$)/gi;
  
  let match;
  let sectionIndex = 0;
  
  while ((match = sectionRegex.exec(mainContent)) !== null) {
    const fullMatch = match[0];
    const sectionHtml = match[1] || fullMatch;
    
    // Check for exclusion patterns (global sections, header/footer groups)
    const isGlobalSection = /shopify-section-group-(header|footer|overlay)/i.test(fullMatch) ||
                           /id=["'][^"']*sections--[^"']*["']/i.test(fullMatch);
    
    if (isGlobalSection) {
      console.log(`[STRUCT-V2] Skipping global section at index ${sectionIndex}`);
      continue;
    }
    
    // Check for footer blacklist content
    const plainText = stripHtmlTags(sectionHtml);
    if (isFooterContent(plainText)) {
      console.log(`[STRUCT-V2] Skipping footer section at index ${sectionIndex}`);
      continue;
    }
    
    // Only keep sections with meaningful content
    if (plainText.length < 20) {
      console.log(`[STRUCT-V2] Skipping empty section at index ${sectionIndex}`);
      continue;
    }
    
    sections.push({
      index: sectionIndex,
      titleHint: extractTitleHint(sectionHtml),
      htmlFragment: sectionHtml,
      primitives: [],
      stats: calculateSectionStats(sectionHtml),
    });
    
    sectionIndex++;
  }
  
  // If no shopify sections found, try alternative approach
  if (sections.length === 0) {
    console.log('[STRUCT-V2] No shopify-section found, trying page-width divs');
    return sectionizeByDividers(mainContent);
  }
  
  return sections;
}

// Generic sectionizer for non-Shopify sites
function sectionizeGeneric(mainContent: string): Section[] {
  return sectionizeByDividers(mainContent);
}

// Sectionize by common structural dividers
function sectionizeByDividers(html: string): Section[] {
  const sections: Section[] = [];
  
  // Try to split by section/article tags or common container patterns
  const dividerPatterns = [
    /<section[^>]*>([\s\S]*?)<\/section>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
    /<div[^>]*class=["'][^"']*(?:page-width|container|content-section|main-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  ];
  
  for (const pattern of dividerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const sectionHtml = match[1] || match[0];
      const plainText = stripHtmlTags(sectionHtml);
      
      if (plainText.length < 30) continue;
      if (isFooterContent(plainText)) continue;
      
      sections.push({
        index: sections.length,
        titleHint: extractTitleHint(sectionHtml),
        htmlFragment: sectionHtml,
        primitives: [],
        stats: calculateSectionStats(sectionHtml),
      });
    }
    
    if (sections.length > 0) break;
  }
  
  // If still no sections, create one from the entire content and then sub-divide
  if (sections.length === 0) {
    console.log('[STRUCT-V2] No structural dividers, splitting by headings');
    return sectionizeByHeadings(html);
  }
  
  return sections;
}

// Split content by headings
function sectionizeByHeadings(html: string): Section[] {
  const sections: Section[] = [];
  
  // Split by h1, h2, h3 headings
  const headingRegex = /(<h[1-3][^>]*>[\s\S]*?<\/h[1-3]>)/gi;
  const parts = html.split(headingRegex);
  
  let currentSection: { heading: string; content: string } | null = null;
  
  for (const part of parts) {
    if (/<h[1-3][^>]*>/i.test(part)) {
      // This is a heading - start new section
      if (currentSection && currentSection.content.trim()) {
        const sectionHtml = currentSection.heading + currentSection.content;
        const plainText = stripHtmlTags(sectionHtml);
        
        if (plainText.length >= 20 && !isFooterContent(plainText)) {
          sections.push({
            index: sections.length,
            titleHint: extractTitleHint(sectionHtml),
            htmlFragment: sectionHtml,
            primitives: [],
            stats: calculateSectionStats(sectionHtml),
          });
        }
      }
      currentSection = { heading: part, content: '' };
    } else if (currentSection) {
      currentSection.content += part;
    } else {
      // Content before first heading
      const plainText = stripHtmlTags(part);
      if (plainText.length >= 30 && !isFooterContent(plainText)) {
        sections.push({
          index: sections.length,
          titleHint: 'Introdução',
          htmlFragment: part,
          primitives: [],
          stats: calculateSectionStats(part),
        });
      }
    }
  }
  
  // Don't forget the last section
  if (currentSection && currentSection.content.trim()) {
    const sectionHtml = currentSection.heading + currentSection.content;
    const plainText = stripHtmlTags(sectionHtml);
    
    if (plainText.length >= 20 && !isFooterContent(plainText)) {
      sections.push({
        index: sections.length,
        titleHint: extractTitleHint(sectionHtml),
        htmlFragment: sectionHtml,
        primitives: [],
        stats: calculateSectionStats(sectionHtml),
      });
    }
  }
  
  return sections;
}

function extractTitleHint(html: string): string {
  // Try to extract the first heading as title hint
  const headingMatch = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
  if (headingMatch) {
    return stripHtmlTags(headingMatch[1]).substring(0, 80);
  }
  return 'Seção';
}

function calculateSectionStats(html: string): Section['stats'] {
  const plainText = stripHtmlTags(html);
  const headings = (html.match(/<h[1-6][^>]*>/gi) || []).length;
  const images = (html.match(/<img[^>]+>/gi) || []).length;
  const videos = (html.match(/youtube\.com|youtu\.be|vimeo\.com/gi) || []).length;
  const ctas = (html.match(/<a[^>]*(?:btn|button|cta)[^>]*>|<button[^>]*>/gi) || []).length;
  
  return { textLen: plainText.length, headings, images, videos, ctas };
}

// ============================================================
// PRIMITIVE EXTRACTION - Per Section
// ============================================================

function extractPrimitivesFromSection(html: string): ContentPrimitive[] {
  const primitives: ContentPrimitive[] = [];
  let match;
  
  // Extract headings (h1-h3)
  const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const text = stripHtmlTags(match[2]).trim();
    if (text && text.length > 2 && text.length < 500) {
      primitives.push({ type: 'heading', content: text, level });
    }
  }
  
  // Extract paragraphs
  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((match = paragraphRegex.exec(html)) !== null) {
    const text = stripHtmlTags(match[1]).trim();
    if (text && text.length > 10 && text.length < 2000) {
      // Filter out noise
      if (!/^(share|compartilhar|1\/1|carregando|loading)/i.test(text)) {
        primitives.push({ type: 'paragraph', content: text });
      }
    }
  }
  
  // Extract YouTube videos
  const youtubeRegex = /(youtube\.com\/embed\/[a-zA-Z0-9_-]+|youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/gi;
  const foundVideos = new Set<string>();
  while ((match = youtubeRegex.exec(html)) !== null) {
    const videoUrl = match[1].startsWith('http') ? match[1] : `https://www.${match[1]}`;
    const videoId = extractYouTubeId(videoUrl);
    if (videoId && !foundVideos.has(videoId)) {
      foundVideos.add(videoId);
      primitives.push({ 
        type: 'video', 
        content: `https://www.youtube.com/embed/${videoId}`,
        src: videoId
      });
    }
  }
  
  // Extract images (main content images only)
  const imageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  while ((match = imageRegex.exec(html)) !== null) {
    const src = match[1];
    const alt = match[2] || '';
    // Filter out icons, logos, tracking pixels
    if (src && !src.includes('icon') && !src.includes('logo') && 
        !src.includes('1x1') && !src.includes('pixel') && !src.includes('svg')) {
      if (src.startsWith('http') || src.startsWith('//')) {
        const fullSrc = src.startsWith('//') ? `https:${src}` : src;
        primitives.push({ type: 'image', content: alt || 'Imagem', src: fullSrc, alt });
      }
    }
  }
  
  // Extract buttons/CTAs
  const buttonRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((match = buttonRegex.exec(html)) !== null) {
    const href = match[1];
    const fullHtml = match[0].toLowerCase();
    const text = stripHtmlTags(match[2]).trim();
    
    // Check if it's a button-like element
    const isButtonLike = fullHtml.includes('btn') || 
                         fullHtml.includes('button') || 
                         fullHtml.includes('cta') ||
                         /consulte|comprar|saiba\s*mais|ver\s*mais|clique|fale|whatsapp|adquira|quero/i.test(text);
    
    if (text && text.length > 2 && text.length < 100 && href && isButtonLike) {
      // Avoid duplicates
      const exists = primitives.some(p => p.type === 'button' && p.content === text);
      if (!exists) {
        primitives.push({ type: 'button', content: text, href });
      }
    }
  }
  
  return primitives;
}

// ============================================================
// AI CLASSIFICATION
// ============================================================

async function classifySectionWithAI(
  htmlFragment: string, 
  pageContext: { title?: string; sectionIndex: number; totalSections: number }
): Promise<ClassificationResult | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('[STRUCT-V2] Missing Supabase config for AI classification');
    return null;
  }
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/classify-content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html: htmlFragment,
        pageContext,
      }),
    });
    
    if (!response.ok) {
      console.log(`[STRUCT-V2] AI classification failed: ${response.status}`);
      return null;
    }
    
    const result = await response.json();
    if (result.success && result.classification) {
      return result.classification as ClassificationResult;
    }
    
    return null;
  } catch (error) {
    console.error('[STRUCT-V2] AI classification error:', error);
    return null;
  }
}

// ============================================================
// SECTION TO BLOCKS MAPPER (with AI classification support)
// ============================================================

function sectionToBlocks(section: Section): BlockNode[] {
  // If we have AI classification with good confidence, use intelligent mapper
  if (section.classification && section.classification.confidence >= 0.5) {
    console.log(`[STRUCT-V2] Using intelligent mapper for section ${section.index}: type=${section.classification.sectionType}`);
    
    // Convert primitives to intelligent mapper format
    const intelligentPrimitives: IntelligentPrimitive[] = section.primitives.map(p => ({
      type: p.type,
      content: p.content,
      level: p.level,
      src: p.src,
      alt: p.alt,
      href: p.href,
      items: p.items,
    }));
    
    const intelligentBlocks = mapSectionToBlocks(intelligentPrimitives, section.classification);
    
    // Convert back to our BlockNode format (they're compatible)
    return intelligentBlocks as BlockNode[];
  }
  
  // Fallback to original deterministic mapper
  console.log(`[STRUCT-V2] Using deterministic mapper for section ${section.index}`);
  return sectionToBlocksDeterministic(section);
}

// Original deterministic mapper (renamed)
function sectionToBlocksDeterministic(section: Section): BlockNode[] {
  const blocks: BlockNode[] = [];
  const primitives = section.primitives;
  
  // Group primitives logically
  const headings = primitives.filter(p => p.type === 'heading');
  const paragraphs = primitives.filter(p => p.type === 'paragraph');
  const videos = primitives.filter(p => p.type === 'video');
  const images = primitives.filter(p => p.type === 'image');
  const buttons = primitives.filter(p => p.type === 'button');
  
  // Add main heading first (if any)
  if (headings.length > 0) {
    const mainHeading = headings[0];
    const headingTag = mainHeading.level === 1 ? 'h1' : mainHeading.level === 2 ? 'h2' : 'h3';
    blocks.push({
      id: generateBlockId('heading'),
      type: 'RichText',
      props: {
        content: `<${headingTag}>${mainHeading.content}</${headingTag}>`,
        textAlign: 'center',
      },
    });
  }
  
  // Add video (if any) - prioritize over images
  if (videos.length > 0) {
    blocks.push({
      id: generateBlockId('video'),
      type: 'YouTubeVideo',
      props: {
        youtubeUrl: videos[0].content,
        widthPreset: 'xl',
        aspectRatio: '16:9',
      },
    });
  } else if (images.length > 0) {
    // Add first relevant image
    blocks.push({
      id: generateBlockId('image'),
      type: 'Image',
      props: {
        imageDesktop: images[0].src,
        imageMobile: images[0].src,
        alt: images[0].alt || images[0].content,
        aspectRatio: 'auto',
      },
    });
  }
  
  // Add secondary headings as separate blocks
  for (let i = 1; i < headings.length; i++) {
    const h = headings[i];
    const tag = h.level === 1 ? 'h2' : h.level === 2 ? 'h3' : 'h4';
    blocks.push({
      id: generateBlockId('subheading'),
      type: 'RichText',
      props: {
        content: `<${tag}>${h.content}</${tag}>`,
        textAlign: 'center',
      },
    });
  }
  
  // Add paragraphs as separate blocks
  for (const p of paragraphs) {
    blocks.push({
      id: generateBlockId('text'),
      type: 'RichText',
      props: {
        content: `<p>${p.content}</p>`,
        textAlign: 'left',
      },
    });
  }
  
  // Add remaining images
  for (let i = 1; i < images.length; i++) {
    blocks.push({
      id: generateBlockId('image'),
      type: 'Image',
      props: {
        imageDesktop: images[i].src,
        imageMobile: images[i].src,
        alt: images[i].alt || images[i].content,
        aspectRatio: 'auto',
      },
    });
  }
  
  // Add buttons
  for (const btn of buttons) {
    blocks.push({
      id: generateBlockId('button'),
      type: 'Button',
      props: {
        text: btn.content,
        url: btn.href || '#',
        variant: 'primary',
        size: 'lg',
        fullWidth: false,
        backgroundColor: '#000000',
        textColor: '#ffffff',
      },
    });
  }
  
  return blocks;
}

// ============================================================
// PAGE STRUCTURE
// ============================================================

function createPageStructure(sectionBlocks: BlockNode[][]): BlockNode {
  const children: BlockNode[] = [
    {
      id: generateBlockId('header'),
      type: 'Header',
      props: {},
    },
  ];
  
  // Each section becomes a Section block with Container
  for (let i = 0; i < sectionBlocks.length; i++) {
    const blocks = sectionBlocks[i];
    if (blocks.length === 0) continue;
    
    children.push({
      id: generateBlockId(`section-${i}`),
      type: 'Section',
      props: {
        paddingY: 48,
        paddingX: 16,
        gap: 24,
      },
      children: [
        {
          id: generateBlockId(`container-${i}`),
          type: 'Container',
          props: {
            maxWidth: 'lg',
            padding: 0,
            gap: 24,
          },
          children: blocks,
        },
      ],
    });
  }
  
  children.push({
    id: generateBlockId('footer'),
    type: 'Footer',
    props: {},
  });
  
  return {
    id: generateBlockId('page'),
    type: 'Page',
    props: {},
    children,
  };
}

// ============================================================
// MAIN HANDLER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, url: rawUrl, slug, createAsDraft = true } = await req.json();
    
    // Normalize URL
    const url = normalizeUrl(rawUrl);
    console.log(`[STRUCT-V2] Starting import: tenant=${tenantId}, url=${url}, slug=${slug}`);

    if (!tenantId || !url) {
      throw new Error('tenantId and url are required');
    }
    
    // Check for core page blocking
    const coreCheck = isCorePage(url);
    if (coreCheck.blocked) {
      console.log(`[STRUCT-V2] blockedCorePage path=${new URL(url).pathname} reason=${coreCheck.reason}`);
      return new Response(
        JSON.stringify({ success: false, error: coreCheck.reason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
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
      console.log('[STRUCT-V2] Using Firecrawl for extraction');
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
      console.log('[STRUCT-V2] Fallback to direct fetch');
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

    console.log(`[STRUCT-V2] Fetched HTML: ${html.length} chars`);

    // Detect platform
    const platform = detectPlatform(html);
    console.log(`[STRUCT-V2] platform=${platform}`);
    
    // Extract main content
    const mainContent = extractMainContent(html);
    console.log(`[STRUCT-V2] mainContent: ${mainContent.length} chars`);
    
    // Sectionize based on platform
    let sections: Section[] = [];
    if (platform === 'shopify') {
      sections = sectionizeShopify(mainContent);
    } else {
      sections = sectionizeGeneric(mainContent);
    }
    
    console.log(`[STRUCT-V2] sectionsFound=${sections.length}`);
    
    if (sections.length === 0) {
      // Fallback: treat entire main content as one section
      sections = [{
        index: 0,
        titleHint: 'Conteúdo',
        htmlFragment: mainContent,
        primitives: [],
        stats: calculateSectionStats(mainContent),
      }];
    }
    
    // Extract primitives for each section and classify with AI
    const pageTitleHint = sections[0]?.titleHint || 'Página';
    
    for (const section of sections) {
      section.primitives = extractPrimitivesFromSection(section.htmlFragment);
      
      // Classify with AI (parallel-safe, runs for each section)
      const classification = await classifySectionWithAI(
        section.htmlFragment,
        { title: pageTitleHint, sectionIndex: section.index, totalSections: sections.length }
      );
      
      if (classification) {
        section.classification = classification;
        console.log(`[STRUCT-V2] section[${section.index}] AI: type=${classification.sectionType}, layout=${classification.layout}, conf=${classification.confidence.toFixed(2)}`);
      }
      
      console.log(`[STRUCT-V2] section[${section.index}] title="${section.titleHint.substring(0, 40)}" ` +
                  `textLen=${section.stats.textLen} h=${section.stats.headings} ` +
                  `img=${section.stats.images} video=${section.stats.videos} cta=${section.stats.ctas} ` +
                  `primitives=${section.primitives.length}`);
    }
    
    // Filter out empty sections
    const validSections = sections.filter(s => s.primitives.length > 0);
    console.log(`[STRUCT-V2] sectionsKept=${validSections.length}`);
    
    if (validSections.length === 0) {
      throw new Error('Nenhum conteúdo válido encontrado nas seções da página');
    }
    
    // Convert sections to blocks
    const allSectionBlocks: BlockNode[][] = [];
    let totalBlocks = 0;
    const blockTypes: string[] = [];
    
    for (const section of validSections) {
      const blocks = sectionToBlocks(section);
      allSectionBlocks.push(blocks);
      totalBlocks += blocks.length;
      blockTypes.push(...blocks.map(b => b.type));
    }
    
    console.log(`[STRUCT-V2] blocksTotal=${totalBlocks} blockTypes=[${[...new Set(blockTypes)].join(', ')}]`);

    // Create page structure
    const pageContent = createPageStructure(allSectionBlocks);

    // Generate title from first heading
    let pageTitle = 'Página Importada';
    for (const section of validSections) {
      const heading = section.primitives.find(p => p.type === 'heading');
      if (heading) {
        pageTitle = heading.content.substring(0, 100);
        break;
      }
    }
    
    // Fallback title from URL
    if (pageTitle === 'Página Importada') {
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
      console.error('[STRUCT-V2] Insert error:', insertError);
      throw new Error(`Erro ao salvar página: ${insertError.message}`);
    }

    console.log(`[STRUCT-V2] SUCCESS: page id=${newPage.id}, slug=${newPage.slug}, sections=${validSections.length}, blocks=${totalBlocks}`);

    return new Response(
      JSON.stringify({
        success: true,
        pageId: newPage.id,
        pageTitle: newPage.title,
        pageSlug: newPage.slug,
        sectionsExtracted: validSections.length,
        blocksCount: totalBlocks,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[STRUCT-V2] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
