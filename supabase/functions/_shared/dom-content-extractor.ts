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
 * SHOPIFY DETERMINISTIC MODE:
 * Instead of picking a single container, collect ALL content sections
 * inside main and concatenate them. This ensures we get ALL content
 * (title + text + video + button) instead of just one section.
 */
function extractShopifySectionsContent(
  doc: Document,
  logs: string[]
): { element: Element; extractedFrom: string; found: boolean } | null {
  logs.push(`[SHOPIFY-DETERMINISTIC] Starting Shopify sections extraction`);
  
  // Step 1: Find the main container
  const mainSelectors = ['#MainContent', 'main[role="main"]', 'main.main-content', 'main'];
  let mainContainer: Element | null = null;
  let mainSelector = '';
  
  for (const selector of mainSelectors) {
    const el = doc.querySelector(selector);
    if (el) {
      mainContainer = el as Element;
      mainSelector = selector;
      logs.push(`[SHOPIFY-DETERMINISTIC] Found main container: ${selector}`);
      break;
    }
  }
  
  if (!mainContainer) {
    logs.push(`[SHOPIFY-DETERMINISTIC] ERROR: No main container found (#MainContent, main[role="main"], main.main-content, main)`);
    return null; // Will trigger error, NOT fallback to body
  }
  
  // Step 2: Collect ALL shopify-section elements inside main
  const allSections = mainContainer.querySelectorAll('section.shopify-section, .shopify-section');
  logs.push(`[SHOPIFY-DETERMINISTIC] Found ${allSections.length} total shopify-section elements in main`);
  
  // Step 3: Filter out header/footer/overlay sections
  const excludePatterns = [
    /header/i, /footer/i, /announcement/i, /overlay/i, /drawer/i, 
    /modal/i, /cookie/i, /consent/i, /nav/i, /menu/i, /cart-drawer/i,
    /trending/i, /popular/i, /search/i // "Mais pesquisados" type sections
  ];
  
  const contentSections: Element[] = [];
  const excludedSections: string[] = [];
  
  for (const section of allSections) {
    const el = section as Element;
    const id = el.getAttribute('id') || '';
    const className = el.getAttribute('class') || '';
    const identifier = id || className.split(' ').slice(0, 2).join(' ');
    
    // Check if section should be excluded
    const shouldExclude = excludePatterns.some(pattern => 
      pattern.test(id) || pattern.test(className)
    ) || el.closest('.shopify-section-group-header-group') !== null
      || el.closest('.shopify-section-group-footer-group') !== null
      || el.closest('.shopify-section-group-overlay-group') !== null;
    
    if (shouldExclude) {
      excludedSections.push(identifier);
      logs.push(`[SHOPIFY-DETERMINISTIC] Excluding section: ${identifier}`);
    } else {
      contentSections.push(el);
      logs.push(`[SHOPIFY-DETERMINISTIC] Including section: ${identifier}`);
    }
  }
  
  logs.push(`[SHOPIFY-DETERMINISTIC] Content sections: ${contentSections.length}, Excluded: ${excludedSections.length}`);
  
  if (contentSections.length === 0) {
    logs.push(`[SHOPIFY-DETERMINISTIC] WARNING: No content sections found after filtering`);
    // Try the main container itself if no sections found
    return {
      element: mainContainer,
      extractedFrom: `shopify-deterministic: ${mainSelector} (no sections, using main)`,
      found: true,
    };
  }
  
  // Step 4: Create a wrapper div and concatenate all content sections
  // This preserves the DOM order and includes ALL content
  const wrapper = doc.createElement('div');
  wrapper.setAttribute('data-import-root', 'shopify');
  wrapper.setAttribute('data-sections-count', String(contentSections.length));
  
  for (const section of contentSections) {
    // Clone the section to avoid mutation issues
    const clone = section.cloneNode(true) as Element;
    wrapper.appendChild(clone);
  }
  
  // Step 5: Log primitive counts for debugging
  const headings = wrapper.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
  const paragraphs = wrapper.querySelectorAll('p').length;
  const links = wrapper.querySelectorAll('a').length;
  const buttons = wrapper.querySelectorAll('button, [role="button"], .btn, .button, a.btn, a.button').length;
  const iframes = wrapper.querySelectorAll('iframe').length;
  
  logs.push(`[SHOPIFY-DETERMINISTIC] Primitives in combined content:`);
  logs.push(`[SHOPIFY-DETERMINISTIC]   - Headings: ${headings}`);
  logs.push(`[SHOPIFY-DETERMINISTIC]   - Paragraphs: ${paragraphs}`);
  logs.push(`[SHOPIFY-DETERMINISTIC]   - Links: ${links}`);
  logs.push(`[SHOPIFY-DETERMINISTIC]   - Buttons: ${buttons}`);
  logs.push(`[SHOPIFY-DETERMINISTIC]   - Iframes: ${iframes}`);
  
  // Step 6: Log text preview
  const textContent = wrapper.textContent || '';
  const textPreview = textContent.replace(/\s+/g, ' ').trim().substring(0, 300);
  logs.push(`[SHOPIFY-DETERMINISTIC] Text preview (first 300 chars): ${textPreview}`);
  
  const sectionIds = contentSections.slice(0, 10).map(s => 
    (s as Element).getAttribute('id') || (s as Element).getAttribute('class')?.split(' ')[0] || 'unknown'
  );
  logs.push(`[SHOPIFY-DETERMINISTIC] Included section IDs (up to 10): ${sectionIds.join(', ')}`);
  
  return {
    element: wrapper,
    extractedFrom: `shopify-deterministic: ${contentSections.length} sections from ${mainSelector}`,
    found: true,
  };
}

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
