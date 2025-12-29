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

interface VisualExtractionResult {
  success: boolean;
  heroBanners: ExtractedBanner[];
  categories: ExtractedCategory[];
  menuItems: ExtractedMenuItem[];
  videos: ExtractedVideo[];
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
    videos: [],
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
    
    // Extract videos (YouTube, Vimeo, direct uploads)
    result.videos = extractVideos(html, baseUrl);
    
    // Extract other sections
    result.sections = extractSections(html, platform);
    
    // Extract branding
    result.branding = extractBranding(html, baseUrl);

    console.log('Extraction complete:', {
      banners: result.heroBanners.length,
      categories: result.categories.length,
      menuItems: result.menuItems.length,
      videos: result.videos.length,
      sections: result.sections.length,
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

  // Helper to convert external URL to internal format
  const convertToInternalUrl = (href: string): string | undefined => {
    // Extract category slug from URL patterns
    const categoryMatch = /\/(?:collections|categoria|category|c)\/([^/?#]+)/i.exec(href);
    if (categoryMatch) {
      return `/categoria/${categoryMatch[1]}`;
    }
    // Extract page slug
    const pageMatch = /\/(?:pages?|pagina)\/([^/?#]+)/i.exec(href);
    if (pageMatch) {
      return `/pagina/${pageMatch[1]}`;
    }
    // Blog
    const blogMatch = /\/(?:blogs?|artigos?)(?:\/([^/?#]+))?/i.exec(href);
    if (blogMatch) {
      return blogMatch[1] ? `/blog/${blogMatch[1]}` : '/blog';
    }
    // Product
    const productMatch = /\/(?:products?|produto)\/([^/?#]+)/i.exec(href);
    if (productMatch) {
      return `/produto/${productMatch[1]}`;
    }
    return undefined;
  };

  // Helper to determine item type from URL
  const getItemType = (href: string): 'link' | 'category' | 'page' => {
    if (/\/(?:collections|categoria|category|c)\//i.test(href)) {
      return 'category';
    } else if (/\/(?:pages?|pagina|blogs?|artigos?)\//i.test(href)) {
      return 'page';
    }
    return 'link';
  };

  // Find main navigation with dropdown structure
  const headerPatterns = [
    /<header[^>]*>([\s\S]*?)<\/header>/gi,
    /<nav[^>]*class="[^"]*(?:main|primary|site-nav|header)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
  ];

  let headerHtml = '';
  for (const pattern of headerPatterns) {
    const match = pattern.exec(html);
    if (match) {
      headerHtml = match[1];
      break;
    }
  }

  if (!headerHtml) {
    const fallbackNav = /<nav[^>]*>([\s\S]*?)<\/nav>/i.exec(html);
    if (fallbackNav) headerHtml = fallbackNav[1];
  }

  if (!headerHtml) return menuItems;

  // Look for dropdown/submenu structures first
  // Common patterns: ul > li > a + (ul.submenu|div.dropdown)
  const menuListPattern = /<(?:ul|nav)[^>]*class="[^"]*(?:menu|nav|navigation)[^"]*"[^>]*>([\s\S]*?)<\/(?:ul|nav)>/gi;
  
  let menuListMatch;
  while ((menuListMatch = menuListPattern.exec(headerHtml)) !== null) {
    const menuListHtml = menuListMatch[1];
    
    // Extract top-level menu items with potential submenus
    const topLevelPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    
    while ((liMatch = topLevelPattern.exec(menuListHtml)) !== null) {
      const liContent = liMatch[1];
      
      // Get the first link in this li (the parent item)
      const mainLinkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/a>/i.exec(liContent);
      if (!mainLinkMatch) continue;
      
      const [, href, rawLabel] = mainLinkMatch;
      const label = rawLabel.replace(/<[^>]*>/g, '').trim();
      
      if (!label || label.length < 2 || addedLabels.has(label.toLowerCase())) continue;
      
      // Skip utility links
      const skipPatterns = ['javascript:', '#', 'mailto:', 'tel:', 'whatsapp'];
      if (skipPatterns.some(p => href.toLowerCase().includes(p))) continue;
      const skipLabels = ['carrinho', 'cart', 'login', 'entrar', 'sair', 'logout', 'buscar', 'search', 'minha conta', 'my account', 'conta', 'pesquisar'];
      if (skipLabels.some(l => label.toLowerCase() === l)) continue;
      
      const normalizedUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
      const internalUrl = convertToInternalUrl(href);
      const itemType = getItemType(href);
      
      // Check for submenu/dropdown - multiple patterns to catch different e-commerce platforms
      const children: ExtractedMenuItem[] = [];
      const submenuPatterns = [
        // Shopify, Nuvemshop, WooCommerce patterns
        /<ul[^>]*class="[^"]*(?:submenu|dropdown|sub-menu|child|dropdown-menu|mega-menu|level1|sub-nav|submenu-list)[^"]*"[^>]*>([\s\S]*?)<\/ul>/i,
        /<div[^>]*class="[^"]*(?:dropdown|megamenu|sub-menu|dropdown-content|mega-content|submenu-container|nav-dropdown)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        // Nested UL directly within LI (common pattern)
        /<li[^>]*>\s*<a[^>]*>.*?<\/a>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i,
        // Any nested UL that's not the main menu
        /(?:<\/a>\s*)<ul[^>]*(?!class="[^"]*(?:main|primary|header)[^"]*")>([\s\S]*?)<\/ul>/i,
      ];
      
      for (const subPattern of submenuPatterns) {
        const submenuMatch = subPattern.exec(liContent);
        if (submenuMatch) {
          const submenuHtml = submenuMatch[1];
          
          // Try to match links - handle both simple <a> and <a> inside <li>
          const subLinkPatterns = [
            /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/a>/gi,
            /<li[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/a>/gi,
          ];
          
          for (const subLinkPattern of subLinkPatterns) {
            let subMatch;
            
            while ((subMatch = subLinkPattern.exec(submenuHtml)) !== null) {
              const [, subHref, subRawLabel] = subMatch;
              const subLabel = subRawLabel.replace(/<[^>]*>/g, '').trim();
              
              if (!subLabel || subLabel.length < 2) continue;
              if (skipPatterns.some(p => subHref.toLowerCase().includes(p))) continue;
              // Avoid duplicate children by checking existing children
              if (children.some(c => c.label.toLowerCase() === subLabel.toLowerCase())) continue;
              
              const subNormalizedUrl = subHref.startsWith('http') ? subHref : `${baseUrl}${subHref.startsWith('/') ? '' : '/'}${subHref}`;
              const subInternalUrl = convertToInternalUrl(subHref);
              const subItemType = getItemType(subHref);
              
              children.push({
                label: subLabel,
                url: subNormalizedUrl,
                internalUrl: subInternalUrl,
                type: subItemType,
              });
            }
          }
          
          if (children.length > 0) break;
        }
      }
      
      menuItems.push({
        label,
        url: normalizedUrl,
        internalUrl,
        type: itemType,
        children: children.length > 0 ? children : undefined,
      });
      
      addedLabels.add(label.toLowerCase());
    }
  }
  
  // If no structured menu found, fallback to flat link extraction
  if (menuItems.length === 0) {
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<[^>]*>[^<]*)*?)<\/a>/gi;
    let match;
    while ((match = linkPattern.exec(headerHtml)) !== null) {
      const [, href, rawLabel] = match;
      const label = rawLabel.replace(/<[^>]*>/g, '').trim();
      
      if (!label || label.length < 2 || addedLabels.has(label.toLowerCase())) continue;
      
      const skipPatterns = ['javascript:', '#', 'mailto:', 'tel:', 'whatsapp'];
      if (skipPatterns.some(p => href.toLowerCase().includes(p))) continue;
      const skipLabels = ['carrinho', 'cart', 'login', 'entrar', 'sair', 'logout', 'buscar', 'search', 'minha conta', 'my account', 'conta', 'pesquisar'];
      if (skipLabels.some(l => label.toLowerCase() === l)) continue;
      
      const normalizedUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
      const internalUrl = convertToInternalUrl(href);
      const itemType = getItemType(href);
      
      menuItems.push({
        label,
        url: normalizedUrl,
        internalUrl,
        type: itemType,
      });
      
      addedLabels.add(label.toLowerCase());
    }
  }

  return menuItems.slice(0, 20);
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
