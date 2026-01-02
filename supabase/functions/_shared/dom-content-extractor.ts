// =============================================
// EXTRATOR DE CONTEÚDO BASEADO EM DOM REAL
// Substitui a abordagem de regex por parsing DOM
// Usa deno-dom para parsing confiável de HTML
// =============================================

import { DOMParser, Element, Document } from "https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts";
import { getPlatformConfig } from './platform-content-selectors.ts';

// =============================================
// INTERFACES
// =============================================

export interface DOMExtractionResult {
  contentHtml: string;
  extractedFrom: string;
  mainContentFound: boolean;
  removedElements: { selector: string; count: number }[];
  primitivesCount: {
    headings: number;
    paragraphs: number;
    images: number;
    videos: number;
    buttons: number;
    links: number;
  };
  stats: {
    originalLength: number;
    finalLength: number;
    reductionPercent: number;
  };
  logs: string[];
}

interface MainContainerCandidate {
  element: Element;
  selector: string;
  score: number;
  textLength: number;
  hasParagraphs: boolean;
  hasHeadings: boolean;
}

// =============================================
// CONSTANTS
// =============================================

const HTML_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB max
const MIN_CONTENT_LENGTH = 300; // Minimum chars to consider valid main content
const EXTRACTION_TIMEOUT = 30000; // 30 seconds

// Universal selectors for main content (ordered by priority)
const UNIVERSAL_MAIN_SELECTORS = [
  '#MainContent',
  'main#MainContent',
  'main[role="main"]',
  'main.main-content',
  'main',
  '[role="main"]',
  'article',
  '#content',
  '.content',
  '.main-content',
  '.page-content',
  '.entry-content',
];

// Platform-specific selectors (highest priority)
const PLATFORM_MAIN_SELECTORS: Record<string, string[]> = {
  shopify: [
    '#MainContent',
    'main#MainContent',
    'main[role="main"]',
    'main.main-content',
    // Specific content sections (video, text, page content)
    '.shopify-section--video',
    '.shopify-section--page-content',
    '.shopify-section--rich-text',
    '.shopify-section--custom-content',
    // Generic content section (exclude header/footer groups)
    '.shopify-section:not(.shopify-section-group-header-group):not(.shopify-section-group-footer-group):not([class*="announcement"]):not([class*="header"]):not([class*="footer"])',
  ],
  woocommerce: [
    '.entry-content',
    'main',
    'article',
    '.woocommerce-page',
  ],
  nuvemshop: [
    '[data-store]',
    'main',
    '.page-content',
  ],
};

// Elements to remove from content (by category)
const REMOVAL_SELECTORS = {
  // Semantic layout elements
  layout: ['header', 'footer', 'nav', 'aside'],
  
  // Modal/overlay elements - CRITICAL: must remove ALL modals/drawers/overlays
  modals: [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '[aria-hidden="true"]',
    '.modal',
    '.drawer',
    '.overlay',
    '.backdrop',
    '.popup',
    '.cart-drawer',
    '.menu-drawer',
    '.search-modal',
    '.lightbox',
    '.modal-parcel',
    '.backdrop-modal-parcel',
    '#backdrop-modal-parcel',
    '[id*="modal"]',
    '[id*="drawer"]',
    '[id*="overlay"]',
    '[id*="backdrop"]',
    '[id*="popup"]',
    '[class*="modal"]',
    '[class*="drawer"]',
    '[class*="overlay"]',
    '[class*="backdrop"]',
    '[class*="popup"]',
  ],
  
  // Cookie/consent banners
  consent: [
    '[id*="cookie"]',
    '[class*="cookie"]',
    '[id*="consent"]',
    '[class*="consent"]',
    '[id*="gdpr"]',
    '[class*="gdpr"]',
    '.cookie-banner',
    '.cookie-notice',
    '#cookie-policy',
  ],
  
  // Shopify-specific - target specific Shopify sections, NOT generic class patterns
  shopify: [
    '.shopify-section-group-header-group',
    '.shopify-section-group-footer-group',
    '.shopify-section-group-overlay-group',
    '[data-section-type="header"]',
    '[data-section-type="footer"]',
    '[data-section-type="announcement-bar"]',
    '#shopify-section-header',
    '#shopify-section-footer',
    '#shopify-section-cart-drawer',
    '#shopify-section-menu-drawer',
    '.announcement-bar',
    '.announcement-bar-section',
    // Specific Shopify footer/header IDs
    '#footer',
    '#header',
    // Mobile menu
    '.menu-mobile',
    '.mobile-menu',
  ],
  
  // Navigation elements
  navigation: [
    '.site-header',
    '.site-footer',
    '.nav-menu',
    '.main-nav',
    '.mobile-nav',
    '.header-container',
    '.header-wrapper',
    '.footer-wrapper',
    '.footer-container',
    '#header',
    '#footer',
    '.menu-flutuante',
    '#MenuFlutuante',
  ],
  
  // Non-content elements - specific classes only, NOT wildcards
  nonContent: [
    '.search-trending',
    '.trending-searches',
    '.popular-searches',
    '.selos-footer',
    '.promo-bar',
    '.top-bar',
    '.menu-flutuante',
    '#MenuFlutuante',
    // Specific footer/contact sections (exact classes, not wildcards)
    '.footer-selos',
    '.footer-contact',
    '.newsletter-section',
  ],
};

// =============================================
// MAIN EXTRACTION FUNCTION
// =============================================

/**
 * Extrai conteúdo principal usando parsing DOM real.
 * Esta é a função principal que substitui o extrator baseado em regex.
 */
