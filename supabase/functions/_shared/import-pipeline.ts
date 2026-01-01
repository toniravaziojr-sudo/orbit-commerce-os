// =============================================
// MULTI-MODE IMPORT PIPELINE
// Extract → Classify → Implement per section
// =============================================

// =============================================
// TYPES
// =============================================

export type ImportMode = 'native-blocks' | 'hybrid' | 'pixel-perfect' | 'content-salvage';

export interface PageSection {
  id: string;
  html: string;
  order: number;
  detectedMode: ImportMode;
  confidence: number;
  characteristics: SectionCharacteristics;
}

export interface SectionCharacteristics {
  hasComplexCss: boolean;
  hasMobileVariant: boolean;
  isMappableToBlocks: boolean;
  blockTypes: string[]; // FAQ, Testimonials, etc
  cssClasses: Set<string>;
  cssIds: Set<string>;
  tagNames: Set<string>;
  imageCount: number;
  videoCount: number;
  textLength: number;
}

export interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  children: BlockNode[];
}

export interface ResponsiveImagePair {
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
  sectionId: string;
}

// =============================================
// CSS PRUNING - Only keep CSS that matches used selectors
// =============================================

export function pruneCssForHtml(css: string, html: string): string {
  if (!css || !html) return '';
  
  // Extract all class names and IDs from HTML
  const classMatches = html.match(/class=\"([^\"]*)\"/gi) || [];
  const idMatches = html.match(/id=\"([^\"]*)\"/gi) || [];
  
  const usedClasses = new Set<string>();
  const usedIds = new Set<string>();
  
  // Parse class names
  classMatches.forEach(match => {
    const classes = match.replace(/class=\"([^\"]*)\"/i, '$1').split(/\s+/);
    classes.forEach(c => c && usedClasses.add(c.toLowerCase()));
  });
  
  // Parse IDs
  idMatches.forEach(match => {
    const id = match.replace(/id=\"([^\"]*)\"/i, '$1');
    if (id) usedIds.add(id.toLowerCase());
  });
  
  // Get all HTML tag names used
  const tagMatches = html.match(/<([a-z][a-z0-9]*)/gi) || [];
  const usedTags = new Set<string>();
  tagMatches.forEach(match => {
    const tag = match.replace('<', '').toLowerCase();
    if (tag) usedTags.add(tag);
  });
  
  // Remove dangerous global rules
  let cleanCss = css
    .replace(/@font-face\s*\{[^}]*\}/gi, '')
    .replace(/@import[^;]*;/gi, '')
    .replace(/:root\s*\{[^}]*\}/gi, '')
    .replace(/(?:^|\})\s*(?:html|body|\*)\s*\{[^}]*\}/gi, '}');
  
  const filteredRules: string[] = [];
  
  // Handle @media queries separately
  const mediaBlocks = cleanCss.match(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/gi) || [];
  const cssWithoutMedia = cleanCss.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/gi, '');
  
  // Filter regular rules
  const rules = cssWithoutMedia.match(/[^{}]+\{[^{}]*\}/g) || [];
  
  rules.forEach(rule => {
    const braceIndex = rule.indexOf('{');
    if (braceIndex === -1) return;
    
    const selector = rule.substring(0, braceIndex).trim();
    const declarations = rule.substring(braceIndex);
    
    // Keep @keyframes
    if (selector.startsWith('@')) {
      filteredRules.push(rule);
      return;
    }
    
    // Skip global selectors
    if (selector === '*' || selector === 'html' || selector === 'body' || selector === ':root') {
      return;
    }
    
    // Skip display:none rules
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(declarations)) {
      return;
    }
    
    // Check if selector matches any used class, ID, or tag
    const selectorLower = selector.toLowerCase();
    let matches = false;
    
    usedClasses.forEach(cls => {
      if (selectorLower.includes('.' + cls)) matches = true;
    });
    usedIds.forEach(id => {
      if (selectorLower.includes('#' + id)) matches = true;
    });
    usedTags.forEach(tag => {
      const tagPattern = new RegExp(`\\b${tag}\\b`, 'i');
      if (tagPattern.test(selector)) matches = true;
    });
    
    if (matches) {
      filteredRules.push(rule);
    }
  });
  
  // Process @media blocks
  const filteredMedia: string[] = [];
  mediaBlocks.forEach(mediaBlock => {
    const mediaQuery = mediaBlock.substring(0, mediaBlock.indexOf('{'));
    const innerContent = mediaBlock.substring(
      mediaBlock.indexOf('{') + 1,
      mediaBlock.lastIndexOf('}')
    );
    
    const innerRules = innerContent.match(/[^{}]+\{[^{}]*\}/g) || [];
    const filteredInner: string[] = [];
    
    innerRules.forEach(rule => {
      const braceIndex = rule.indexOf('{');
      if (braceIndex === -1) return;
      
      const selector = rule.substring(0, braceIndex).trim();
      const declarations = rule.substring(braceIndex);
      
      if (selector === '*' || selector === 'html' || selector === 'body') return;
      if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(declarations)) return;
      
      const selectorLower = selector.toLowerCase();
      let matches = false;
      
      usedClasses.forEach(cls => {
        if (selectorLower.includes('.' + cls)) matches = true;
      });
      usedIds.forEach(id => {
        if (selectorLower.includes('#' + id)) matches = true;
      });
      usedTags.forEach(tag => {
        const tagPattern = new RegExp(`\\b${tag}\\b`, 'i');
        if (tagPattern.test(selector)) matches = true;
      });
      
      if (matches) {
        filteredInner.push(rule);
      }
    });
    
    if (filteredInner.length > 0) {
      filteredMedia.push(`${mediaQuery}{${filteredInner.join('\n')}}`);
    }
  });
  
  const result = [...filteredRules, ...filteredMedia].join('\n');
  console.log(`[CSS-PRUNE] Input: ${css.length} chars -> Output: ${result.length} chars (${Math.round((1 - result.length/css.length) * 100)}% reduction)`);
  return result;
}

