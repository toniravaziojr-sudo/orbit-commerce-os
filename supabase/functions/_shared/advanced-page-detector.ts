// =====================================================
// ADVANCED PAGE DETECTOR - Detecção Inteligente de Páginas
// =====================================================
// Baseado em metodologia avançada de clonagem de sites:
// - Análise semântica de estrutura HTML
// - Detecção multi-plataforma (Shopify, VTEX, Nuvemshop, etc.)
// - Classificação inteligente de tipo de página
// - Extração de links institucionais e customizados
// =====================================================

export interface DetectedPage {
  url: string;
  title: string;
  slug: string;
  type: 'institutional' | 'custom' | 'home' | 'category' | 'product' | 'functional' | 'blog';
  confidence: number;
  source: 'footer' | 'header' | 'nav' | 'sitemap' | 'content';
  metadata?: {
    platform?: string;
    hasMainContent?: boolean;
    estimatedWordCount?: number;
    hasForm?: boolean;
    hasDynamicContent?: boolean;
  };
}

export interface PageDetectionResult {
  platform: string | null;
  homePage: string;
  institutionalPages: DetectedPage[];
  customPages: DetectedPage[];
  blogPages: DetectedPage[];
  allPages: DetectedPage[];
}

// =====================================================
// PLATFORM DETECTION - Expanded patterns
// =====================================================
const PLATFORM_SIGNATURES = {
  shopify: {
    patterns: [
      /cdn\.shopify\.com/i,
      /shopify-section/i,
      /data-shopify/i,
      /Shopify\.theme/i,
      /\/products\.json/i,
      /shopify_analytics/i,
    ],
    institutionalPrefix: '/pages/',
    categoryPrefix: '/collections/',
    productPrefix: '/products/',
    blogPrefix: '/blogs/',
  },
  vtex: {
    patterns: [
      /vtex\.com/i,
      /data-vtex/i,
      /vtex-store/i,
      /io\.vtex/i,
      /__RENDER_8_STATE__/,
      /vtexassets\.com/i,
    ],
    institutionalPrefix: '/institucional/',
    categoryPrefix: '/departamento/',
    productPrefix: '/p',
    blogPrefix: '/blog/',
  },
  nuvemshop: {
    patterns: [
      /nuvemshop/i,
      /tiendanube/i,
      /NuvemShop/i,
      /lojanuvem/i,
      /d26lpennugtm8s\.cloudfront\.net/i,
      /js-nuvemshop/i,
    ],
    institutionalPrefix: null, // Direct slugs
    categoryPrefix: '/categorias/',
    productPrefix: '/productos/',
    blogPrefix: '/blog/',
  },
  woocommerce: {
    patterns: [
      /woocommerce/i,
      /wc-add-to-cart/i,
      /wp-content\/plugins\/woocommerce/i,
      /wc-block/i,
      /is-type-product/i,
    ],
    institutionalPrefix: null, // Direct slugs as pages
    categoryPrefix: '/product-category/',
    productPrefix: '/product/',
    blogPrefix: '/blog/',
  },
  tray: {
    patterns: [
      /tray\.com\.br/i,
      /traycorp/i,
      /data-tray/i,
      /cdn\.tray\.com\.br/i,
    ],
    institutionalPrefix: '/pagina/',
    categoryPrefix: '/departamento/',
    productPrefix: '/produto/',
    blogPrefix: '/blog/',
  },
  loja_integrada: {
    patterns: [
      /lojaintegrada/i,
      /loja-integrada/i,
      /cdn\.awsli\.com\.br/i,
      /awsli\.com\.br/i,
    ],
    institutionalPrefix: '/pagina/',
    categoryPrefix: '/categoria/',
    productPrefix: '/produto/',
    blogPrefix: '/blog/',
  },
  yampi: {
    patterns: [
      /yampi/i,
      /checkout\.yampi/i,
      /cdn\.yampi\.com\.br/i,
    ],
    institutionalPrefix: '/pages/',
    categoryPrefix: '/category/',
    productPrefix: '/product/',
    blogPrefix: '/blog/',
  },
  bagy: {
    patterns: [
      /bagy\.com\.br/i,
      /cdn\.bagy/i,
    ],
    institutionalPrefix: '/pagina/',
    categoryPrefix: '/categoria/',
    productPrefix: '/produto/',
    blogPrefix: '/blog/',
  },
  magento: {
    patterns: [
      /magento/i,
      /mage-/i,
      /Mage\.Cookies/i,
      /data-mage-init/i,
    ],
    institutionalPrefix: null,
    categoryPrefix: null,
    productPrefix: null,
    blogPrefix: '/blog/',
  },
};