export async function extractContentWithDOM(
  html: string,
  pageUrl: string,
  platformHint?: string
): Promise<DOMExtractionResult> {
  const logs: string[] = [];
  const removedElements: { selector: string; count: number }[] = [];
  const originalLength = html.length;
  
  logs.push(`[DOM-EXTRACT] Starting extraction for URL: ${pageUrl}`);
  logs.push(`[DOM-EXTRACT] Platform hint: ${platformHint || 'auto-detect'}`);
  logs.push(`[DOM-EXTRACT] Input HTML length: ${originalLength} chars`);
  
  // Guard: Check HTML size limit
  if (originalLength > HTML_SIZE_LIMIT) {
    logs.push(`[DOM-EXTRACT] WARNING: HTML exceeds size limit (${(originalLength / 1024 / 1024).toFixed(2)}MB > 5MB). Truncating.`);
    html = html.substring(0, HTML_SIZE_LIMIT);
  }
  
  try {
    // STEP 1: Parse DOM
    logs.push(`[DOM-EXTRACT] STEP 1: Parsing HTML with DOMParser`);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    if (!doc || !doc.body) {
      logs.push(`[DOM-EXTRACT] ERROR: Failed to parse HTML - no document/body`);
      return createFallbackResult(html, logs, removedElements, originalLength, 'parse-failed');
    }
    
    logs.push(`[DOM-EXTRACT] DOM parsed successfully`);
    
    // Remove scripts, noscript, style immediately
    const scriptsRemoved = removeAllByTag(doc, 'script');
    const noscriptRemoved = removeAllByTag(doc, 'noscript');
    const styleRemoved = removeAllByTag(doc, 'style');
    
    logs.push(`[DOM-EXTRACT] Removed initial elements: scripts=${scriptsRemoved}, noscript=${noscriptRemoved}, style=${styleRemoved}`);
    
    // STEP 1.5: CRITICAL - Remove header/footer sections from ENTIRE document BEFORE selecting main
    // Some Shopify themes have header-group INSIDE the main element
    logs.push(`[DOM-EXTRACT] STEP 1.5: Pre-cleaning header/footer from entire document`);
    // CRITICAL: Do NOT remove <main> here - only remove elements INSIDE it later
    // We only pre-clean elements that are clearly NOT content containers
    const preCleanSelectors = [
      // Shopify section groups (header/footer inside main)
      '.shopify-section-group-header-group',
      '.shopify-section-group-footer-group', 
      '.shopify-section-group-overlay-group',
      '[data-section-type="header"]',
      '[data-section-type="footer"]',
      '[data-section-type="announcement-bar"]',
      '#shopify-section-header',
      '#shopify-section-footer',
      '#shopify-section-cart-drawer',
      '#shopify-section-menu-drawer',
      // Announcement bars
      '.announcement-bar',
      '.announcement-bar-section',
      // Standard header/footer - but NOT <main>!
      'header:not(main header)', // Only remove header if not inside main
      'footer:not(main footer)', // Only remove footer if not inside main  
      'nav:not(main nav)',       // Only remove nav if not inside main
      // Modal/overlays
      '[role="dialog"]',
      '[aria-modal="true"]',
      '.modal',
      '.drawer',
      '.overlay',
      '.backdrop',
      '#backdrop-modal-parcel',
      '.modal-parcel',
    ];
    
    let preCleanCount = 0;
    for (const selector of preCleanSelectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        if (elements.length > 0) {
          for (const el of elements) {
            (el as Element).remove();
          }
          preCleanCount += elements.length;
          removedElements.push({ selector: `pre-clean:${selector}`, count: elements.length });
          logs.push(`[DOM-EXTRACT] Pre-cleaned ${elements.length} elements: ${selector}`);
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }
    logs.push(`[DOM-EXTRACT] Total pre-cleaned elements: ${preCleanCount}`);
    
    // STEP 2: Select main container (now cleaner)
    logs.push(`[DOM-EXTRACT] STEP 2: Selecting main content container`);
    const mainResult = selectMainContainer(doc, platformHint, logs);
    
    let mainElement = mainResult.element;
    const extractedFrom = mainResult.extractedFrom;
    const mainContentFound = mainResult.found;
    
    logs.push(`[DOM-EXTRACT] Main content selection: ${extractedFrom}`);
    logs.push(`[DOM-EXTRACT] Main content found: ${mainContentFound}`);
    
    // STEP 3: Remove layout/overlays from main content
    logs.push(`[DOM-EXTRACT] STEP 3: Removing layout/overlay elements`);
    const removalResult = removeLayoutElements(mainElement, platformHint, logs);
    removedElements.push(...removalResult.removedElements);
    
    // STEP 4: Normalize URLs
    logs.push(`[DOM-EXTRACT] STEP 4: Normalizing relative URLs`);
    normalizeUrls(mainElement, pageUrl, logs);
    
    // STEP 5: Extract final HTML and count primitives
    logs.push(`[DOM-EXTRACT] STEP 5: Extracting final content`);
    const contentHtml = mainElement.innerHTML || '';
    const primitivesCount = countPrimitives(mainElement);
    
    const finalLength = contentHtml.length;
    const reductionPercent = originalLength > 0 
      ? Math.round((1 - finalLength / originalLength) * 100) 
      : 0;
    
    logs.push(`[DOM-EXTRACT] Final HTML length: ${finalLength} chars (${reductionPercent}% reduction)`);
    logs.push(`[DOM-EXTRACT] Primitives: headings=${primitivesCount.headings}, paragraphs=${primitivesCount.paragraphs}, images=${primitivesCount.images}, videos=${primitivesCount.videos}`);
    logs.push(`[DOM-EXTRACT] Removed ${removedElements.length} element categories`);
    
    // Log all removed elements summary
    for (const removed of removedElements) {
      logs.push(`[DOM-EXTRACT]   - ${removed.selector}: ${removed.count} elements`);
    }
    
    return {
      contentHtml,
      extractedFrom,
      mainContentFound,
      removedElements,
      primitivesCount,
      stats: {
        originalLength,
        finalLength,
        reductionPercent,
      },
      logs,
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logs.push(`[DOM-EXTRACT] ERROR: ${errorMsg}`);
    return createFallbackResult(html, logs, removedElements, originalLength, `error: ${errorMsg}`);
  }
}

// =============================================
// STEP 2: Main Container Selection
// =============================================

// =============================================
// SHOPIFY EXTRACTOR V6 - SEED-BASED SCOPING
// =============================================
// 
// Estratégia: Em vez de filtrar candidatos por regras de exclusão,
// usamos âncoras de conteúdo real (seeds) para definir o escopo:
// 1. SEED_TITLE: h1/h2 similar ao og:title
// 2. SEED_VIDEO: iframe YouTube/Vimeo
// 3. SEED_CTA: botão/link com texto de CTA
// Depois calculamos o LCA (Lowest Common Ancestor) e validamos.
// =============================================

interface SeedResult {
  element: Element | null;
  path: string;
  text?: string;
}

interface V6ExtractionResult {
  success: boolean;
  element: Element | null;
  extractedFrom: string;
  errorCode?: string;
  seeds: {
    title: SeedResult | null;
    video: SeedResult | null;
    cta: SeedResult | null;
  };
}

// Blacklist patterns for footer/trending detection
const V6_BLACKLIST_PATTERNS = [
  'mais pesquisados', 'trending searches', 'trending products',
  'cnpj', 'formas de pagamento', 'selos de segurança',
  'receba nossas promoções', 'políticas da loja', 'política de',
  'termos de uso', 'termos de serviço', 'fale conosco',
  'atendimento ao cliente', 'central de ajuda', 'inscreva-se',
  'newsletter', 'assine nossa', 'redes sociais', 'siga-nos',
  'menu principal', 'navegação', 'mapa do site', 'sobre nós'
];

// CTA patterns for detecting primary call-to-action
const V6_CTA_PATTERNS = [
  'consulte agora', 'comprar agora', 'compre agora', 'saiba mais',
  'ver mais', 'conhecer', 'agendar', 'começar', 'iniciar',
  'experimente', 'teste grátis', 'assinar', 'cadastrar'
];

/**
 * V6: Get element path for debugging
 */
function getElementPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  
  while (current && current.tagName) {
    const tag = current.tagName.toLowerCase();
    const id = current.getAttribute('id');
    const className = current.getAttribute('class')?.split(' ')[0];
    
    if (id) {
      parts.unshift(`${tag}#${id}`);
    } else if (className) {
      parts.unshift(`${tag}.${className}`);
    } else {
      parts.unshift(tag);
    }
    
    current = current.parentElement;
    if (parts.length > 5) break;
  }
  
  return parts.join(' > ');
}

/**
 * V6: Check if element is inside forbidden containers
 */
function isInsideForbiddenContainer(element: Element): boolean {
  const forbiddenSelectors = [
    'header', 'footer', 'nav', 'aside',
    '[role="banner"]', '[role="contentinfo"]', '[role="navigation"]',
    '.shopify-section-group-header-group', '.shopify-section-group-footer-group',
    '[data-section-type="header"]', '[data-section-type="footer"]',
    '.drawer', '.modal', '.overlay', '[role="dialog"]', '[aria-modal="true"]',
    '.predictive-search', '[data-predictive-search]'
  ];
  
  for (const selector of forbiddenSelectors) {
    if (element.closest(selector)) {
      return true;
    }
  }
  
  return false;
}

/**
 * V6: Normalize text for comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '')     // Keep only alphanumeric
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * V6: Calculate text similarity (0-1)
 */
function textSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  
  if (normA === normB) return 1;
  if (normA.length === 0 || normB.length === 0) return 0;
  
  // Check if one contains the other
  if (normA.includes(normB) || normB.includes(normA)) {
    const minLen = Math.min(normA.length, normB.length);
    const maxLen = Math.max(normA.length, normB.length);
    return minLen / maxLen;
  }
  
  // Simple word overlap
  const wordsA = new Set(normA.split(' ').filter(w => w.length > 2));
  const wordsB = new Set(normB.split(' ').filter(w => w.length > 2));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }
  
  return overlap / Math.max(wordsA.size, wordsB.size);
}

