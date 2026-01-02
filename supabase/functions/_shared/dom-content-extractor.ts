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

/**
 * SHOPIFY ROBUST DETERMINISTIC MODE (v3):
 * 
 * REGRA CENTRAL: Não depender exclusivamente de template-- no ID.
 * Muitos temas usam IDs como shopify-section-main-page, shopify-section-main, etc.
 * 
 * CRITÉRIOS DE EXCLUSÃO (determinísticos):
 * 1. ID contém "sections--" (globais do theme editor)
 * 2. Classe contém "shopify-section-group-header" ou "shopify-section-group-footer"
 * 3. ID contém sufixos de layout (__header, __footer, __announcement, etc.)
 * 4. Elemento contém [role="dialog"] ou [aria-modal="true"]
 * 5. Texto contém "mais pesquisados" / "trending"
 * 
 * CRITÉRIOS DE INCLUSÃO (limiar baixo - CTAs são curtos):
 * - textLen >= 30 OU
 * - Possui iframe youtube/vimeo OU
 * - Possui button/CTA OU
 * - Possui imagens
 */
// =============================================
// SHOPIFY EXTRACTOR V5 - DETERMINISTIC & VALIDATED
// =============================================

interface ShopifySectionAnalysis {
  id: string;
  className: string;
  hasHeading: boolean;
  hasParagraphs: boolean;
  hasVideo: boolean;
  hasCTA: boolean;
  hasImages: boolean;
  textLength: number;
  isFooterLike: boolean;
  textPreview: string;
}

/**
 * V5: Check if a section should be included using STRICT deterministic rules
 */