// =====================================================
// INSTITUTIONAL PAGE IDENTIFIERS
// =====================================================

// These slugs/paths ALWAYS indicate institutional pages
const INSTITUTIONAL_SLUGS = [
  // About/Company
  'sobre', 'about', 'about-us', 'quem-somos', 'nossa-historia', 'nossa-empresa',
  'nossa-missao', 'nosso-time', 'nossa-equipe', 'conheca-nos', 'a-empresa',
  'who-we-are', 'our-story', 'our-team', 'company', 'institucional',
  
  // Policies
  'politica-de-privacidade', 'privacy-policy', 'privacy', 'privacidade',
  'politica-de-cookies', 'cookies', 'cookie-policy',
  'lgpd', 'gdpr', 'protecao-de-dados', 'data-protection',
  
  // Terms
  'termos-de-uso', 'terms-of-use', 'terms', 'termos', 'termos-e-condicoes',
  'terms-and-conditions', 'terms-of-service', 'tos',
  'condicoes-gerais', 'regulamento',
  
  // Returns/Exchange
  'troca-e-devolucao', 'trocas-e-devolucoes', 'devolucao', 'politica-de-troca',
  'exchange', 'returns', 'return-policy', 'refund', 'refund-policy',
  'garantia', 'warranty',
  
  // FAQ/Help
  'faq', 'perguntas-frequentes', 'duvidas', 'duvidas-frequentes',
  'ajuda', 'help', 'suporte', 'support', 'central-de-ajuda', 'help-center',
  'atendimento', 'customer-service', 'sac',
  
  // How to buy/Payment
  'como-comprar', 'how-to-buy', 'como-funciona', 'how-it-works',
  'formas-de-pagamento', 'payment-methods', 'pagamento', 'payment',
  'parcelamento', 'installments',
  
  // Shipping/Delivery
  'entrega', 'entregas', 'shipping', 'delivery', 'frete', 'envio',
  'prazo-de-entrega', 'delivery-time', 'politica-de-entrega',
  'shipping-policy', 'como-rastrear', 'tracking-info',
  
  // Contact
  'contato', 'contact', 'contact-us', 'fale-conosco', 'entre-em-contato',
  
  // Work with us
  'trabalhe-conosco', 'careers', 'vagas', 'jobs', 'oportunidades',
  'seja-um-revendedor', 'seja-parceiro', 'revenda', 'wholesale', 'atacado',
  
  // Physical stores
  'lojas', 'stores', 'nossas-lojas', 'our-stores', 'encontre-uma-loja',
  'store-locator', 'onde-encontrar', 'pontos-de-venda',
  
  // Press/Media
  'imprensa', 'press', 'midia', 'media', 'na-midia',
  
  // Sustainability
  'sustentabilidade', 'sustainability', 'responsabilidade-social',
  'social-responsibility', 'impacto', 'impact',
];

// Title patterns that indicate institutional content
const INSTITUTIONAL_TITLE_PATTERNS = [
  /^sobre\b/i, /^about\b/i, /^quem\s+somos/i, /^nossa/i,
  /pol[íi]tica/i, /termos/i, /terms/i, /policy/i,
  /troca/i, /devolu[çc][ãa]o/i, /return/i, /exchange/i, /garantia/i,
  /faq/i, /perguntas/i, /d[úu]vidas/i, /ajuda/i, /help/i, /suporte/i,
  /como\s+(comprar|funciona)/i, /how\s+to/i, /pagamento/i, /payment/i,
  /entrega/i, /frete/i, /shipping/i, /delivery/i,
  /contato/i, /contact/i, /fale/i,
  /trabalhe/i, /career/i, /vaga/i,
  /loja/i, /store/i, /encontre/i,
];

