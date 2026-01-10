// =====================================================
// ADVANCED HEADER/FOOTER DETECTOR
// =====================================================
// Sistema robusto de detecção de header/footer baseado em:
// - Landmarks semânticos HTML5 (<header>, <footer>)
// - ARIA Landmarks (role="banner", role="contentinfo")
// - Heurísticas de classe/ID
// - Sistema de scoring por conteúdo
// - Sinais específicos por plataforma
// =====================================================

export interface DetectedLayoutElement {
  type: 'header' | 'footer';
  html: string;
  confidence: number;
  source: 'semantic' | 'aria' | 'class' | 'heuristic';
  metadata: {
    hasLogo?: boolean;
    hasNav?: boolean;
    hasSearch?: boolean;
    hasCart?: boolean;
    hasAccount?: boolean;
    hasSocialLinks?: boolean;
    hasNewsletter?: boolean;
    hasCopyright?: boolean;
    hasPaymentIcons?: boolean;
    hasAddress?: boolean;
    linkCount?: number;
    position?: 'top' | 'bottom';
  };
}

export interface LayoutDetectionResult {
  header: DetectedLayoutElement | null;
  footer: DetectedLayoutElement | null;
  platform: string | null;
  footerSections: FooterSection[];
}

export interface FooterSection {
  title: string;
  links: Array<{ text: string; url: string }>;
  type: 'categories' | 'institutional' | 'contact' | 'social' | 'payment' | 'other';
}

// =====================================================
// PLATFORM-SPECIFIC SIGNALS
// =====================================================
const PLATFORM_LAYOUT_SIGNALS = {
  vtex: {
    headerSelectors: [
      'header.page-header',
      '.vtex-store-header',
      '[class*="vtex"][class*="header"]',
      '.header-layout',
      '.header-row',
    ],
    footerSelectors: [
      'footer.page-footer',
      '.vtex-store-footer',
      '[class*="vtex"][class*="footer"]',
      '.footer-layout',
    ],
    headerClasses: /vtex.*header|header.*layout|header.*row/i,
    footerClasses: /vtex.*footer|footer.*layout|footer.*row/i,
  },
  shopify: {
    headerSelectors: [
      'header.section-header',
      '[data-section-type="header"]',
      '.shopify-section-header',
      '#shopify-section-header',
      '.header-wrapper',
    ],
    footerSelectors: [
      'footer.section-footer',
      '[data-section-type="footer"]',
      '.shopify-section-footer',
      '#shopify-section-footer',
      '.footer-wrapper',
    ],
    headerClasses: /shopify.*header|section-header|header-wrapper/i,
    footerClasses: /shopify.*footer|section-footer|footer-wrapper/i,
  },
  nuvemshop: {
    headerSelectors: [
      '[data-store="header"]',
      '.js-nav-header',
      '#header',
      '.header-main',
    ],
    footerSelectors: [
      '[data-store="footer"]',
      '#footer',
      '.footer-main',
      '.js-footer',
    ],
    headerClasses: /js-nav|header-main|mobile-nav-header/i,
    footerClasses: /footer-main|js-footer|footer-container/i,
  },
  woocommerce: {
    headerSelectors: [
      '.site-header',
      '#masthead',
      '.header-main',
      '.elementor-header',
    ],
    footerSelectors: [
      '.site-footer',
      '#colophon',
      '.footer-main',
      '.elementor-footer',
    ],
    headerClasses: /site-header|masthead|header-main|elementor-location-header/i,
    footerClasses: /site-footer|colophon|footer-main|elementor-location-footer/i,
  },
  magento: {
    headerSelectors: [
      'header.page-header',
      '.page-header',
      '.header.content',
    ],
    footerSelectors: [
      'footer.page-footer',
      '.page-footer',
      '.footer.content',
    ],
    headerClasses: /page-header|header\.content/i,
    footerClasses: /page-footer|footer\.content|footer-container/i,
  },
  tray: {
    headerSelectors: [
      '.header-topo',
      '#header',
      '.topo-loja',
      '[class*="header-tray"]',
    ],
    footerSelectors: [
      '.footer-loja',
      '#footer',
      '.rodape',
      '[class*="footer-tray"]',
    ],
    headerClasses: /header-topo|topo-loja|header-tray/i,
    footerClasses: /footer-loja|rodape|footer-tray/i,
  },
  loja_integrada: {
    headerSelectors: [
      '.menu.superior',
      '#header-menu',
      '.header-content',
      '.topo',
    ],
    footerSelectors: [
      '.footer-content',
      '#rodape',
      '.rodape',
      '.footer-li',
    ],
    headerClasses: /menu\s*superior|header-content|topo|header-li/i,
    footerClasses: /footer-content|rodape|footer-li/i,
  },
  yampi: {
    headerSelectors: [
      '.header-yampi',
      '[class*="header"]',
      '#site-header',
    ],
    footerSelectors: [
      '.footer-yampi',
      '[class*="footer"]',
      '#site-footer',
    ],
    headerClasses: /header-yampi|yampi.*header/i,
    footerClasses: /footer-yampi|yampi.*footer/i,
  },
  bagy: {
    headerSelectors: [
      '.bagy-header',
      '#bagy-header',
      '.header-bagy',
    ],
    footerSelectors: [
      '.bagy-footer',
      '#bagy-footer',
      '.footer-bagy',
    ],
    headerClasses: /bagy.*header|header.*bagy/i,
    footerClasses: /bagy.*footer|footer.*bagy/i,
  },
  wix: {
    headerSelectors: [
      '#SITE_HEADER',
      '[data-mesh-id*="SITE_HEADER"]',
      '.wix-header',
    ],
    footerSelectors: [
      '#SITE_FOOTER',
      '[data-mesh-id*="SITE_FOOTER"]',
      '.wix-footer',
    ],
    headerClasses: /SITE_HEADER|wix-header/i,
    footerClasses: /SITE_FOOTER|wix-footer/i,
  },
};