/**
 * V6: Find title seed (h1/h2 similar to og:title or document title)
 */
function findTitleSeed(container: Element, doc: Document, logs: string[]): SeedResult | null {
  // Get reference title from meta tags
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const docTitle = doc.querySelector('title')?.textContent;
  const referenceTitle = ogTitle || docTitle || '';
  
  logs.push(`[SHOPIFY-V6] SEED_TITLE: reference="${referenceTitle.substring(0, 50)}..."`);
  
  if (!referenceTitle) {
    logs.push(`[SHOPIFY-V6] SEED_TITLE: no reference title found`);
    return null;
  }
  
  // Find all headings (h1 first, then h2)
  const h1s = container.querySelectorAll('h1');
  const h2s = container.querySelectorAll('h2');
  const allHeadings = [...Array.from(h1s), ...Array.from(h2s)];
  
  let bestMatch: { element: Element; similarity: number; text: string } | null = null;
  
  for (const heading of allHeadings) {
    const h = heading as Element;
    
    // Skip headings inside forbidden containers
    if (isInsideForbiddenContainer(h)) {
      logs.push(`[SHOPIFY-V6] SEED_TITLE: skipping heading inside forbidden container`);
      continue;
    }
    
    const headingText = (h.textContent || '').trim();
    if (headingText.length < 5) continue;
    
    const similarity = textSimilarity(headingText, referenceTitle);
    
    if (similarity >= 0.3 && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { element: h, similarity, text: headingText };
    }
  }
  
  if (bestMatch) {
    logs.push(`[SHOPIFY-V6] SEED_TITLE: found "${bestMatch.text.substring(0, 40)}..." (similarity: ${bestMatch.similarity.toFixed(2)}) at path ${getElementPath(bestMatch.element)}`);
    return {
      element: bestMatch.element,
      path: getElementPath(bestMatch.element),
      text: bestMatch.text
    };
  }
  
  // Fallback: first h1 or h2 not in forbidden container
  for (const heading of allHeadings) {
    const h = heading as Element;
    if (!isInsideForbiddenContainer(h)) {
      const text = (h.textContent || '').trim();
      if (text.length >= 5) {
        logs.push(`[SHOPIFY-V6] SEED_TITLE: fallback to first valid heading "${text.substring(0, 40)}..."`);
        return {
          element: h,
          path: getElementPath(h),
          text
        };
      }
    }
  }
  
  logs.push(`[SHOPIFY-V6] SEED_TITLE: not found`);
  return null;
}

