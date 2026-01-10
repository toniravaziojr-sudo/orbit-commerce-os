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

interface ContactInfo {
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  cnpj?: string;
  legalName?: string;
  supportHours?: string;
}

interface SocialLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  twitter?: string;
  linkedin?: string;
  pinterest?: string;
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
  contactInfo: ContactInfo;
  socialLinks: SocialLinks;
  unsupportedSections: string[];
  error?: string;
}

// Fetch Shopify navigation menu via multiple strategies
async function fetchShopifyNavigation(baseUrl: string): Promise<ExtractedMenuItem[]> {
  console.log('=== FETCHING SHOPIFY NAVIGATION ===');
  console.log(`Base URL: ${baseUrl}`);
  
  // Strategy 1: Try to fetch the homepage with raw fetch to get full HTML including header
  try {
    console.log('Strategy 1: Fetching homepage directly...');
    const response = await fetch(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    
    if (response.ok) {
      const html = await response.text();
      console.log(`Fetched homepage HTML directly, length: ${html.length}`);
      
      // Extract menu from the raw HTML
      const menuItems = extractMenuFromRawHtml(html, baseUrl);
      if (menuItems.length > 0) {
        console.log(`Strategy 1 SUCCESS: Found ${menuItems.length} menu items`);
        return menuItems;
      }
    }
  } catch (e) {
    console.log('Strategy 1 failed:', e);
  }
  
  // Strategy 2: Try navigation JSON endpoints
  const jsonEndpoints = [
    `${baseUrl}/?view=navigation.json`,
    `${baseUrl}/pages/menu?view=json`,
  ];
  
  for (const endpoint of jsonEndpoints) {
    try {
      console.log(`Strategy 2: Trying JSON endpoint ${endpoint}`);
      const response = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          if (data.menu || data.items || data.linklist) {
            const items = data.menu || data.items || data.linklist?.links || [];
            const menuItems = parseShopifyMenuItems(items, baseUrl);
            if (menuItems.length > 0) {
              console.log(`Strategy 2 SUCCESS: Found ${menuItems.length} menu items from JSON`);
              return menuItems;
            }
          }
        } catch (e) {
          // Not valid JSON
        }
      }
    } catch (e) {
      console.log(`JSON endpoint failed: ${endpoint}`);
    }
  }
  
  console.log('All Shopify navigation strategies failed');
  return [];
}

// Extract menu from raw HTML with multiple approaches
function extractMenuFromRawHtml(html: string, baseUrl: string): ExtractedMenuItem[] {
  console.log('=== EXTRACTING MENU FROM RAW HTML ===');
  
  const menuItems: ExtractedMenuItem[] = [];
  const addedLabels = new Set<string>();
  
  // Skip patterns
  const skipPatterns = ['javascript:', '#', 'mailto:', 'tel:', 'whatsapp'];
  const skipLabels = ['carrinho', 'cart', 'login', 'entrar', 'sair', 'logout', 'buscar', 'search', 'minha conta', 'my account', 'conta', 'pesquisar', 'wishlist', 'lista de desejos', 'atendimento', 'fale conosco', 'meu perfil', 'rastrear pedido'];
  
  const shouldSkip = (href: string, label: string) => {
    if (!label || label.length < 2) return true;
    if (skipPatterns.some(p => href.toLowerCase().includes(p))) return true;
    if (skipLabels.some(l => label.toLowerCase() === l)) return true;
    return false;
  };
  
  const normalizeUrl = (href: string): string => {
    if (!href || href === '#') return '';
    if (href.startsWith('http')) return href;
    return `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`;
  };

  // ===== STRATEGY A: Look for menu-drawer / mobile-menu (usually contains full hierarchy) =====
  const drawerPatterns = [
    /<(?:menu-drawer|div)[^>]*(?:id|class)="[^"]*(?:menu-drawer|mobile-menu|drawer-menu|MenuDrawer|nav-drawer|navigation-drawer)[^"]*"[^>]*>([\s\S]*?)<\/(?:menu-drawer|div)>/gi,
    /<div[^>]*class="[^"]*(?:drawer|mobile-nav|offcanvas)[^"]*menu[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    /<nav[^>]*class="[^"]*(?:mobile|drawer)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
  ];
  
  let drawerHtml = '';
  for (const pattern of drawerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      if (match[1].length > drawerHtml.length && match[1].length < 100000) {
        drawerHtml = match[1];
        console.log(`Found drawer menu HTML, length: ${drawerHtml.length}`);
      }
    }
  }
  
  if (drawerHtml) {
    const drawerItems = parseHierarchicalMenu(drawerHtml, baseUrl, shouldSkip, normalizeUrl, addedLabels);
    if (drawerItems.length >= 3) {
      console.log(`Strategy A SUCCESS: Found ${drawerItems.length} items from drawer`);
      return drawerItems;
    }
  }
  
  // ===== STRATEGY B: Look for JSON menu data in script tags =====
  const jsonPatterns = [
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    /<script[^>]*type="application\/json"[^>]*data-[^>]*menu[^>]*>([\s\S]*?)<\/script>/gi,
    /"menu(?:Items)?"\s*:\s*(\[[\s\S]*?\])/gi,
    /"navigation"\s*:\s*(\{[\s\S]*?\})/gi,
    /window\.__[A-Z_]+\s*=\s*(\{[\s\S]*?\});/gi,
  ];
  
  for (const pattern of jsonPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      try {
        const jsonStr = match[1];
        // Try to parse and find menu items
        if (jsonStr.includes('"title"') || jsonStr.includes('"label"') || jsonStr.includes('"url"')) {
          const menuData = extractMenuFromJson(jsonStr, baseUrl);
          if (menuData.length >= 3) {
            console.log(`Strategy B SUCCESS: Found ${menuData.length} items from JSON`);
            return menuData;
          }
        }
      } catch (e) {
        // Continue trying
      }
    }
  }
  
  // ===== STRATEGY C: Parse header nav using improved pattern matching =====
  // Look for specific Shopify header patterns
  const headerPatterns = [
    /<header[^>]*class="[^"]*(?:header|Header|site-header)[^"]*"[^>]*>([\s\S]*?)<\/header>/gi,
    /<nav[^>]*class="[^"]*(?:header|Header|main|primary)[^"]*(?:nav|menu)[^"]*"[^>]*>([\s\S]*?)<\/nav>/gi,
    /<ul[^>]*class="[^"]*(?:header|Header)[^"]*(?:menu|nav)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
  ];
  
  for (const pattern of headerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const headerItems = parseHierarchicalMenu(match[1], baseUrl, shouldSkip, normalizeUrl, addedLabels);
      if (headerItems.length >= 3) {
        console.log(`Strategy C SUCCESS: Found ${headerItems.length} items from header`);
        return headerItems;
      }
    }
  }
  
  console.log('All raw HTML extraction strategies failed or found < 3 items');
  return menuItems;
}