// =====================================================
// FUNCTIONAL/SYSTEM PAGE IDENTIFIERS (TO EXCLUDE)
// =====================================================
const FUNCTIONAL_PATTERNS = [
  // Auth/Account
  /^\/?(login|signin|sign-in|entrar)/i,
  /^\/?(cadastro|cadastrar|register|signup|sign-up|criar-conta)/i,
  /^\/?(logout|signout|sign-out|sair)/i,
  /^\/?(minha-conta|my-account|account|conta|perfil|profile)/i,
  /^\/?(recuperar-senha|forgot-password|reset-password|esqueci)/i,
  
  // Cart/Checkout
  /^\/?(carrinho|cart|sacola|bag)/i,
  /^\/?(checkout|finalizar|pagamento-finalizar)/i,
  /^\/?(pedido|order|orders|meus-pedidos)/i,
  /^\/?(confirmacao|confirmation|obrigado|thank-you)/i,
  
  // Wishlist/Favorites
  /^\/?(wishlist|favoritos|lista-de-desejos|saved)/i,
  
  // Search
  /^\/?(busca|search|pesquisa|buscar)/i,
  
  // Tracking (native)
  /^\/?(rastreio|rastrear|rastreamento|tracking|track)/i,
  
  // Products (individual)
  /^\/?(produto|product|p)\/[^/]+$/i,
  /^\/products\/[^/]+$/i,
  
  // Categories/Collections
  /^\/?(categoria|category|colecao|collection|departamento)/i,
  /^\/collections\/[^/]+$/i,
  
  // Dynamic pages with IDs
  /\/\d{5,}$/i, // URLs ending with long numbers (order IDs, product IDs)
  /\?.*order_id/i,
  /\?.*product_id/i,
  
  // System/API endpoints
  /^\/?api\//i,
  /^\/?ajax\//i,
  /^\/?_/i,
  /\.json$/i,
  /\.xml$/i,
];

// =====================================================
// MAIN DETECTION FUNCTION
// =====================================================
export function detectAllPages(html: string, baseUrl: string): PageDetectionResult {
  console.log('[page-detector] Starting advanced page detection...');
  
  // 1. Detect platform
  const platform = detectPlatform(html);
  console.log(`[page-detector] Platform detected: ${platform || 'generic'}`);
  
  // 2. Extract all links from strategic areas
  const allLinks = extractAllLinks(html, baseUrl);
  console.log(`[page-detector] Found ${allLinks.length} total links`);
  
  // 3. Classify each link
  const classifiedPages = classifyLinks(allLinks, platform, html, baseUrl);
  
  // 4. Filter and organize results
  const institutionalPages = classifiedPages.filter(p => p.type === 'institutional' && p.confidence >= 0.5);
  const customPages = classifiedPages.filter(p => p.type === 'custom' && p.confidence >= 0.5);
  const blogPages = classifiedPages.filter(p => p.type === 'blog' && p.confidence >= 0.5);
  
  console.log(`[page-detector] Classification results:`);
  console.log(`  - Institutional: ${institutionalPages.length}`);
  console.log(`  - Custom: ${customPages.length}`);
  console.log(`  - Blog: ${blogPages.length}`);
  
  // Log all found institutional pages
  for (const page of institutionalPages) {
    console.log(`[page-detector] ✓ Institutional: ${page.title} (${page.slug}) [${page.confidence.toFixed(2)}] from ${page.source}`);
  }
  
  return {
    platform,
    homePage: baseUrl,
    institutionalPages,
    customPages,
    blogPages,
    allPages: classifiedPages,
  };
}

// =====================================================
// PLATFORM DETECTION
// =====================================================
function detectPlatform(html: string): string | null {
  for (const [platformName, config] of Object.entries(PLATFORM_SIGNATURES)) {
    for (const pattern of config.patterns) {
      if (pattern.test(html)) {
        return platformName;
      }
    }
  }
  return null;
}

// =====================================================
// LINK EXTRACTION FROM ALL STRATEGIC AREAS
// =====================================================
interface RawLink {
  url: string;
  text: string;
  source: 'footer' | 'header' | 'nav' | 'sitemap' | 'content';
  context?: string; // Parent section class/id for context
}