/**
 * V6: Find video seed (YouTube/Vimeo iframe)
 */
function findVideoSeed(container: Element, logs: string[]): SeedResult | null {
  const videoSelectors = [
    'iframe[src*="youtube.com"]',
    'iframe[src*="youtu.be"]',
    'iframe[data-src*="youtube"]',
    'iframe[src*="vimeo.com"]',
    'video[src]',
    'video source[src]'
  ];
  
  for (const selector of videoSelectors) {
    const elements = container.querySelectorAll(selector);
    
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as Element;
      
      // Skip videos inside forbidden containers
      if (isInsideForbiddenContainer(el)) {
        logs.push(`[SHOPIFY-V6] SEED_VIDEO: skipping video inside forbidden container`);
        continue;
      }
      
      const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
      logs.push(`[SHOPIFY-V6] SEED_VIDEO: found video (src: ${src.substring(0, 50)}...) at path ${getElementPath(el)}`);
      
      return {
        element: el,
        path: getElementPath(el),
        text: src
      };
    }
  }
  
  logs.push(`[SHOPIFY-V6] SEED_VIDEO: not found`);
  return null;
}

/**
 * V6: Find CTA seed (primary call-to-action button/link)
 */
function findCTASeed(container: Element, logs: string[]): SeedResult | null {
  // Find all potential CTAs
  const ctaSelectors = [
    'a[href*="consulte"]',
    'a[href*="contato"]',
    'a[href*="comprar"]',
    'a[href*="agendar"]',
    'button',
    'a.btn',
    'a.button',
    '[role="button"]'
  ];
  
  const candidates: Element[] = [];
  for (const selector of ctaSelectors) {
    try {
      const els = container.querySelectorAll(selector);
      for (let i = 0; i < els.length; i++) {
        candidates.push(els[i] as Element);
      }
    } catch { /* invalid selector */ }
  }
  
  // Find best CTA by matching patterns
  for (const pattern of V6_CTA_PATTERNS) {
    for (const el of candidates) {
      if (isInsideForbiddenContainer(el)) continue;
      
      const text = normalizeText(el.textContent || '');
      if (text.includes(pattern.replace(/\s+/g, ' '))) {
        logs.push(`[SHOPIFY-V6] SEED_CTA: found "${(el.textContent || '').trim().substring(0, 30)}" (pattern: ${pattern}) at path ${getElementPath(el)}`);
        return {
          element: el,
          path: getElementPath(el),
          text: (el.textContent || '').trim()
        };
      }
    }
  }
  
  // Fallback: first CTA with href not in forbidden container
  for (const el of candidates) {
    if (isInsideForbiddenContainer(el)) continue;
    
    const text = (el.textContent || '').trim();
    if (text.length >= 3 && text.length <= 50) {
      logs.push(`[SHOPIFY-V6] SEED_CTA: fallback to first valid CTA "${text.substring(0, 30)}"`);
      return {
        element: el,
        path: getElementPath(el),
        text
      };
    }
  }
  
  logs.push(`[SHOPIFY-V6] SEED_CTA: not found`);
  return null;
}

/**
 * V6: Find Lowest Common Ancestor (LCA) of two elements
 */
function findLCA(a: Element, b: Element): Element | null {
  const ancestorsA = new Set<Element>();
  
  let current: Element | null = a;
  while (current) {
    ancestorsA.add(current);
    current = current.parentElement;
  }
  
  current = b;
  while (current) {
    if (ancestorsA.has(current)) {
      return current;
    }
    current = current.parentElement;
  }
  
  return null;
}

/**
 * V6: Check if scope contains blacklist patterns
 */
function containsBlacklistPatterns(element: Element, logs: string[]): string[] {
  const text = normalizeText(element.textContent || '');
  const matched: string[] = [];
  
  for (const pattern of V6_BLACKLIST_PATTERNS) {
    if (text.includes(pattern.replace(/\s+/g, ' '))) {
      matched.push(pattern);
    }
  }
  
  return matched;
}

/**
 * V6: Pre-clean container by removing non-content elements
 */
function preCleanContainer(container: Element, logs: string[]): void {
  const removeSelectors = [
    'script', 'style', 'link', 'noscript',
    '[aria-hidden="true"]', '[hidden]',
    '[style*="display: none"]', '[style*="display:none"]',
    '.predictive-search', '[data-predictive-search]',
    '.drawer', '.modal', '.overlay', '[role="dialog"]', '[aria-modal="true"]',
    '.search-modal', '.cart-drawer', '.menu-drawer',
    '[data-section-type="header"]', '[data-section-type="footer"]',
    '.shopify-section-group-header-group', '.shopify-section-group-footer-group'
  ];
  
  let removed = 0;
  for (const selector of removeSelectors) {
    try {
      const els = container.querySelectorAll(selector);
      for (let i = 0; i < els.length; i++) {
        (els[i] as Element).remove();
        removed++;
      }
    } catch { /* invalid selector */ }
  }
  
  logs.push(`[SHOPIFY-V6] PRE-CLEAN: removed ${removed} non-content elements`);
}

/**
 * V6: Extract scope based on seeds
 * Returns the section(s) containing the seeds
 */
