// =============================================
// IMPORT-VISUAL: Deep scraping for visual elements from e-commerce stores
// Extracts banners, category images, hero sections, menus and maps to our builder blocks
// =============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedBanner {
  imageDesktop: string;
  imageMobile?: string;
  linkUrl?: string;
  altText?: string;
}

interface ExtractedCategory {
  name: string;
  slug: string;
  url: string;
  imageUrl?: string;
  bannerDesktop?: string;
  bannerMobile?: string;
}

interface ExtractedMenuItem {
  label: string;
  url: string;
  type: 'link' | 'category' | 'page';
  children?: ExtractedMenuItem[];
}

interface ExtractedSection {
  type: string;
  title?: string;
  data: any;
}

interface VisualExtractionResult {
  success: boolean;
  heroBanners: ExtractedBanner[];
  categories: ExtractedCategory[];
  menuItems: ExtractedMenuItem[];
  sections: ExtractedSection[];
  branding: {
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
  };
  unsupportedSections: string[];
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, html, platform } = await req.json();

    if (!html && !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL ou HTML é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting visual elements from:', url || 'provided HTML');
    console.log('Detected platform:', platform);

    const result = extractVisualElements(html, url, platform);

    console.log(`Extracted: ${result.heroBanners.length} banners, ${result.categories.length} categories, ${result.menuItems.length} menu items, ${result.sections.length} sections`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting visual elements:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao extrair elementos visuais' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractVisualElements(html: string, url: string, platform?: string): VisualExtractionResult {
  const result: VisualExtractionResult = {
    success: true,
    heroBanners: [],
    categories: [],
    menuItems: [],
    sections: [],
    branding: {},
    unsupportedSections: [],
  };

  try {
    const baseUrl = extractBaseUrl(url, html);
    
    // Extract hero banners
    result.heroBanners = extractHeroBanners(html, baseUrl, platform);
    
    // Extract categories with URLs (banners will be fetched separately)
    result.categories = extractCategories(html, baseUrl, platform);
    
    // Extract menu items from navigation
    result.menuItems = extractMenuItems(html, baseUrl, platform);
    
    // Extract other sections
    result.sections = extractSections(html, platform);
    
    // Extract branding
    result.branding = extractBranding(html, baseUrl);

    console.log('Extraction complete:', {
      banners: result.heroBanners.length,
      categories: result.categories.length,
      menuItems: result.menuItems.length,
      sections: result.sections.length,
    });
  } catch (error) {
    console.error('Error during extraction:', error);
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Erro na extração';
  }

  return result;
}

function extractBaseUrl(url: string, html: string): string {
  if (url) {
    try {
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch {}
  }
  
  // Try to extract from HTML
  const canonicalMatch = /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (canonicalMatch) {
    try {
      const urlObj = new URL(canonicalMatch[1]);
      return urlObj.origin;
    } catch {}
  }
  
  const ogUrlMatch = /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i.exec(html);
  if (ogUrlMatch) {
    try {
      const urlObj = new URL(ogUrlMatch[1]);
      return urlObj.origin;
    } catch {}
  }

  return '';
}

function extractHeroBanners(html: string, baseUrl: string, platform?: string): ExtractedBanner[] {
  const banners: ExtractedBanner[] = [];
  const addedUrls = new Set<string>();
  
  // Shopify-specific patterns
  if (platform?.toLowerCase() === 'shopify') {
    // Slideshow sections
    const slideshowPattern = /<div[^>]*class="[^"]*slideshow[^"]*"[^>]*>([\s\S]*?)<\/section>/gi;
    let slideshowMatch;
    while ((slideshowMatch = slideshowPattern.exec(html)) !== null) {
      const slideshowHtml = slideshowMatch[1];
      extractBannersFromSection(slideshowHtml, baseUrl, banners, addedUrls);
    }
  }

  // Look for picture elements first (best source for responsive images)
  const picturePattern = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;
  let pictureMatch;
  while ((pictureMatch = picturePattern.exec(html)) !== null) {
    const pictureHtml = pictureMatch[0];
    const sources: { media?: string; src: string }[] = [];
    
    // Extract sources
    const sourcePattern = /<source[^>]*srcset=["']([^"'\s]+)[^"']*["'][^>]*(?:media=["']([^"']+)["'])?[^>]*>/gi;
    let sourceMatch;
    while ((sourceMatch = sourcePattern.exec(pictureHtml)) !== null) {
      sources.push({ src: sourceMatch[1], media: sourceMatch[2] });
    }
    
    // Extract img fallback
    const imgMatch = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/i.exec(pictureHtml);
    const imgSrc = imgMatch?.[1] || '';
    const altText = imgMatch?.[2] || '';
    
    if (imgSrc && isLikelyBannerImage(imgSrc) && isInBannerContext(html, pictureMatch.index)) {
      const desktopSrc = normalizeImageUrl(imgSrc, baseUrl);
      if (!addedUrls.has(desktopSrc)) {
        const mobileSrc = sources.find(s => s.media?.includes('max-width'))?.src;
        banners.push({
          imageDesktop: desktopSrc,
          imageMobile: mobileSrc ? normalizeImageUrl(mobileSrc, baseUrl) : undefined,
          altText,
        });
        addedUrls.add(desktopSrc);
      }
    }
  }

  // Look for linked images (banners with links)
  const linkImagePattern = /<a[^>]*href=["']([^"']+)["'][^>]*>\s*<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>\s*<\/a>/gi;
  let linkMatch;
  while ((linkMatch = linkImagePattern.exec(html)) !== null) {
    const [, linkUrl, imageSrc, altText] = linkMatch;
    
    if (isLikelyBannerImage(imageSrc) && isInBannerContext(html, linkMatch.index)) {
      const normalizedSrc = normalizeImageUrl(imageSrc, baseUrl);
      if (!addedUrls.has(normalizedSrc)) {
        banners.push({
          imageDesktop: normalizedSrc,
          linkUrl: normalizeUrl(linkUrl, baseUrl),
          altText: altText || '',
        });
        addedUrls.add(normalizedSrc);
      }
    }
  }

  // Look for standalone large images in banner contexts
  const standaloneImgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = standaloneImgPattern.exec(html)) !== null) {
    const [, src, alt] = imgMatch;
    
    if (isLikelyBannerImage(src) && isInBannerContext(html, imgMatch.index)) {
      const normalizedSrc = normalizeImageUrl(src, baseUrl);
      if (!addedUrls.has(normalizedSrc)) {
        banners.push({
          imageDesktop: normalizedSrc,
          altText: alt || '',
        });
        addedUrls.add(normalizedSrc);
      }
    }
  }

  // Limit and deduplicate
  return banners.slice(0, 10);
}