function shouldIncludeShopifySectionV5(
  section: Element, 
  logs: string[]
): { include: boolean; reason: string; analysis: ShopifySectionAnalysis } {
  const id = section.getAttribute('id') || '';
  const className = section.getAttribute('class') || '';
  const identifier = id || className.split(' ').slice(0, 2).join(' ') || 'unknown';
  
  // Get raw text content
  const rawText = (section.textContent || '').trim();
  const textLower = rawText.toLowerCase();
  const textLen = rawText.length;
  const textPreview = rawText.substring(0, 100).replace(/\s+/g, ' ');
  
  // Analyze content indicators
  const hasYouTube = !!section.querySelector('iframe[src*="youtube"], iframe[src*="youtu.be"], iframe[data-src*="youtube"]');
  const hasVimeo = !!section.querySelector('iframe[src*="vimeo"]');
  const hasVideo = !!section.querySelector('video') || hasYouTube || hasVimeo;
  const hasCTA = !!section.querySelector('a[href*="consulte"], a[href*="contato"], button, .btn, .button, [role="button"]');
  const hasHeading = !!section.querySelector('h1, h2, h3, h4, h5, h6');
  const hasParagraphs = section.querySelectorAll('p').length > 0;
  const hasImages = section.querySelectorAll('img[src]').length;
  
  // Check for footer/trending patterns - these are HARD disqualifiers if no real content
  const footerPatterns = [
    'mais pesquisados', 'trending searches', 'trending products',
    'cnpj', 'formas de pagamento', 'selos de segurança',
    'receba nossas promoções', 'políticas da loja', 'política de',
    'termos de uso', 'termos de serviço', 'sobre nós', 'fale conosco',
    'atendimento ao cliente', 'central de ajuda', 'inscreva-se',
    'newsletter', 'assine nossa', 'redes sociais', 'siga-nos',
    'menu principal', 'navegação', 'mapa do site'
  ];
  const footerMatchCount = footerPatterns.filter(p => textLower.includes(p)).length;
  const isFooterLike = footerMatchCount >= 1 && !hasVideo && !hasHeading;
  
  const analysis: ShopifySectionAnalysis = {
    id,
    className: className.split(' ').slice(0, 3).join(' '),
    hasHeading,
    hasParagraphs,
    hasVideo,
    hasCTA,
    hasImages: hasImages > 0,
    textLength: textLen,
    isFooterLike,
    textPreview
  };
  
  // ============ STRICT EXCLUSION RULES (V5) ============
  
  // RULE 1: ID contains "sections--" (global sections from theme editor) - ALWAYS exclude
  if (id.includes('sections--')) {
    return { include: false, reason: 'sections-- prefix (global section)', analysis };
  }
  
  // RULE 2: Class contains header/footer group markers - ALWAYS exclude
  if (className.includes('shopify-section-group-header') || className.includes('shopify-section-group-footer')) {
    return { include: false, reason: 'header/footer group class', analysis };
  }
  
  // RULE 3: ID contains layout suffixes - ALWAYS exclude
  const layoutSuffixes = [
    '__header', '__footer', '__announcement', '__cookie', '__consent',
    '__drawer', '__cart', '__popup', '__modal', '__overlay', '__predictive',
    '__newsletter', '__search', '-header', '-footer', '-announcement',
    '-drawer', '-cart-drawer', '-menu-drawer', '-popup', '-modal', '-overlay'
  ];
  const matchedSuffix = layoutSuffixes.find(suffix => id.toLowerCase().includes(suffix));
  if (matchedSuffix) {
    return { include: false, reason: `layout suffix: ${matchedSuffix}`, analysis };
  }
  
  // RULE 4: Contains dialog/modal role - ALWAYS exclude
  if (section.querySelector('[role="dialog"], [aria-modal="true"]')) {
    return { include: false, reason: 'contains dialog/modal', analysis };
  }
  
  // RULE 5: Is inside a <footer> element - ALWAYS exclude
  if (section.closest('footer') || section.closest('[role="contentinfo"]')) {
    return { include: false, reason: 'inside footer element', analysis };
  }
  
  // RULE 6: Is inside header/footer group ancestor - ALWAYS exclude
  if (section.closest('.shopify-section-group-header-group') || section.closest('.shopify-section-group-footer-group')) {
    return { include: false, reason: 'inside header/footer group ancestor', analysis };
  }
  
  // RULE 7: Footer-like text WITHOUT meaningful content indicators - exclude
  if (isFooterLike) {
    return { include: false, reason: `footer-like text (matches: ${footerMatchCount}, no heading/video)`, analysis };
  }
  
  // ============ INCLUSION RULES (V5) ============
  
  // INCLUDE if has any meaningful content indicator
  const hasContent = hasVideo || hasHeading || hasParagraphs || hasCTA || hasImages > 0 || textLen >= 50;
  
  if (hasContent) {
    const indicators = [];
    if (hasVideo) indicators.push('video');
    if (hasHeading) indicators.push('heading');
    if (hasParagraphs) indicators.push('paragraphs');
    if (hasCTA) indicators.push('cta');
    if (hasImages > 0) indicators.push(`imgs:${hasImages}`);
    if (textLen >= 50) indicators.push(`text:${textLen}`);
    return { include: true, reason: `has content (${indicators.join(', ')})`, analysis };
  }
  
  // No content - exclude
  return { include: false, reason: 'no content indicators', analysis };
}

/**
 * V5: Validate final extraction - REJECT if it looks like footer/trending
 */