function extractScopeFromSeeds(
  mainContainer: Element,
  seeds: { title: SeedResult | null; video: SeedResult | null; cta: SeedResult | null },
  logs: string[]
): Element | null {
  // Need at least title OR video to proceed
  if (!seeds.title && !seeds.video) {
    logs.push(`[SHOPIFY-V6] SCOPE: no title or video seed, cannot determine scope`);
    return null;
  }
  
  // Find the shopify-section containing each seed
  const findSection = (el: Element | null): Element | null => {
    if (!el) return null;
    
    // Look for shopify-section ancestor
    const section = el.closest('[id^="shopify-section-"]');
    if (section) return section as Element;
    
    // Fallback: look for section or article
    const container = el.closest('section, article, [class*="section"]');
    return container as Element | null;
  };
  
  const titleSection = findSection(seeds.title?.element || null);
  const videoSection = findSection(seeds.video?.element || null);
  const ctaSection = findSection(seeds.cta?.element || null);
  
  logs.push(`[SHOPIFY-V6] SCOPE: titleSection=${titleSection?.getAttribute('id') || 'none'}`);
  logs.push(`[SHOPIFY-V6] SCOPE: videoSection=${videoSection?.getAttribute('id') || 'none'}`);
  logs.push(`[SHOPIFY-V6] SCOPE: ctaSection=${ctaSection?.getAttribute('id') || 'none'}`);
  
  // Collect unique sections
  const sectionsMap = new Map<string, Element>();
  
  if (titleSection) {
    sectionsMap.set(titleSection.getAttribute('id') || 'title', titleSection);
  }
  if (videoSection) {
    sectionsMap.set(videoSection.getAttribute('id') || 'video', videoSection);
  }
  if (ctaSection) {
    // Only include CTA section if it's the same as title/video OR adjacent
    const ctaId = ctaSection.getAttribute('id') || 'cta';
    const existingIds = Array.from(sectionsMap.keys());
    
    if (existingIds.includes(ctaId) || sectionsMap.size === 0) {
      sectionsMap.set(ctaId, ctaSection);
    }
  }
  
  if (sectionsMap.size === 0) {
    logs.push(`[SHOPIFY-V6] SCOPE: no valid sections found`);
    return null;
  }
  
  // If we have multiple sections, find their LCA or combine them
  const sections = Array.from(sectionsMap.values());
  
  if (sections.length === 1) {
    logs.push(`[SHOPIFY-V6] SCOPE: single section scope`);
    return sections[0];
  }
  
  // Find LCA of all sections
  let lca = sections[0];
  for (let i = 1; i < sections.length; i++) {
    const newLca = findLCA(lca, sections[i]);
    if (newLca) {
      lca = newLca;
    }
  }
  
  // If LCA is too broad (is the main container), create a wrapper with just the sections
  if (lca === mainContainer || lca.tagName.toLowerCase() === 'main') {
    logs.push(`[SHOPIFY-V6] SCOPE: LCA is too broad, using individual sections`);
    
    const wrapper = mainContainer.ownerDocument!.createElement('div');
    wrapper.setAttribute('data-import-scope', 'v6-combined');
    
    for (const section of sections) {
      const clone = section.cloneNode(true) as Element;
      wrapper.appendChild(clone);
    }
    
    return wrapper;
  }
  
  logs.push(`[SHOPIFY-V6] SCOPE: LCA determined at ${getElementPath(lca)}`);
  return lca;
}

/**
 * V6: Main Shopify extraction with seed-based scoping
 */