// =============================================
// ROBUST DESKTOP/MOBILE DEDUPE
// Uses proper DOM-like parsing with nesting support
// =============================================

// Remove a single HTML element with proper nesting support
function removeNestedElement(html: string, tagName: string, startPos: number): string {
  const openTagEnd = html.indexOf('>', startPos);
  if (openTagEnd === -1) return html;
  
  // Self-closing tag
  if (html.charAt(openTagEnd - 1) === '/') {
    return html.substring(0, startPos) + html.substring(openTagEnd + 1);
  }
  
  // Find matching closing tag with nesting support
  let depth = 1;
  let pos = openTagEnd + 1;
  const openPattern = new RegExp(`<${tagName}[\\s>]`, 'gi');
  const closePattern = new RegExp(`</${tagName}>`, 'gi');
  
  while (depth > 0 && pos < html.length) {
    openPattern.lastIndex = pos;
    closePattern.lastIndex = pos;
    
    const openMatch = openPattern.exec(html);
    const closeMatch = closePattern.exec(html);
    
    if (!closeMatch) break;
    
    if (openMatch && openMatch.index < closeMatch.index) {
      depth++;
      pos = openMatch.index + openMatch[0].length;
    } else {
      depth--;
      if (depth === 0) {
        return html.substring(0, startPos) + html.substring(closeMatch.index + closeMatch[0].length);
      }
      pos = closeMatch.index + closeMatch[0].length;
    }
  }
  
  return html;
}

// Mobile class patterns to detect and remove
const MOBILE_CLASS_PATTERNS = [
  /\btablet\b/i,
  /\bmobile\b/i,
  /\bd-sm-block\b/i,
  /\bd-md-none\b/i,
  /\bshow-mobile\b/i,
  /\bhide-desktop\b/i,
  /\bmobile-only\b/i,
  /\btablet-only\b/i,
  /\bd-lg-none\b/i,
  /\bhidden-desktop\b/i,
  /\bvisible-mobile\b/i,
  /\bvisible-sm\b/i,
  /\bhidden-lg\b/i,
];

// Check if a class string indicates mobile-only content
function isMobileOnlyElement(classString: string): boolean {
  return MOBILE_CLASS_PATTERNS.some(pattern => pattern.test(classString));
}

