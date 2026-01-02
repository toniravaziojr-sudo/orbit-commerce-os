// =====================================================
// ELEMENT EXTRACTOR v2 - WITH DETAILED LOGGING
// =====================================================
// Extracts ALL elements from HTML with their POSITION
// This enables reconstruction in original page order
// =====================================================

export type ElementType = 
  | 'video'
  | 'video-carousel'
  | 'image'
  | 'image-carousel'
  | 'heading'
  | 'text'
  | 'button'
  | 'faq'
  | 'testimonial'
  | 'info-highlight'
  | 'list'
  | 'unknown-section';

export interface ElementMetadata {
  // Video
  videoId?: string;
  videoSource?: 'youtube' | 'vimeo' | 'upload';
  videoUrl?: string;
  videos?: Array<{ id: string; url: string; thumbnail?: string }>;
  
  // Image
  imageSrc?: string;
  imageDesktop?: string;
  imageMobile?: string;
  imageAlt?: string;
  images?: Array<{ desktop: string; mobile?: string; alt?: string }>;
  
  // Heading
  level?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  
  // Text/Content
  text?: string;
  content?: string;
  
  // Button
  buttonText?: string;
  buttonUrl?: string;
  buttonVariant?: 'primary' | 'secondary' | 'outline';
  
  // FAQ
  faqItems?: Array<{ question: string; answer: string }>;
  faqTitle?: string;
  
  // Testimonials
  testimonialItems?: Array<{ name: string; text: string; rating?: number }>;
  testimonialTitle?: string;
  
  // Info Highlights
  infoItems?: Array<{ icon: string; title: string; description: string }>;
  
  // List
  listItems?: string[];
  listType?: 'ordered' | 'unordered';
  
  // Styles (preserved from original)
  styles?: {
    fontSize?: string;
    fontWeight?: string;
    fontFamily?: string;
    color?: string;
    textAlign?: string;
    backgroundColor?: string;
  };
}

export interface ExtractedElement {
  id: string;
  position: number;
  type: ElementType;
  rawHtml: string;
  metadata: ElementMetadata;
}