function extractShopifySectionsContent(
  doc: Document,
  logs: string[]
): { element: Element; extractedFrom: string; found: boolean } | null {
  logs.push(`[SHOPIFY-V6] ========== Starting Shopify SEED-BASED extraction (V6) ==========`);
  
  // Step 1: Find the main container - try multiple selectors, use body as last resort
  const mainSelectors = [
    '#MainContent',
    'main#MainContent',
    'main[role="main"]',
    'main.main-content',
    'main',
    '[role="main"]',
    '.main-content',
    '#content',
    '.content'
  ];
  
  let mainContainer: Element | null = null;
  let mainSelector = '';
  
  for (const selector of mainSelectors) {
    const el = doc.querySelector(selector);
    if (el) {
      mainContainer = el as Element;
      mainSelector = selector;
      break;
    }
  }
  
  // Fallback to body if no main found (but still apply seed-based filtering)
  if (!mainContainer) {
    logs.push(`[SHOPIFY-V6] WARNING: No main container found, using body with seed-based filtering`);
    mainContainer = doc.body as Element;
    mainSelector = 'body (fallback)';
  }
  
  if (!mainContainer) {
    logs.push(`[SHOPIFY-V6] ERROR: ROOT_NOT_FOUND - no container available`);
    return null;
  }
  
  logs.push(`[SHOPIFY-V6] mainSelectorUsed: ${mainSelector}`);
  
  // Step 2: Pre-clean the container
  const cleanedMain = mainContainer.cloneNode(true) as Element;
  preCleanContainer(cleanedMain, logs);
  
  // Step 3: Find seeds
  const titleSeed = findTitleSeed(cleanedMain, doc, logs);
  const videoSeed = findVideoSeed(cleanedMain, logs);
  const ctaSeed = findCTASeed(cleanedMain, logs);
  
  const seeds = { title: titleSeed, video: videoSeed, cta: ctaSeed };
  
  // Step 4: Extract scope from seeds
  const scope = extractScopeFromSeeds(cleanedMain, seeds, logs);
  
  if (!scope) {
    logs.push(`[SHOPIFY-V6] ERROR: SCOPE_NOT_FOUND - could not determine content scope from seeds`);
    return null;
  }
  
  // Step 5: Clone and clean the scope
  const wrapper = doc.createElement('div');
  wrapper.setAttribute('data-import-root', 'shopify-v6');
  
  const scopeClone = scope.cloneNode(true) as Element;
  
  // Remove any remaining blacklist elements
  const blacklistMatches = containsBlacklistPatterns(scopeClone, logs);
  
  if (blacklistMatches.length > 0) {
    logs.push(`[SHOPIFY-V6] VALIDATION: found blacklist patterns: [${blacklistMatches.join(', ')}]`);
    
    // Try to remove the specific elements containing blacklist text
    const allElements = scopeClone.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i] as Element;
      const directText = Array.from(el.childNodes)
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent || '')
        .join('');
      
      const normalizedDirect = normalizeText(directText);
      const hasBlacklist = blacklistMatches.some(p => 
        normalizedDirect.includes(p.replace(/\s+/g, ' '))
      );
      
      if (hasBlacklist && el.parentElement) {
        logs.push(`[SHOPIFY-V6] VALIDATION: removing element with blacklist text`);
        el.remove();
      }
    }
  }
  
  wrapper.appendChild(scopeClone);
  
  // Step 6: Final validation
  const finalText = (wrapper.textContent || '').replace(/\s+/g, ' ').trim();
  const finalLength = finalText.length;
  
  // Check for remaining blacklist patterns
  const remainingBlacklist = containsBlacklistPatterns(wrapper, logs);
  
  // Count content indicators
  const headings = wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const videos = wrapper.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], video').length;
  const paragraphs = wrapper.querySelectorAll('p').length;
  const buttons = wrapper.querySelectorAll('button, a.btn, a.button, [role="button"]').length;
  
  logs.push(`[SHOPIFY-V6] VALIDATION: textLen=${finalLength}, headings=${headings}, videos=${videos}, paragraphs=${paragraphs}, buttons=${buttons}`);
  
  // HARD FAIL: Too much blacklist content without redeeming video/heading
  if (remainingBlacklist.length >= 3 && videos === 0 && headings === 0) {
    logs.push(`[SHOPIFY-V6] ERROR: BLACKLIST_IN_SCOPE - too many blacklist patterns without content`);
    return null;
  }
  
  // HARD FAIL: Too short (no real content)
  if (finalLength < 100 && videos === 0) {
    logs.push(`[SHOPIFY-V6] ERROR: CONTENT_TOO_SHORT - ${finalLength} chars, no video`);
    return null;
  }
  
  // HARD FAIL: Too long (probably grabbed too much)
  if (finalLength > 50000) {
    logs.push(`[SHOPIFY-V6] ERROR: CONTENT_TOO_LONG - ${finalLength} chars exceeds limit`);
    return null;
  }
  
  // SUCCESS
  const seedsFound = [
    titleSeed ? 'title' : null,
    videoSeed ? 'video' : null,
    ctaSeed ? 'cta' : null
  ].filter(Boolean).join('+');
  
  logs.push(`[SHOPIFY-V6] SUCCESS: extracted ${finalLength} chars with seeds [${seedsFound}]`);
  logs.push(`[SHOPIFY-V6] BLOCKS: h=${headings}, p=${paragraphs}, iframe=${videos}, btn=${buttons}`);
  logs.push(`[SHOPIFY-V6] ========== Extraction complete ==========`);
  
  return {
    element: wrapper,
    extractedFrom: `shopify-v6: seeds[${seedsFound}] from ${mainSelector}`,
    found: true,
  };
}

// V5: extractDirectMainContent REMOVED - No fallback for Shopify
// This was the dangerous fallback that was pulling footer/trending content
// If extractShopifySectionsContent fails, we now return null and the caller handles the error

function selectMainContainer(
  doc: Document,
  platformHint: string | undefined,
  logs: string[]
): { element: Element; extractedFrom: string; found: boolean } {
  
  // SHOPIFY DETERMINISTIC MODE: Use specialized extraction
  if (platformHint?.toLowerCase() === 'shopify') {
    logs.push(`[DOM-EXTRACT] Using Shopify deterministic mode`);
    const shopifyResult = extractShopifySectionsContent(doc, logs);
    
    if (shopifyResult) {
      return shopifyResult;
    }
    
    // If Shopify extraction failed, DO NOT fall back to body - return error
    logs.push(`[DOM-EXTRACT] ERROR: Shopify deterministic extraction failed - not falling back to body`);
    // Return a minimal element that will trigger proper error handling
    const errorWrapper = doc.createElement('div');
    errorWrapper.setAttribute('data-extraction-error', 'shopify-no-content');
    return {
      element: errorWrapper,
      extractedFrom: 'error: shopify-extraction-failed',
      found: false,
    };
  }
  
  // NON-SHOPIFY: Use standard selector-based extraction
  const platformSelectors = platformHint && PLATFORM_MAIN_SELECTORS[platformHint.toLowerCase()]
    ? PLATFORM_MAIN_SELECTORS[platformHint.toLowerCase()]
    : [];
  
  const allSelectors = [...platformSelectors, ...UNIVERSAL_MAIN_SELECTORS];
  
  for (const selector of allSelectors) {
    try {
      const element = doc.querySelector(selector);
      if (element) {
        const textContent = element.textContent || '';
        const textLength = textContent.trim().length;
        
        if (textLength >= MIN_CONTENT_LENGTH) {
          const hasParagraphs = element.querySelectorAll('p').length > 0;
          const hasHeadings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
          
          logs.push(`[DOM-EXTRACT] Found main via selector: ${selector}`);
          logs.push(`[DOM-EXTRACT]   - Text length: ${textLength} chars`);
          logs.push(`[DOM-EXTRACT]   - Has paragraphs: ${hasParagraphs}, Has headings: ${hasHeadings}`);
          
          return {
            element: element as Element,
            extractedFrom: `selector: ${selector}`,
            found: true,
          };
        } else {
          logs.push(`[DOM-EXTRACT] Selector ${selector} matched but too short (${textLength} < ${MIN_CONTENT_LENGTH} chars)`);
        }
      }
    } catch (e) {
      logs.push(`[DOM-EXTRACT] Invalid selector: ${selector}`);
    }
  }
  
  // Fallback: Find largest text container heuristically (non-Shopify only)
  logs.push(`[DOM-EXTRACT] No selector matched, trying heuristic fallback`);
  const heuristicResult = findLargestTextContainer(doc, logs);
  
  if (heuristicResult) {
    return {
      element: heuristicResult.element,
      extractedFrom: `heuristic: ${heuristicResult.selector} (score: ${heuristicResult.score})`,
      found: true,
    };
  }
  
  // Last resort: use body (non-Shopify only)
  logs.push(`[DOM-EXTRACT] FALLBACK: Using document.body as last resort`);
  return {
    element: doc.body as Element,
    extractedFrom: 'fallback: body',
    found: false,
  };
}