function extractAllLinks(html: string, baseUrl: string): RawLink[] {
  const links: RawLink[] = [];
  const seenUrls = new Set<string>();
  
  // Define extraction areas with priority
  const extractionAreas: Array<{
    name: 'footer' | 'header' | 'nav' | 'sitemap' | 'content';
    regex: RegExp;
    priority: number;
  }> = [
    // Footer - Primary source for institutional pages
    {
      name: 'footer',
      regex: /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
      priority: 1,
    },
    // Specific footer divs
    {
      name: 'footer',
      regex: /<div[^>]*(?:class|id)="[^"]*(?:footer|rodape)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      priority: 1,
    },
    // Navigation menus
    {
      name: 'nav',
      regex: /<nav[^>]*>([\s\S]*?)<\/nav>/gi,
      priority: 2,
    },
    // Header
    {
      name: 'header',
      regex: /<header[^>]*>([\s\S]*?)<\/header>/gi,
      priority: 2,
    },
    // Specific menu divs
    {
      name: 'nav',
      regex: /<(?:ul|div)[^>]*(?:class|id)="[^"]*(?:menu|nav|navigation|links)[^"]*"[^>]*>([\s\S]*?)<\/(?:ul|div)>/gi,
      priority: 3,
    },
    // Aside/Sidebar (often has institutional links)
    {
      name: 'content',
      regex: /<aside[^>]*>([\s\S]*?)<\/aside>/gi,
      priority: 4,
    },
  ];
  
  for (const area of extractionAreas) {
    let match;
    while ((match = area.regex.exec(html)) !== null) {
      const areaHtml = match[1] || match[0];
      const areaLinks = extractLinksFromHtml(areaHtml, baseUrl, area.name);
      
      for (const link of areaLinks) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          links.push(link);
        }
      }
    }
  }
  
  // Also search the entire HTML for platform-specific patterns (like /pages/)
  const platformSpecificLinks = extractPlatformSpecificLinks(html, baseUrl, seenUrls);
  links.push(...platformSpecificLinks);
  
  console.log(`[page-detector] Extracted links from areas:`, {
    footer: links.filter(l => l.source === 'footer').length,
    header: links.filter(l => l.source === 'header').length,
    nav: links.filter(l => l.source === 'nav').length,
    content: links.filter(l => l.source === 'content').length,
  });
  
  return links;
}

function extractLinksFromHtml(html: string, baseUrl: string, source: 'footer' | 'header' | 'nav' | 'sitemap' | 'content'): RawLink[] {
  const links: RawLink[] = [];
  
  // Match anchor tags with href
  const linkRegex = /<a[^>]*href=[\"']([^\"'#]+)[\"'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    const [, href, rawText] = match;
    if (!href || href === '/' || href === '#') continue;
    
    // Clean the text content
    const text = rawText
      .replace(/<[^>]*>/g, ' ')  // Remove inner tags
      .replace(/\s+/g, ' ')       // Normalize whitespace
      .trim();
    
    // Skip empty or very long texts
    if (text.length < 2 || text.length > 150) continue;
    
    // Normalize URL
    let url = href;
    try {
      const baseUrlObj = new URL(baseUrl);
      
      if (href.startsWith('/')) {
        url = `${baseUrlObj.origin}${href}`;
      } else if (href.startsWith('./')) {
        url = `${baseUrlObj.origin}${href.substring(1)}`;
      } else if (!href.startsWith('http')) {
        continue; // Skip relative or special URLs
      }
      
      const linkUrl = new URL(url);
      
      // Skip external links
      if (linkUrl.hostname !== baseUrlObj.hostname) continue;
      
      // Skip media files
      if (/\.(jpg|jpeg|png|gif|webp|svg|pdf|mp4|mp3)$/i.test(linkUrl.pathname)) continue;
      
      // Normalize URL (remove trailing slash, lowercase)
      url = `${linkUrl.origin}${linkUrl.pathname.replace(/\/$/, '')}`;
      
    } catch {
      continue;
    }
    
    links.push({ url, text, source });
  }
  
  return links;
}

