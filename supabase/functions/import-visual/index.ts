// =============================================
// IMPORT-VISUAL: Deep scraping for visual elements from e-commerce stores
// Extracts banners, category images, hero sections, menus, videos and maps to our builder blocks
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
  internalUrl?: string; // Converted to internal URL format
  type: 'link' | 'category' | 'page';
  children?: ExtractedMenuItem[];
}

interface ExtractedVideo {
  type: 'youtube' | 'vimeo' | 'upload';
  url: string;
  embedUrl?: string;
  videoId?: string;
  title?: string;
}

interface ExtractedSection {
  type: string;
  title?: string;
  data: any;
}

interface ExtractedInstitutionalPage {
  title: string;
  slug: string;
  url: string;
  source: 'footer' | 'header' | 'sitemap' | 'global';
}

interface VisualExtractionResult {
  success: boolean;
  heroBanners: ExtractedBanner[];
  categories: ExtractedCategory[];
  menuItems: ExtractedMenuItem[]; // Header menu items (backward compatibility)
  footerMenuItems: ExtractedMenuItem[]; // Footer menu items
  videos: ExtractedVideo[];
  sections: ExtractedSection[];
  institutionalPages: ExtractedInstitutionalPage[];
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

// Fetch Shopify navigation menu via public JSON endpoint
async function fetchShopifyNavigation(baseUrl: string): Promise<ExtractedMenuItem[]> {
  const menuItems: ExtractedMenuItem[] = [];
  
  try {
    // Shopify stores expose navigation via a public JSON endpoint
    // Try main-menu first, then header-menu
    const menuHandles = ['main-menu', 'header-menu', 'main', 'header'];
    
    for (const handle of menuHandles) {
      try {
        const menuUrl = `${baseUrl}/pages/menu?view=json`;
        console.log(`Trying to fetch Shopify menu: ${menuUrl}`);
        
        // Try the navigation JSON endpoint that most themes expose
        const navUrl = `${baseUrl}/?view=navigation.json`;
        const response = await fetch(navUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const text = await response.text();
          try {
            const data = JSON.parse(text);
            if (data.menu || data.items || data.linklist) {
              console.log('Found Shopify navigation JSON');
              // Parse the menu structure
              const items = data.menu || data.items || data.linklist?.links || [];
              return parseShopifyMenuItems(items, baseUrl);
            }
          } catch (e) {
            // Not valid JSON, continue trying other methods
          }
        }
      } catch (e) {
        // Continue to next method
      }
    }
    
    // Try to fetch via Storefront API by looking for menu data in script tags
    console.log('Trying alternative Shopify menu extraction methods...');
    
  } catch (error) {
    console.error('Error fetching Shopify navigation:', error);
  }
  
  return menuItems;
}

function parseShopifyMenuItems(items: any[], baseUrl: string): ExtractedMenuItem[] {
  const menuItems: ExtractedMenuItem[] = [];
  
  for (const item of items) {
    const label = item.title || item.label || item.name || '';
    const url = item.url || item.href || '';
    
    if (!label) continue;
    
    const normalizedUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    const internalUrl = convertUrlToInternal(url);
    const itemType = getUrlItemType(url);
    
    const children: ExtractedMenuItem[] = [];
    if (item.links && Array.isArray(item.links) && item.links.length > 0) {
      for (const child of item.links) {
        const childLabel = child.title || child.label || child.name || '';
        const childUrl = child.url || child.href || '';
        if (!childLabel) continue;
        
        const childNormalizedUrl = childUrl.startsWith('http') ? childUrl : `${baseUrl}${childUrl.startsWith('/') ? '' : '/'}${childUrl}`;
        const childInternalUrl = convertUrlToInternal(childUrl);
        const childItemType = getUrlItemType(childUrl);
        
        children.push({
          label: childLabel,
          url: childNormalizedUrl,
          internalUrl: childInternalUrl,
          type: childItemType,
        });
      }
    }
    
    menuItems.push({
      label,
      url: normalizedUrl,
      internalUrl,
      type: itemType,
      children: children.length > 0 ? children : undefined,
    });
  }
  
  return menuItems;
}

function convertUrlToInternal(href: string): string | undefined {
  // Collection/Category
  const collectionMatch = /\/(?:collections?|categoria|category|c)\/([^/?#]+)/i.exec(href);
  if (collectionMatch) {
    return `/categoria/${collectionMatch[1]}`;
  }
  // Page
  const pageMatch = /\/(?:pages?|pagina)\/([^/?#]+)/i.exec(href);
  if (pageMatch) {
    return `/pagina/${pageMatch[1]}`;
  }
  // Blog/Article
  const blogMatch = /\/(?:blogs?|artigos?)\/([^/?#]+)(?:\/([^/?#]+))?/i.exec(href);
  if (blogMatch) {
    return blogMatch[2] ? `/blog/${blogMatch[1]}/${blogMatch[2]}` : `/blog/${blogMatch[1]}`;
  }
  // Product
  const productMatch = /\/(?:products?|produto)\/([^/?#]+)/i.exec(href);
  if (productMatch) {
    return `/produto/${productMatch[1]}`;
  }
  return undefined;
}

function getUrlItemType(href: string): 'link' | 'category' | 'page' {
  if (/\/(?:collections|categoria|category|c)\//i.test(href)) {
    return 'category';
  } else if (/\/(?:pages?|pagina|blogs?|artigos?)\//i.test(href)) {
    return 'page';
  }
  return 'link';
}

// Extract Shopify menu from inline JSON or script data in the HTML
async function extractShopifyMenuFromHtml(html: string, baseUrl: string): Promise<ExtractedMenuItem[]> {
  const menuItems: ExtractedMenuItem[] = [];
  
  try {
    // Pattern 1: Look for window.theme.navigation or similar global objects
    const jsonPatterns = [
      // Shopify Dawn theme and similar
      /window\.theme\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i,
      // menu/navigation specific
      /"menu":\s*(\[[\s\S]*?\])/i,
      /"navigation":\s*(\{[\s\S]*?\})/i,
      // linklist pattern (Shopify specific)
      /"linklist":\s*(\{[\s\S]*?\})/i,
      // Look for menu data in data attributes or embedded JSON
      /data-menu=['"](\[[\s\S]*?\])['"]>/i,
    ];
    
    for (const pattern of jsonPatterns) {
      const match = pattern.exec(html);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const items = data.menu || data.items || data.links || data.linklist?.links || (Array.isArray(data) ? data : []);
          if (items.length > 0) {
            console.log('Found menu data in HTML JSON:', items.length, 'items');
            return parseShopifyMenuItems(items, baseUrl);
          }
        } catch (e) {
          // Continue trying other patterns
        }
      }
    }
    
    // Pattern 2: Look for structured data in nav elements with data-* attributes
    // Many themes include submenu structure in nested <details> elements or similar
    const detailsNavPattern = /<details[^>]*>[\s\S]*?<summary[^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>[\s\S]*?<\/summary>[\s\S]*?(<ul[^>]*>[\s\S]*?<\/ul>)[\s\S]*?<\/details>/gi;
    let detailsMatch;
    const addedLabels = new Set<string>();
    
    while ((detailsMatch = detailsNavPattern.exec(html)) !== null) {
      const [, parentHref, parentLabel, submenuHtml] = detailsMatch;
      const cleanLabel = parentLabel.replace(/<[^>]*>/g, '').trim();
      
      if (!cleanLabel || cleanLabel.length < 2 || addedLabels.has(cleanLabel.toLowerCase())) continue;
      
      const children: ExtractedMenuItem[] = [];
      const subLinkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/a>/gi;
      let subMatch;
      
      while ((subMatch = subLinkPattern.exec(submenuHtml)) !== null) {
        const [, subHref, subRawLabel] = subMatch;
        const subLabel = subRawLabel.replace(/<[^>]*>/g, '').trim();
        
        if (!subLabel || subLabel.length < 2) continue;
        if (children.some(c => c.label.toLowerCase() === subLabel.toLowerCase())) continue;
        
        const subNormalizedUrl = subHref.startsWith('http') ? subHref : `${baseUrl}${subHref.startsWith('/') ? '' : '/'}${subHref}`;
        children.push({
          label: subLabel,
          url: subNormalizedUrl,
          internalUrl: convertUrlToInternal(subHref),
          type: getUrlItemType(subHref),
        });
      }
      
      const normalizedUrl = parentHref.startsWith('http') ? parentHref : `${baseUrl}${parentHref.startsWith('/') ? '' : '/'}${parentHref}`;
      menuItems.push({
        label: cleanLabel,
        url: normalizedUrl,
        internalUrl: convertUrlToInternal(parentHref),
        type: getUrlItemType(parentHref),
        children: children.length > 0 ? children : undefined,
      });
      addedLabels.add(cleanLabel.toLowerCase());
    }
    
    if (menuItems.length > 0) {
      console.log(`Found ${menuItems.length} menu items from details/summary structure`);
      return menuItems;
    }
    
    // Pattern 3: Look for Shopify section rendering data
    const sectionDataPattern = /data-section-settings=['"](\{[\s\S]*?\})['"]>/gi;
    let sectionMatch;
    while ((sectionMatch = sectionDataPattern.exec(html)) !== null) {
      try {
        const sectionData = JSON.parse(sectionMatch[1].replace(/&quot;/g, '"'));
        if (sectionData.menu || sectionData.navigation) {
          const items = sectionData.menu || sectionData.navigation;
          if (Array.isArray(items) && items.length > 0) {
            return parseShopifyMenuItems(items, baseUrl);
          }
        }
      } catch (e) {
        // Continue
      }
    }
    
  } catch (error) {
    console.error('Error extracting Shopify menu from HTML:', error);
  }
  
  return menuItems;
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

    let result = extractVisualElements(html, url, platform);
    
    // For Shopify, try to fetch menus via API if HTML extraction didn't find submenus
    if (platform === 'shopify' && url) {
      const hasSubmenus = result.menuItems.some(item => item.children && item.children.length > 0);
      
      if (!hasSubmenus && result.menuItems.length > 0) {
        console.log('No submenus found in HTML, trying Shopify-specific menu extraction...');
        
        // Try to extract from inline JSON in the HTML (common in Shopify themes)
        const shopifyMenuItems = await extractShopifyMenuFromHtml(html, url);
        if (shopifyMenuItems.length > 0 && shopifyMenuItems.some((item: ExtractedMenuItem) => item.children && item.children.length > 0)) {
          result.menuItems = shopifyMenuItems;
          console.log(`Found ${shopifyMenuItems.length} menu items with hierarchy from Shopify extraction`);
        }
      }
    }

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
    footerMenuItems: [],
    videos: [],
    sections: [],
    institutionalPages: [],
    branding: {},
    unsupportedSections: [],
  };

  try {
    const baseUrl = extractBaseUrl(url, html);
    
    // Extract hero banners
    result.heroBanners = extractHeroBanners(html, baseUrl, platform);
    
    // Extract categories with URLs (banners will be fetched separately)
    result.categories = extractCategories(html, baseUrl, platform);
    
    // Extract menu items from header navigation
    result.menuItems = extractMenuItems(html, baseUrl, platform);
    
    // Extract footer menu items - try dedicated extraction first
    result.footerMenuItems = extractFooterMenuItems(html, baseUrl, platform);
    
    // If footer menu is empty or too small, derive from header menu (main items only, no children)
    if (result.footerMenuItems.length < 2 && result.menuItems.length > 0) {
      console.log('Footer menu empty/small, deriving from header menu main items');
      result.footerMenuItems = result.menuItems.map(item => ({
        label: item.label,
        url: item.url,
        internalUrl: item.internalUrl,
        type: item.type,
        // No children for footer - just top-level items
      }));
    }
    
    // Extract videos (YouTube, Vimeo, direct uploads)
    result.videos = extractVideos(html, baseUrl);
    
    // Extract other sections
    result.sections = extractSections(html, platform);
    
    // Extract branding
    result.branding = extractBranding(html, baseUrl);
    
    // Extract institutional pages from footer
    result.institutionalPages = extractInstitutionalPages(html, baseUrl, platform);

    console.log('Extraction complete:', {
      banners: result.heroBanners.length,
      categories: result.categories.length,
      menuItems: result.menuItems.length,
      menuItemsWithChildren: result.menuItems.filter(m => m.children && m.children.length > 0).length,
      footerMenuItems: result.footerMenuItems.length,
      videos: result.videos.length,
      sections: result.sections.length,
      institutionalPages: result.institutionalPages.length,
    });
  } catch (error) {
    console.error('Error during extraction:', error);
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Erro na extração';
  }

  return result;
}

function extractVideos(html: string, baseUrl: string): ExtractedVideo[] {
  const videos: ExtractedVideo[] = [];
  const addedIds = new Set<string>();

  // YouTube iframes
  const youtubePattern = /<iframe[^>]*src=["']([^"']*(?:youtube\.com|youtu\.be)[^"']*)["'][^>]*>/gi;
  let match;
  while ((match = youtubePattern.exec(html)) !== null) {
    const embedUrl = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
    const videoIdMatch = /(?:embed\/|watch\?v=|youtu\.be\/)([^&?/]+)/.exec(embedUrl);
    if (videoIdMatch && !addedIds.has(videoIdMatch[1])) {
      videos.push({
        type: 'youtube',
        url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
        embedUrl: `https://www.youtube.com/embed/${videoIdMatch[1]}`,
        videoId: videoIdMatch[1],
      });
      addedIds.add(videoIdMatch[1]);
    }
  }

  // Vimeo iframes
  const vimeoPattern = /<iframe[^>]*src=["']([^"']*vimeo\.com[^"']*)["'][^>]*>/gi;
  while ((match = vimeoPattern.exec(html)) !== null) {
    const embedUrl = match[1].startsWith('//') ? `https:${match[1]}` : match[1];
    const videoIdMatch = /vimeo\.com\/(?:video\/)?(\d+)/.exec(embedUrl);
    if (videoIdMatch && !addedIds.has(videoIdMatch[1])) {
      videos.push({
        type: 'vimeo',
        url: `https://vimeo.com/${videoIdMatch[1]}`,
        embedUrl: `https://player.vimeo.com/video/${videoIdMatch[1]}`,
        videoId: videoIdMatch[1],
      });
      addedIds.add(videoIdMatch[1]);
    }
  }

  // Direct video files
  const videoFilePattern = /<(?:video|source)[^>]*src=["']([^"']+\.(?:mp4|webm|mov))["'][^>]*>/gi;
  while ((match = videoFilePattern.exec(html)) !== null) {
    const videoUrl = normalizeImageUrl(match[1], baseUrl);
    if (!addedIds.has(videoUrl)) {
      videos.push({
        type: 'upload',
        url: videoUrl,
      });
      addedIds.add(videoUrl);
    }
  }

  return videos;
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

// =============================================
// BANNER EXTRACTION WITH DESKTOP/MOBILE PAIRING
// Key principle: 1 logical slide = 1 banner with desktop + mobile variants
// =============================================

interface BannerCandidate {
  src: string;
  alt?: string;
  linkUrl?: string;
  variant: 'desktop' | 'mobile' | 'unknown';
  pairKey: string; // Used to match desktop/mobile versions
  slideIndex: number;
  context: string; // Which section/slide container it came from
}

function extractHeroBanners(html: string, baseUrl: string, platform?: string): ExtractedBanner[] {
  console.log('Starting banner extraction with desktop/mobile pairing...');
  
  const candidates: BannerCandidate[] = [];
  let slideIndex = 0;
  
  // STRATEGY 1: Find slides/sections in carousels and extract pairs
  const slideContainerPatterns = [
    // Shopify slideshow slides
    /<(?:div|li)[^>]*class="[^"]*(?:slideshow__slide|slide[^"]*|swiper-slide|carousel-item|banner-slide)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|li)>/gi,
    // Generic slide patterns
    /<(?:div|li)[^>]*(?:data-slide|data-index|data-swiper-slide)[^>]*>([\s\S]*?)<\/(?:div|li)>/gi,
  ];
  
  for (const pattern of slideContainerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const slideHtml = match[1];
      const slideContext = `slide-${slideIndex}`;
      
      // Extract all images from this slide
      extractImagesFromSlide(slideHtml, baseUrl, candidates, slideIndex, slideContext);
      slideIndex++;
    }
  }
  
  // STRATEGY 2: Look for <picture> elements with responsive sources
  const picturePattern = /<picture[^>]*>([\s\S]*?)<\/picture>/gi;
  let pictureMatch;
  while ((pictureMatch = picturePattern.exec(html)) !== null) {
    if (!isInBannerContext(html, pictureMatch.index)) continue;
    
    const pictureHtml = pictureMatch[0];
    const context = `picture-${slideIndex}`;
    
    // Desktop image (usually the main <img> or largest source)
    const imgMatch = /<img[^>]*src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?/i.exec(pictureHtml);
    if (imgMatch && isLikelyBannerImage(imgMatch[1])) {
      const linkMatch = getLinkFromContext(html, pictureMatch.index);
      const pairKey = generatePairKey(imgMatch[2] || '', linkMatch || '', slideIndex);
      
      candidates.push({
        src: normalizeImageUrl(imgMatch[1], baseUrl),
        alt: imgMatch[2],
        linkUrl: linkMatch ? normalizeUrl(linkMatch, baseUrl) : undefined,
        variant: 'desktop',
        pairKey,
        slideIndex,
        context,
      });
      
      // Mobile source (look for media with max-width)
      const mobileSourcePattern = /<source[^>]*media=["'][^"']*max-width[^"']*["'][^>]*srcset=["']([^"'\s]+)/gi;
      const mobileMatch = mobileSourcePattern.exec(pictureHtml);
      if (mobileMatch) {
        candidates.push({
          src: normalizeImageUrl(mobileMatch[1], baseUrl),
          alt: imgMatch[2],
          linkUrl: linkMatch ? normalizeUrl(linkMatch, baseUrl) : undefined,
          variant: 'mobile',
          pairKey,
          slideIndex,
          context,
        });
      }
    }
    slideIndex++;
  }
  
  // STRATEGY 3: Look for mobile/desktop specific classes or attributes
  if (candidates.length === 0) {
    const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    let imgMatch;
    while ((imgMatch = imgPattern.exec(html)) !== null) {
      const fullMatch = imgMatch[0];
      const src = imgMatch[1];
      
      if (!isLikelyBannerImage(src) || !isInBannerContext(html, imgMatch.index)) continue;
      
      const altMatch = /alt=["']([^"']*)["']/i.exec(fullMatch);
      const alt = altMatch?.[1] || '';
      const linkUrl = getLinkFromContext(html, imgMatch.index);
      
      // Detect variant from class/attributes
      const variant = detectImageVariant(fullMatch, src);
      const pairKey = generatePairKey(alt, linkUrl || '', slideIndex);
      
      candidates.push({
        src: normalizeImageUrl(src, baseUrl),
        alt,
        linkUrl: linkUrl ? normalizeUrl(linkUrl, baseUrl) : undefined,
        variant,
        pairKey,
        slideIndex,
        context: `img-${slideIndex}`,
      });
      
      // Only increment slideIndex for unknown variants (to pair them later)
      if (variant === 'unknown') slideIndex++;
    }
  }
  
  console.log(`Found ${candidates.length} banner candidates`);
  
  // PAIR desktop and mobile versions
  const pairedBanners = pairBannerCandidates(candidates);
  
  console.log(`Created ${pairedBanners.length} paired banners`);
  
  return pairedBanners.slice(0, 10);
}

function extractImagesFromSlide(
  slideHtml: string, 
  baseUrl: string, 
  candidates: BannerCandidate[], 
  slideIndex: number,
  context: string
) {
  // Look for desktop/mobile image pairs within the same slide
  const imgPattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let match;
  
  while ((match = imgPattern.exec(slideHtml)) !== null) {
    const fullMatch = match[0];
    const src = match[1];
    
    if (!isLikelyBannerImage(src)) continue;
    
    const altMatch = /alt=["']([^"']*)["']/i.exec(fullMatch);
    const alt = altMatch?.[1] || '';
    
    // Try to find link wrapping this image
    const linkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]*src=["']/.exec(slideHtml);
    const linkUrl = linkMatch?.[1];
    
    const variant = detectImageVariant(fullMatch, src);
    const pairKey = generatePairKey(alt, linkUrl || '', slideIndex);
    
    candidates.push({
      src: normalizeImageUrl(src, baseUrl),
      alt,
      linkUrl: linkUrl ? normalizeUrl(linkUrl, baseUrl) : undefined,
      variant,
      pairKey,
      slideIndex,
      context,
    });
  }
}

function detectImageVariant(imgTag: string, src: string): 'desktop' | 'mobile' | 'unknown' {
  const mobilePatterns = [
    /class="[^"]*(?:mobile|sm:|md:|small|hidden-desktop|visible-mobile|--mobile|_mobile)[^"]*"/i,
    /data-(?:mobile|small)-src/i,
    /srcset="[^"]*\s(?:3[0-9]{2}|4[0-9]{2}|5[0-9]{2}|6[0-9]{2})w/i, // 300-699w
    /_mobile\./i,
    /-mobile\./i,
    /_sm\./i,
    /-sm\./i,
  ];
  
  const desktopPatterns = [
    /class="[^"]*(?:desktop|lg:|xl:|large|hidden-mobile|visible-desktop|--desktop|_desktop)[^"]*"/i,
    /data-(?:desktop|large)-src/i,
    /srcset="[^"]*\s(?:1[2-9][0-9]{2}|[2-9][0-9]{3})w/i, // 1200w+
    /_desktop\./i,
    /-desktop\./i,
    /_lg\./i,
    /-lg\./i,
  ];
  
  for (const pattern of mobilePatterns) {
    if (pattern.test(imgTag) || pattern.test(src)) return 'mobile';
  }
  
  for (const pattern of desktopPatterns) {
    if (pattern.test(imgTag) || pattern.test(src)) return 'desktop';
  }
  
  return 'unknown';
}

function generatePairKey(alt: string, linkUrl: string, slideIndex: number): string {
  // Use combination of alt text, link URL, and slide index to pair images
  const cleanAlt = alt.toLowerCase().replace(/\s+/g, '-').substring(0, 30);
  const cleanLink = linkUrl.replace(/https?:\/\/[^/]+/, '').substring(0, 50);
  return `${slideIndex}-${cleanAlt}-${cleanLink}`;
}

function getLinkFromContext(html: string, imgIndex: number): string | null {
  // Look backwards from the image position to find a wrapping <a> tag
  const contextStart = Math.max(0, imgIndex - 500);
  const contextHtml = html.substring(contextStart, imgIndex + 200);
  
  // Find the closest <a> that wraps this image
  const linkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>[^<]*$/i.exec(contextHtml.substring(0, imgIndex - contextStart));
  return linkMatch?.[1] || null;
}

function pairBannerCandidates(candidates: BannerCandidate[]): ExtractedBanner[] {
  const banners: ExtractedBanner[] = [];
  const processed = new Set<number>();
  
  // Group by slideIndex first (strongest pairing signal)
  const bySlide = new Map<number, BannerCandidate[]>();
  for (const candidate of candidates) {
    const existing = bySlide.get(candidate.slideIndex) || [];
    existing.push(candidate);
    bySlide.set(candidate.slideIndex, existing);
  }
  
  for (const [slideIdx, slideCandidates] of bySlide) {
    if (slideCandidates.length === 0) continue;
    
    // If we have exactly 2 images in the same slide, likely desktop/mobile pair
    if (slideCandidates.length === 2) {
      const [first, second] = slideCandidates;
      
      // Determine which is desktop and which is mobile
      let desktop: BannerCandidate;
      let mobile: BannerCandidate | undefined;
      
      if (first.variant === 'desktop' && second.variant === 'mobile') {
        desktop = first;
        mobile = second;
      } else if (first.variant === 'mobile' && second.variant === 'desktop') {
        desktop = second;
        mobile = first;
      } else {
        // Both unknown - use URL heuristics (larger dimension hints = desktop)
        desktop = first;
        mobile = second;
      }
      
      banners.push({
        imageDesktop: desktop.src,
        imageMobile: mobile?.src,
        linkUrl: desktop.linkUrl || mobile?.linkUrl,
        altText: desktop.alt || mobile?.alt,
      });
      
      processed.add(candidates.indexOf(first));
      processed.add(candidates.indexOf(second));
    }
    // If we have just 1 image, use it (with same image for both variants if needed)
    else if (slideCandidates.length === 1) {
      const single = slideCandidates[0];
      banners.push({
        imageDesktop: single.src,
        imageMobile: undefined, // Will use desktop as fallback
        linkUrl: single.linkUrl,
        altText: single.alt,
      });
      processed.add(candidates.indexOf(single));
    }
    // If more than 2, try to pair by variant
    else {
      const desktops = slideCandidates.filter(c => c.variant === 'desktop');
      const mobiles = slideCandidates.filter(c => c.variant === 'mobile');
      const unknowns = slideCandidates.filter(c => c.variant === 'unknown');
      
      // Pair desktops with mobiles
      const maxPairs = Math.max(desktops.length, mobiles.length, Math.ceil(unknowns.length / 2));
      for (let i = 0; i < maxPairs; i++) {
        const desktop = desktops[i] || unknowns[i * 2];
        const mobile = mobiles[i] || unknowns[i * 2 + 1];
        
        if (desktop) {
          banners.push({
            imageDesktop: desktop.src,
            imageMobile: mobile?.src,
            linkUrl: desktop.linkUrl || mobile?.linkUrl,
            altText: desktop.alt || mobile?.alt,
          });
          if (desktop) processed.add(candidates.indexOf(desktop));
          if (mobile) processed.add(candidates.indexOf(mobile));
        }
      }
    }
  }
  
  // Add any remaining unprocessed candidates as individual banners
  for (let i = 0; i < candidates.length; i++) {
    if (!processed.has(i)) {
      const candidate = candidates[i];
      banners.push({
        imageDesktop: candidate.src,
        imageMobile: undefined,
        linkUrl: candidate.linkUrl,
        altText: candidate.alt,
      });
    }
  }
  
  // Deduplicate by desktop image URL
  const seen = new Set<string>();
  return banners.filter(b => {
    if (seen.has(b.imageDesktop)) return false;
    seen.add(b.imageDesktop);
    return true;
  });
}

// extractBannersFromSection removed - replaced by pairBannerCandidates logic

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

  // Helper to convert external URL to internal format
  const convertToInternalUrl = (href: string): string | undefined => {
    const categoryMatch = /\/(?:collections|categoria|category|c)\/([^/?#]+)/i.exec(href);
    if (categoryMatch) return `/categoria/${categoryMatch[1]}`;
    const pageMatch = /\/(?:pages?|pagina)\/([^/?#]+)/i.exec(href);
    if (pageMatch) return `/pagina/${pageMatch[1]}`;
    const blogMatch = /\/(?:blogs?|artigos?)(?:\/([^/?#]+))?/i.exec(href);
    if (blogMatch) return blogMatch[1] ? `/blog/${blogMatch[1]}` : '/blog';
    const productMatch = /\/(?:products?|produto)\/([^/?#]+)/i.exec(href);
    if (productMatch) return `/produto/${productMatch[1]}`;
    return undefined;
  };

  const getItemType = (href: string): 'link' | 'category' | 'page' => {
    if (/\/(?:collections|categoria|category|c)\//i.test(href)) return 'category';
    if (/\/(?:pages?|pagina|blogs?|artigos?)\//i.test(href)) return 'page';
    return 'link';
  };

  const skipPatterns = ['javascript:', '#', 'mailto:', 'tel:', 'whatsapp'];
  const skipLabels = ['carrinho', 'cart', 'login', 'entrar', 'sair', 'logout', 'buscar', 'search', 'minha conta', 'my account', 'conta', 'pesquisar', 'wishlist', 'lista de desejos', 'atendimento', 'fale conosco'];

  const shouldSkip = (href: string, label: string) => {
    if (!label || label.length < 2) return true;
    if (skipPatterns.some(p => href.toLowerCase().includes(p))) return true;
    if (skipLabels.some(l => label.toLowerCase() === l)) return true;
    return false;
  };
  
  const isDuplicate = (label: string) => addedLabels.has(label.toLowerCase().trim());
  const markAdded = (label: string) => addedLabels.add(label.toLowerCase().trim());

  const normalizeUrl = (href: string): string => {
    if (!href || href === '#') return '';
    if (href.startsWith('http')) return href;
    return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
  };

  console.log('Starting menu extraction for platform:', platform);

  // ===== FIND HEADER/NAV HTML =====
  const headerPatterns = [
    /<header[^>]*id="[^"]*header[^"]*"[^>]*>([\s\S]*?)<\/header>/gi,
    /<header[^>]*class="[^"]*header[^"]*"[^>]*>([\s\S]*?)<\/header>/gi,
    /<header[^>]*>([\s\S]*?)<\/header>/gi,
    /<nav[^>]*class="[^"]*(?:main|primary|site|header|mega)[^"]*nav[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
    /<nav[^>]*id="[^"]*(?:nav|menu|header)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
    /<div[^>]*class="[^"]*(?:header-nav|main-nav|site-nav|mega-menu|navigation)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  let headerHtml = '';
  for (const pattern of headerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (match[1].length > headerHtml.length && match[1].length < 100000) {
        headerHtml = match[1];
      }
    }
  }

  if (!headerHtml) {
    const fallbackNav = /<nav[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
    if (fallbackNav) headerHtml = fallbackNav[1];
  }

  if (!headerHtml) {
    console.log('No header/nav HTML found');
    return menuItems;
  }

  console.log('Found header HTML, length:', headerHtml.length);

  // ===== NEW APPROACH: Find the TOP-LEVEL menu container first =====
  // Look for the main horizontal navigation bar - it usually contains the parent items
  
  // Strategy: Find <ul> that directly contains the main menu items
  // Main menu items are typically direct <li> children of the main <ul>
  
  const mainMenuPatterns = [
    // Shopify patterns
    /<ul[^>]*class="[^"]*(?:header__inline-menu|site-nav|main-menu|primary-menu|menu-list|mega-menu__list|header-menu|navigation-menu|nav-menu)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
    // Generic patterns
    /<nav[^>]*>\s*<ul[^>]*>([\s\S]*?)<\/ul>\s*<\/nav>/gi,
    /<ul[^>]*class="[^"]*menu[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
  ];

  let mainMenuHtml = '';
  for (const pattern of mainMenuPatterns) {
    let match;
    while ((match = pattern.exec(headerHtml)) !== null) {
      // Check if this contains navigation-like links
      const linkCount = (match[1].match(/<a[^>]*href/gi) || []).length;
      if (linkCount >= 3 && match[1].length > mainMenuHtml.length && match[1].length < 50000) {
        mainMenuHtml = match[1];
        console.log(`Found main menu HTML with ${linkCount} links, length: ${match[1].length}`);
      }
    }
  }

  if (!mainMenuHtml) {
    mainMenuHtml = headerHtml;
    console.log('Using full header as menu source');
  }

  // ===== STRATEGY 1: Parse top-level <li> items directly =====
  // This is the key change: we look for DIRECT children of the main menu
  // Top-level items are <li> at the first level, their children are nested <ul> or <div>
  
  // Split by top-level <li> tags - we need to handle nested <li> carefully
  const topLevelItems: { fullHtml: string; }[] = [];
  
  // Use a more careful approach: find <li> that are at the top level
  // by tracking nesting depth
  let depth = 0;
  let currentItem = '';
  let inLi = false;
  const chars = mainMenuHtml.split('');
  let i = 0;
  
  while (i < chars.length) {
    const remaining = mainMenuHtml.slice(i);
    
    // Check for opening <li
    if (remaining.match(/^<li[\s>]/i)) {
      if (depth === 0 && !inLi) {
        // Start of a new top-level item
        if (currentItem.trim()) {
          topLevelItems.push({ fullHtml: currentItem });
        }
        currentItem = '';
        inLi = true;
      }
      depth++;
      
      // Find end of this tag
      const tagEnd = remaining.indexOf('>');
      if (tagEnd > 0) {
        currentItem += remaining.slice(0, tagEnd + 1);
        i += tagEnd + 1;
        continue;
      }
    }
    
    // Check for closing </li>
    if (remaining.match(/^<\/li>/i)) {
      currentItem += '</li>';
      depth--;
      if (depth === 0) {
        topLevelItems.push({ fullHtml: currentItem });
        currentItem = '';
        inLi = false;
      }
      i += 5;
      continue;
    }
    
    // Check for nested <ul> or </ul> - adjust depth tracking
    if (remaining.match(/^<ul[\s>]/i)) {
      const tagEnd = remaining.indexOf('>');
      if (tagEnd > 0) {
        currentItem += remaining.slice(0, tagEnd + 1);
        i += tagEnd + 1;
        continue;
      }
    }
    
    if (remaining.match(/^<\/ul>/i)) {
      currentItem += '</ul>';
      i += 5;
      continue;
    }
    
    currentItem += chars[i];
    i++;
  }
  
  // Don't forget the last item
  if (currentItem.trim() && inLi) {
    topLevelItems.push({ fullHtml: currentItem });
  }
  
  console.log(`Found ${topLevelItems.length} potential top-level menu items`);

  // ===== Process each top-level item =====
  for (const item of topLevelItems) {
    const itemHtml = item.fullHtml;
    
    // Get the FIRST link in this item - that's the parent/main menu item
    const firstLinkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(itemHtml);
    
    // Also check for <details><summary> pattern (modern Shopify)
    const summaryMatch = /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(itemHtml);
    
    let parentLabel = '';
    let parentUrl = '';
    
    if (summaryMatch) {
      // Get text from summary
      parentLabel = summaryMatch[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      // Try to find a link inside or after summary
      const linkInSummary = /<a[^>]*href=["']([^"']+)["']/i.exec(summaryMatch[1]);
      if (linkInSummary) {
        parentUrl = normalizeUrl(linkInSummary[1]);
      }
    }
    
    if (!parentLabel && firstLinkMatch) {
      parentLabel = firstLinkMatch[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      parentUrl = normalizeUrl(firstLinkMatch[1]);
    }
    
    if (!parentLabel || shouldSkip(parentUrl || '#', parentLabel) || isDuplicate(parentLabel)) {
      continue;
    }
    
    // ===== Now look for children (submenu) =====
    const children: ExtractedMenuItem[] = [];
    
    // Remove the first link/summary from consideration for children
    let childSearchHtml = itemHtml;
    if (firstLinkMatch) {
      childSearchHtml = itemHtml.replace(firstLinkMatch[0], '');
    }
    if (summaryMatch) {
      childSearchHtml = childSearchHtml.replace(summaryMatch[0], '');
    }
    
    // Find nested <ul> or submenu containers
    const submenuPatterns = [
      /<ul[^>]*>([\s\S]*?)<\/ul>/gi,
      /<div[^>]*class="[^"]*(?:sub|drop|mega|child|menu-list|submenu)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];
    
    for (const subPattern of submenuPatterns) {
      let subMatch;
      subPattern.lastIndex = 0;
      
      while ((subMatch = subPattern.exec(childSearchHtml)) !== null) {
        const submenuContent = subMatch[1];
        
        // Find all links in this submenu
        const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let linkMatch;
        
        while ((linkMatch = linkPattern.exec(submenuContent)) !== null) {
          const [, href, rawLabelHtml] = linkMatch;
          const label = rawLabelHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          
          if (shouldSkip(href, label)) continue;
          // Skip if same as parent
          if (label.toLowerCase() === parentLabel.toLowerCase()) continue;
          // Skip duplicates within children
          if (children.some(c => c.label.toLowerCase() === label.toLowerCase())) continue;
          
          children.push({
            label,
            url: normalizeUrl(href),
            internalUrl: convertToInternalUrl(href),
            type: getItemType(href),
          });
        }
      }
    }
    
    // Add the parent item with its children
    menuItems.push({
      label: parentLabel,
      url: parentUrl,
      internalUrl: convertToInternalUrl(parentUrl),
      type: getItemType(parentUrl),
      children: children.length > 0 ? children : undefined,
    });
    markAdded(parentLabel);
    
    console.log(`Menu item: "${parentLabel}" with ${children.length} children`);
  }

  // ===== FALLBACK: If no items found, try simpler approach =====
  if (menuItems.length === 0) {
    console.log('No items via top-level parsing, trying fallback...');
    
    // Look for direct navigation links
    const navLinkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*class="[^"]*(?:nav|menu|header)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = navLinkPattern.exec(headerHtml)) !== null) {
      const [, href, rawLabel] = match;
      const label = rawLabel.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (shouldSkip(href, label) || isDuplicate(label)) continue;
      
      menuItems.push({
        label,
        url: normalizeUrl(href),
        internalUrl: convertToInternalUrl(href),
        type: getItemType(href),
      });
      markAdded(label);
    }
  }

  // ===== SECOND FALLBACK: Look for any prominent links in header =====
  if (menuItems.length < 3) {
    console.log('Still too few items, trying broader search...');
    
    const allLinksPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = allLinksPattern.exec(headerHtml)) !== null) {
      const [, href, rawLabel] = match;
      const label = rawLabel.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (shouldSkip(href, label) || isDuplicate(label)) continue;
      if (label.length > 40) continue; // Skip very long labels (likely not menu items)
      
      menuItems.push({
        label,
        url: normalizeUrl(href),
        internalUrl: convertToInternalUrl(href),
        type: getItemType(href),
      });
      markAdded(label);
      
      if (menuItems.length >= 15) break;
    }
  }

  console.log('Final menu extraction:', menuItems.length, 'items,', menuItems.filter(m => m.children && m.children.length > 0).length, 'with children');
  return menuItems.slice(0, 25);
}

// =============================================
// FOOTER MENU EXTRACTION
// =============================================
function extractFooterMenuItems(html: string, baseUrl: string, platform?: string): ExtractedMenuItem[] {
  const menuItems: ExtractedMenuItem[] = [];
  const addedLabels = new Set<string>();
  
  // Helper to convert external URL to internal format
  const convertToInternalUrl = (href: string): string | undefined => {
    const categoryMatch = /\/(?:collections|categoria|category|c)\/([^/?#]+)/i.exec(href);
    if (categoryMatch) return `/categoria/${categoryMatch[1]}`;
    const pageMatch = /\/(?:pages?|pagina)\/([^/?#]+)/i.exec(href);
    if (pageMatch) return `/pagina/${pageMatch[1]}`;
    const blogMatch = /\/(?:blogs?|artigos?)(?:\/([^/?#]+))?/i.exec(href);
    if (blogMatch) return blogMatch[1] ? `/blog/${blogMatch[1]}` : '/blog';
    const productMatch = /\/(?:products?|produto)\/([^/?#]+)/i.exec(href);
    if (productMatch) return `/produto/${productMatch[1]}`;
    return undefined;
  };

  const getItemType = (href: string): 'link' | 'category' | 'page' => {
    if (/\/(?:collections|categoria|category|c)\//i.test(href)) return 'category';
    if (/\/(?:pages?|pagina|blogs?|artigos?|policies)\//i.test(href)) return 'page';
    return 'link';
  };

  const skipPatterns = ['javascript:', '#', 'mailto:', 'tel:', 'whatsapp'];
  const skipLabels = ['carrinho', 'cart', 'login', 'entrar', 'sair', 'logout', 'buscar', 'search', 'minha conta', 'my account', 'conta', 'pesquisar', 'wishlist', 'lista de desejos'];

  const shouldSkip = (href: string, label: string) => {
    if (!label || label.length < 2 || addedLabels.has(label.toLowerCase())) return true;
    if (skipPatterns.some(p => href.toLowerCase().includes(p))) return true;
    if (skipLabels.some(l => label.toLowerCase() === l)) return true;
    return false;
  };

  console.log('Starting footer menu extraction...');

  // Find footer HTML
  const footerPatterns = [
    /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
    /<div[^>]*id="?(?:footer|shopify-section-footer)"?[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*(?=<\/body>|$)/gi,
    /<div[^>]*class="[^"]*(?:footer|Footer|site-footer)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class="[^"]*(?:footer|Footer)[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
  ];

  let footerHtml = '';
  for (const pattern of footerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (match[1].length > footerHtml.length) {
        footerHtml = match[1];
      }
    }
  }

  if (!footerHtml) {
    console.log('No footer HTML found');
    return menuItems;
  }

  console.log('Found footer HTML, length:', footerHtml.length);

  // STRATEGY 1: Look for menu sections in footer (labeled sections like "MENU", "POLITICAS", etc.)
  // Shopify footers often have divs with headings followed by lists
  const sectionPatterns = [
    // Look for heading followed by list or links
    /<(?:h[2-6]|p|span)[^>]*class="[^"]*(?:title|heading|footer-title|widget-title)[^"]*"[^>]*>([^<]+)<\/(?:h[2-6]|p|span)>\s*(?:<(?:nav|div|ul)[^>]*>)?([\s\S]*?)(?=<(?:h[2-6]|p|span)[^>]*class="[^"]*(?:title|heading|footer-title|widget-title)|<\/(?:footer|section)|$)/gi,
    // Simpler pattern: any heading followed by links
    /<(?:h[2-6]|strong|b)[^>]*>([^<]+)<\/(?:h[2-6]|strong|b)>\s*([\s\S]*?)(?=<(?:h[2-6]|strong|b)[^>]*>|<\/(?:footer|section|div)>\s*<\/(?:footer|section)|$)/gi,
    // Footer column divs
    /<div[^>]*class="[^"]*(?:footer-col|footer-column|footer-block|footer-menu|footer-widget)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  // Try to extract labeled sections
  for (let patternIndex = 0; patternIndex < 2; patternIndex++) {
    const pattern = sectionPatterns[patternIndex];
    let match;
    
    while ((match = pattern.exec(footerHtml)) !== null) {
      const sectionTitle = (patternIndex < 2 ? match[1] : '').replace(/<[^>]*>/g, '').trim();
      const sectionContent = patternIndex < 2 ? match[2] : match[1];
      
      if (!sectionContent) continue;
      
      // Skip if this looks like contact/social section
      if (/(?:contato|contact|social|redes|sobre|about|telefone|email|endereço|newsletter|inscrev)/i.test(sectionTitle)) {
        continue;
      }
      
      // Extract links from this section
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*?)<\/a>/gi;
      const sectionItems: ExtractedMenuItem[] = [];
      let linkMatch;
      
      while ((linkMatch = linkPattern.exec(sectionContent)) !== null) {
        const [, href, rawLabel] = linkMatch;
        const label = rawLabel.replace(/<[^>]*>/g, '').trim();
        
        if (shouldSkip(href, label)) continue;
        if (sectionItems.some(i => i.label.toLowerCase() === label.toLowerCase())) continue;
        
        const normalizedUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
        sectionItems.push({
          label,
          url: normalizedUrl,
          internalUrl: convertToInternalUrl(href),
          type: getItemType(href),
        });
      }
      
      if (sectionItems.length > 0) {
        // Check if this section title should become a parent menu item
        if (sectionTitle && sectionTitle.length > 1 && !addedLabels.has(sectionTitle.toLowerCase())) {
          menuItems.push({
            label: sectionTitle,
            url: '#',
            type: 'link',
            children: sectionItems,
          });
          addedLabels.add(sectionTitle.toLowerCase());
          sectionItems.forEach(item => addedLabels.add(item.label.toLowerCase()));
          console.log(`Found footer section: ${sectionTitle} with ${sectionItems.length} items`);
        } else {
          // Add items directly without parent
          for (const item of sectionItems) {
            if (!addedLabels.has(item.label.toLowerCase())) {
              menuItems.push(item);
              addedLabels.add(item.label.toLowerCase());
            }
          }
        }
      }
    }
    
    if (menuItems.length > 0) break;
  }

  // STRATEGY 2: Fallback - extract all links from footer
  if (menuItems.length === 0) {
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*?)<\/a>/gi;
    let match;
    
    while ((match = linkPattern.exec(footerHtml)) !== null) {
      const [, href, rawLabel] = match;
      const label = rawLabel.replace(/<[^>]*>/g, '').trim();
      
      // Only include pages/policies links in footer
      if (!/(\/pages?\/|\/policies\/|\/blogs?\/|\/sobre|\/contato|\/faq|\/perguntas|\/politica|\/termos|\/garantia|\/troca)/i.test(href)) {
        continue;
      }
      
      if (shouldSkip(href, label)) continue;
      
      const normalizedUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
      
      menuItems.push({
        label,
        url: normalizedUrl,
        internalUrl: convertToInternalUrl(href),
        type: getItemType(href),
      });
      
      addedLabels.add(label.toLowerCase());
    }
  }

  console.log('Final footer menu extraction result:', menuItems.length, 'items');
  return menuItems.slice(0, 30);
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
// Extract institutional pages from footer links, header, nav, and Shopify standard policies
// Improved: finds pages from multiple sources including sitemap, menus, and all internal links
function extractInstitutionalPages(html: string, baseUrl: string, platform?: string): ExtractedInstitutionalPage[] {
  const pages: ExtractedInstitutionalPage[] = [];
  const addedSlugs = new Set<string>();
  const processedUrls = new Set<string>();

  // Core routes to SKIP (not institutional pages)
  const skipPatterns = [
    '/collections', '/products', '/cart', '/checkout', '/account', '/login',
    '/search', '/register', '/wishlist', 
    'javascript:', 'mailto:', 'tel:', 'whatsapp', '#', '/cdn/', '/apps/',
    'facebook.com', 'instagram.com', 'twitter.com', 'youtube.com', 'linkedin.com', 
    'pinterest.com', 'tiktok.com', 'wa.me', 'api.whatsapp.com', '/blogs/',
    '/assets/', '/files/', '.jpg', '.png', '.gif', '.webp', '.svg', '.pdf',
  ];

  const shouldSkip = (href: string): boolean => {
    const lowerHref = href.toLowerCase();
    // Skip external links (different domain) unless it's relative
    if (href.startsWith('http') && !href.includes(new URL(baseUrl).hostname)) return true;
    // Skip core routes and social media
    if (skipPatterns.some(p => lowerHref.includes(p))) return true;
    // Skip home page
    if (/^https?:\/\/[^/]+\/?$/.test(href) || href === '/' || href === '') return true;
    // Skip already processed URLs
    const cleanUrl = href.split('?')[0].replace(/\/$/, '').toLowerCase();
    if (processedUrls.has(cleanUrl)) return true;
    processedUrls.add(cleanUrl);
    return false;
  };

  const extractSlug = (href: string): string | null => {
    // Remove UTM and tracking params
    const cleanHref = href.split('?')[0].replace(/\/$/, '');
    
    // Match Shopify policies
    const policyMatch = /\/policies\/([^/?#]+)/i.exec(cleanHref);
    if (policyMatch) return policyMatch[1];
    
    // Match /pages/slug or /page/slug
    const pageMatch = /\/(?:pages?|pagina)\/([^/?#]+)/i.exec(cleanHref);
    if (pageMatch) return pageMatch[1];
    
    return null;
  };

  const extractTitle = (rawLabel: string): string => {
    return rawLabel.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  };

  const addPage = (href: string, rawLabel: string, source: 'footer' | 'header' | 'sitemap' | 'global') => {
    if (shouldSkip(href)) return;
    
    const slug = extractSlug(href);
    if (!slug || addedSlugs.has(slug.toLowerCase())) return;
    
    const title = extractTitle(rawLabel);
    if (!title || title.length < 2) return;
    
    // Clean URL - remove UTM params
    let cleanUrl = href.split('?')[0];
    if (!cleanUrl.startsWith('http')) {
      // Only add baseUrl if it's not empty, otherwise skip this page
      if (!baseUrl) {
        console.warn(`Skipping page ${slug}: relative URL "${cleanUrl}" but no baseUrl available`);
        return;
      }
      cleanUrl = `${baseUrl}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
    }
    
    // Validate the final URL
    try {
      new URL(cleanUrl);
    } catch (e) {
      console.warn(`Skipping page ${slug}: invalid URL "${cleanUrl}"`);
      return;
    }
    
    pages.push({ 
      title, 
      slug: slug.toLowerCase(), 
      url: cleanUrl, 
      source 
    });
    addedSlugs.add(slug.toLowerCase());
    console.log(`Found institutional page: ${title} -> ${slug} (${cleanUrl})`);
  };

  // Link extraction pattern
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*?)<\/a>/gi;

  // ===== STRATEGY 1: Extract from header/nav =====
  const headerPatterns = [
    /<header[^>]*>([\s\S]*?)<\/header>/gi,
    /<nav[^>]*class="[^"]*(?:main|primary|site|header)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
    /<div[^>]*class="[^"]*(?:header|navigation|main-nav)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const headerPattern of headerPatterns) {
    let headerMatch;
    while ((headerMatch = headerPattern.exec(html)) !== null) {
      let linkMatch;
      const tempPattern = new RegExp(linkPattern.source, 'gi');
      while ((linkMatch = tempPattern.exec(headerMatch[1])) !== null) {
        const [, href, rawLabel] = linkMatch;
        if (/\/(?:pages?|policies)\//i.test(href)) {
          addPage(href, rawLabel, 'header');
        }
      }
    }
  }

  // ===== STRATEGY 2: Extract from footer =====
  const footerPatterns = [
    /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
    /<div[^>]*class="[^"]*(?:footer|Footer|site-footer)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*)*(?=<\/body>|$)/gi,
    /<section[^>]*class="[^"]*(?:footer|Footer)[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*id="?(?:footer|shopify-section-footer)"?[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const footerPattern of footerPatterns) {
    let footerMatch;
    while ((footerMatch = footerPattern.exec(html)) !== null) {
      let linkMatch;
      const tempPattern = new RegExp(linkPattern.source, 'gi');
      while ((linkMatch = tempPattern.exec(footerMatch[1])) !== null) {
        const [, href, rawLabel] = linkMatch;
        if (/\/(?:pages?|policies)\//i.test(href)) {
          addPage(href, rawLabel, 'footer');
        }
      }
    }
  }

  // ===== STRATEGY 3: Add Shopify standard policy pages (always for Shopify stores) =====
  const isShopify = platform === 'Shopify' || html.includes('Shopify') || html.includes('shopify') || html.includes('cdn.shopify');
  if (isShopify) {
    const shopifyPolicies = [
      { slug: 'privacy-policy', title: 'Política de Privacidade', path: '/policies/privacy-policy' },
      { slug: 'refund-policy', title: 'Política de Reembolso', path: '/policies/refund-policy' },
      { slug: 'terms-of-service', title: 'Termos de Serviço', path: '/policies/terms-of-service' },
      { slug: 'shipping-policy', title: 'Política de Frete', path: '/policies/shipping-policy' },
    ];
    
    for (const policy of shopifyPolicies) {
      if (!addedSlugs.has(policy.slug)) {
        pages.push({
          title: policy.title,
          slug: policy.slug,
          url: `${baseUrl}${policy.path}`,
          source: 'sitemap',
        });
        addedSlugs.add(policy.slug);
        console.log(`Added Shopify policy: ${policy.title}`);
      }
    }
  }

  // ===== STRATEGY 4: Search ENTIRE HTML for ALL /pages/ and /policies/ links =====
  // Reset pattern to start from beginning
  const globalPagePattern = /<a[^>]*href=["']([^"']*\/(?:pages?|policies)\/[^"'?#]+)[^"']*["'][^>]*>([^<]*(?:<[^/][^>]*>[^<]*)*?)<\/a>/gi;
  let linkMatch;
  
  while ((linkMatch = globalPagePattern.exec(html)) !== null) {
    const [, href, rawLabel] = linkMatch;
    addPage(href, rawLabel, 'global');
  }

  // ===== STRATEGY 5: Look for menu data in JSON (Shopify themes often embed this) =====
  const jsonMenuPatterns = [
    /"links"\s*:\s*\[([\s\S]*?)\]/gi,
    /"menu"\s*:\s*\[([\s\S]*?)\]/gi,
  ];

  for (const pattern of jsonMenuPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      // Extract URLs from the JSON-like structure
      const urlMatches = match[1].matchAll(/"(?:url|href)"\s*:\s*"([^"]*\/(?:pages?|policies)\/[^"]+)"/gi);
      const titleMatches = match[1].matchAll(/"(?:title|label|name)"\s*:\s*"([^"]+)"/gi);
      
      const urls = Array.from(urlMatches).map(m => m[1]);
      const titles = Array.from(titleMatches).map(m => m[1]);
      
      urls.forEach((url, i) => {
        const title = titles[i] || extractSlug(url) || 'Página';
        addPage(url, title, 'sitemap');
      });
    }
  }

  // ===== STRATEGY 6: Look for sitemap links if available in the HTML =====
  // Some themes include sitemap data or links to sitemap
  const sitemapLinksPattern = /<loc>([^<]*\/(?:pages?|policies)\/[^<]+)<\/loc>/gi;
  while ((linkMatch = sitemapLinksPattern.exec(html)) !== null) {
    const url = linkMatch[1];
    const slug = extractSlug(url);
    if (slug && !addedSlugs.has(slug.toLowerCase())) {
      // Generate title from slug
      const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      addPage(url, title, 'sitemap');
    }
  }

  // ===== STRATEGY 7: Common institutional page paths for Shopify =====
  // Try to find pages by common names that might exist
  const commonPageSlugs = [
    'sobre', 'sobre-nos', 'about', 'about-us', 'quem-somos',
    'contato', 'contact', 'fale-conosco',
    'faq', 'perguntas-frequentes', 'duvidas',
    'como-comprar', 'how-to-buy',
    'entrega', 'envio', 'shipping', 'frete',
    'troca', 'devolucao', 'trocas-e-devolucoes', 'returns',
    'garantia', 'warranty',
    'pagamento', 'formas-de-pagamento', 'payment',
    'rastreio', 'rastreamento', 'tracking', 'rastrear-pedido',
    'depoimentos', 'testimonials', 'feedback-clientes',
    'parceiros', 'partners',
    'trabalhe-conosco', 'careers', 'vagas',
  ];

  // Check if any of these common pages are referenced in the HTML
  for (const slug of commonPageSlugs) {
    if (addedSlugs.has(slug)) continue;
    
    // Check if this slug appears in any /pages/ link
    const slugPattern = new RegExp(`/pages/${slug}(?:[?#]|"|'|$)`, 'i');
    if (slugPattern.test(html)) {
      const title = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      if (!addedSlugs.has(slug)) {
        pages.push({
          title,
          slug,
          url: `${baseUrl}/pages/${slug}`,
          source: 'global',
        });
        addedSlugs.add(slug);
        console.log(`Found common page by pattern: ${title}`);
      }
    }
  }

  console.log(`Extracted ${pages.length} institutional pages total`);
  return pages;
}