/**
 * Heuristic fallback: Find the container with highest "content score".
 * Score = text length + (paragraphs * 100) + (headings * 200)
 * Excludes containers that contain header/nav/aside as children.
 */
function findLargestTextContainer(
  doc: Document,
  logs: string[]
): MainContainerCandidate | null {
  const candidates: MainContainerCandidate[] = [];
  
  // CRITICAL: Patterns to EXCLUDE from heuristic selection
  // These are modals, drawers, overlays, headers, footers that should NEVER be selected as main content
  const EXCLUDED_ID_PATTERNS = [
    /^modal/i, /^drawer/i, /^overlay/i, /^backdrop/i, /^popup/i, 
    /^lightbox/i, /^dialog/i, /^cart-drawer/i, /^menu-drawer/i,
    /^cookie/i, /^consent/i, /^gdpr/i, /-modal$/i, /-drawer$/i,
    // CRITICAL: Exclude footer/header by ID
    /^footer/i, /^header/i, /-footer$/i, /-header$/i,
    /^site-footer/i, /^site-header/i, /^page-footer/i, /^page-header/i,
  ];
  
  const EXCLUDED_CLASS_PATTERNS = [
    /^modal$/i, /^drawer$/i, /^overlay$/i, /^backdrop$/i, /^popup$/i,
    /^lightbox$/i, /modal-parcel/i, /backdrop-modal/i, /cart-drawer/i,
    /menu-drawer/i, /cookie-banner/i, /consent-banner/i,
    // CRITICAL: Exclude footer/header by class
    /^footer$/i, /^header$/i, /site-footer/i, /site-header/i,
    /page-footer/i, /page-header/i, /main-footer/i, /main-header/i,
  ];
  
  // CRITICAL: Tag names that should NEVER be selected as main content
  const EXCLUDED_TAGS = ['footer', 'header', 'nav', 'aside'];
  
  // Check various container elements (do NOT include footer/header/nav/aside)
  const containers = doc.querySelectorAll('div, section, article, main');
  
  for (const container of containers) {
    const element = container as Element;
    const tagName = element.tagName.toLowerCase();
    
    // SKIP: Layout elements by tag name (should not happen with our selector, but just in case)
    if (EXCLUDED_TAGS.includes(tagName)) {
      logs.push(`[DOM-EXTRACT] Heuristic skipping <${tagName}> (excluded tag)`);
      continue;
    }
    
    // Get element identifiers
    const id = element.getAttribute('id') || '';
    const className = element.getAttribute('class') || '';
    const role = element.getAttribute('role') || '';
    const ariaModal = element.getAttribute('aria-modal');
    const ariaHidden = element.getAttribute('aria-hidden');
    
    // SKIP: Elements with footer/header in ID
    if (id && EXCLUDED_ID_PATTERNS.some(pattern => pattern.test(id))) {
      logs.push(`[DOM-EXTRACT] Heuristic skipping #${id} (excluded pattern in ID)`);
      continue;
    }
    
    // SKIP: Elements with footer/header in class (check each class individually)
    if (className) {
      const classList = className.split(/\s+/);
      const hasExcludedClass = classList.some(cls => 
        EXCLUDED_CLASS_PATTERNS.some(pattern => pattern.test(cls)) ||
        cls.toLowerCase().includes('footer') ||
        cls.toLowerCase().includes('header') ||
        cls.toLowerCase().includes('nav-')
      );
      if (hasExcludedClass) {
        logs.push(`[DOM-EXTRACT] Heuristic skipping .${classList[0]} (excluded class pattern)`);
        continue;
      }
    }
    
    // SKIP: Elements with modal/dialog/navigation roles
    if (role === 'dialog' || role === 'alertdialog' || role === 'menu' || 
        role === 'navigation' || role === 'banner' || role === 'contentinfo') {
      logs.push(`[DOM-EXTRACT] Heuristic skipping element with role="${role}"`);
      continue;
    }
    
    // SKIP: Elements marked as modal or hidden
    if (ariaModal === 'true' || ariaHidden === 'true') {
      continue;
    }
    
    // Skip if this container has layout elements as direct children
    const hasLayoutChildren = 
      element.querySelector(':scope > header') !== null ||
      element.querySelector(':scope > nav') !== null ||
      element.querySelector(':scope > aside') !== null ||
      element.querySelector(':scope > footer') !== null;
    
    if (hasLayoutChildren) continue;
    
    const textContent = element.textContent || '';
    const textLength = textContent.trim().length;
    
    // Skip very short containers
    if (textLength < MIN_CONTENT_LENGTH) continue;
    
    const paragraphs = element.querySelectorAll('p').length;
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    
    // Calculate score
    const score = textLength + (paragraphs * 100) + (headings * 200);
    
    // Get a readable selector for logging
    const firstClass = className.split(' ')[0];
    const elementTagName = element.tagName.toLowerCase();
    const selector = id ? `#${id}` : firstClass ? `.${firstClass}` : elementTagName;
    
    candidates.push({
      element,
      selector,
      score,
      textLength,
      hasParagraphs: paragraphs > 0,
      hasHeadings: headings > 0,
    });
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  if (candidates.length > 0) {
    const best = candidates[0];
    logs.push(`[DOM-EXTRACT] Heuristic found ${candidates.length} candidates`);
    logs.push(`[DOM-EXTRACT] Best candidate: ${best.selector} (score: ${best.score}, text: ${best.textLength})`);
    return best;
  }
  
  logs.push(`[DOM-EXTRACT] Heuristic found no valid candidates`);
  return null;
}

// =============================================
// STEP 3: Remove Layout Elements
// =============================================

function removeLayoutElements(
  container: Element,
  platformHint: string | undefined,
  logs: string[]
): { removedElements: { selector: string; count: number }[] } {
  const removedElements: { selector: string; count: number }[] = [];
  
  // Combine all removal selectors
  const allSelectors = [
    ...REMOVAL_SELECTORS.layout,
    ...REMOVAL_SELECTORS.modals,
    ...REMOVAL_SELECTORS.consent,
    ...REMOVAL_SELECTORS.navigation,
    ...REMOVAL_SELECTORS.nonContent,
  ];
  
  // Add platform-specific selectors
  if (platformHint?.toLowerCase() === 'shopify') {
    allSelectors.push(...REMOVAL_SELECTORS.shopify);
  }
  
  // Also get selectors from platform config
  try {
    const platformConfig = getPlatformConfig(platformHint || 'generic');
    if (platformConfig.excludeSelectors) {
      allSelectors.push(...platformConfig.excludeSelectors);
    }
  } catch (e) {
    // Config not available, use defaults
  }
  
  // Deduplicate selectors
  const uniqueSelectors = [...new Set(allSelectors)];
  
  for (const selector of uniqueSelectors) {
    try {
      const elements = container.querySelectorAll(selector);
      const count = elements.length;
      
      if (count > 0) {
        for (const el of elements) {
          (el as Element).remove();
        }
        removedElements.push({ selector, count });
        logs.push(`[DOM-EXTRACT] Removed ${count} elements: ${selector}`);
      }
    } catch (e) {
      // Invalid selector, skip
    }
  }
  
  return { removedElements };
}

// =============================================
// STEP 4: Normalize URLs
// =============================================

function normalizeUrls(
  container: Element,
  baseUrl: string,
  logs: string[]
): void {
  let normalized = 0;
  
  try {
    const base = new URL(baseUrl);
    
    // Normalize img src
    const images = container.querySelectorAll('img[src]');
    for (const img of images) {
      const src = (img as Element).getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          const absoluteUrl = new URL(src, base).href;
          (img as Element).setAttribute('src', absoluteUrl);
          normalized++;
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }
    
    // Normalize a href
    const links = container.querySelectorAll('a[href]');
    for (const link of links) {
      const href = (link as Element).getAttribute('href');
      if (href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          const absoluteUrl = new URL(href, base).href;
          (link as Element).setAttribute('href', absoluteUrl);
          normalized++;
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }
    
    // Normalize iframe src
    const iframes = container.querySelectorAll('iframe[src]');
    for (const iframe of iframes) {
      const src = (iframe as Element).getAttribute('src');
      if (src && !src.startsWith('http') && !src.startsWith('//')) {
        try {
          const absoluteUrl = new URL(src, base).href;
          (iframe as Element).setAttribute('src', absoluteUrl);
          normalized++;
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }
    
    // Normalize source src (video/audio)
    const sources = container.querySelectorAll('source[src]');
    for (const source of sources) {
      const src = (source as Element).getAttribute('src');
      if (src && !src.startsWith('http')) {
        try {
          const absoluteUrl = new URL(src, base).href;
          (source as Element).setAttribute('src', absoluteUrl);
          normalized++;
        } catch (e) {
          // Invalid URL, skip
        }
      }
    }
    
    logs.push(`[DOM-EXTRACT] Normalized ${normalized} relative URLs`);
    
  } catch (e) {
    logs.push(`[DOM-EXTRACT] URL normalization error: ${e}`);
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function removeAllByTag(doc: Document, tagName: string): number {
  const elements = doc.querySelectorAll(tagName);
  const count = elements.length;
  for (const el of elements) {
    (el as Element).remove();
  }
  return count;
}

function countPrimitives(container: Element): DOMExtractionResult['primitivesCount'] {
  return {
    headings: container.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
    paragraphs: container.querySelectorAll('p').length,
    images: container.querySelectorAll('img').length,
    videos: container.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length,
    buttons: container.querySelectorAll('button, [role="button"], .btn, .button').length,
    links: container.querySelectorAll('a[href]').length,
  };
}

function createFallbackResult(
  html: string,
  logs: string[],
  removedElements: { selector: string; count: number }[],
  originalLength: number,
  reason: string
): DOMExtractionResult {
  logs.push(`[DOM-EXTRACT] Using raw HTML fallback: ${reason}`);
  
  // Basic cleanup without DOM
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s*on\w+="[^"]*"/gi, '');
  
  return {
    contentHtml: cleaned,
    extractedFrom: `fallback: ${reason}`,
    mainContentFound: false,
    removedElements,
    primitivesCount: {
      headings: 0,
      paragraphs: 0,
      images: 0,
      videos: 0,
      buttons: 0,
      links: 0,
    },
    stats: {
      originalLength,
      finalLength: cleaned.length,
      reductionPercent: Math.round((1 - cleaned.length / originalLength) * 100),
    },
    logs,
  };
}

// =============================================
// LEGACY COMPATIBILITY
// =============================================

/**
 * Wrapper function for backwards compatibility with old extractMainContentByPlatform.
 * Maps the new DOMExtractionResult to the old ExtractionResult format.
 */
export function extractMainContentByPlatformDOM(
  html: string,
  platform: string,
  pageUrl?: string
): Promise<{
  content: string;
  platform: string;
  removedSections: string[];
  extractedFrom: string | null;
  stats: {
    originalLength: number;
    finalLength: number;
    sectionsRemoved: number;
  };
  logs: string[];
}> {
  return extractContentWithDOM(html, pageUrl || '', platform).then(result => ({
    content: result.contentHtml,
    platform,
    removedSections: result.removedElements.map(r => `${r.selector} (${r.count})`),
    extractedFrom: result.extractedFrom,
    stats: {
      originalLength: result.stats.originalLength,
      finalLength: result.stats.finalLength,
      sectionsRemoved: result.removedElements.length,
    },
    logs: result.logs,
  }));
}