// Robust mobile element removal with DOM-like parsing
export function removeMobileElements(html: string): { cleanedHtml: string; removedCount: number } {
  let content = html;
  let removedCount = 0;
  
  // Pattern to find section/div elements with potential mobile classes
  const elementPattern = /<(section|div)[^>]*class=\"([^\"]*)\"[^>]*/gi;
  
  let searchStart = 0;
  let match;
  
  while (searchStart < content.length) {
    elementPattern.lastIndex = searchStart;
    match = elementPattern.exec(content);
    
    if (!match) break;
    
    const tagName = match[1];
    const classString = match[2];
    
    if (isMobileOnlyElement(classString)) {
      const newContent = removeNestedElement(content, tagName, match.index);
      
      if (newContent.length < content.length) {
        removedCount++;
        content = newContent;
        // Don't advance - positions shifted
      } else {
        searchStart = match.index + match[0].length;
      }
    } else {
      searchStart = match.index + match[0].length;
    }
  }
  
  // Also remove HTML comment blocks for mobile
  content = content.replace(
    /<!--\s*(?:MOBILE|TABLET|mobile|tablet)\s*-->[\s\S]*?<!--\s*\/(?:MOBILE|TABLET|mobile|tablet)\s*-->/gi, 
    ''
  );
  
  console.log(`[DEDUPE] Removed ${removedCount} mobile-only elements`);
  return { cleanedHtml: content, removedCount };
}

// =============================================
// EXTRACT RESPONSIVE IMAGES (Desktop + Mobile pairs)
// =============================================

export function extractResponsiveImages(html: string): ResponsiveImagePair[] {
  const images: ResponsiveImagePair[] = [];
  
  // Pattern: sections with numbered classes (section1, section2, etc)
  // Find both desktop (no tablet/mobile class) and mobile (with tablet/mobile class) versions
  const sectionPattern = /<section[^>]*class=\"([^\"]*\bsection(\d+)\b[^\"]*)\"[^>]*>([\s\S]*?)<\/section>/gi;
  
  interface SectionContent {
    desktop?: string;
    mobile?: string;
  }
  
  const sectionsByNumber: Record<string, SectionContent> = {};
  
  let match;
  while ((match = sectionPattern.exec(html)) !== null) {
    const fullClass = match[1];
    const sectionNum = match[2];
    const content = match[3];
    
    const isMobile = isMobileOnlyElement(fullClass);
    
    if (!sectionsByNumber[sectionNum]) {
      sectionsByNumber[sectionNum] = {};
    }
    
    if (isMobile) {
      sectionsByNumber[sectionNum].mobile = content;
    } else {
      sectionsByNumber[sectionNum].desktop = content;
    }
  }
  
  // For each section that has BOTH versions, extract and pair images
  for (const [sectionNum, contents] of Object.entries(sectionsByNumber)) {
    if (contents.desktop && contents.mobile) {
      const desktopImages = extractImagesFromHtml(contents.desktop);
      const mobileImages = extractImagesFromHtml(contents.mobile);
      
      console.log(`[RESPONSIVE-IMG] Section ${sectionNum}: ${desktopImages.length} desktop, ${mobileImages.length} mobile`);
      
      // Match by position (assume same order)
      const maxLen = Math.max(desktopImages.length, mobileImages.length);
      for (let i = 0; i < maxLen; i++) {
        const desktopImg = desktopImages[i];
        const mobileImg = mobileImages[i];
        
        if (desktopImg || mobileImg) {
          images.push({
            desktopSrc: desktopImg?.src || mobileImg?.src || '',
            mobileSrc: mobileImg?.src || desktopImg?.src || '',
            alt: desktopImg?.alt || mobileImg?.alt || `Imagem ${sectionNum}-${i + 1}`,
            sectionId: `section${sectionNum}`,
          });
        }
      }
    }
  }
  
  console.log(`[RESPONSIVE-IMG] Total paired images: ${images.length}`);
  return images;
}

function extractImagesFromHtml(html: string): Array<{ src: string; alt: string }> {
  const images: Array<{ src: string; alt: string }> = [];
  
  // Match img tags
  const imgPattern = /<img[^>]*src=\"([^\"]+)\"[^>]*(?:alt=\"([^\"]*)\")?[^>]*>/gi;
  let match;
  
  while ((match = imgPattern.exec(html)) !== null) {
    const src = match[1];
    const alt = match[2] || '';
    
    // Skip tiny images, icons, tracking pixels
    if (src && !src.includes('tracking') && !src.includes('pixel') && !src.includes('1x1')) {
      images.push({ src, alt });
    }
  }
  
  // Also match background-image in style
  const bgPattern = /background-image:\s*url\(['"]?([^'"\)\s]+)['"]?\)/gi;
  while ((match = bgPattern.exec(html)) !== null) {
    images.push({ src: match[1], alt: '' });
  }
  
  return images;
}

// =============================================
// SECTION SEGMENTATION
// Break page into sections for per-section mode selection
// =============================================