// =====================================================
// UNIVERSAL HEADER DETECTION PATTERNS
// =====================================================
const HEADER_SIGNALS = {
  // Sinais fortes (landmark/semântico)
  strongSelectors: [
    'header',
    '[role="banner"]',
    '[aria-label*="header" i]',
    '[aria-label*="cabeçalho" i]',
  ],
  
  // Sinais por classe/ID
  classIdPatterns: [
    /^header$/i,
    /^site-header$/i,
    /^page-header$/i,
    /^main-header$/i,
    /^global-header$/i,
    /^masthead$/i,
    /^top-bar$/i,
    /^navbar$/i,
    /^nav-header$/i,
    /cabecalho/i,
    /topo-site/i,
    /header-wrapper/i,
    /header-container/i,
    /header-main/i,
  ],
  
  // Padrões de conteúdo que indicam header
  contentIndicators: {
    logo: [
      /<a[^>]*href=["']\/["'][^>]*>/i, // Link para home
      /<img[^>]*(?:logo|brand|marca)[^>]*>/i,
      /class=["'][^"']*logo[^"']*["']/i,
      /id=["'][^"']*logo[^"']*["']/i,
    ],
    nav: [
      /<nav\b/i,
      /class=["'][^"']*(?:menu|nav|navigation)[^"']*["']/i,
    ],
    search: [
      /<form[^>]*(?:search|busca)[^>]*>/i,
      /<input[^>]*type=["']search["'][^>]*>/i,
      /class=["'][^"']*search[^"']*["']/i,
      /class=["'][^"']*busca[^"']*["']/i,
    ],
    cart: [
      /class=["'][^"']*(?:cart|carrinho|minicart|sacola|bag)[^"']*["']/i,
      /href=["'][^"']*(?:\/cart|\/carrinho|\/sacola)[^"']*["']/i,
    ],
    account: [
      /class=["'][^"']*(?:account|conta|login|entrar|user)[^"']*["']/i,
      /href=["'][^"']*(?:\/account|\/conta|\/login|\/entrar)[^"']*["']/i,
    ],
  },
  
  // Penalidades (indica que NÃO é header)
  penaltyPatterns: [
    /class=["'][^"']*hero[^"']*["']/i, // Hero banner
    /R\$\s*\d+[,\.]\d{2}/g, // Múltiplos preços (área de produtos)
    /<article\b/gi, // Artigo de blog
  ],
};

// =====================================================
// UNIVERSAL FOOTER DETECTION PATTERNS
// =====================================================
const FOOTER_SIGNALS = {
  // Sinais fortes (landmark/semântico)
  strongSelectors: [
    'footer',
    '[role="contentinfo"]',
    '[aria-label*="footer" i]',
    '[aria-label*="rodapé" i]',
  ],
  
  // Sinais por classe/ID
  classIdPatterns: [
    /^footer$/i,
    /^site-footer$/i,
    /^page-footer$/i,
    /^main-footer$/i,
    /^global-footer$/i,
    /^colophon$/i,
    /^bottom$/i,
    /rodape/i,
    /footer-wrapper/i,
    /footer-container/i,
    /footer-main/i,
  ],
  
  // Padrões de conteúdo que indicam footer
  contentIndicators: {
    institutional: [
      /pol[íi]tica\s+de\s+privacidade/i,
      /termos\s+de\s+uso/i,
      /troca.*devolu/i,
      /faq|perguntas\s+frequentes/i,
      /sobre\s+n[óo]s/i,
      /quem\s+somos/i,
      /fale\s+conosco/i,
      /contato/i,
      /ajuda/i,
      /suporte/i,
    ],
    contact: [
      /\(\d{2}\)\s*\d{4,5}[-.\s]?\d{4}/, // Telefone BR
      /\d{5}[-.\s]?\d{3}/, // CEP
      /cnpj/i,
      /sac@/i,
      /atendimento@/i,
      /contato@/i,
    ],
    social: [
      /facebook\.com/i,
      /instagram\.com/i,
      /twitter\.com|x\.com/i,
      /youtube\.com/i,
      /linkedin\.com/i,
      /tiktok\.com/i,
      /whatsapp/i,
    ],
    payment: [
      /visa|mastercard|amex|american\s+express/i,
      /boleto|pix|mercado\s*pago/i,
      /class=["'][^"']*(?:payment|pagamento|bandeiras)[^"']*["']/i,
    ],
    copyright: [
      /©|&copy;|copyright/i,
      /todos\s+os\s+direitos/i,
      /all\s+rights\s+reserved/i,
      /\b20\d{2}\b/, // Anos
    ],
    newsletter: [
      /newsletter/i,
      /cadastre.*email/i,
      /receba.*ofertas/i,
      /inscreva-se/i,
      /<input[^>]*type=["']email["'][^>]*>/i,
    ],
  },
  
  // Penalidades (indica que NÃO é footer)
  penaltyPatterns: [
    /class=["'][^"']*(?:product|produto|vitrine|showcase)[^"']*["']/i,
    /R\$\s*\d+[,\.]\d{2}/g, // Múltiplos preços
    /class=["'][^"']*(?:sticky|fixed|whatsapp-btn|chat-widget)[^"']*["']/i,
  ],
};

// =====================================================
// ELEMENTS TO IGNORE (overlays, popups, etc)
// =====================================================
const IGNORE_PATTERNS = [
  /class=["'][^"']*(?:cookie|lgpd|gdpr|popup|modal|overlay|chat-widget|whatsapp)[^"']*["']/i,
  /style=["'][^"']*(?:position:\s*fixed|z-index:\s*\d{4,})[^"']*["']/i,
];

// =====================================================
// MAIN DETECTION FUNCTION
// =====================================================
export function detectLayoutElements(html: string): LayoutDetectionResult {
  console.log('[layout-detector] Starting advanced header/footer detection...');
  
  // Detect platform first for platform-specific signals
  const platform = detectPlatformFromHtml(html);
  console.log(`[layout-detector] Platform detected: ${platform || 'generic'}`);
  
  // Remove overlays and popups before detection
  const cleanHtml = removeOverlays(html);
  
  // Detect header
  const header = detectHeader(cleanHtml, platform);
  console.log(`[layout-detector] Header: ${header ? `found (confidence: ${header.confidence.toFixed(2)})` : 'not found'}`);
  
  // Detect footer
  const footer = detectFooter(cleanHtml, platform);
  console.log(`[layout-detector] Footer: ${footer ? `found (confidence: ${footer.confidence.toFixed(2)})` : 'not found'}`);
  
  // Extract footer sections for menu building
  const footerSections = footer ? extractFooterSections(footer.html) : [];
  console.log(`[layout-detector] Footer sections found: ${footerSections.length}`);
  
  return {
    header,
    footer,
    platform,
    footerSections,
  };
}

// =====================================================
// PLATFORM DETECTION
// =====================================================
function detectPlatformFromHtml(html: string): string | null {
  const patterns: Record<string, RegExp[]> = {
    vtex: [/vtex/i, /data-vtex/i, /__RENDER_8_STATE__/, /vtexassets\.com/i],
    shopify: [/cdn\.shopify\.com/i, /shopify-section/i, /Shopify\.theme/i],
    nuvemshop: [/nuvemshop/i, /tiendanube/i, /d26lpennugtm8s\.cloudfront\.net/i],
    woocommerce: [/woocommerce/i, /wp-content\/plugins\/woocommerce/i],
    magento: [/mage-/i, /Mage\.Cookies/i, /data-mage-init/i],
    tray: [/tray\.com\.br/i, /traycorp/i, /cdn\.tray\.com\.br/i],
    loja_integrada: [/lojaintegrada/i, /cdn\.awsli\.com\.br/i],
    yampi: [/yampi/i, /cdn\.yampi\.com\.br/i],
    bagy: [/bagy\.com\.br/i, /cdn\.bagy/i],
    wix: [/wix\.com/i, /parastorage\.com/i, /static\.wixstatic\.com/i],
  };
  
  for (const [platform, platformPatterns] of Object.entries(patterns)) {
    for (const pattern of platformPatterns) {
      if (pattern.test(html)) {
        return platform;
      }
    }
  }
  
  return null;
}

// =====================================================
// REMOVE OVERLAYS/POPUPS
// =====================================================
function removeOverlays(html: string): string {
  let clean = html;
  
  // Remove common overlay patterns
  const overlayPatterns = [
    /<div[^>]*class=["'][^"']*(?:cookie|lgpd|gdpr|popup|modal|overlay)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    /<div[^>]*id=["'][^"']*(?:cookie|lgpd|gdpr|popup|modal|overlay)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  ];
  
  for (const pattern of overlayPatterns) {
    clean = clean.replace(pattern, '');
  }
  
  return clean;
}

// =====================================================
// HEADER DETECTION WITH SCORING
// =====================================================
function detectHeader(html: string, platform: string | null): DetectedLayoutElement | null {
  const candidates: Array<{
    html: string;
    score: number;
    source: 'semantic' | 'aria' | 'class' | 'heuristic';
    metadata: DetectedLayoutElement['metadata'];
  }> = [];
  
  // 1. Try semantic landmarks first (highest priority)
  for (const selector of HEADER_SIGNALS.strongSelectors) {
    const elements = extractElementsBySelector(html, selector);
    for (const element of elements) {
      const metadata = analyzeHeaderContent(element);
      let score = 100; // Base score for semantic
      
      // Bonus for content indicators
      if (metadata.hasLogo) score += 20;
      if (metadata.hasNav) score += 15;
      if (metadata.hasSearch) score += 10;
      if (metadata.hasCart) score += 10;
      if (metadata.hasAccount) score += 5;
      
      // Penalty checks
      score -= calculateHeaderPenalty(element);
      
      candidates.push({
        html: element,
        score,
        source: selector.startsWith('[role') ? 'aria' : 'semantic',
        metadata,
      });
    }
  }
  
  // 2. Try platform-specific selectors
  if (platform && PLATFORM_LAYOUT_SIGNALS[platform as keyof typeof PLATFORM_LAYOUT_SIGNALS]) {
    const platformSignals = PLATFORM_LAYOUT_SIGNALS[platform as keyof typeof PLATFORM_LAYOUT_SIGNALS];
    for (const selector of platformSignals.headerSelectors) {
      const elements = extractElementsBySelector(html, selector);
      for (const element of elements) {
        if (candidates.some(c => c.html === element)) continue;
        
        const metadata = analyzeHeaderContent(element);
        let score = 80; // Platform-specific score
        
        if (metadata.hasLogo) score += 15;
        if (metadata.hasNav) score += 10;
        if (metadata.hasSearch) score += 5;
        if (metadata.hasCart) score += 5;
        
        score -= calculateHeaderPenalty(element);
        
        candidates.push({
          html: element,
          score,
          source: 'class',
          metadata,
        });
      }
    }
  }
  
  // 3. Try class/ID patterns (lower priority)
  for (const pattern of HEADER_SIGNALS.classIdPatterns) {
    const regex = new RegExp(`<(?:div|section|header)[^>]*(?:class|id)=["'][^"']*${pattern.source}[^"']*["'][^>]*>[\\s\\S]*?<\\/(?:div|section|header)>`, 'gi');
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const element = match[0];
      if (candidates.some(c => c.html.includes(element) || element.includes(c.html))) continue;
      
      const metadata = analyzeHeaderContent(element);
      let score = 60; // Class/ID score
      
      if (metadata.hasLogo) score += 15;
      if (metadata.hasNav) score += 10;
      if (metadata.hasSearch) score += 5;
      if (metadata.hasCart) score += 5;
      
      score -= calculateHeaderPenalty(element);
      
      candidates.push({
        html: element,
        score,
        source: 'class',
        metadata,
      });
    }
  }
  
  // 4. Heuristic: first major container with nav + logo
  if (candidates.length === 0) {
    const heuristicHeader = findHeuristicHeader(html);
    if (heuristicHeader) {
      const metadata = analyzeHeaderContent(heuristicHeader);
      candidates.push({
        html: heuristicHeader,
        score: 40,
        source: 'heuristic',
        metadata,
      });
    }
  }
  
  // Select best candidate
  if (candidates.length === 0) return null;
  
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  
  return {
    type: 'header',
    html: best.html,
    confidence: Math.min(best.score / 150, 1), // Normalize to 0-1
    source: best.source,
    metadata: best.metadata,
  };
}

// =====================================================
// FOOTER DETECTION WITH SCORING
// =====================================================
function detectFooter(html: string, platform: string | null): DetectedLayoutElement | null {
  const candidates: Array<{
    html: string;
    score: number;
    source: 'semantic' | 'aria' | 'class' | 'heuristic';
    metadata: DetectedLayoutElement['metadata'];
  }> = [];
  
  // 1. Try semantic landmarks first (highest priority)
  for (const selector of FOOTER_SIGNALS.strongSelectors) {
    const elements = extractElementsBySelector(html, selector);
    for (const element of elements) {
      const metadata = analyzeFooterContent(element);
      let score = 100; // Base score for semantic
      
      // Bonus for content indicators
      if (metadata.hasCopyright) score += 25;
      if (metadata.hasPaymentIcons) score += 15;
      if (metadata.hasSocialLinks) score += 10;
      if (metadata.hasAddress) score += 10;
      if (metadata.hasNewsletter) score += 5;
      if ((metadata.linkCount || 0) > 5) score += 10;
      
      // Penalty checks
      score -= calculateFooterPenalty(element);
      
      candidates.push({
        html: element,
        score,
        source: selector.startsWith('[role') ? 'aria' : 'semantic',
        metadata,
      });
    }
  }
  
  // 2. Try platform-specific selectors
  if (platform && PLATFORM_LAYOUT_SIGNALS[platform as keyof typeof PLATFORM_LAYOUT_SIGNALS]) {
    const platformSignals = PLATFORM_LAYOUT_SIGNALS[platform as keyof typeof PLATFORM_LAYOUT_SIGNALS];
    for (const selector of platformSignals.footerSelectors) {
      const elements = extractElementsBySelector(html, selector);
      for (const element of elements) {
        if (candidates.some(c => c.html === element)) continue;
        
        const metadata = analyzeFooterContent(element);
        let score = 80; // Platform-specific score
        
        if (metadata.hasCopyright) score += 20;
        if (metadata.hasPaymentIcons) score += 10;
        if (metadata.hasSocialLinks) score += 10;
        
        score -= calculateFooterPenalty(element);
        
        candidates.push({
          html: element,
          score,
          source: 'class',
          metadata,
        });
      }
    }
  }
  
  // 3. Try class/ID patterns
  for (const pattern of FOOTER_SIGNALS.classIdPatterns) {
    const regex = new RegExp(`<(?:div|section|footer)[^>]*(?:class|id)=["'][^"']*${pattern.source}[^"']*["'][^>]*>[\\s\\S]*?<\\/(?:div|section|footer)>`, 'gi');
    let match;
    
    while ((match = regex.exec(html)) !== null) {
      const element = match[0];
      if (candidates.some(c => c.html.includes(element) || element.includes(c.html))) continue;
      
      const metadata = analyzeFooterContent(element);
      let score = 60;
      
      if (metadata.hasCopyright) score += 15;
      if (metadata.hasPaymentIcons) score += 10;
      if (metadata.hasSocialLinks) score += 5;
      
      score -= calculateFooterPenalty(element);
      
      candidates.push({
        html: element,
        score,
        source: 'class',
        metadata,
      });
    }
  }
  
  // 4. Heuristic: last major container with institutional links
  if (candidates.length === 0) {
    const heuristicFooter = findHeuristicFooter(html);
    if (heuristicFooter) {
      const metadata = analyzeFooterContent(heuristicFooter);
      candidates.push({
        html: heuristicFooter,
        score: 40,
        source: 'heuristic',
        metadata,
      });
    }
  }
  
  // Select best candidate
  if (candidates.length === 0) return null;
  
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  
  return {
    type: 'footer',
    html: best.html,
    confidence: Math.min(best.score / 150, 1),
    source: best.source,
    metadata: best.metadata,
  };
}

// =====================================================
// CONTENT ANALYSIS HELPERS
// =====================================================
function analyzeHeaderContent(html: string): DetectedLayoutElement['metadata'] {
  return {
    hasLogo: HEADER_SIGNALS.contentIndicators.logo.some(p => p.test(html)),
    hasNav: HEADER_SIGNALS.contentIndicators.nav.some(p => p.test(html)),
    hasSearch: HEADER_SIGNALS.contentIndicators.search.some(p => p.test(html)),
    hasCart: HEADER_SIGNALS.contentIndicators.cart.some(p => p.test(html)),
    hasAccount: HEADER_SIGNALS.contentIndicators.account.some(p => p.test(html)),
    linkCount: (html.match(/<a\s/gi) || []).length,
    position: 'top',
  };
}

function analyzeFooterContent(html: string): DetectedLayoutElement['metadata'] {
  const hasInstitutional = FOOTER_SIGNALS.contentIndicators.institutional.some(p => p.test(html));
  const hasContact = FOOTER_SIGNALS.contentIndicators.contact.some(p => p.test(html));
  const hasSocial = FOOTER_SIGNALS.contentIndicators.social.some(p => p.test(html));
  const hasPayment = FOOTER_SIGNALS.contentIndicators.payment.some(p => p.test(html));
  const hasCopyright = FOOTER_SIGNALS.contentIndicators.copyright.some(p => p.test(html));
  const hasNewsletter = FOOTER_SIGNALS.contentIndicators.newsletter.some(p => p.test(html));
  
  return {
    hasSocialLinks: hasSocial,
    hasNewsletter: hasNewsletter,
    hasCopyright: hasCopyright,
    hasPaymentIcons: hasPayment,
    hasAddress: hasContact,
    linkCount: (html.match(/<a\s/gi) || []).length,
    position: 'bottom',
  };
}

function calculateHeaderPenalty(html: string): number {
  let penalty = 0;
  
  // Check for hero banner (not header)
  if (/class=["'][^"']*hero[^"']*["']/i.test(html)) {
    penalty += 50;
  }
  
  // Check for multiple prices (product area)
  const priceMatches = html.match(/R\$\s*\d+[,\.]\d{2}/g) || [];
  if (priceMatches.length > 2) {
    penalty += 30;
  }
  
  // Check for article content
  if (/<article\b/i.test(html)) {
    penalty += 20;
  }
  
  return penalty;
}

function calculateFooterPenalty(html: string): number {
  let penalty = 0;
  
  // Check for product showcase
  if (/class=["'][^"']*(?:product|produto|vitrine|showcase)[^"']*["']/i.test(html)) {
    penalty += 40;
  }
  
  // Check for multiple prices
  const priceMatches = html.match(/R\$\s*\d+[,\.]\d{2}/g) || [];
  if (priceMatches.length > 3) {
    penalty += 30;
  }
  
  // Check for sticky/fixed elements (not main footer)
  if (/class=["'][^"']*(?:sticky|fixed|whatsapp-btn|chat)[^"']*["']/i.test(html)) {
    penalty += 20;
  }
  
  return penalty;
}

// =====================================================
// ELEMENT EXTRACTION HELPERS
// =====================================================
function extractElementsBySelector(html: string, selector: string): string[] {
  const elements: string[] = [];
  
  // Handle tag selectors
  if (selector === 'header' || selector === 'footer') {
    const regex = new RegExp(`<${selector}[^>]*>[\\s\\S]*?<\\/${selector}>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      elements.push(match[0]);
    }
  }
  // Handle role selectors
  else if (selector.startsWith('[role=')) {
    const role = selector.match(/role=["']([^"']+)["']/)?.[1];
    if (role) {
      const regex = new RegExp(`<[^>]*role=["']${role}["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        elements.push(match[0]);
      }
    }
  }
  // Handle attribute selectors
  else if (selector.startsWith('[')) {
    const attrMatch = selector.match(/\[([^\]=*~^$|]+)([*~^$|]?=)?["']?([^"'\]]+)?["']?\]/);
    if (attrMatch) {
      const [, attr, op, value] = attrMatch;
      let pattern: string;
      
      if (!op || !value) {
        pattern = `<[^>]*${attr}[^>]*>[\\s\\S]*?<\\/[^>]+>`;
      } else if (op === '*=') {
        pattern = `<[^>]*${attr}=["'][^"']*${value}[^"']*["'][^>]*>[\\s\\S]*?<\\/[^>]+>`;
      } else {
        pattern = `<[^>]*${attr}=["']${value}["'][^>]*>[\\s\\S]*?<\\/[^>]+>`;
      }
      
      const regex = new RegExp(pattern, 'gi');
      let match;
      while ((match = regex.exec(html)) !== null) {
        elements.push(match[0]);
      }
    }
  }
  // Handle class/ID selectors
  else if (selector.startsWith('.') || selector.startsWith('#')) {
    const isClass = selector.startsWith('.');
    const name = selector.substring(1);
    const attr = isClass ? 'class' : 'id';
    const regex = new RegExp(`<[^>]*${attr}=["'][^"']*${name}[^"']*["'][^>]*>[\\s\\S]*?<\\/[^>]+>`, 'gi');
    let match;
    while ((match = regex.exec(html)) !== null) {
      elements.push(match[0]);
    }
  }
  
  return elements;
}

function findHeuristicHeader(html: string): string | null {
  // Look for first container with logo + nav
  const containerRegex = /<div[^>]*>[^]*?(?:<a[^>]*href=["']\/["'][^>]*>|<img[^>]*logo)[^]*?<nav\b[^]*?<\/div>/gi;
  const match = containerRegex.exec(html);
  return match ? match[0] : null;
}

function findHeuristicFooter(html: string): string | null {
  // Look for last container with copyright or institutional links
  const containerRegex = /<div[^>]*>[^]*?(?:©|copyright|todos\s+os\s+direitos|cnpj)[^]*?<\/div>/gi;
  const matches = [...html.matchAll(containerRegex)];
  return matches.length > 0 ? matches[matches.length - 1][0] : null;
}

// =====================================================
// FOOTER SECTION EXTRACTION
// =====================================================
function extractFooterSections(footerHtml: string): FooterSection[] {
  const sections: FooterSection[] = [];
  
  // Look for lists or columns in footer
  const listRegex = /<(?:ul|div)[^>]*>[^]*?<\/(?:ul|div)>/gi;
  const lists = footerHtml.match(listRegex) || [];
  
  for (const list of lists) {
    // Extract title (h3, h4, h5, or strong before list)
    const titleMatch = list.match(/<(?:h[3-5]|strong|b)[^>]*>([^<]+)<\/(?:h[3-5]|strong|b)>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract links
    const links: Array<{ text: string; url: string }> = [];
    const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let linkMatch;
    
    while ((linkMatch = linkRegex.exec(list)) !== null) {
      const [, url, text] = linkMatch;
      if (text.trim() && url && !url.startsWith('#')) {
        links.push({ url, text: text.trim() });
      }
    }
    
    if (links.length >= 2) {
      // Classify section type
      const type = classifyFooterSection(title, links);
      sections.push({ title, links, type });
    }
  }
  
  return sections;
}

function classifyFooterSection(title: string, links: Array<{ text: string; url: string }>): FooterSection['type'] {
  const titleLower = title.toLowerCase();
  const linkTexts = links.map(l => l.text.toLowerCase()).join(' ');
  const linkUrls = links.map(l => l.url.toLowerCase()).join(' ');
  
  // Check for categories
  if (/categor|departamento|produtos|coleç/i.test(titleLower)) {
    return 'categories';
  }
  
  // Check for institutional
  if (/institucional|empresa|sobre|ajuda|informa/i.test(titleLower) ||
      /política|termos|troca|faq|como\s+comprar/i.test(linkTexts)) {
    return 'institutional';
  }
  
  // Check for contact
  if (/contato|atendimento|sac/i.test(titleLower) ||
      /telefone|email|whatsapp|fale/i.test(linkTexts)) {
    return 'contact';
  }
  
  // Check for social
  if (/redes\s+sociais|siga/i.test(titleLower) ||
      /facebook|instagram|twitter|youtube|linkedin/i.test(linkUrls)) {
    return 'social';
  }
  
  // Check for payment
  if (/pagamento|formas|bandeiras/i.test(titleLower)) {
    return 'payment';
  }
  
  return 'other';
}

// =====================================================
// EXPORT HTML WITHOUT HEADER/FOOTER
// =====================================================
export function extractMainContent(html: string): string {
  const result = detectLayoutElements(html);
  let mainHtml = html;
  
  // Remove header
  if (result.header) {
    mainHtml = mainHtml.replace(result.header.html, '');
  }
  
  // Remove footer
  if (result.footer) {
    mainHtml = mainHtml.replace(result.footer.html, '');
  }
  
  // Also remove common noise elements
  const noisePatterns = [
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<aside[^>]*>[\s\S]*?<\/aside>/gi,
    /<div[^>]*class=["'][^"']*(?:cookie|popup|modal|overlay|chat|whatsapp)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
  ];
  
  for (const pattern of noisePatterns) {
    mainHtml = mainHtml.replace(pattern, '');
  }
  
  return mainHtml;
}