// Parse hierarchical menu structure from HTML
function parseHierarchicalMenu(
  html: string, 
  baseUrl: string, 
  shouldSkip: (href: string, label: string) => boolean,
  normalizeUrl: (href: string) => string,
  addedLabels: Set<string>
): ExtractedMenuItem[] {
  const items: ExtractedMenuItem[] = [];
  
  // Find all top-level list items by looking for patterns that indicate menu items
  // Shopify themes often use: <li class="menu-item has-dropdown">
  
  // Pattern 1: <details> based menus (common in modern Shopify themes)
  const detailsPattern = /<details[^>]*>([\s\S]*?)<\/details>/gi;
  let detailsMatch;
  
  while ((detailsMatch = detailsPattern.exec(html)) !== null) {
    const detailsContent = detailsMatch[1];
    
    // Get summary (parent item)
    const summaryMatch = /<summary[^>]*>([\s\S]*?)<\/summary>/i.exec(detailsContent);
    if (!summaryMatch) continue;
    
    const summaryContent = summaryMatch[1];
    // Extract text, ignoring SVG and other elements
    let parentLabel = summaryContent
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Try to find a link in the summary for the parent URL
    const summaryLinkMatch = /<a[^>]*href=["']([^"']+)["'][^>]*>/i.exec(summaryContent);
    const parentUrl = summaryLinkMatch ? normalizeUrl(summaryLinkMatch[1]) : '';
    
    if (!parentLabel || parentLabel.length < 2 || addedLabels.has(parentLabel.toLowerCase())) continue;
    
    // Find children (links inside the details but outside summary)
    const childrenHtml = detailsContent.replace(summaryMatch[0], '');
    const children: ExtractedMenuItem[] = [];
    
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    
    while ((linkMatch = linkPattern.exec(childrenHtml)) !== null) {
      const [, href, rawLabel] = linkMatch;
      const label = rawLabel.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      if (shouldSkip(href, label)) continue;
      if (label.toLowerCase() === parentLabel.toLowerCase()) continue;
      if (children.some(c => c.label.toLowerCase() === label.toLowerCase())) continue;
      
      children.push({
        label,
        url: normalizeUrl(href),
        internalUrl: convertUrlToInternal(href),
        type: getUrlItemType(href),
      });
    }
    
    items.push({
      label: parentLabel,
      url: parentUrl,
      internalUrl: parentUrl ? convertUrlToInternal(parentUrl) : undefined,
      type: parentUrl ? getUrlItemType(parentUrl) : 'link',
      children: children.length > 0 ? children : undefined,
    });
    addedLabels.add(parentLabel.toLowerCase());
  }
  
  // If we found items with details pattern, return them
  if (items.length >= 3) {
    return items;
  }
  
  // Pattern 2: <li> with dropdown classes
  // Look for <li> elements that contain both a main link/button and a nested <ul>
  const liPattern = /<li[^>]*class="[^"]*(?:has-dropdown|has-submenu|menu-item-has-children|mega-menu-item|dropdown)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  
  while ((liMatch = liPattern.exec(html)) !== null) {
    const liContent = liMatch[1];
    
    // Get first link or button as parent
    const firstLinkMatch = /<(?:a|button)[^>]*(?:href=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/(?:a|button)>/i.exec(liContent);
    if (!firstLinkMatch) continue;
    
    const parentUrl = firstLinkMatch[1] ? normalizeUrl(firstLinkMatch[1]) : '';
    let parentLabel = firstLinkMatch[2]
      .replace(/<svg[\s\S]*?<\/svg>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!parentLabel || parentLabel.length < 2 || addedLabels.has(parentLabel.toLowerCase())) continue;
    
    // Find nested <ul> for children
    const nestedUlMatch = /<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(liContent.replace(firstLinkMatch[0], ''));
    const children: ExtractedMenuItem[] = [];
    
    if (nestedUlMatch) {
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let linkMatch;
      
      while ((linkMatch = linkPattern.exec(nestedUlMatch[1])) !== null) {
        const [, href, rawLabel] = linkMatch;
        const label = rawLabel.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        
        if (shouldSkip(href, label)) continue;
        if (label.toLowerCase() === parentLabel.toLowerCase()) continue;
        if (children.some(c => c.label.toLowerCase() === label.toLowerCase())) continue;
        
        children.push({
          label,
          url: normalizeUrl(href),
          internalUrl: convertUrlToInternal(href),
          type: getUrlItemType(href),
        });
      }
    }
    
    items.push({
      label: parentLabel,
      url: parentUrl,
      internalUrl: parentUrl ? convertUrlToInternal(parentUrl) : undefined,
      type: parentUrl ? getUrlItemType(parentUrl) : 'link',
      children: children.length > 0 ? children : undefined,
    });
    addedLabels.add(parentLabel.toLowerCase());
  }
  
  // If we found items with li pattern, return them
  if (items.length >= 3) {
    return items;
  }
  
  // Pattern 3: Simple link extraction as fallback (no hierarchy)
  const allLinksPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = allLinksPattern.exec(html)) !== null) {
    const [, href, rawLabel] = match;
    const label = rawLabel.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    if (shouldSkip(href, label)) continue;
    if (addedLabels.has(label.toLowerCase())) continue;
    if (label.length > 50) continue; // Skip very long labels
    
    // Only include navigation-like links (collections, pages, products)
    if (!/\/(collections|pages|products|categoria|pagina|produto)\//i.test(href)) continue;
    
    items.push({
      label,
      url: normalizeUrl(href),
      internalUrl: convertUrlToInternal(href),
      type: getUrlItemType(href),
    });
    addedLabels.add(label.toLowerCase());
    
    if (items.length >= 20) break;
  }
  
  return items;
}