export function segmentPageIntoSections(html: string): PageSection[] {
  const sections: PageSection[] = [];
  let sectionId = 0;
  
  // Strategy 1: Find explicit <section> tags
  const sectionPattern = /<section[^>]*>([\s\S]*?)<\/section>/gi;
  let match;
  let lastIndex = 0;
  
  while ((match = sectionPattern.exec(html)) !== null) {
    // Add any content before this section as a section
    if (match.index > lastIndex) {
      const betweenContent = html.substring(lastIndex, match.index).trim();
      if (betweenContent.length > 100) {
        sections.push(createSection(sectionId++, betweenContent, sections.length));
      }
    }
    
    // Add this section
    sections.push(createSection(sectionId++, match[0], sections.length));
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining content
  if (lastIndex < html.length) {
    const remaining = html.substring(lastIndex).trim();
    if (remaining.length > 100) {
      sections.push(createSection(sectionId++, remaining, sections.length));
    }
  }
  
  // If no sections found, treat entire content as one section
  if (sections.length === 0) {
    sections.push(createSection(0, html, 0));
  }
  
  console.log(`[SEGMENT] Split page into ${sections.length} sections`);
  return sections;
}

function createSection(id: number, html: string, order: number): PageSection {
  const characteristics = analyzeSection(html);
  const mode = selectModeForSection(characteristics);
  
  return {
    id: `section-${id}`,
    html,
    order,
    detectedMode: mode.mode,
    confidence: mode.confidence,
    characteristics,
  };
}

function analyzeSection(html: string): SectionCharacteristics {
  // Extract classes and IDs
  const classMatches = html.match(/class=\"([^\"]*)\"/gi) || [];
  const idMatches = html.match(/id=\"([^\"]*)\"/gi) || [];
  const tagMatches = html.match(/<([a-z][a-z0-9]*)/gi) || [];
  
  const cssClasses = new Set<string>();
  const cssIds = new Set<string>();
  const tagNames = new Set<string>();
  
  classMatches.forEach(m => {
    const classes = m.replace(/class=\"([^\"]*)\"/i, '$1').split(/\s+/);
    classes.forEach(c => c && cssClasses.add(c));
  });
  
  idMatches.forEach(m => {
    const id = m.replace(/id=\"([^\"]*)\"/i, '$1');
    if (id) cssIds.add(id);
  });
  
  tagMatches.forEach(m => {
    tagNames.add(m.replace('<', '').toLowerCase());
  });
  
  // Count images and videos
  const imageCount = (html.match(/<img/gi) || []).length;
  const videoCount = (html.match(/youtube\.com|vimeo\.com|<video/gi) || []).length;
  
  // Text length
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Check for complex CSS indicators
  const hasComplexCss = 
    /grid-template|display:\s*grid|flex-wrap|position:\s*absolute/i.test(html) ||
    cssClasses.size > 20;
  
  // Check for mobile variant
  const hasMobileVariant = MOBILE_CLASS_PATTERNS.some(p => 
    Array.from(cssClasses).some(c => p.test(c))
  );
  
  // Check mappability to blocks
  const blockTypes: string[] = [];
  
  // FAQ detection
  if (/faq|pergunta|d[úu]vida|accordion.*pergunta/i.test(html) && 
      html.includes('?')) {
    blockTypes.push('FAQ');
  }
  
  // Testimonials detection
  if (/depoimento|testemunho|cliente.*disse|review|rating|estrela/i.test(html)) {
    blockTypes.push('Testimonials');
  }
  
  // InfoHighlights detection
  if (/frete|pagamento|seguro|garantia|atendimento|suporte|entrega/i.test(html) &&
      imageCount > 0) {
    blockTypes.push('InfoHighlights');
  }
  
  // Video detection
  if (videoCount > 0) {
    blockTypes.push('YouTubeVideo');
  }
  
  return {
    hasComplexCss,
    hasMobileVariant,
    isMappableToBlocks: blockTypes.length > 0,
    blockTypes,
    cssClasses,
    cssIds,
    tagNames,
    imageCount,
    videoCount,
    textLength: textContent.length,
  };
}

function selectModeForSection(characteristics: SectionCharacteristics): { mode: ImportMode; confidence: number } {
  // If mappable to native blocks, prefer native-blocks mode
  if (characteristics.isMappableToBlocks && !characteristics.hasComplexCss) {
    return { mode: 'native-blocks', confidence: 0.9 };
  }
  
  // If has complex CSS but also some mappable elements, use hybrid
  if (characteristics.hasComplexCss && characteristics.isMappableToBlocks) {
    return { mode: 'hybrid', confidence: 0.8 };
  }
  
  // If complex CSS dominant, use pixel-perfect
  if (characteristics.hasComplexCss || characteristics.hasMobileVariant) {
    return { mode: 'pixel-perfect', confidence: 0.85 };
  }
  
  // If mostly text, use native-blocks (RichText)
  if (characteristics.textLength > 500 && characteristics.imageCount < 3) {
    return { mode: 'native-blocks', confidence: 0.7 };
  }
  
  // Default: pixel-perfect for safety
  return { mode: 'pixel-perfect', confidence: 0.6 };
}

// =============================================
// BLOCK CREATION HELPERS
// =============================================

export function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createImageBlock(
  imageDesktop: string, 
  imageMobile: string, 
  alt: string
): BlockNode {
  return {
    id: generateBlockId('image'),
    type: 'Image',
    props: {
      imageDesktop,
      imageMobile: imageMobile || imageDesktop,
      alt,
      width: 'full',
      height: 'auto',
      objectFit: 'cover',
      objectPosition: 'center',
      aspectRatio: 'auto',
      rounded: 'none',
      shadow: 'none',
    },
    children: [],
  };
}

export function createCustomBlock(
  html: string, 
  css: string, 
  blockName: string
): BlockNode {
  // CRITICAL: Prune CSS before creating block
  const prunedCss = pruneCssForHtml(css, html);
  
  return {
    id: generateBlockId('customblock'),
    type: 'CustomBlock',
    props: {
      htmlContent: html,
      cssContent: prunedCss,
      blockName,
    },
    children: [],
  };
}

export function createRichTextBlock(content: string): BlockNode {
  return {
    id: generateBlockId('richtext'),
    type: 'RichText',
    props: {
      content,
      fontFamily: 'inherit',
      fontSize: 'base',
      fontWeight: 'normal',
    },
    children: [],
  };
}

export function createButtonBlock(
  text: string, 
  url: string, 
  variant: 'primary' | 'secondary' | 'outline' = 'primary'
): BlockNode {
  return {
    id: generateBlockId('button'),
    type: 'Button',
    props: {
      text,
      url,
      variant,
      size: 'lg',
      fullWidth: false,
      alignment: 'center',
    },
    children: [],
  };
}

// =============================================
// BUTTON EXTRACTION
// Extract CTAs from HTML for native Button blocks
// =============================================

interface ExtractedButton {
  text: string;
  url: string;
  variant: 'primary' | 'secondary' | 'outline';
}

export function extractButtons(html: string): { buttons: ExtractedButton[]; cleanedHtml: string } {
  if (!html) return { buttons: [], cleanedHtml: html };
  
  const buttons: ExtractedButton[] = [];
  let cleanedHtml = html;
  
  // Pattern: <a> with button-like classes
  const buttonPatterns = [
    /<a[^>]*class=\"[^\"]*(?:btn|button|cta|comprar|buy-now)[^\"]*\"[^>]*href=\"([^\"]*)\"[^>]*>([^<]+)<\/a>/gi,
    /<a[^>]*href=\"([^\"]*)\"[^>]*class=\"[^\"]*(?:btn|button|cta|comprar|buy-now)[^\"]*\"[^>]*>([^<]+)<\/a>/gi,
  ];
  
  for (const pattern of buttonPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1];
      const text = match[2].trim();
      
      if (text && text.length > 2 && text.length < 50 && !/^[<>]+$/.test(text)) {
        const fullMatch = match[0].toLowerCase();
        let variant: 'primary' | 'secondary' | 'outline' = 'primary';
        
        if (fullMatch.includes('outline') || fullMatch.includes('ghost')) {
          variant = 'outline';
        } else if (fullMatch.includes('secondary')) {
          variant = 'secondary';
        }
        
        buttons.push({ text, url: url || '#', variant });
        cleanedHtml = cleanedHtml.replace(match[0], '');
      }
    }
  }
  
  // Deduplicate
  const uniqueButtons = buttons.reduce((acc, btn) => {
    if (!acc.some(b => b.text.toLowerCase() === btn.text.toLowerCase())) {
      acc.push(btn);
    }
    return acc;
  }, [] as ExtractedButton[]);
  
  console.log(`[BUTTONS] Extracted ${uniqueButtons.length} buttons`);
  return { buttons: uniqueButtons.slice(0, 5), cleanedHtml };
}
