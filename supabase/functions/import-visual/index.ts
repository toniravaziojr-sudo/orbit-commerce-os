// =============================================
// IMPORT-VISUAL: Deep scraping for visual elements from e-commerce stores
// Extracts banners, category images, hero sections, and maps to our builder blocks
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
  imageUrl?: string;
  bannerDesktop?: string;
  bannerMobile?: string;
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
    sections: [],
    branding: {},
    unsupportedSections: [],
  };

  try {
    // Extract hero banners based on platform
    result.heroBanners = extractHeroBanners(html, platform);
    
    // Extract categories with images
    result.categories = extractCategories(html, url, platform);
    
    // Extract other sections (product grids, testimonials, etc.)
    result.sections = extractSections(html, platform);
    
    // Extract branding
    result.branding = extractBranding(html);

    console.log(`Extracted: ${result.heroBanners.length} banners, ${result.categories.length} categories, ${result.sections.length} sections`);
  } catch (error) {
    console.error('Error during extraction:', error);
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Erro na extração';
  }

  return result;
}

function extractHeroBanners(html: string, platform?: string): ExtractedBanner[] {
  const banners: ExtractedBanner[] = [];
  
  // Common banner selectors for e-commerce platforms
  const bannerPatterns = [
    // Shopify patterns
    /<div[^>]*class="[^"]*slideshow[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*hero[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*banner[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*carousel[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*slider[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    
    // Nuvemshop patterns
    /<div[^>]*class="[^"]*js-home-slider[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*id="[^"]*slider[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    
    // Generic patterns
    /<div[^>]*class="[^"]*swiper[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<div[^>]*class="[^"]*slick[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  // Extract all images from potential banner areas
  const imagePattern = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  const picturePattern = /<picture[^>]*>[\s\S]*?<source[^>]*srcset=["']([^"']+)["'][^>]*media=["']\(max-width[^"']*\)["'][^>]*>[\s\S]*?<source[^>]*srcset=["']([^"']+)["'][^>]*>[\s\S]*?<\/picture>/gi;
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[\s\S]*?<\/a>/gi;

  // Extract from link+image patterns (more reliable for banners)
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const [, linkUrl, imageSrc, altText] = match;
    
    // Filter out small images, icons, logos
    if (isLikelyBannerImage(imageSrc)) {
      banners.push({
        imageDesktop: normalizeImageUrl(imageSrc, html),
        linkUrl: normalizeUrl(linkUrl, html),
        altText: altText || '',
      });
    }
  }

  // Extract from picture elements (responsive images)
  while ((match = picturePattern.exec(html)) !== null) {
    const [, mobileSource, desktopSource] = match;
    if (isLikelyBannerImage(desktopSource)) {
      banners.push({
        imageDesktop: normalizeImageUrl(desktopSource, html),
        imageMobile: normalizeImageUrl(mobileSource, html),
      });
    }
  }

  // If no banners found yet, try to find large images
  if (banners.length === 0) {
    while ((match = imagePattern.exec(html)) !== null) {
      const [, src, alt] = match;
      if (isLikelyBannerImage(src) && isInBannerContext(html, match.index)) {
        banners.push({
          imageDesktop: normalizeImageUrl(src, html),
          altText: alt || '',
        });
      }
    }
  }

  // Deduplicate banners
  const uniqueBanners = banners.filter((banner, index, self) => 
    index === self.findIndex(b => b.imageDesktop === banner.imageDesktop)
  );

  // Limit to first 10 banners (reasonable max)
  return uniqueBanners.slice(0, 10);
}

function extractCategories(html: string, url: string, platform?: string): ExtractedCategory[] {
  const categories: ExtractedCategory[] = [];
  
  // Extract navigation links that likely represent categories
  const navPatterns = [
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<ul[^>]*class="[^"]*menu[^"]*"[^>]*>[\s\S]*?<\/ul>/gi,
    /<div[^>]*class="[^"]*nav[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
  ];

  // Category link patterns
  const categoryLinkPattern = /<a[^>]*href=["']([^"']*(?:categoria|category|colecao|collection|c\/)[^"']*)["'][^>]*>([^<]+)<\/a>/gi;
  const categoryImagePattern = /<a[^>]*href=["']([^"']*(?:categoria|category|colecao|collection|c\/)[^"']*)["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;

  // Extract categories with images first
  let match;
  while ((match = categoryImagePattern.exec(html)) !== null) {
    const [, href, imageSrc] = match;
    const category = extractCategoryFromUrl(href, url);
    if (category) {
      category.imageUrl = normalizeImageUrl(imageSrc, html);
      categories.push(category);
    }
  }

  // Extract text-only category links
  while ((match = categoryLinkPattern.exec(html)) !== null) {
    const [, href, text] = match;
    const category = extractCategoryFromUrl(href, url);
    if (category && !categories.some(c => c.slug === category.slug)) {
      category.name = text.trim();
      categories.push(category);
    }
  }

  // Try to extract category banners from category pages
  // This would require fetching each category page, which we'll handle client-side

  return categories;
}

function extractCategoryFromUrl(href: string, baseUrl: string): ExtractedCategory | null {
  try {
    const urlObj = new URL(href, baseUrl);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    
    // Find category slug from URL
    const categoryKeywords = ['categoria', 'category', 'colecao', 'collection', 'c'];
    let slug = '';
    let name = '';

    for (let i = 0; i < pathParts.length; i++) {
      if (categoryKeywords.includes(pathParts[i].toLowerCase()) && pathParts[i + 1]) {
        slug = pathParts[i + 1];
        name = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        break;
      }
    }

    // If no keyword found, use last path part
    if (!slug && pathParts.length > 0) {
      slug = pathParts[pathParts.length - 1];
      name = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    if (!slug) return null;

    return { name, slug };
  } catch {
    return null;
  }
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

function extractBranding(html: string): VisualExtractionResult['branding'] {
  const branding: VisualExtractionResult['branding'] = {};

  // Extract logo
  const logoPatterns = [
    /<img[^>]*class="[^"]*logo[^"]*"[^>]*src=["']([^"']+)["']/i,
    /<img[^>]*alt="[^"]*logo[^"]*"[^>]*src=["']([^"']+)["']/i,
    /<a[^>]*class="[^"]*logo[^"]*"[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i,
  ];

  for (const pattern of logoPatterns) {
    const match = pattern.exec(html);
    if (match) {
      branding.logo = normalizeImageUrl(match[1], html);
      break;
    }
  }

  // Extract favicon
  const faviconMatch = /<link[^>]*rel=["'](?:icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (faviconMatch) {
    branding.favicon = faviconMatch[1];
  }

  // Extract colors from CSS variables or inline styles
  const primaryColorPatterns = [
    /--primary[^:]*:\s*([^;]+)/i,
    /--brand[^:]*:\s*([^;]+)/i,
    /\.btn-primary[^{]*\{[^}]*background[^:]*:\s*([^;]+)/i,
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
  ];
  
  for (const pattern of excludePatterns) {
    if (lowSrc.includes(pattern)) return false;
  }

  // Include patterns that suggest banners
  const includePatterns = [
    'banner', 'slide', 'hero', 'carousel', 'home', 'promo',
    'destaque', 'oferta', 'campanha', 'lancamento',
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

  return true; // Default to including if no strong signal
}

function isInBannerContext(html: string, index: number): boolean {
  // Check surrounding context for banner indicators
  const contextStart = Math.max(0, index - 500);
  const contextEnd = Math.min(html.length, index + 500);
  const context = html.substring(contextStart, contextEnd).toLowerCase();
  
  const bannerKeywords = [
    'slider', 'slideshow', 'carousel', 'banner', 'hero',
    'home-banner', 'main-banner', 'swiper', 'slick',
  ];
  
  return bannerKeywords.some(keyword => context.includes(keyword));
}

function normalizeImageUrl(src: string, html: string): string {
  if (!src) return '';
  
  // Already absolute URL
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // Protocol-relative URL
  if (src.startsWith('//')) {
    return `https:${src}`;
  }

  // Try to extract base URL from HTML
  const baseMatch = /<base[^>]*href=["']([^"']+)["']/i.exec(html);
  if (baseMatch) {
    try {
      return new URL(src, baseMatch[1]).href;
    } catch {}
  }

  // Try to find og:url or canonical
  const urlMatch = /<meta[^>]*property=["']og:url["'][^>]*content=["']([^"']+)["']/i.exec(html) ||
                   /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(html);
  if (urlMatch) {
    try {
      return new URL(src, urlMatch[1]).href;
    } catch {}
  }

  return src;
}

function normalizeUrl(href: string, html: string): string {
  if (!href || href === '#' || href.startsWith('javascript:')) {
    return '';
  }
  return normalizeImageUrl(href, html);
}