// Extract menu items from JSON string
function extractMenuFromJson(jsonStr: string, baseUrl: string): ExtractedMenuItem[] {
  const items: ExtractedMenuItem[] = [];
  
  try {
    // Try to find menu arrays in the JSON
    const menuArrayPattern = /\[[\s\S]*?"(?:title|label)"[\s\S]*?\]/g;
    const matches = jsonStr.match(menuArrayPattern);
    
    if (matches) {
      for (const match of matches) {
        try {
          const arr = JSON.parse(match);
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item.title || item.label) {
                const label = item.title || item.label || item.name;
                const url = item.url || item.href || '';
                if (!label) continue;
                
                const normalizedUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
                
                const children: ExtractedMenuItem[] = [];
                if (item.links || item.children || item.items) {
                  const childItems = item.links || item.children || item.items;
                  for (const child of childItems) {
                    const childLabel = child.title || child.label || child.name;
                    const childUrl = child.url || child.href || '';
                    if (!childLabel) continue;
                    
                    const childNormalizedUrl = childUrl.startsWith('http') ? childUrl : `${baseUrl}${childUrl.startsWith('/') ? '' : '/'}${childUrl}`;
                    children.push({
                      label: childLabel,
                      url: childNormalizedUrl,
                      internalUrl: convertUrlToInternal(childUrl),
                      type: getUrlItemType(childUrl),
                    });
                  }
                }
                
                items.push({
                  label,
                  url: normalizedUrl,
                  internalUrl: convertUrlToInternal(url),
                  type: getUrlItemType(url),
                  children: children.length > 0 ? children : undefined,
                });
              }
            }
          }
        } catch (e) {
          // Continue
        }
      }
    }
  } catch (e) {
    console.log('Error parsing menu JSON:', e);
  }
  
  return items;
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
        JSON.stringify({ success: false, error: 'URL ou HTML é obrigatório', code: 'MISSING_INPUT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting visual elements from:', url || 'provided HTML');
    console.log('Detected platform:', platform);

    let result = extractVisualElements(html, url, platform);
    
    // CRITICAL: If menu extraction failed or found no items with hierarchy, try direct fetch
    const hasSubmenus = result.menuItems.some(item => item.children && item.children.length > 0);
    
    if ((result.menuItems.length < 3 || !hasSubmenus) && url) {
      console.log('=== MENU EXTRACTION INSUFFICIENT, TRYING DIRECT FETCH ===');
      console.log(`Current menu items: ${result.menuItems.length}, has submenus: ${hasSubmenus}`);
      
      // Try fetching the page directly to get full HTML including header
      try {
        const directFetchItems = await fetchShopifyNavigation(url);
        if (directFetchItems.length >= 3) {
          const newHasSubmenus = directFetchItems.some(item => item.children && item.children.length > 0);
          console.log(`Direct fetch found ${directFetchItems.length} items, has submenus: ${newHasSubmenus}`);
          
          if (directFetchItems.length > result.menuItems.length || (newHasSubmenus && !hasSubmenus)) {
            result.menuItems = directFetchItems;
            console.log('Replaced menu items with directly fetched items');
            
            // Also update footer menu
            if (result.footerMenuItems.length < 2) {
              result.footerMenuItems = directFetchItems.map(item => ({
                label: item.label,
                url: item.url,
                internalUrl: item.internalUrl,
                type: item.type,
                // No children for footer
              }));
            }
          }
        }
      } catch (e) {
        console.log('Direct fetch failed:', e);
      }
      
      // Also try Shopify-specific HTML extraction
      if (platform === 'shopify' || html?.includes('Shopify') || html?.includes('shopify')) {
        console.log('Trying Shopify-specific menu extraction from HTML...');
        const shopifyMenuItems = await extractShopifyMenuFromHtml(html, url);
        if (shopifyMenuItems.length > result.menuItems.length) {
          const shopifyHasSubmenus = shopifyMenuItems.some((item: ExtractedMenuItem) => item.children && item.children.length > 0);
          if (shopifyHasSubmenus || shopifyMenuItems.length > result.menuItems.length) {
            result.menuItems = shopifyMenuItems;
            console.log(`Found ${shopifyMenuItems.length} menu items from Shopify HTML extraction`);
          }
        }
      }
    }
    
    // Final log
    console.log('=== FINAL EXTRACTION RESULTS ===');
    console.log(`Extracted: ${result.heroBanners.length} banners, ${result.categories.length} categories, ${result.menuItems.length} menu items (${result.menuItems.filter(m => m.children && m.children.length > 0).length} with children), ${result.footerMenuItems.length} footer items`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting visual elements:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        code: 'EXTRACTION_ERROR',
        error: error instanceof Error ? error.message : 'Erro ao extrair elementos visuais' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    contactInfo: {},
    socialLinks: {},
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
    
    // Extract contact info and social links
    result.contactInfo = extractContactInfo(html);
    result.socialLinks = extractSocialLinks(html);
    
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
      hasContactInfo: Object.keys(result.contactInfo).length > 0,
      hasSocialLinks: Object.keys(result.socialLinks).length > 0,
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

// =====================================================
// EXTRACT CONTACT INFO (phone, email, address, CNPJ, etc)
// =====================================================
function extractContactInfo(html: string): ContactInfo {
  const contact: ContactInfo = {};
  
  // === PHONE EXTRACTION ===
  // Brazilian phone patterns
  const phonePatterns = [
    // With area code in parentheses: (11) 3000-0000 or (11) 99999-9999
    /\(?0?(\d{2})\)?\s*(\d{4,5})[-.\s]?(\d{4})/g,
    // WhatsApp links
    /wa\.me\/(\d{10,13})/gi,
    /api\.whatsapp\.com\/send\?phone=(\d{10,13})/gi,
    // Tel links
    /tel:[\s+]*([\d\s\-\(\)]+)/gi,
    // Formatted with country code
    /\+55\s*\(?(\d{2})\)?\s*(\d{4,5})[-.\s]?(\d{4})/g,
  ];
  
  // Look for phone in footer or contact sections first
  const footerHtml = extractFooterHtml(html);
  const contactSectionHtml = extractContactSectionHtml(html);
  const searchHtml = footerHtml + contactSectionHtml;
  
  for (const pattern of phonePatterns) {
    const match = pattern.exec(searchHtml || html);
    if (match) {
      // Normalize phone number
      const rawPhone = match[0].replace(/[^\d]/g, '');
      if (rawPhone.length >= 10) {
        if (!contact.phone) {
          // Format as (XX) XXXXX-XXXX
          if (rawPhone.length === 10) {
            contact.phone = `(${rawPhone.slice(0,2)}) ${rawPhone.slice(2,6)}-${rawPhone.slice(6)}`;
          } else if (rawPhone.length === 11) {
            contact.phone = `(${rawPhone.slice(0,2)}) ${rawPhone.slice(2,7)}-${rawPhone.slice(7)}`;
          } else if (rawPhone.length >= 12 && rawPhone.startsWith('55')) {
            const phone = rawPhone.slice(2);
            contact.phone = `(${phone.slice(0,2)}) ${phone.slice(2,7)}-${phone.slice(7)}`;
          }
        }
      }
    }
  }
  
  // === WHATSAPP EXTRACTION ===
  const whatsappPatterns = [
    /wa\.me\/(\d{10,13})/gi,
    /api\.whatsapp\.com\/send\?phone=(\d{10,13})/gi,
    /whatsapp[^>]*href=["'][^"']*(\d{10,13})/gi,
  ];
  
  for (const pattern of whatsappPatterns) {
    const match = pattern.exec(html);
    if (match && match[1]) {
      contact.whatsapp = match[1];
      break;
    }
  }
  
  // === EMAIL EXTRACTION ===
  const emailPatterns = [
    /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|br|net|org|info|io)/gi,
  ];
  
  for (const pattern of emailPatterns) {
    const match = pattern.exec(searchHtml || html);
    if (match) {
      const email = match[1] || match[0];
      // Skip common non-contact emails
      if (!email.includes('noreply') && !email.includes('no-reply') && 
          !email.includes('example') && !email.includes('teste')) {
        contact.email = email.toLowerCase();
        break;
      }
    }
  }
  
  // === ADDRESS EXTRACTION ===
  // Look for typical address patterns
  const addressPatterns = [
    // Street with number: Rua X, 123
    /(?:Rua|Av\.?|Avenida|R\.)\s+[^,<]+,?\s*(?:n[º°]?\s*)?\d+[^<]{0,100}(?:CEP|cep)?[:\s]*\d{5}[-.]?\d{3}/gi,
    // Just CEP with some context
    /<[^>]*>\s*(?:CEP|Cep)[:\s]*(\d{5}[-.]?\d{3})\s*<\/[^>]*>/gi,
  ];
  
  for (const pattern of addressPatterns) {
    const match = pattern.exec(searchHtml || html);
    if (match) {
      let address = match[0].replace(/<[^>]*>/g, '').trim();
      if (address.length > 10 && address.length < 200) {
        contact.address = address;
        break;
      }
    }
  }
  
  // === CNPJ EXTRACTION ===
  const cnpjPattern = /\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-.\s]?\d{2}/g;
  const cnpjMatch = cnpjPattern.exec(searchHtml || html);
  if (cnpjMatch) {
    const cnpj = cnpjMatch[0].replace(/[^\d]/g, '');
    if (cnpj.length === 14) {
      contact.cnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
  }
  
  // === SUPPORT HOURS EXTRACTION ===
  const hoursPatterns = [
    /(?:hor[aá]rio|atendimento)[^<]*?(\d{1,2}h?\s*[àa-]\s*\d{1,2}h?)/gi,
    /(?:segunda|seg)[^<]*?(?:sexta|sex)[^<]*(\d{1,2}h?\s*[àa-]\s*\d{1,2}h?)/gi,
    /(\d{1,2}h\s*[àa-]\s*\d{1,2}h)/gi,
  ];
  
  for (const pattern of hoursPatterns) {
    const match = pattern.exec(searchHtml || html);
    if (match) {
      contact.supportHours = match[0].replace(/<[^>]*>/g, '').trim().slice(0, 100);
      break;
    }
  }
  
  console.log('Extracted contact info:', contact);
  return contact;
}

// Helper to extract footer HTML
function extractFooterHtml(html: string): string {
  const footerMatch = /<footer[^>]*>([\s\S]*?)<\/footer>/gi.exec(html);
  return footerMatch ? footerMatch[1] : '';
}

// Helper to extract contact section HTML
function extractContactSectionHtml(html: string): string {
  const patterns = [
    /<(?:section|div)[^>]*class="[^"]*contact[^"]*"[^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
    /<(?:section|div)[^>]*id="[^"]*contact[^"]*"[^>]*>([\s\S]*?)<\/(?:section|div)>/gi,
  ];
  
  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return match[1];
  }
  return '';
}

// =====================================================
// EXTRACT SOCIAL LINKS (Facebook, Instagram, TikTok, YouTube, etc)
// =====================================================
function extractSocialLinks(html: string): SocialLinks {
  const social: SocialLinks = {};
  
  // Focus on footer and header for social links
  const footerHtml = extractFooterHtml(html);
  const searchHtml = footerHtml || html;
  
  // === FACEBOOK ===
  const facebookPatterns = [
    /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"'?#]+)/gi,
    /href=["'](https?:\/\/(?:www\.)?fb\.com\/[^"'?#]+)/gi,
  ];
  for (const pattern of facebookPatterns) {
    const match = pattern.exec(searchHtml);
    if (match && match[1]) {
      social.facebook = match[1];
      break;
    }
  }
  
  // === INSTAGRAM ===
  const instagramPattern = /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"'?#]+)/gi;
  const igMatch = instagramPattern.exec(searchHtml);
  if (igMatch && igMatch[1]) {
    social.instagram = igMatch[1];
  }
  
  // === TIKTOK ===
  const tiktokPattern = /href=["'](https?:\/\/(?:www\.)?tiktok\.com\/@?[^"'?#]+)/gi;
  const ttMatch = tiktokPattern.exec(searchHtml);
  if (ttMatch && ttMatch[1]) {
    social.tiktok = ttMatch[1];
  }
  
  // === YOUTUBE ===
  const youtubePatterns = [
    /href=["'](https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|user\/|@)?[^"'?#]+)/gi,
    /href=["'](https?:\/\/(?:www\.)?youtu\.be\/[^"'?#]+)/gi,
  ];
  for (const pattern of youtubePatterns) {
    const match = pattern.exec(searchHtml);
    if (match && match[1]) {
      social.youtube = match[1];
      break;
    }
  }
  
  // === TWITTER / X ===
  const twitterPatterns = [
    /href=["'](https?:\/\/(?:www\.)?twitter\.com\/[^"'?#]+)/gi,
    /href=["'](https?:\/\/(?:www\.)?x\.com\/[^"'?#]+)/gi,
  ];
  for (const pattern of twitterPatterns) {
    const match = pattern.exec(searchHtml);
    if (match && match[1]) {
      social.twitter = match[1];
      break;
    }
  }
  
  // === LINKEDIN ===
  const linkedinPattern = /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company\/|in\/)?[^"'?#]+)/gi;
  const liMatch = linkedinPattern.exec(searchHtml);
  if (liMatch && liMatch[1]) {
    social.linkedin = liMatch[1];
  }
  
  // === PINTEREST ===
  const pinterestPattern = /href=["'](https?:\/\/(?:www\.)?(?:br\.)?pinterest\.com\/[^"'?#]+)/gi;
  const pinMatch = pinterestPattern.exec(searchHtml);
  if (pinMatch && pinMatch[1]) {
    social.pinterest = pinMatch[1];
  }
  
  console.log('Extracted social links:', social);
  return social;
}

function extractBranding(html: string, baseUrl: string): VisualExtractionResult['branding'] {
  const branding: VisualExtractionResult['branding'] = {};
  
  // Safety check - return empty branding if no HTML
  if (!html || typeof html !== 'string') {
    console.log('extractBranding: No HTML provided, returning empty branding');
    return branding;
  }
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
    /<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i,
  ];

  for (const pattern of faviconPatterns) {
    const match = pattern.exec(html);
    if (match) {
      branding.favicon = normalizeImageUrl(match[1], baseUrl);
      break;
    }
  }

  // === ENHANCED COLOR EXTRACTION ===
  // Strategy 1: CSS custom properties (most reliable)
  const cssVarPatterns = [
    { regex: /--(?:color-)?primary[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'primary' },
    { regex: /--(?:color-)?secondary[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'secondary' },
    { regex: /--(?:color-)?accent[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'accent' },
    { regex: /--brand[^:]*color[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'primary' },
    { regex: /--button[^:]*color[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'primary' },
    { regex: /--link[^:]*color[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'accent' },
  ];

  for (const { regex, type } of cssVarPatterns) {
    const match = regex.exec(html);
    if (match && match[1]) {
      if (type === 'primary' && !branding.primaryColor) {
        branding.primaryColor = match[1];
      } else if (type === 'secondary' && !branding.secondaryColor) {
        branding.secondaryColor = match[1];
      } else if (type === 'accent' && !branding.accentColor) {
        branding.accentColor = match[1];
      }
    }
  }

  // Strategy 2: Look for colors in <style> tags and inline styles
  const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
  const allStyles = styleBlocks.join(' ');
  
  // Find most common colors in buttons, headers, links
  const colorContext = [
    { pattern: /\.btn[^{]*\{[^}]*background[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'primary' },
    { pattern: /button[^{]*\{[^}]*background[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'primary' },
    { pattern: /\.header[^{]*\{[^}]*background[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'secondary' },
    { pattern: /a[^{]*\{[^}]*color:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'accent' },
    { pattern: /\.footer[^{]*\{[^}]*background[^:]*:\s*([#][a-fA-F0-9]{3,6})/gi, type: 'secondary' },
  ];

  for (const { pattern, type } of colorContext) {
    const match = pattern.exec(allStyles);
    if (match && match[1]) {
      const color = match[1];
      // Skip common non-brand colors
      if (color.toLowerCase() === '#fff' || color.toLowerCase() === '#ffffff' || 
          color.toLowerCase() === '#000' || color.toLowerCase() === '#000000' ||
          color.toLowerCase() === '#333' || color.toLowerCase() === '#666') {
        continue;
      }
      
      if (type === 'primary' && !branding.primaryColor) {
        branding.primaryColor = color;
      } else if (type === 'secondary' && !branding.secondaryColor) {
        branding.secondaryColor = color;
      } else if (type === 'accent' && !branding.accentColor) {
        branding.accentColor = color;
      }
    }
  }

  // Strategy 3: Meta theme-color
  const themeColorMatch = /<meta[^>]*name=["']theme-color["'][^>]*content=["']([#][a-fA-F0-9]{3,6})["']/i.exec(html);
  if (themeColorMatch && !branding.primaryColor) {
    branding.primaryColor = themeColorMatch[1];
  }

  console.log('Extracted branding colors:', {
    primary: branding.primaryColor,
    secondary: branding.secondaryColor,
    accent: branding.accentColor,
    logo: branding.logo ? 'found' : 'not found',
    favicon: branding.favicon ? 'found' : 'not found',
  });

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
// =====================================================
// EXTRACT INSTITUTIONAL PAGES - UNIVERSAL PATTERNS
// Detects common e-commerce pages across ALL platforms
// =====================================================

// Universal page patterns - works for any platform
const INSTITUTIONAL_PAGE_PATTERNS: Array<{
  slugPatterns: RegExp[];
  titlePatterns: RegExp[];
  category: 'about' | 'privacy' | 'terms' | 'returns' | 'shipping' | 'faq' | 'payment' | 'warranty' | 'contact' | 'other';
  defaultTitle: string;
  priority: number;
}> = [
  // === ABOUT ===
  {
    slugPatterns: [/sobre/, /about/, /quem-somos/, /nossa-historia/, /historia/, /empresa/, /institucional/],
    titlePatterns: [/sobre\s*(n[oó]s)?/i, /about\s*us/i, /quem\s*somos/i, /nossa\s*hist[oó]ria/i, /a\s*empresa/i],
    category: 'about',
    defaultTitle: 'Sobre Nós',
    priority: 1
  },
  // === PRIVACY ===
  {
    slugPatterns: [/privacidade/, /privacy/, /politica.*privacidade/, /privacy.*policy/, /lgpd/],
    titlePatterns: [/pol[ií]tica.*privacidade/i, /privacy\s*policy/i, /privacidade/i, /lgpd/i],
    category: 'privacy',
    defaultTitle: 'Política de Privacidade',
    priority: 2
  },
  // === TERMS ===
  {
    slugPatterns: [/termos/, /terms/, /condi[cç][oõ]es/, /uso/, /servi[cç]o/],
    titlePatterns: [/termos.*(?:uso|servi[cç]o)/i, /terms.*(?:service|use)/i, /condi[cç][oõ]es.*uso/i],
    category: 'terms',
    defaultTitle: 'Termos de Uso',
    priority: 2
  },
  // === RETURNS/REFUND ===
  {
    slugPatterns: [/troca/, /devolu[cç]/, /refund/, /return/, /reembolso/, /cancelamento/],
    titlePatterns: [/trocas?.*devolu[cç]/i, /devolu[cç].*trocas?/i, /refund/i, /return/i, /pol[ií]tica.*troca/i],
    category: 'returns',
    defaultTitle: 'Trocas e Devoluções',
    priority: 2
  },
  // === SHIPPING ===
  {
    slugPatterns: [/frete/, /envio/, /shipping/, /entrega/, /prazos?/],
    titlePatterns: [/pol[ií]tica.*frete/i, /shipping/i, /envio/i, /entrega/i, /prazos?.*entrega/i],
    category: 'shipping',
    defaultTitle: 'Política de Frete',
    priority: 2
  },
  // === FAQ ===
  {
    slugPatterns: [/faq/, /duvida/, /pergunta/, /ajuda/, /help/, /suporte/],
    titlePatterns: [/faq/i, /d[uú]vidas?/i, /perguntas?\s*frequentes?/i, /ajuda/i, /help/i],
    category: 'faq',
    defaultTitle: 'Perguntas Frequentes',
    priority: 1
  },
  // === PAYMENT ===
  {
    slugPatterns: [/pagamento/, /payment/, /formas.*pagamento/, /meios.*pagamento/],
    titlePatterns: [/formas?.*pagamento/i, /meios?.*pagamento/i, /payment/i, /como\s*pagar/i],
    category: 'payment',
    defaultTitle: 'Formas de Pagamento',
    priority: 3
  },
  // === WARRANTY ===
  {
    slugPatterns: [/garantia/, /warranty/],
    titlePatterns: [/garantia/i, /warranty/i, /pol[ií]tica.*garantia/i],
    category: 'warranty',
    defaultTitle: 'Garantia',
    priority: 3
  },
  // === CONTACT (text pages only, not forms) ===
  {
    slugPatterns: [/contato/, /contact/, /fale.*conosco/, /atendimento/],
    titlePatterns: [/contato/i, /contact/i, /fale.*conosco/i, /atendimento/i],
    category: 'contact',
    defaultTitle: 'Contato',
    priority: 3
  }
];

// Pages to NEVER import (functional, not content)
const SKIP_PAGE_PATTERNS = [
  // E-commerce functional
  /\/cart\b/, /\/carrinho\b/, /\/checkout\b/, /\/account\b/, /\/conta\b/, /\/login\b/,
  /\/cadastro\b/, /\/register\b/, /\/signup\b/, /\/signin\b/, /\/wishlist\b/,
  /\/search\b/, /\/busca\b/, /\/compare\b/, /\/comparar\b/,
  // Tracking (we have native)
  /\/rastreio\b/, /\/rastreamento\b/, /\/rastrear\b/, /\/tracking\b/, /\/track\b/,
  // Blog (we have native)
  /\/blogs?\b/, /\/artigos?\b/, /\/noticias?\b/, /\/news\b/,
  // Collections/Products
  /\/collections?\b/, /\/products?\b/, /\/produtos?\b/, /\/categorias?\b/,
  // Assets
  /\.(?:jpg|jpeg|png|gif|webp|svg|pdf|css|js)$/i,
  // External
  /facebook\.com/, /instagram\.com/, /twitter\.com/, /youtube\.com/,
  /linkedin\.com/, /pinterest\.com/, /tiktok\.com/, /wa\.me/, /whatsapp\.com/,
  // Technical
  /^javascript:/, /^mailto:/, /^tel:/, /^#$/
];

function extractInstitutionalPages(html: string, baseUrl: string, platform?: string): ExtractedInstitutionalPage[] {
  const pages: ExtractedInstitutionalPage[] = [];
  const addedSlugs = new Set<string>();
  const processedUrls = new Set<string>();

  console.log('=== EXTRACTING INSTITUTIONAL PAGES ===');
  console.log(`Platform: ${platform}, BaseURL: ${baseUrl}`);

  const shouldSkipUrl = (href: string): boolean => {
    if (!href || href === '#' || href === '/') return true;
    const lowerHref = href.toLowerCase();
    
    // Skip external links
    if (href.startsWith('http') && baseUrl) {
      try {
        const hrefDomain = new URL(href).hostname;
        const baseDomain = new URL(baseUrl).hostname;
        if (hrefDomain !== baseDomain) return true;
      } catch {}
    }
    
    // Skip functional pages
    return SKIP_PAGE_PATTERNS.some(pattern => pattern.test(lowerHref));
  };

  const normalizeUrl = (href: string): string => {
    if (!href) return '';
    let url = href.split('?')[0].replace(/\/$/, '');
    if (!url.startsWith('http') && baseUrl) {
      url = `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  };

  const extractSlugFromUrl = (href: string): string | null => {
    const cleanHref = href.split('?')[0].replace(/\/$/, '').toLowerCase();
    
    // Try common page URL patterns
    const patterns = [
      /\/policies\/([^/?#]+)/i,      // Shopify policies
      /\/pages?\/([^/?#]+)/i,        // Generic pages
      /\/paginas?\/([^/?#]+)/i,      // Portuguese
      /\/politicas?\/([^/?#]+)/i,    // Portuguese policies
      /\/institucional\/([^/?#]+)/i, // Institutional
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(cleanHref);
      if (match) return match[1];
    }
    
    // Fallback: last path segment
    const segments = cleanHref.replace(/^https?:\/\/[^/]+/, '').split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      // Only use if it looks like a page slug (not numeric, not too short)
      if (lastSegment.length > 2 && !/^\d+$/.test(lastSegment)) {
        return lastSegment;
      }
    }
    
    return null;
  };

  const categorizeSlug = (slug: string, title: string): { category: string; normalizedTitle: string } => {
    const lowerSlug = slug.toLowerCase();
    const lowerTitle = title.toLowerCase();
    
    for (const pattern of INSTITUTIONAL_PAGE_PATTERNS) {
      // Check slug patterns
      if (pattern.slugPatterns.some(p => p.test(lowerSlug))) {
        return { category: pattern.category, normalizedTitle: pattern.defaultTitle };
      }
      // Check title patterns
      if (pattern.titlePatterns.some(p => p.test(lowerTitle))) {
        return { category: pattern.category, normalizedTitle: pattern.defaultTitle };
      }
    }
    
    return { category: 'other', normalizedTitle: title || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };
  };

  const addPage = (href: string, rawTitle: string, source: 'footer' | 'header' | 'sitemap' | 'global') => {
    if (shouldSkipUrl(href)) return false;
    
    const url = normalizeUrl(href);
    if (!url || processedUrls.has(url.toLowerCase())) return false;
    processedUrls.add(url.toLowerCase());
    
    const slug = extractSlugFromUrl(href);
    if (!slug || addedSlugs.has(slug.toLowerCase())) return false;
    
    // Clean title
    const title = rawTitle.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    if (!title || title.length < 2 || title.length > 100) return false;
    
    // Skip if title looks like a product or category
    if (/^\d+%?\s*off|^r\$|compre|add.*cart|adicionar/i.test(title)) return false;
    
    const { category, normalizedTitle } = categorizeSlug(slug, title);
    
    pages.push({
      title: title || normalizedTitle,
      slug: slug.toLowerCase(),
      url,
      source
    });
    addedSlugs.add(slug.toLowerCase());
    console.log(`[PAGE] Found: "${title}" -> ${slug} (${category}) from ${source}`);
    return true;
  };

  // ===== STRATEGY 1: Footer Links (most reliable for institutional pages) =====
  const footerPatterns = [
    /<footer[^>]*>([\s\S]*?)<\/footer>/gi,
    /<div[^>]*(?:class|id)="[^"]*footer[^"]*"[^>]*>([\s\S]*?)<\/div>(?=\s*<\/body|\s*$)/gi,
    /<section[^>]*class="[^"]*footer[^"]*"[^>]*>([\s\S]*?)<\/section>/gi,
  ];

  for (const footerPattern of footerPatterns) {
    let match;
    while ((match = footerPattern.exec(html)) !== null) {
      const footerHtml = match[1] || match[0];
      
      // Find all links in footer
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<(?!\/a)[^>]*>[^<]*)*)<\/a>/gi;
      let linkMatch;
      
      while ((linkMatch = linkPattern.exec(footerHtml)) !== null) {
        addPage(linkMatch[1], linkMatch[2], 'footer');
      }
    }
  }
  console.log(`[STRATEGY 1] Footer: Found ${pages.length} pages so far`);

  // ===== STRATEGY 2: Header/Nav Links =====
  const navPatterns = [
    /<header[^>]*>([\s\S]*?)<\/header>/gi,
    /<nav[^>]*(?:class="[^"]*(?:main|primary|site)[^"]*")?[^>]*>([\s\S]*?)<\/nav>/gi,
  ];

  const beforeCount = pages.length;
  for (const navPattern of navPatterns) {
    let match;
    while ((match = navPattern.exec(html)) !== null) {
      const navHtml = match[1] || match[0];
      const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:<(?!\/a)[^>]*>[^<]*)*)<\/a>/gi;
      let linkMatch;
      
      while ((linkMatch = linkPattern.exec(navHtml)) !== null) {
        const href = linkMatch[1];
        // Only add if it's a page link, not category/product
        if (/\/(?:pages?|policies|paginas?|politicas?)\//i.test(href)) {
          addPage(href, linkMatch[2], 'header');
        }
      }
    }
  }
  console.log(`[STRATEGY 2] Header: Found ${pages.length - beforeCount} new pages`);

  // ===== STRATEGY 3: Platform-specific policy pages =====
  const isShopify = platform === 'Shopify' || /shopify|cdn\.shopify/i.test(html);
  const isNuvemshop = platform === 'Nuvemshop' || /tiendanube|nuvemshop/i.test(html);
  
  if (isShopify) {
    const shopifyPolicies = [
      { slug: 'privacy-policy', title: 'Política de Privacidade', path: '/policies/privacy-policy' },
      { slug: 'refund-policy', title: 'Política de Reembolso', path: '/policies/refund-policy' },
      { slug: 'terms-of-service', title: 'Termos de Serviço', path: '/policies/terms-of-service' },
      { slug: 'shipping-policy', title: 'Política de Frete', path: '/policies/shipping-policy' },
    ];
    
    for (const policy of shopifyPolicies) {
      if (!addedSlugs.has(policy.slug)) {
        // Check if the page actually exists in HTML
        if (html.includes(policy.path) || html.includes(`/policies/${policy.slug}`)) {
          pages.push({
            title: policy.title,
            slug: policy.slug,
            url: `${baseUrl}${policy.path}`,
            source: 'sitemap'
          });
          addedSlugs.add(policy.slug);
          console.log(`[STRATEGY 3] Shopify policy: ${policy.title}`);
        }
      }
    }
  }

  // ===== STRATEGY 4: Global search for page/policy links =====
  const globalPatterns = [
    /<a[^>]*href=["']([^"']*\/(?:pages?|policies|paginas?|politicas?)\/[^"'?#]+)["'][^>]*>([^<]*(?:<(?!\/a)[^>]*>[^<]*)*)<\/a>/gi,
  ];

  const beforeGlobal = pages.length;
  for (const pattern of globalPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      addPage(match[1], match[2], 'global');
    }
  }
  console.log(`[STRATEGY 4] Global: Found ${pages.length - beforeGlobal} new pages`);

  // ===== STRATEGY 5: Common institutional page slugs =====
  const commonSlugs = [
    { slug: 'sobre', title: 'Sobre' },
    { slug: 'sobre-nos', title: 'Sobre Nós' },
    { slug: 'quem-somos', title: 'Quem Somos' },
    { slug: 'about', title: 'About' },
    { slug: 'about-us', title: 'About Us' },
    { slug: 'faq', title: 'FAQ' },
    { slug: 'perguntas-frequentes', title: 'Perguntas Frequentes' },
    { slug: 'duvidas', title: 'Dúvidas' },
    { slug: 'trocas-e-devolucoes', title: 'Trocas e Devoluções' },
    { slug: 'politica-de-troca', title: 'Política de Troca' },
    { slug: 'como-comprar', title: 'Como Comprar' },
    { slug: 'formas-de-pagamento', title: 'Formas de Pagamento' },
    { slug: 'politica-de-privacidade', title: 'Política de Privacidade' },
    { slug: 'termos-de-uso', title: 'Termos de Uso' },
    { slug: 'garantia', title: 'Garantia' },
    { slug: 'politica-de-frete', title: 'Política de Frete' },
    { slug: 'entrega', title: 'Entrega' },
    { slug: 'trabalhe-conosco', title: 'Trabalhe Conosco' },
  ];

  const beforeCommon = pages.length;
  for (const { slug, title } of commonSlugs) {
    if (addedSlugs.has(slug)) continue;
    
    // Check if slug appears in any /pages/ link in the HTML
    const slugRegex = new RegExp(`/pages?/${slug}(?:[?#"']|$)`, 'i');
    if (slugRegex.test(html)) {
      pages.push({
        title,
        slug,
        url: `${baseUrl}/pages/${slug}`,
        source: 'global'
      });
      addedSlugs.add(slug);
      console.log(`[STRATEGY 5] Common slug found: ${title}`);
    }
  }
  console.log(`[STRATEGY 5] Common slugs: Found ${pages.length - beforeCommon} new pages`);

  // ===== STRATEGY 6: Look for embedded JSON menu data =====
  const jsonPatterns = [
    /"(?:links|menu|items)"\s*:\s*\[[\s\S]*?"(?:url|href)"\s*:\s*"([^"]*\/(?:pages?|policies)\/[^"]+)"[\s\S]*?"(?:title|label|name)"\s*:\s*"([^"]+)"/gi,
  ];

  const beforeJson = pages.length;
  for (const pattern of jsonPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      addPage(match[1], match[2], 'sitemap');
    }
  }
  console.log(`[STRATEGY 6] JSON data: Found ${pages.length - beforeJson} new pages`);

  // Sort by priority (about, policies, then others)
  const priorityOrder: Record<string, number> = {
    'about': 1, 'privacy': 2, 'terms': 3, 'returns': 4, 'shipping': 5,
    'faq': 6, 'payment': 7, 'warranty': 8, 'contact': 9, 'other': 10
  };

  pages.sort((a, b) => {
    const catA = categorizeSlug(a.slug, a.title).category;
    const catB = categorizeSlug(b.slug, b.title).category;
    return (priorityOrder[catA] || 10) - (priorityOrder[catB] || 10);
  });

  console.log(`=== INSTITUTIONAL PAGES EXTRACTION COMPLETE: ${pages.length} pages found ===`);
  return pages;
}