function extractPlatformSpecificLinks(html: string, baseUrl: string, seenUrls: Set<string>): RawLink[] {
  const links: RawLink[] = [];
  
  // Look for /pages/ links (Shopify pattern)
  const pagesRegex = /<a[^>]*href=[\"']([^\"']+\/pages\/[^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = pagesRegex.exec(html)) !== null) {
    const [, href, rawText] = match;
    const text = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    let url = href;
    try {
      const baseUrlObj = new URL(baseUrl);
      if (href.startsWith('/')) {
        url = `${baseUrlObj.origin}${href}`;
      }
      url = url.replace(/\/$/, '');
    } catch {
      continue;
    }
    
    if (!seenUrls.has(url) && text.length >= 2) {
      seenUrls.add(url);
      links.push({ url, text, source: 'content' });
    }
  }
  
  // Look for /institucional/ links (VTEX pattern)
  const institucionalRegex = /<a[^>]*href=[\"']([^\"']+\/institucional\/[^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/gi;
  
  while ((match = institucionalRegex.exec(html)) !== null) {
    const [, href, rawText] = match;
    const text = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    let url = href;
    try {
      const baseUrlObj = new URL(baseUrl);
      if (href.startsWith('/')) {
        url = `${baseUrlObj.origin}${href}`;
      }
      url = url.replace(/\/$/, '');
    } catch {
      continue;
    }
    
    if (!seenUrls.has(url) && text.length >= 2) {
      seenUrls.add(url);
      links.push({ url, text, source: 'content' });
    }
  }
  
  // Look for /pagina/ links (Tray, Loja Integrada patterns)
  const paginaRegex = /<a[^>]*href=[\"']([^\"']+\/pagina\/[^\"']+)[\"'][^>]*>([\s\S]*?)<\/a>/gi;
  
  while ((match = paginaRegex.exec(html)) !== null) {
    const [, href, rawText] = match;
    const text = rawText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    let url = href;
    try {
      const baseUrlObj = new URL(baseUrl);
      if (href.startsWith('/')) {
        url = `${baseUrlObj.origin}${href}`;
      }
      url = url.replace(/\/$/, '');
    } catch {
      continue;
    }
    
    if (!seenUrls.has(url) && text.length >= 2) {
      seenUrls.add(url);
      links.push({ url, text, source: 'content' });
    }
  }
  
  return links;
}

// =====================================================
// LINK CLASSIFICATION
// =====================================================
function classifyLinks(
  links: RawLink[],
  platform: string | null,
  html: string,
  baseUrl: string
): DetectedPage[] {
  const pages: DetectedPage[] = [];
  
  for (const link of links) {
    const classification = classifyLink(link, platform);
    
    if (classification.type !== 'functional' && classification.type !== 'product' && classification.type !== 'category') {
      pages.push(classification);
    }
  }
  
  // Remove duplicates by URL, keeping highest confidence
  const uniquePages = new Map<string, DetectedPage>();
  for (const page of pages) {
    const existing = uniquePages.get(page.url);
    if (!existing || page.confidence > existing.confidence) {
      uniquePages.set(page.url, page);
    }
  }
  
  return Array.from(uniquePages.values())
    .sort((a, b) => b.confidence - a.confidence);
}

function classifyLink(link: RawLink, platform: string | null): DetectedPage {
  const { url, text, source } = link;
  
  let pathname: string;
  let slug: string;
  
  try {
    const urlObj = new URL(url);
    pathname = urlObj.pathname.toLowerCase();
    slug = pathname.replace(/^\/|\/$/g, '').split('/').pop() || '';
  } catch {
    return createPage(link, 'functional', 0);
  }
  
  // ===== Check if it's a functional page (EXCLUDE) =====
  for (const pattern of FUNCTIONAL_PATTERNS) {
    if (pattern.test(pathname)) {
      return createPage(link, 'functional', 0);
    }
  }
  
  // ===== Check if it's a blog page =====
  if (/\/blog\//i.test(pathname) || /^blog$/i.test(slug)) {
    return createPage(link, 'blog', 0.8);
  }
  
  // ===== Check for platform-specific institutional paths =====
  if (platform) {
    const platformConfig = PLATFORM_SIGNATURES[platform as keyof typeof PLATFORM_SIGNATURES];
    if (platformConfig) {
      // Check if it matches institutional prefix
      if (platformConfig.institutionalPrefix && pathname.includes(platformConfig.institutionalPrefix.toLowerCase())) {
        return createPage(link, 'institutional', 0.95);
      }
      
      // Check if it matches category prefix (exclude)
      if (platformConfig.categoryPrefix && pathname.includes(platformConfig.categoryPrefix.toLowerCase())) {
        return createPage(link, 'category', 0);
      }
      
      // Check if it matches product prefix (exclude)
      if (platformConfig.productPrefix && pathname.includes(platformConfig.productPrefix.toLowerCase())) {
        return createPage(link, 'product', 0);
      }
    }
  }
  
  // ===== Check for known institutional slugs =====
  const slugLower = slug.toLowerCase();
  const isKnownInstitutional = INSTITUTIONAL_SLUGS.some(s => 
    slugLower === s || slugLower.includes(s) || s.includes(slugLower)
  );
  
  if (isKnownInstitutional) {
    return createPage(link, 'institutional', 0.9);
  }
  
  // ===== Check for institutional title patterns =====
  const textLower = text.toLowerCase();
  const isInstitutionalByTitle = INSTITUTIONAL_TITLE_PATTERNS.some(p => p.test(textLower));
  
  if (isInstitutionalByTitle) {
    return createPage(link, 'institutional', 0.85);
  }
  
  // ===== Check for platform-specific patterns =====
  // Shopify: /pages/ prefix is always institutional
  if (/\/pages\//i.test(pathname)) {
    return createPage(link, 'institutional', 0.95);
  }
  
  // VTEX: /institucional/ prefix
  if (/\/institucional\//i.test(pathname)) {
    return createPage(link, 'institutional', 0.95);
  }
  
  // Generic: /pagina/ or /paginas/ prefix
  if (/\/paginas?\//i.test(pathname)) {
    return createPage(link, 'institutional', 0.85);
  }
  
  // ===== Check source location for hints =====
  // Links from footer are more likely to be institutional
  if (source === 'footer') {
    // If it's a simple direct slug (not /products/, /collections/, etc.)
    if (pathname.split('/').filter(Boolean).length === 1) {
      // Check if it looks like a category name (usually short, single words)
      if (text.length < 15 && !textLower.includes(' ')) {
        // Might be a category, lower confidence
        return createPage(link, 'custom', 0.4);
      }
      // Longer titles or multi-word = more likely institutional
      return createPage(link, 'custom', 0.6);
    }
  }
  
  // ===== Default: treat as potential custom page =====
  // Simple paths without specific identifiers might be custom pages
  if (pathname.split('/').filter(Boolean).length <= 2) {
    return createPage(link, 'custom', 0.3);
  }
  
  // Unknown/complex paths - low confidence
  return createPage(link, 'functional', 0.1);
}

function createPage(link: RawLink, type: DetectedPage['type'], confidence: number): DetectedPage {
  let slug: string;
  try {
    const urlObj = new URL(link.url);
    slug = urlObj.pathname.replace(/^\/|\/$/g, '').split('/').pop() || '';
  } catch {
    slug = link.text.toLowerCase().replace(/\s+/g, '-').substring(0, 50);
  }
  
  return {
    url: link.url,
    title: link.text,
    slug,
    type,
    confidence,
    source: link.source,
  };
}

// =====================================================
// HELPER: Verify if a page is institutional by fetching it
// =====================================================
export async function verifyInstitutionalPage(url: string, fetchFn: (url: string) => Promise<string>): Promise<{
  isInstitutional: boolean;
  hasMainContent: boolean;
  hasForm: boolean;
  estimatedWordCount: number;
}> {
  try {
    const html = await fetchFn(url);
    
    // Remove header, footer, nav from analysis
    const mainContent = extractMainContent(html);
    
    // Check for forms (might indicate functional page)
    const hasForm = /<form[^>]*>/i.test(mainContent) && 
                    /<input[^>]*type=[\"'](text|email|password|tel)/i.test(mainContent);
    
    // Estimate word count
    const textContent = mainContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const estimatedWordCount = textContent.split(' ').length;
    
    // Institutional pages typically have substantial text content (>100 words)
    // and limited dynamic/interactive elements
    const hasMainContent = estimatedWordCount > 100;
    
    // Check for dynamic content markers
    const hasDynamicContent = 
      /<\w+[^>]*data-(product|cart|checkout|search)/i.test(html) ||
      /add.to.cart|buy.now/i.test(html);
    
    const isInstitutional = hasMainContent && !hasForm && !hasDynamicContent;
    
    return {
      isInstitutional,
      hasMainContent,
      hasForm,
      estimatedWordCount,
    };
  } catch {
    return {
      isInstitutional: false,
      hasMainContent: false,
      hasForm: false,
      estimatedWordCount: 0,
    };
  }
}

function extractMainContent(html: string): string {
  // Try to find main content area
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];
  
  // Try article
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return articleMatch[1];
  
  // Try common content divs
  const contentDivMatch = html.match(/<div[^>]*(?:class|id)="[^"]*(?:content|main|page-content|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentDivMatch) return contentDivMatch[1];
  
  // Fallback: remove header, footer, nav and return body
  return html
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
}