// Generate unique ID
function generateId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Clean text
function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// =====================================================
// VIDEO EXTRACTION - With Position
// =====================================================
export function extractVideosWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractVideosWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  const foundVideoIds = new Set<string>();
  
  const patterns = [
    // YouTube iframe
    { regex: /<iframe[^>]*src=["'][^"']*youtube\.com\/embed\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi, source: 'youtube' as const },
    // YouTube data attributes
    { regex: /<[^>]*data-(?:youtube|video-id|youtube-id|yt-id)=["']([a-zA-Z0-9_-]{11})["'][^>]*>/gi, source: 'youtube' as const },
    // lite-youtube custom element
    { regex: /<lite-youtube[^>]*videoid=["']([a-zA-Z0-9_-]{11})["'][^>]*>[\s\S]*?<\/lite-youtube>/gi, source: 'youtube' as const },
    // YouTube URL in href
    { regex: /<a[^>]*href=["'][^"']*(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, source: 'youtube' as const },
    // YouTube thumbnail (ytimg)
    { regex: /<img[^>]*src=["'][^"']*ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})[^"']*["'][^>]*>/gi, source: 'youtube' as const },
    // HTML comments with YouTube URLs
    { regex: /<!--[\s\S]*?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[\s\S]*?-->/gi, source: 'youtube' as const },
    // Vimeo iframe
    { regex: /<iframe[^>]*src=["'][^"']*player\.vimeo\.com\/video\/(\d+)[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi, source: 'vimeo' as const },
    // Vimeo data attributes
    { regex: /<[^>]*data-vimeo(?:-id)?=["'](\d+)["'][^>]*>/gi, source: 'vimeo' as const },
  ];
  
  for (const { regex, source } of patterns) {
    let match;
    while ((match = regex.exec(html)) !== null) {
      const videoId = match[1];
      
      // Skip duplicates
      if (foundVideoIds.has(videoId)) continue;
      foundVideoIds.add(videoId);
      
      const videoUrl = source === 'youtube' 
        ? `https://www.youtube.com/watch?v=${videoId}`
        : `https://vimeo.com/${videoId}`;
      
      elements.push({
        id: generateId(),
        position: match.index,
        type: 'video',
        rawHtml: match[0],
        metadata: {
          videoId,
          videoSource: source,
          videoUrl,
        }
      });
      
      console.log(`[FUNC:extractVideosWithPosition] FOUND: ${JSON.stringify({ source, videoId, position: match.index })}`);
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractVideosWithPosition] OUTPUT: ${JSON.stringify({ 
    elementsFound: elements.length, 
    videoIds: Array.from(foundVideoIds),
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

// =====================================================
// VIDEO CAROUSEL EXTRACTION - Detect multiple videos in container
// =====================================================
export function extractVideoCarouselsWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractVideoCarouselsWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  
  // Pattern: section/div with carousel class containing multiple videos
  const carouselPatterns = [
    /<(?:section|div)[^>]*class=["'][^"']*(?:swiper|slick|carousel|slider|owl|video-carousel|video-slider)[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
    /<(?:section|div)[^>]*data-(?:swiper|slick|carousel)[^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
  ];
  
  for (const pattern of carouselPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const sectionHtml = match[0];
      const sectionContent = match[1];
      
      // Extract all videos from this section
      const videoPatterns = [
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/gi,
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/gi,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/gi,
        /data-(?:youtube|video-id|yt-id)=["']([a-zA-Z0-9_-]{11})["']/gi,
        /ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/gi,
      ];
      
      const foundIds = new Set<string>();
      const videos: Array<{ id: string; url: string; thumbnail?: string }> = [];
      
      for (const vp of videoPatterns) {
        let vmatch;
        while ((vmatch = vp.exec(sectionContent)) !== null) {
          const videoId = vmatch[1];
          if (!foundIds.has(videoId) && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
            foundIds.add(videoId);
            videos.push({
              id: videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            });
          }
        }
      }
      
      // Only create carousel if 2+ videos found
      if (videos.length >= 2) {
        elements.push({
          id: generateId(),
          position: match.index,
          type: 'video-carousel',
          rawHtml: sectionHtml,
          metadata: {
            videos,
          }
        });
        
        console.log(`[FUNC:extractVideoCarouselsWithPosition] FOUND: ${JSON.stringify({ videosCount: videos.length, position: match.index })}`);
      }
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractVideoCarouselsWithPosition] OUTPUT: ${JSON.stringify({ 
    carouselsFound: elements.length,
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

// =====================================================
// IMAGE EXTRACTION - With Position
// =====================================================
export function extractImagesWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractImagesWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  const foundSrcs = new Set<string>();
  
  // Pattern for img tags
  const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const src = match[1];
    const imgTag = match[0];
    
    // Skip small images, icons, lazy placeholders
    if (isSmallOrIconImage(src, imgTag)) {
      console.log(`[FUNC:extractImagesWithPosition] SKIP_SMALL: ${JSON.stringify({ src: src.substring(0, 50) })}`);
      continue;
    }
    
    // Skip duplicates
    const normalizedSrc = src.replace(/\?.*$/, ''); // Remove query params for comparison
    if (foundSrcs.has(normalizedSrc)) continue;
    foundSrcs.add(normalizedSrc);
    
    // Extract alt text
    const altMatch = /alt=["']([^"']*)["']/i.exec(imgTag);
    const alt = altMatch ? cleanText(altMatch[1]) : '';
    
    // Try to find mobile version
    const mobileSrc = findMobileVersion(html, src, match.index);
    
    elements.push({
      id: generateId(),
      position: match.index,
      type: 'image',
      rawHtml: match[0],
      metadata: {
        imageSrc: src,
        imageDesktop: src,
        imageMobile: mobileSrc || src,
        imageAlt: alt,
      }
    });
    
    console.log(`[FUNC:extractImagesWithPosition] FOUND: ${JSON.stringify({ src: src.substring(0, 60), alt: alt.substring(0, 30), position: match.index })}`);
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractImagesWithPosition] OUTPUT: ${JSON.stringify({ 
    imagesFound: elements.length,
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

function isSmallOrIconImage(src: string, imgTag: string): boolean {
  // Skip by filename patterns
  if (/icon|logo|sprite|placeholder|loading|lazy|data:/i.test(src)) return true;
  
  // Skip by dimensions
  const widthMatch = /width=["']?(\d+)/i.exec(imgTag);
  const heightMatch = /height=["']?(\d+)/i.exec(imgTag);
  
  if (widthMatch && parseInt(widthMatch[1]) < 100) return true;
  if (heightMatch && parseInt(heightMatch[1]) < 100) return true;
  
  // Skip tiny image URLs
  if (/[_-](\d{1,2})x\d{1,2}\./i.test(src)) return true;
  
  return false;
}

function findMobileVersion(html: string, desktopSrc: string, position: number): string | null {
  // Look for srcset or picture/source with mobile version
  const searchRange = html.substring(Math.max(0, position - 500), Math.min(html.length, position + 500));
  
  // Pattern: srcset with smaller size
  const srcsetMatch = /srcset=["']([^"']+)["']/i.exec(searchRange);
  if (srcsetMatch) {
    const sources = srcsetMatch[1].split(',').map(s => s.trim());
    for (const source of sources) {
      const [url, size] = source.split(/\s+/);
      if (url && size && /\d+w/i.test(size)) {
        const width = parseInt(size);
        if (width <= 768 && width >= 320) {
          return url;
        }
      }
    }
  }
  
  // Pattern: picture source with max-width
  const sourceMatch = /<source[^>]*media=["'][^"']*max-width[^"']*["'][^>]*srcset=["']([^"']+)["'][^>]*>/i.exec(searchRange);
  if (sourceMatch) {
    return sourceMatch[1].split(',')[0].trim().split(/\s+/)[0];
  }
  
  return null;
}

// =====================================================
// HEADING EXTRACTION - With Position
// =====================================================
export function extractHeadingsWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractHeadingsWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  const foundTexts = new Set<string>();
  
  // Pattern 1: Standard h1-h6 tags
  const headingPattern = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  
  let match;
  while ((match = headingPattern.exec(html)) !== null) {
    const level = match[1].toLowerCase() as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
    const content = match[2];
    const text = cleanText(stripHtml(content));
    
    // Skip empty or very short headings
    if (text.length < 3) continue;
    
    // Skip duplicates
    const textLower = text.toLowerCase();
    if (foundTexts.has(textLower)) continue;
    foundTexts.add(textLower);
    
    // Skip headings that are likely navigation/menu items
    if (text.length < 15 && /menu|nav|link|btn/i.test(match[0])) continue;
    
    // Extract styles if present
    const styles: ElementMetadata['styles'] = {};
    const styleMatch = /style=["']([^"']*)["']/i.exec(match[0]);
    if (styleMatch) {
      const styleStr = styleMatch[1];
      const fontSize = /font-size:\s*([^;]+)/i.exec(styleStr);
      const fontWeight = /font-weight:\s*([^;]+)/i.exec(styleStr);
      const color = /color:\s*([^;]+)/i.exec(styleStr);
      const textAlign = /text-align:\s*([^;]+)/i.exec(styleStr);
      
      if (fontSize) styles.fontSize = fontSize[1].trim();
      if (fontWeight) styles.fontWeight = fontWeight[1].trim();
      if (color) styles.color = color[1].trim();
      if (textAlign) styles.textAlign = textAlign[1].trim();
    }
    
    elements.push({
      id: generateId(),
      position: match.index,
      type: 'heading',
      rawHtml: match[0],
      metadata: {
        level,
        text,
        content,
        styles,
      }
    });
    
    console.log(`[FUNC:extractHeadingsWithPosition] FOUND: ${JSON.stringify({ level, text: text.substring(0, 40), position: match.index })}`);
  }
  
  // Pattern 2: Spans/Divs with title/heading classes (including BEM notation)
  const titleClassPatterns = [
    // Standard class names
    /<(?:span|div)[^>]*class=["'][^"']*(?:title|heading|headline|titulo|subtitulo|section-title|page-title)[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div)>/gi,
    // BEM notation: block__heading, block__title, rich-text__heading, etc.
    /<(?:span|div)[^>]*class=["'][^"']*(?:__heading|__title|__header)[^"']*["'][^>]*>([^<]{3,200})<\/(?:span|div)>/gi,
    // Shopify themes: divs with class containing "h1", "h2", etc.
    /<div[^>]*class=["'][^"']*\b(h[1-6])\b[^"']*["'][^>]*>([^<]{3,200})<\/div>/gi,
  ];
  
  for (const pattern of titleClassPatterns) {
    pattern.lastIndex = 0; // Reset regex state
    while ((match = pattern.exec(html)) !== null) {
      // Handle different match groups
      const content = match[2] || match[1];
      const text = cleanText(stripHtml(content));
      
      if (text.length < 5 || text.length > 200) continue;
      
      const textLower = text.toLowerCase();
      if (foundTexts.has(textLower)) continue;
      
      // Skip footer content headings
      if (isFooterContent(text)) {
        console.log(`[FUNC:extractHeadingsWithPosition] SKIP_FOOTER: ${JSON.stringify({ text: text.substring(0, 40) })}`);
        continue;
      }
      
      foundTexts.add(textLower);
      
      // Determine level from class if present (e.g., "h2" class)
      const levelMatch = match[0].match(/class=["'][^"']*\b(h[1-6])\b/i);
      const level = levelMatch ? levelMatch[1].toLowerCase() as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' : 'h2';
      
      elements.push({
        id: generateId(),
        position: match.index,
        type: 'heading',
        rawHtml: match[0],
        metadata: {
          level,
          text,
          content,
        }
      });
      
      console.log(`[FUNC:extractHeadingsWithPosition] FOUND_BEM: ${JSON.stringify({ level, text: text.substring(0, 40), position: match.index })}`);
    }
  }
  
  // Pattern 3: Strong/b tags with substantial text (likely styled headings)
  const strongPattern = /<(?:strong|b)[^>]*>([^<]{10,100})<\/(?:strong|b)>/gi;
  while ((match = strongPattern.exec(html)) !== null) {
    const text = cleanText(match[1]);
    
    if (text.length < 10 || text.length > 100) continue;
    
    // Only if it looks like a heading (mostly uppercase or title-case)
    const uppercaseRatio = (text.match(/[A-ZÀ-Ú]/g) || []).length / text.replace(/\s/g, '').length;
    if (uppercaseRatio < 0.3) continue;
    
    const textLower = text.toLowerCase();
    if (foundTexts.has(textLower)) continue;
    
    // Skip footer content headings
    if (isFooterContent(text)) {
      console.log(`[FUNC:extractHeadingsWithPosition] SKIP_FOOTER_STRONG: ${JSON.stringify({ text: text.substring(0, 40) })}`);
      continue;
    }
    
    foundTexts.add(textLower);
    
    elements.push({
      id: generateId(),
      position: match.index,
      type: 'heading',
      rawHtml: match[0],
      metadata: {
        level: 'h3',
        text,
        content: text,
      }
    });
    
    console.log(`[FUNC:extractHeadingsWithPosition] FOUND_STRONG: ${JSON.stringify({ text: text.substring(0, 40), position: match.index })}`);
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractHeadingsWithPosition] OUTPUT: ${JSON.stringify({ 
    headingsFound: elements.length,
    levels: elements.map(e => e.metadata.level),
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

// =====================================================
// BUTTON/CTA EXTRACTION - With Position
// =====================================================
export function extractButtonsWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractButtonsWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  const foundTexts = new Set<string>();
  
  const patterns = [
    // <a> with button classes (expanded) - class before href
    /<a[^>]*class=["'][^"']*(?:btn|button|cta|comprar|buy|action|submit|consult|consulte|agendar|saiba-mais|ver-mais)[^"']*["'][^>]*href=["']([^"']*)["'][^>]*>([^<]+)<\/a>/gi,
    // <a> with href first, then button class
    /<a[^>]*href=["']([^"']*)["'][^>]*class=["'][^"']*(?:btn|button|cta|action|submit)[^"']*["'][^>]*>([^<]+)<\/a>/gi,
    // <a> with just "btn" as word boundary (covers "btn btn-primary btn-md" etc.)
    /<a[^>]*class=["'][^"']*\bbtn\b[^"']*["'][^>]*href=["']([^"']*)["'][^>]*>([^<]+)<\/a>/gi,
    // <a> with href first, then just "btn" 
    /<a[^>]*href=["']([^"']*)["'][^>]*class=["'][^"']*\bbtn\b[^"']*["'][^>]*>([^<]+)<\/a>/gi,
    // BEM notation: rich-text__button, section__button, block__cta
    /<a[^>]*class=["'][^"']*(?:__button|__cta|__action)[^"']*["'][^>]*href=["']([^"']*)["'][^>]*>([^<]+)<\/a>/gi,
    // <button> elements
    /<button[^>]*(?:onclick=["'][^"']*location[^"']*=["']([^"']*)|data-href=["']([^"']*))?["'][^>]*>([^<]+)<\/button>/gi,
  ];
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1] || match[2] || '#';
      const text = cleanText(match[2] || match[3] || '');
      
      // Skip empty, very short, or duplicates
      if (text.length < 2 || text.length > 50) continue;
      const textLower = text.toLowerCase();
      if (foundTexts.has(textLower)) continue;
      
      // Skip footer buttons
      if (isFooterButton(text, url)) {
        console.log(`[FUNC:extractButtonsWithPosition] SKIP_FOOTER: ${JSON.stringify({ text, url })}`);
        continue;
      }
      
      foundTexts.add(textLower);
      
      // Determine variant from classes
      const buttonHtml = match[0].toLowerCase();
      let variant: 'primary' | 'secondary' | 'outline' = 'primary';
      if (/outline|ghost|transparent/i.test(buttonHtml)) variant = 'outline';
      else if (/secondary|alt|light/i.test(buttonHtml)) variant = 'secondary';
      
      elements.push({
        id: generateId(),
        position: match.index,
        type: 'button',
        rawHtml: match[0],
        metadata: {
          buttonText: text,
          buttonUrl: url,
          buttonVariant: variant,
        }
      });
      
      console.log(`[FUNC:extractButtonsWithPosition] FOUND: ${JSON.stringify({ text, url: url.substring(0, 40), variant, position: match.index })}`);
    }
  }
  
  // Pattern 2: Links with short UPPERCASE text (CTAs)
  const ctaPattern = /<a[^>]*href=["']([^"']*)["'][^>]*>([A-ZÀ-Ú][A-ZÀ-Ú\s]{3,30})<\/a>/gi;
  let match;
  while ((match = ctaPattern.exec(html)) !== null) {
    const url = match[1] || '#';
    const text = cleanText(match[2]);
    
    if (text.length < 4 || text.length > 40) continue;
    const textLower = text.toLowerCase();
    if (foundTexts.has(textLower)) continue;
    
    // Skip footer buttons
    if (isFooterButton(text, url)) {
      console.log(`[FUNC:extractButtonsWithPosition] SKIP_FOOTER_CTA: ${JSON.stringify({ text, url })}`);
      continue;
    }
    
    // Skip navigation/menu links
    if (isNavigationLink(text, url)) {
      console.log(`[FUNC:extractButtonsWithPosition] SKIP_NAV: ${JSON.stringify({ text, url })}`);
      continue;
    }
    
    foundTexts.add(textLower);
    
    elements.push({
      id: generateId(),
      position: match.index,
      type: 'button',
      rawHtml: match[0],
      metadata: {
        buttonText: text,
        buttonUrl: url,
        buttonVariant: 'primary',
      }
    });
    
    console.log(`[FUNC:extractButtonsWithPosition] FOUND_CTA: ${JSON.stringify({ text, url: url.substring(0, 40), position: match.index })}`);
  }
  
  // Pattern 3: Links with inline background-color styles (styled buttons)
  const styledPattern = /<a[^>]*style=["'][^"']*background(?:-color)?[^"']*["'][^>]*href=["']([^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  while ((match = styledPattern.exec(html)) !== null) {
    const url = match[1] || '#';
    const text = cleanText(match[2]);
    
    if (text.length < 2 || text.length > 50) continue;
    const textLower = text.toLowerCase();
    if (foundTexts.has(textLower)) continue;
    
    if (isFooterButton(text, url)) continue;
    
    foundTexts.add(textLower);
    
    elements.push({
      id: generateId(),
      position: match.index,
      type: 'button',
      rawHtml: match[0],
      metadata: {
        buttonText: text,
        buttonUrl: url,
        buttonVariant: 'primary',
      }
    });
    
    console.log(`[FUNC:extractButtonsWithPosition] FOUND_STYLED: ${JSON.stringify({ text, url: url.substring(0, 40), position: match.index })}`);
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractButtonsWithPosition] OUTPUT: ${JSON.stringify({ 
    buttonsFound: elements.length,
    buttonTexts: elements.map(e => e.metadata.buttonText),
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

// =====================================================
// FOOTER/HEADER CONTENT DETECTION
// =====================================================
// v2 - 2026-01-01: DESATIVADO filtragem agressiva
// Agora extraímos TUDO e deixamos a análise visual filtrar
// Mantemos apenas patterns ÓBVIOS de footer (copyright, CNPJ, etc)
// =====================================================
function isFooterContent(text: string): boolean {
  // v2: Retornar FALSE para a maioria dos casos
  // Deixar a análise visual (Gemini) decidir o que é conteúdo principal
  // Manter apenas patterns 100% seguros (dados legais/técnicos)
  
  const obviousFooterPatterns = [
    /cnpj[\s:]*\d{2}[\s.]\d{3}[\s.]\d{3}\/\d{4}[-.]\d{2}/i, // CNPJ formatado
    /todos\s+os?\s+direitos?\s+reservados?/i,
    /copyright|©\s*\d{4}/i,
    /\d{2}[\s.]\d{3}[\s.]\d{3}\/\d{4}[-.]\d{2}/i, // CNPJ
    /desenvolvido\s+por/i,
    /powered\s+by/i,
  ];
  
  const isObviousFooter = obviousFooterPatterns.some(pattern => pattern.test(text));
  
  if (isObviousFooter) {
    console.log(`[FUNC:isFooterContent] DETECTED: ${JSON.stringify({ text: text.substring(0, 40), isFooter: true })}`);
  }
  
  return isObviousFooter;
}

// v2 - 2026-01-01: DESATIVADO filtragem agressiva de botões
// Deixar a análise visual decidir
function isFooterButton(text: string, url: string): boolean {
  // v2: Retornar FALSE para quase tudo
  // Apenas filtrar URLs de policies (legal)
  const obviousLegalUrls = [
    /\/policies\//i,
    /\/terms/i,
    /\/privacy/i,
  ];
  
  const isObviousLegal = obviousLegalUrls.some(p => p.test(url));
  
  if (isObviousLegal) {
    console.log(`[FUNC:isFooterButton] DETECTED: ${JSON.stringify({ text, url: url.substring(0, 40), isLegal: true })}`);
  }
  
  return isObviousLegal;
}

// v2 - 2026-01-01: DESATIVADO filtragem agressiva de navegação
// Deixar a análise visual decidir
function isNavigationLink(text: string, url: string): boolean {
  // v2: Retornar FALSE para quase tudo
  // Manter apenas filtro de links de busca (claramente navegação)
  const obviousSearchUrls = [
    /\/search\?/i,           // Search results
    /\?type=product/i,       // Product search  
    /\?q=/i,                 // Query parameters
  ];
  
  if (text.length <= 15 && obviousSearchUrls.some(p => p.test(url))) {
    console.log(`[FUNC:isNavigationLink] DETECTED: ${JSON.stringify({ text, url: url.substring(0, 40), isSearch: true })}`);
    return true;
  }
  
  return false;
}

// =====================================================
// TEXT/PARAGRAPH EXTRACTION - With Position
// =====================================================
export function extractTextBlocksWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractTextBlocksWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  const foundTexts = new Set<string>();
  
  // Pattern for paragraphs and text divs (expanded)
  const textPatterns = [
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    /<div[^>]*class=["'][^"']*(?:text|content|description|paragraph|body|copy|info)[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    // Spans with longer text content
    /<span[^>]*>([^<]{30,})<\/span>/gi,
  ];
  
  for (const pattern of textPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const content = match[1] || match[0];
      const text = cleanText(stripHtml(content));
      
      // Reduced minimum from 50 to 30 chars
      if (text.length < 30) continue;
      
      // Skip duplicates
      const textLower = text.toLowerCase().substring(0, 100);
      if (foundTexts.has(textLower)) continue;
      foundTexts.add(textLower);
      
      // Skip if looks like navigation/menu
      if (/<a[^>]*>/gi.test(content) && (content.match(/<a/gi) || []).length > 3) continue;
      
      // Skip footer content
      if (isFooterContent(text)) {
        console.log(`[FUNC:extractTextBlocksWithPosition] SKIP_FOOTER: ${JSON.stringify({ text: text.substring(0, 50) })}`);
        continue;
      }
      
      elements.push({
        id: generateId(),
        position: match.index,
        type: 'text',
        rawHtml: match[0],
        metadata: {
          text,
          content: content.trim(),
        }
      });
      
      console.log(`[FUNC:extractTextBlocksWithPosition] FOUND: ${JSON.stringify({ textLength: text.length, textPreview: text.substring(0, 50), position: match.index })}`);
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractTextBlocksWithPosition] OUTPUT: ${JSON.stringify({ 
    textBlocksFound: elements.length,
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

// =====================================================
// FAQ EXTRACTION - With Position
// =====================================================
export function extractFAQWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractFAQWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  
  // Pattern for FAQ sections
  const faqSectionPatterns = [
    /<(?:section|div)[^>]*class=["'][^"']*(?:faq|perguntas|questions|accordion)[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
    /<(?:section|div)[^>]*id=["'][^"']*(?:faq|perguntas)[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
  ];
  
  for (const pattern of faqSectionPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const sectionHtml = match[0];
      const sectionContent = match[1];
      
      // Extract FAQ items from section
      const items = extractFAQItemsFromContent(sectionContent);
      
      if (items.length >= 2) {
        // Find title
        const titleMatch = /<h[1-6][^>]*>([^<]*(?:perguntas?|faq|dúvidas?)[^<]*)<\/h[1-6]>/i.exec(sectionHtml);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Perguntas Frequentes';
        
        elements.push({
          id: generateId(),
          position: match.index,
          type: 'faq',
          rawHtml: sectionHtml,
          metadata: {
            faqItems: items,
            faqTitle: title,
          }
        });
        
        console.log(`[FUNC:extractFAQWithPosition] FOUND: ${JSON.stringify({ itemsCount: items.length, title, position: match.index })}`);
      }
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractFAQWithPosition] OUTPUT: ${JSON.stringify({ 
    faqSectionsFound: elements.length,
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

function extractFAQItemsFromContent(html: string): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = [];
  
  // Pattern 1: details/summary
  const detailsPattern = /<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>\s*([\s\S]*?)<\/details>/gi;
  let match;
  while ((match = detailsPattern.exec(html)) !== null) {
    const question = cleanText(stripHtml(match[1]));
    const answer = cleanText(stripHtml(match[2]));
    if (question.length > 10 && answer.length > 15 && question.includes('?')) {
      items.push({ question, answer });
    }
  }
  
  // Pattern 2: collapsible divs
  const collapsiblePattern = /<div[^>]*class="[^"]*(?:accordion|collapsible)[^"]*"[^>]*>[\s\S]*?<(?:button|summary)[^>]*>([^<]+)<\/(?:button|summary)>[\s\S]*?<div[^>]*>([^<]+)/gi;
  while ((match = collapsiblePattern.exec(html)) !== null) {
    const question = cleanText(match[1]);
    const answer = cleanText(stripHtml(match[2]));
    if (question.length > 10 && answer.length > 15) {
      items.push({ question: question.endsWith('?') ? question : question + '?', answer });
    }
  }
  
  return items;
}

// =====================================================
// TESTIMONIAL EXTRACTION - With Position
// =====================================================
export function extractTestimonialsWithPosition(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractTestimonialsWithPosition] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  
  const elements: ExtractedElement[] = [];
  
  // Pattern for testimonial sections
  const testimonialSectionPatterns = [
    /<(?:section|div)[^>]*class=["'][^"']*(?:testimonial|depoimento|review|feedback|avaliac)[^"']*["'][^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
  ];
  
  for (const pattern of testimonialSectionPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const sectionHtml = match[0];
      const sectionContent = match[1];
      
      // Extract testimonial items
      const items = extractTestimonialItemsFromContent(sectionContent);
      
      if (items.length >= 2) {
        const titleMatch = /<h[1-6][^>]*>([^<]*(?:depoimento|avalia|feedback|testemunho)[^<]*)<\/h[1-6]>/i.exec(sectionHtml);
        const title = titleMatch ? cleanText(titleMatch[1]) : 'Depoimentos';
        
        elements.push({
          id: generateId(),
          position: match.index,
          type: 'testimonial',
          rawHtml: sectionHtml,
          metadata: {
            testimonialItems: items,
            testimonialTitle: title,
          }
        });
        
        console.log(`[FUNC:extractTestimonialsWithPosition] FOUND: ${JSON.stringify({ itemsCount: items.length, title, position: match.index })}`);
      }
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractTestimonialsWithPosition] OUTPUT: ${JSON.stringify({ 
    testimonialSectionsFound: elements.length,
    elapsedMs: elapsed 
  })}`);
  
  return elements;
}

function extractTestimonialItemsFromContent(html: string): Array<{ name: string; text: string; rating?: number }> {
  const items: Array<{ name: string; text: string; rating?: number }> = [];
  
  // Pattern 1: blockquotes
  const blockquotePattern = /<blockquote[^>]*>([\s\S]*?)<\/blockquote>[\s\S]*?(?:<cite[^>]*>|<footer[^>]*>|—|-)?\s*([^<]*)?/gi;
  let match;
  while ((match = blockquotePattern.exec(html)) !== null) {
    const text = cleanText(stripHtml(match[1]));
    const name = cleanText(match[2] || 'Cliente');
    if (text.length > 20) {
      items.push({ name, text, rating: 5 });
    }
  }
  
  // Pattern 2: testimonial cards
  const cardPattern = /<div[^>]*class="[^"]*(?:testimonial|review|feedback)[^"]*-?(?:item|card)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  while ((match = cardPattern.exec(html)) !== null) {
    const content = match[1];
    const textMatch = /<p[^>]*>([\s\S]+?)<\/p>/i.exec(content);
    const nameMatch = /(?:—|-|by|por)\s*([^<]+)|<(?:strong|cite|span)[^>]*>([^<]+)/i.exec(content);
    
    if (textMatch) {
      const text = cleanText(stripHtml(textMatch[1]));
      const name = cleanText(nameMatch?.[1] || nameMatch?.[2] || 'Cliente');
      if (text.length > 20) {
        items.push({ name, text, rating: 5 });
      }
    }
  }
  
  return items;
}

// =====================================================
// MAIN EXTRACTION FUNCTION
// =====================================================
export function extractAllElementsInOrder(html: string): ExtractedElement[] {
  const startTime = Date.now();
  console.log(`[FUNC:extractAllElementsInOrder] INPUT: ${JSON.stringify({ htmlLength: html.length })}`);
  console.log(`[FUNC:extractAllElementsInOrder] HTML_PREVIEW_START: ${html.substring(0, 300).replace(/\n/g, ' ')}`);
  console.log(`[FUNC:extractAllElementsInOrder] HTML_PREVIEW_END: ${html.substring(Math.max(0, html.length - 300)).replace(/\n/g, ' ')}`);
  
  const allElements: ExtractedElement[] = [];
  
  // Extract all element types
  // ORDER MATTERS: more specific first to avoid conflicts
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting video carousels...`);
  const videoCarousels = extractVideoCarouselsWithPosition(html);
  allElements.push(...videoCarousels);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Video carousels done: ${videoCarousels.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting videos...`);
  const videos = extractVideosWithPosition(html);
  allElements.push(...videos);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Videos done: ${videos.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting images...`);
  const images = extractImagesWithPosition(html);
  allElements.push(...images);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Images done: ${images.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting FAQs...`);
  const faqs = extractFAQWithPosition(html);
  allElements.push(...faqs);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: FAQs done: ${faqs.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting testimonials...`);
  const testimonials = extractTestimonialsWithPosition(html);
  allElements.push(...testimonials);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Testimonials done: ${testimonials.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting headings...`);
  const headings = extractHeadingsWithPosition(html);
  allElements.push(...headings);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Headings done: ${headings.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting buttons...`);
  const buttons = extractButtonsWithPosition(html);
  allElements.push(...buttons);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Buttons done: ${buttons.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Extracting text blocks...`);
  const textBlocks = extractTextBlocksWithPosition(html);
  allElements.push(...textBlocks);
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Text blocks done: ${textBlocks.length}`);
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: Before removeOverlapping: ${allElements.length} elements`);
  
  // Remove overlapping elements (prefer more specific types)
  const filtered = removeOverlappingElements(allElements);
  
  // =====================================================
  // V5: REMOVE FOOTER/TRENDING ELEMENTS (ANTI-POLLUTION)
  // =====================================================
  const footerPatterns = [
    'mais pesquisados', 'trending searches', 'trending products',
    'cnpj', 'formas de pagamento', 'selos de segurança',
    'receba nossas promoções', 'políticas da loja', 'política de',
    'termos de uso', 'termos de serviço', 'sobre nós', 'fale conosco',
    'atendimento ao cliente', 'central de ajuda', 'inscreva-se',
    'newsletter', 'assine nossa', 'redes sociais', 'siga-nos',
    'menu principal', 'navegação', 'mapa do site', 'todos os direitos'
  ];
  
  const cleanedElements = filtered.filter((el) => {
    const text = (el.metadata.text || el.metadata.buttonText || el.metadata.content || '').toLowerCase();
    
    // Check if text starts with or primarily contains footer patterns
    const matchedPatterns = footerPatterns.filter(p => text.includes(p));
    
    if (matchedPatterns.length >= 1) {
      // For text elements with footer patterns, check if it's MOSTLY footer content
      const isShortFooterText = text.length < 200 && matchedPatterns.length >= 1;
      const isTrending = text.startsWith('mais pesquisados') || text.includes('trending');
      
      if (isShortFooterText || isTrending) {
        console.log(`[FUNC:extractAllElementsInOrder] FILTER_OUT_FOOTER: "${text.substring(0, 50)}..." (matches: ${matchedPatterns.join(', ')})`);
        return false;
      }
    }
    
    return true;
  });
  
  console.log(`[FUNC:extractAllElementsInOrder] STEP: After footer filter: ${cleanedElements.length} elements (removed ${filtered.length - cleanedElements.length})`);
  
  // Sort by position to maintain original order
  cleanedElements.sort((a, b) => a.position - b.position);
  
  // Count by type
  const countByType = cleanedElements.reduce((acc, el) => {
    acc[el.type] = (acc[el.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const elapsed = Date.now() - startTime;
  console.log(`[FUNC:extractAllElementsInOrder] OUTPUT: ${JSON.stringify({ 
    totalElements: cleanedElements.length,
    byType: countByType,
    elapsedMs: elapsed 
  })}`);
  
  // Log each element
  cleanedElements.forEach((el, i) => {
    console.log(`[FUNC:extractAllElementsInOrder] ELEMENT[${i}]: ${JSON.stringify({ 
      type: el.type, 
      position: el.position,
      textPreview: (el.metadata.text || el.metadata.buttonText || el.metadata.videoId || '').substring(0, 40)
    })}`);
  });
  
  return cleanedElements;
}

function removeOverlappingElements(elements: ExtractedElement[]): ExtractedElement[] {
  console.log(`[FUNC:removeOverlappingElements] INPUT: ${JSON.stringify({ elementsCount: elements.length })}`);
  
  // Priority order (higher = keep when overlapping)
  const priority: Record<ElementType, number> = {
    'video-carousel': 10,
    'faq': 9,
    'testimonial': 8,
    'video': 7,
    'image-carousel': 6,
    'image': 5,
    'button': 4,
    'heading': 3,
    'info-highlight': 2,
    'list': 1,
    'text': 0,
    'unknown-section': -1,
  };
  
  const sorted = [...elements].sort((a, b) => {
    // Sort by position first
    if (a.position !== b.position) return a.position - b.position;
    // Then by priority (higher priority first)
    return priority[b.type] - priority[a.type];
  });
  
  const result: ExtractedElement[] = [];
  
  for (const element of sorted) {
    const elementEnd = element.position + element.rawHtml.length;
    
    // Check if this element overlaps with previously added elements
    const overlaps = result.some(existing => {
      const existingEnd = existing.position + existing.rawHtml.length;
      return !(elementEnd <= existing.position || element.position >= existingEnd);
    });
    
    if (!overlaps) {
      result.push(element);
    } else {
      // Check if this element has higher priority
      const overlappingIdx = result.findIndex(existing => {
        const existingEnd = existing.position + existing.rawHtml.length;
        return !(elementEnd <= existing.position || element.position >= existingEnd);
      });
      
      if (overlappingIdx >= 0 && priority[element.type] > priority[result[overlappingIdx].type]) {
        console.log(`[FUNC:removeOverlappingElements] REPLACE: ${JSON.stringify({ 
          old: result[overlappingIdx].type, 
          new: element.type,
          reason: 'higher_priority'
        })}`);
        result[overlappingIdx] = element; // Replace with higher priority
      } else {
        console.log(`[FUNC:removeOverlappingElements] SKIP_OVERLAP: ${JSON.stringify({ 
          type: element.type, 
          position: element.position
        })}`);
      }
    }
  }
  
  console.log(`[FUNC:removeOverlappingElements] OUTPUT: ${JSON.stringify({ 
    beforeCount: elements.length, 
    afterCount: result.length, 
    removedCount: elements.length - result.length 
  })}`);
  
  return result;
}