function extractBannersFromSection(sectionHtml: string, baseUrl: string, banners: ExtractedBanner[], addedUrls: Set<string>) {
  const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let match;
  while ((match = imgPattern.exec(sectionHtml)) !== null) {
    const [, src, alt] = match;
    if (isLikelyBannerImage(src)) {
      const normalizedSrc = normalizeImageUrl(src, baseUrl);
      if (!addedUrls.has(normalizedSrc)) {
        banners.push({
          imageDesktop: normalizedSrc,
          altText: alt || '',
        });
        addedUrls.add(normalizedSrc);
      }
    }
  }
}

function extractCategories(html: string, baseUrl: string, platform?: string): ExtractedCategory[] {
  const categories: ExtractedCategory[] = [];
  const addedSlugs = new Set<string>();

  // Category URL patterns for different platforms
  const categoryPatterns = [
    // Shopify collections
    /href=["']((?:https?:\/\/[^"']*)?\/collections\/([^"'?#]+))[^"']*["']/gi,
    // Generic category/categoria patterns  
    /href=["']((?:https?:\/\/[^"']*)?\/(?:categoria|category|c)\/([^"'?#]+))[^"']*["']/gi,
    // Nuvemshop
    /href=["']((?:https?:\/\/[^"']*)?\/([^"'?#]+))["'][^>]*class="[^"]*(?:category|categoria)[^"]*"/gi,
  ];

  for (const pattern of categoryPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const fullUrl = match[1];
      const slug = match[2];
      
      if (!slug || addedSlugs.has(slug)) continue;
      
      // Skip common non-category slugs
      const skipSlugs = ['all', 'products', 'search', 'cart', 'account', 'login', 'register', 'checkout'];
      if (skipSlugs.includes(slug.toLowerCase())) continue;
      
      const name = slug
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const normalizedUrl = fullUrl.startsWith('http') ? fullUrl : `${baseUrl}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
      
      categories.push({
        name,
        slug,
        url: normalizedUrl,
      });
      
      addedSlugs.add(slug);
    }
  }

  // Extract from navigation menus
  const navPattern = /<nav[^>]*>([\s\S]*?)<\/nav>/gi;
  let navMatch;
  while ((navMatch = navPattern.exec(html)) !== null) {
    const navHtml = navMatch[1];
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(navHtml)) !== null) {
      const [, href, text] = linkMatch;
      
      // Check if link is a category
      const categoryMatch = /\/(?:collections|categoria|category|c)\/([^/?#]+)/i.exec(href);
      if (categoryMatch) {
        const slug = categoryMatch[1];
        if (!addedSlugs.has(slug)) {
          const normalizedUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
          
          categories.push({
            name: text.trim(),
            slug,
            url: normalizedUrl,
          });
          
          addedSlugs.add(slug);
        }
      }
    }
  }

  return categories;
}

function extractMenuItems(html: string, baseUrl: string, platform?: string): ExtractedMenuItem[] {
  const menuItems: ExtractedMenuItem[] = [];
  const addedLabels = new Set<string>();

  // Find main navigation - try header nav first
  const headerNavPatterns = [
    /<header[^>]*>([\s\S]*?)<\/header>/gi,
    /<nav[^>]*class="[^"]*(?:main|primary|site-nav|header)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
    /<nav[^>]*id="[^"]*(?:main|primary|site-nav|header)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
    /<div[^>]*class="[^"]*header[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  let navHtml = '';
  for (const pattern of headerNavPatterns) {
    const match = pattern.exec(html);
    if (match) {
      navHtml = match[1];
      break;
    }
  }

  if (!navHtml) {
    // Fallback to first nav
    const fallbackNav = /<nav[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
    if (fallbackNav) {
      navHtml = fallbackNav[1];
    }
  }

  if (!navHtml) return menuItems;

  // Extract links from navigation
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/a>/gi;
  let match;
  while ((match = linkPattern.exec(navHtml)) !== null) {
    const [, href, rawLabel] = match;
    
    // Clean label (remove HTML tags)
    const label = rawLabel.replace(/<[^>]*>/g, '').trim();
    
    // Skip empty labels, icons, or already added items
    if (!label || label.length < 2 || addedLabels.has(label.toLowerCase())) continue;
    
    // Skip non-content links
    const skipPatterns = ['javascript:', '#', 'mailto:', 'tel:', 'whatsapp'];
    if (skipPatterns.some(p => href.toLowerCase().includes(p))) continue;
    
    // Skip utility links
    const skipLabels = ['carrinho', 'cart', 'login', 'entrar', 'sair', 'logout', 'buscar', 'search', 'minha conta', 'my account'];
    if (skipLabels.some(l => label.toLowerCase().includes(l))) continue;
    
    // Determine item type
    let itemType: 'link' | 'category' | 'page' = 'link';
    if (/\/(?:collections|categoria|category|c)\//i.test(href)) {
      itemType = 'category';
    } else if (/\/(?:pages?|pagina)\//i.test(href)) {
      itemType = 'page';
    }
    
    const normalizedUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
    
    menuItems.push({
      label,
      url: normalizedUrl,
      type: itemType,
    });
    
    addedLabels.add(label.toLowerCase());
  }

  return menuItems.slice(0, 15); // Limit to 15 items
}

function extractSections(html: string, platform?: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];

  // Common section patterns
  const sectionPatterns: { pattern: RegExp; type: string; titleGroup: number }[] = [
    // Product sections
    { 
      pattern: /<(?:section|div)[^>]*class="[^"]*(?:featured|destaque|products)[^"]*"[^>]*>[\s\S]*?<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi,
      type: 'ProductGrid',
      titleGroup: 1
    },
    // Testimonials/Reviews
    {
      pattern: /<(?:section|div)[^>]*class="[^"]*(?:testimonial|depoiment|review|avalia)[^"]*"[^>]*>/gi,
      type: 'Testimonials',
      titleGroup: 0
    },
    // Info highlights/Trust badges
    {
      pattern: /<(?:section|div)[^>]*class="[^"]*(?:trust|benefit|vantag|info-bar)[^"]*"[^>]*>/gi,
      type: 'InfoHighlights',
      titleGroup: 0
    },
    // Newsletter
    {
      pattern: /<(?:section|div)[^>]*class="[^"]*(?:newsletter|inscri)[^"]*"[^>]*>/gi,
      type: 'Newsletter',
      titleGroup: 0
    },
  ];

  for (const { pattern, type, titleGroup } of sectionPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      sections.push({
        type,
        title: titleGroup > 0 ? match[titleGroup]?.trim() : undefined,
        data: {},
      });
    }
  }

  return sections;
}

function extractBranding(html: string, baseUrl: string): VisualExtractionResult['branding'] {
  const branding: VisualExtractionResult['branding'] = {};

  // Extract logo - multiple strategies
  const logoPatterns = [
    /<img[^>]*class="[^"]*logo[^"]*"[^>]*src=["']([^"']+)["']/i,
    /<img[^>]*alt="[^"]*logo[^"]*"[^>]*src=["']([^"']+)["']/i,
    /<a[^>]*class="[^"]*logo[^"]*"[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i,
    /<header[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*class="[^"]*logo[^"]*"/i,
    /class="[^"]*logo[^"]*"[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i,
    /<img[^>]*src=["']([^"']*logo[^"']+)["']/i,
  ];

  for (const pattern of logoPatterns) {
    const match = pattern.exec(html);
    if (match) {
      branding.logo = normalizeImageUrl(match[1], baseUrl);
      break;
    }
  }

  // Extract favicon
  const faviconPatterns = [
    /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:icon|shortcut icon)["']/i,
  ];

  for (const pattern of faviconPatterns) {
    const match = pattern.exec(html);
    if (match) {
      branding.favicon = normalizeImageUrl(match[1], baseUrl);
      break;
    }
  }

  // Extract colors from CSS variables or inline styles
  const primaryColorPatterns = [
    /--primary[^:]*:\s*([#]?[a-fA-F0-9]{3,6}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/i,
    /--brand[^:]*:\s*([#]?[a-fA-F0-9]{3,6}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/i,
    /--accent[^:]*:\s*([#]?[a-fA-F0-9]{3,6}|rgb[a]?\([^)]+\)|hsl[a]?\([^)]+\))/i,
  ];

  for (const pattern of primaryColorPatterns) {
    const match = pattern.exec(html);
    if (match) {
      branding.primaryColor = match[1].trim();
      break;
    }
  }

  return branding;
}

function isLikelyBannerImage(src: string): boolean {
  if (!src) return false;
  
  const lowSrc = src.toLowerCase();
  
  // Exclude common non-banner patterns
  const excludePatterns = [
    'logo', 'icon', 'badge', 'flag', 'payment', 'seal', 'sprite',
    'avatar', 'user', 'thumb', 'thumbnail', 'small', 'tiny',
    '.svg', '.gif', 'base64', 'placeholder', 'loading',
    '32x32', '64x64', '100x100', '48x48', '24x24', '16x16',
    'favicon', 'apple-touch', 'pixel', 'tracking',
  ];
  
  for (const pattern of excludePatterns) {
    if (lowSrc.includes(pattern)) return false;
  }

  // Include patterns that suggest banners
  const includePatterns = [
    'banner', 'slide', 'hero', 'carousel', 'home', 'promo',
    'destaque', 'oferta', 'campanha', 'lancamento', 'collection',
  ];
  
  for (const pattern of includePatterns) {
    if (lowSrc.includes(pattern)) return true;
  }

  // Check for reasonable dimensions in URL (common CDN patterns)
  const dimensionPattern = /(\d{3,4})x(\d{2,4})/;
  const dimMatch = dimensionPattern.exec(lowSrc);
  if (dimMatch) {
    const width = parseInt(dimMatch[1]);
    const height = parseInt(dimMatch[2]);
    // Banner-like aspect ratios
    if (width >= 600 && height >= 150 && width / height >= 1.5) {
      return true;
    }
  }

  // Check file size indicators in URL
  if (lowSrc.includes('large') || lowSrc.includes('grande') || lowSrc.includes('1920') || lowSrc.includes('1200')) {
    return true;
  }

  return false;
}

function isInBannerContext(html: string, index: number): boolean {
  // Check surrounding context for banner indicators
  const contextStart = Math.max(0, index - 800);
  const contextEnd = Math.min(html.length, index + 500);
  const context = html.substring(contextStart, contextEnd).toLowerCase();
  
  const bannerKeywords = [
    'slider', 'slideshow', 'carousel', 'banner', 'hero',
    'home-banner', 'main-banner', 'swiper', 'slick',
    'section-slideshow', 'index-section', 'shopify-section',
    'featured', 'promo', 'destaque',
  ];
  
  // Exclude footer/header contexts for generic images
  const excludeContexts = ['footer', 'payment-icons', 'trust-badges'];
  
  for (const exclude of excludeContexts) {
    if (context.includes(exclude)) return false;
  }
  
  return bannerKeywords.some(keyword => context.includes(keyword));
}

function normalizeImageUrl(src: string, baseUrl: string): string {
  if (!src) return '';
  
  // Already absolute URL
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // Protocol-relative URL
  if (src.startsWith('//')) {
    return `https:${src}`;
  }
  
  // Relative URL
  if (baseUrl) {
    try {
      return new URL(src, baseUrl).href;
    } catch {}
  }

  return src;
}

function normalizeUrl(href: string, baseUrl: string): string {
  if (!href || href === '#' || href.startsWith('javascript:')) {
    return '';
  }
  return normalizeImageUrl(href, baseUrl);
}