function validateShopifyExtraction(
  wrapper: Element,
  logs: string[]
): { valid: boolean; reason: string } {
  const text = (wrapper.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const textLen = text.length;
  
  // Check for HARD FAIL patterns
  const hardFailPatterns = [
    { pattern: 'mais pesquisados', weight: 5 },
    { pattern: 'trending searches', weight: 5 },
    { pattern: 'cnpj', weight: 3 },
    { pattern: 'políticas da loja', weight: 4 },
    { pattern: 'política de privacidade', weight: 3 },
    { pattern: 'termos de uso', weight: 3 },
    { pattern: 'formas de pagamento', weight: 3 },
    { pattern: 'selos de segurança', weight: 3 },
    { pattern: 'receba nossas promoções', weight: 4 },
    { pattern: 'newsletter', weight: 2 },
    { pattern: 'inscreva-se', weight: 2 },
    { pattern: 'sobre nós', weight: 2 },
    { pattern: 'fale conosco', weight: 2 },
    { pattern: 'atendimento ao cliente', weight: 2 },
  ];
  
  let failScore = 0;
  const matchedPatterns: string[] = [];
  for (const { pattern, weight } of hardFailPatterns) {
    if (text.includes(pattern)) {
      failScore += weight;
      matchedPatterns.push(pattern);
    }
  }
  
  // Check content indicators
  const hasHeadings = wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const hasVideos = wrapper.querySelectorAll('iframe[src*="youtube"], iframe[src*="vimeo"], video').length;
  const hasCTAs = wrapper.querySelectorAll('a[href], button').length;
  
  logs.push(`[SHOPIFY-V5] VALIDATION: textLen=${textLen}, failScore=${failScore}, headings=${hasHeadings}, videos=${hasVideos}, ctas=${hasCTAs}`);
  
  if (matchedPatterns.length > 0) {
    logs.push(`[SHOPIFY-V5] VALIDATION: matched patterns: [${matchedPatterns.join(', ')}]`);
  }
  
  // HARD FAIL: High fail score without redeeming content
  if (failScore >= 5 && hasHeadings === 0 && hasVideos === 0) {
    return { valid: false, reason: `footer/trending content detected (score: ${failScore})` };
  }
  
  // HARD FAIL: Very short extraction with fail patterns
  if (textLen < 100 && failScore >= 3) {
    return { valid: false, reason: `short text with footer patterns (${textLen} chars, score: ${failScore})` };
  }
  
  // HARD FAIL: No meaningful content at all
  if (hasHeadings === 0 && hasVideos === 0 && hasCTAs === 0 && textLen < 50) {
    return { valid: false, reason: 'no meaningful content found' };
  }
  
  // PASS
  return { valid: true, reason: 'content validated' };
}

/**
 * V5: Main Shopify extraction - deterministic and validated
 */
function extractShopifySectionsContent(
  doc: Document,
  logs: string[]
): { element: Element; extractedFrom: string; found: boolean } | null {
  logs.push(`[SHOPIFY-V5] ========== Starting Shopify STRICT DETERMINISTIC extraction (V5) ==========`);
  
  // Step 1: Find the main container - NEVER use body directly for Shopify
  const mainSelectors = [
    '#MainContent',
    'main#MainContent', 
    'main[role="main"]', 
    'main.main-content', 
    'main',
    '[role="main"]'
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
  
  if (!mainContainer) {
    logs.push(`[SHOPIFY-V5] ERROR: No main container found. Selectors tried: ${mainSelectors.join(', ')}`);
    logs.push(`[SHOPIFY-V5] FAIL: Cannot extract without main container`);
    return null;
  }
  
  logs.push(`[SHOPIFY-V5] mainSelectorUsed: ${mainSelector}`);
  logs.push(`[SHOPIFY-V5] mainFound: true`);
  
  // Step 2: Collect ALL shopify-section candidates within main (using multiple selectors)
  const byId = mainContainer.querySelectorAll('[id^="shopify-section-"]');
  const byClass = mainContainer.querySelectorAll('.shopify-section');
  const byTemplate = mainContainer.querySelectorAll('[id^="shopify-section-template"]');
  
  // Deduplicate using a Map keyed by element id or reference
  const candidateMap = new Map<string, Element>();
  
  const addCandidate = (el: Element, source: string) => {
    const id = el.getAttribute('id');
    if (id && !candidateMap.has(id)) {
      candidateMap.set(id, el);
    }
  };
  
  for (let i = 0; i < byTemplate.length; i++) addCandidate(byTemplate[i] as Element, 'template');
  for (let i = 0; i < byId.length; i++) addCandidate(byId[i] as Element, 'id');
  for (let i = 0; i < byClass.length; i++) {
    const el = byClass[i] as Element;
    const id = el.getAttribute('id');
    if (id && !candidateMap.has(id)) {
      candidateMap.set(id, el);
    }
  }
  
  const candidates = Array.from(candidateMap.values());
  logs.push(`[SHOPIFY-V5] candidatesFound: ${candidates.length} (byTemplate: ${byTemplate.length}, byId: ${byId.length}, byClass: ${byClass.length})`);
  
  if (candidates.length === 0) {
    logs.push(`[SHOPIFY-V5] ERROR: No shopify-section candidates found in main`);
    logs.push(`[SHOPIFY-V5] FAIL: Cannot extract without section candidates`);
    return null;
  }
  
  // Step 3: Filter candidates using V5 rules
  const contentSections: Element[] = [];
  const excludedSections: { id: string; reason: string }[] = [];
  const includedAnalyses: ShopifySectionAnalysis[] = [];
  
  for (const section of candidates) {
    const result = shouldIncludeShopifySectionV5(section, logs);
    const id = section.getAttribute('id') || 'no-id';
    
    if (result.include) {
      contentSections.push(section);
      includedAnalyses.push(result.analysis);
      logs.push(`[SHOPIFY-V5] INCLUDE: ${id} => ${result.reason}`);
    } else {
      excludedSections.push({ id, reason: result.reason });
      logs.push(`[SHOPIFY-V5] EXCLUDE: ${id} => ${result.reason}`);
    }
  }
  
  logs.push(`[SHOPIFY-V5] Summary: included=${contentSections.length}, excluded=${excludedSections.length}`);
  
  if (contentSections.length === 0) {
    logs.push(`[SHOPIFY-V5] ERROR: All candidates were excluded`);
    for (const ex of excludedSections) {
      logs.push(`[SHOPIFY-V5]   - ${ex.id}: ${ex.reason}`);
    }
    logs.push(`[SHOPIFY-V5] FAIL: No content sections passed filters`);
    return null;
  }
  
  // Step 4: Pre-clean each section before concatenating
  const wrapper = doc.createElement('div');
  wrapper.setAttribute('data-import-root', 'shopify-v5');
  wrapper.setAttribute('data-sections-count', String(contentSections.length));
  
  for (const section of contentSections) {
    const clone = section.cloneNode(true) as Element;
    
    // Remove non-content elements from clone
    const removeSelectors = [
      'script', 'style', 'link', 'noscript',
      '[aria-hidden="true"]', '[hidden]',
      '[style*="display: none"]', '[style*="display:none"]',
      '.predictive-search', '[data-predictive-search]',
      '.drawer', '.modal', '.overlay', '[role="dialog"]'
    ];
    
    for (const sel of removeSelectors) {
      try {
        const els = clone.querySelectorAll(sel);
        for (const el of els) (el as Element).remove();
      } catch { /* invalid selector */ }
    }
    
    wrapper.appendChild(clone);
  }
  
  // Step 5: VALIDATE extraction - reject if it looks like footer/trending
  const validation = validateShopifyExtraction(wrapper, logs);
  
  if (!validation.valid) {
    logs.push(`[SHOPIFY-V5] VALIDATION FAILED: ${validation.reason}`);
    logs.push(`[SHOPIFY-V5] FAIL: Extraction rejected by validation`);
    return null;
  }
  
  logs.push(`[SHOPIFY-V5] VALIDATION PASSED: ${validation.reason}`);
  
  // Step 6: Log final content summary
  const headings = wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const paragraphs = wrapper.querySelectorAll('p').length;
  const iframes = wrapper.querySelectorAll('iframe').length;
  const buttons = wrapper.querySelectorAll('button, a.btn, a.button, [role="button"]').length;
  const links = wrapper.querySelectorAll('a[href]').length;
  
  const finalText = (wrapper.textContent || '').replace(/\s+/g, ' ').trim();
  const textPreview = finalText.substring(0, 200);
  
  logs.push(`[SHOPIFY-V5] finalPrimitivesCount: h=${headings}, p=${paragraphs}, iframe=${iframes}, btn=${buttons}, links=${links}`);
  logs.push(`[SHOPIFY-V5] finalTextPreview: "${textPreview}..."`);
  logs.push(`[SHOPIFY-V5] ========== Extraction complete: ${contentSections.length} sections, ${finalText.length} chars ==========`);
  
  return {
    element: wrapper,
    extractedFrom: `shopify-v5: ${contentSections.length} sections from ${mainSelector}`,
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
