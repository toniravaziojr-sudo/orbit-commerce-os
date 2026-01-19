import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// TYPES
// ===========================================

interface ImportRequest {
  tenantId: string;
  storeUrl: string;
  platform?: string;
}

interface MenuItem {
  label: string;
  url: string;
  originalUrl: string;
  type: 'category' | 'page' | 'external';
  refId?: string;
  children?: MenuItem[];
}

interface MenuStructure {
  header: MenuItem[];
  footer1: MenuItem[];
  footer2: MenuItem[];
}

// ===========================================
// HELPERS
// ===========================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function extractSlugFromPath(pathname: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(pathname);
    if (match && match[1]) {
      return match[1].toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
  }
  return null;
}

// ===========================================
// MENU EXTRACTION - IMPROVED FOR SHOPIFY + HIERARCHICAL
// ===========================================

async function extractMenuStructure(
  storeUrl: string,
  firecrawlApiKey: string
): Promise<MenuStructure> {
  const origin = new URL(storeUrl.startsWith('http') ? storeUrl : `https://${storeUrl}`).origin;
  
  console.log(`[Menus] Extracting from ${origin}`);
  
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firecrawlApiKey}`
    },
    body: JSON.stringify({
      url: storeUrl,
      formats: ['html'],
      onlyMainContent: false,
      waitFor: 3000
    })
  });

  if (!response.ok) {
    console.error('[Menus] Firecrawl error:', response.status);
    return { header: [], footer1: [], footer2: [] };
  }

  const result = await response.json();
  const html = result?.data?.html || result?.html || '';
  
  if (!html) {
    return { header: [], footer1: [], footer2: [] };
  }

  const menuStructure: MenuStructure = {
    header: [],
    footer1: [],
    footer2: []
  };

  // Category URL patterns
  const categoryPatterns = [
    /\/(?:collections?|categoria|categorias|category|categories|c)\/([^/?#"']+)/gi,
    /\/(?:departamento|departamentos|department|departments|dept)\/([^/?#"']+)/gi,
    /\/(?:shop|loja|store)\/([^/?#"']+)/gi,
  ];

  // Page URL patterns
  const pagePatterns = [
    /\/(?:pages?|pagina|paginas)\/([^/?#"']+)/gi,
    /\/(?:policies|politicas?|termos|terms|privacy|privacidade)\/([^/?#"']+)/gi,
  ];

  // Blacklisted paths (skip these)
  const blacklist = [
    'cart', 'carrinho', 'checkout', 'login', 'cadastro', 'register', 
    'search', 'busca', 'account', 'conta', 'minha-conta', 'my-account',
    'wishlist', 'favoritos', 'track', 'rastreio', 'all'
  ];

  // ===========================================
  // EXTRACT HEADER MENU (with Shopify mega-menu detection)
  // ===========================================
  const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
  if (headerMatch) {
    const headerHtml = headerMatch[1];
    
    // Try Shopify mega-menu patterns first
    menuStructure.header = extractShopifyMegaMenu(headerHtml, origin, categoryPatterns, pagePatterns, blacklist);
    
    // Fallback to generic hierarchical extraction
    if (menuStructure.header.length === 0) {
      menuStructure.header = extractHierarchicalMenu(headerHtml, origin, categoryPatterns, pagePatterns, blacklist);
    }
    
    console.log(`[Menus] Header items: ${menuStructure.header.length} (with ${menuStructure.header.filter(i => i.children?.length).length} having children)`);
  }

  // ===========================================
  // EXTRACT FOOTER MENUS (may have multiple sections)
  // ===========================================
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch) {
    const footerHtml = footerMatch[1];
    
    // Try to find distinct menu sections in footer
    // Look for titled sections with headings
    const footerSections = extractFooterSections(footerHtml, origin, categoryPatterns, pagePatterns, blacklist);
    
    console.log(`[Menus] Found ${footerSections.length} footer sections`);

    if (footerSections.length >= 2) {
      // Multiple sections - assign first non-empty to footer1, second to footer2
      const nonEmptySections = footerSections.filter(s => s.length > 0);
      menuStructure.footer1 = nonEmptySections[0] || [];
      menuStructure.footer2 = nonEmptySections[1] || [];
    } else if (footerSections.length === 1) {
      // Single section - analyze content to split
      const allItems = footerSections[0];
      
      // Separate categories from pages
      menuStructure.footer1 = allItems.filter(item => item.type === 'category');
      menuStructure.footer2 = allItems.filter(item => item.type === 'page' || item.type === 'external');
      
      // If all same type, just put in footer1
      if (menuStructure.footer1.length === 0 || menuStructure.footer2.length === 0) {
        menuStructure.footer1 = allItems;
        menuStructure.footer2 = [];
      }
    } else {
      // No structured sections, extract from entire footer
      const allItems = extractHierarchicalMenu(footerHtml, origin, categoryPatterns, pagePatterns, blacklist);
      menuStructure.footer1 = allItems.filter(item => item.type === 'category');
      menuStructure.footer2 = allItems.filter(item => item.type === 'page' || item.type === 'external');
    }
  }

  console.log(`[Menus] Extracted: header=${menuStructure.header.length}, footer1=${menuStructure.footer1.length}, footer2=${menuStructure.footer2.length}`);
  
  return menuStructure;
}

// ===========================================
// SHOPIFY MEGA MENU EXTRACTION
// Shopify uses specific classes: header__menu-item, menu-drawer__menu-item, etc.
// ===========================================
function extractShopifyMegaMenu(
  html: string,
  origin: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[],
  blacklist: string[]
): MenuItem[] {
  const items: MenuItem[] = [];
  const seenUrls = new Set<string>();
  
  // Shopify desktop mega menu patterns
  // Look for top-level menu items that have submenus
  const megaMenuPatterns = [
    // Shopify 2.0 header__menu structure
    /<li[^>]*class="[^"]*header__menu-item[^"]*"[^>]*>([\s\S]*?)(?=<li[^>]*class="[^"]*header__menu-item|<\/ul>|<\/nav>)/gi,
    // Dawn theme mega-menu
    /<details[^>]*class="[^"]*mega-menu[^"]*"[^>]*>([\s\S]*?)<\/details>/gi,
    // Generic nav items with dropdowns
    /<li[^>]*class="[^"]*(?:nav-item|menu-item|has-dropdown|has-submenu)[^"]*"[^>]*>([\s\S]*?)(?=<li[^>]*class="[^"]*(?:nav-item|menu-item)|<\/ul>|<\/nav>)/gi,
  ];
  
  for (const pattern of megaMenuPatterns) {
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(html)) !== null) {
      const itemHtml = match[1] || match[0];
      
      // Get the main link (first link in the item)
      const mainLinkMatch = itemHtml.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      if (!mainLinkMatch) continue;
      
      const [, href, rawLabel] = mainLinkMatch;
      const label = rawLabel.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      
      if (!href || !label || seenUrls.has(href)) continue;
      if (href === '#' || href === 'javascript:void(0)') continue;
      if (blacklist.some(term => href.toLowerCase().includes(`/${term}`))) continue;
      
      seenUrls.add(href);
      
      const fullUrl = href.startsWith('/') ? `${origin}${href}` : href.startsWith('http') ? href : `${origin}/${href}`;
      const item = classifyLink(fullUrl, label, categoryPatterns, pagePatterns);
      if (!item) continue;
      
      // Look for submenu (nested ul or mega-menu content)
      const submenuPatterns = [
        /<ul[^>]*class="[^"]*(?:mega-menu|submenu|dropdown-menu|header__submenu)[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi,
        /<div[^>]*class="[^"]*(?:mega-menu|submenu|dropdown)[^"]*"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/gi,
        /<ul[^>]*>([\s\S]*?)<\/ul>/gi, // Fallback: any nested ul
      ];
      
      for (const subPattern of submenuPatterns) {
        subPattern.lastIndex = 0;
        const subMatch = subPattern.exec(itemHtml);
        if (subMatch) {
          const childItems = extractLinksFlat(subMatch[1], origin, categoryPatterns, pagePatterns, blacklist, seenUrls);
          if (childItems.length > 0) {
            item.children = childItems;
            break;
          }
        }
      }
      
      items.push(item);
    }
    
    if (items.length > 0) break; // Use first successful pattern
  }
  
  return items;
}

// ===========================================
// FOOTER SECTIONS EXTRACTION
// Footer usually has titled sections with h3/h4 headings
// ===========================================
function extractFooterSections(
  html: string,
  origin: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[],
  blacklist: string[]
): MenuItem[][] {
  const sections: MenuItem[][] = [];
  
  // Try to find footer columns/sections with headings
  const sectionPatterns = [
    // Sections with heading + list
    /<(?:div|section)[^>]*class="[^"]*(?:footer-col|footer-block|footer-section|col-)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>/gi,
    // Nav sections
    /<nav[^>]*>([\s\S]*?)<\/nav>/gi,
    // Divs with footer links
    /<div[^>]*class="[^"]*(?:footer-links|footer-menu|footer-nav)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];
  
  const processedHtml = new Set<string>();
  
  for (const pattern of sectionPatterns) {
    pattern.lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(html)) !== null) {
      const sectionHtml = match[1] || match[0];
      
      // Skip if no links
      if (!/<a[^>]*href=/i.test(sectionHtml)) continue;
      
      // Skip duplicates (based on first 100 chars)
      const key = sectionHtml.substring(0, 100);
      if (processedHtml.has(key)) continue;
      processedHtml.add(key);
      
      // Skip if this looks like social links or payment icons
      if (/(?:instagram|facebook|twitter|youtube|linkedin|pinterest)/i.test(sectionHtml) &&
          !/<a[^>]*href="[^"]*\/(?:page|collection|categoria)/i.test(sectionHtml)) {
        continue;
      }
      
      const items = extractHierarchicalMenu(sectionHtml, origin, categoryPatterns, pagePatterns, blacklist);
      if (items.length >= 2) { // Only add if has meaningful content
        sections.push(items);
      }
    }
  }
  
  // If no sections found, try to split by dividers/breaks
  if (sections.length === 0) {
    const allItems = extractHierarchicalMenu(html, origin, categoryPatterns, pagePatterns, blacklist);
    if (allItems.length > 0) {
      sections.push(allItems);
    }
  }
  
  return sections;
}

// ===========================================
// FLAT LINK EXTRACTION (for submenus)
// ===========================================
function extractLinksFlat(
  html: string,
  origin: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[],
  blacklist: string[],
  seenUrls: Set<string>
): MenuItem[] {
  const items: MenuItem[] = [];
  
  const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  
  while ((match = linkPattern.exec(html)) !== null) {
    const [, href, rawLabel] = match;
    const label = rawLabel.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    
    if (!href || !label || seenUrls.has(href)) continue;
    if (href === '#' || href === 'javascript:void(0)') continue;
    if (blacklist.some(term => href.toLowerCase().includes(`/${term}`))) continue;
    
    seenUrls.add(href);
    
    const fullUrl = href.startsWith('/') ? `${origin}${href}` : href.startsWith('http') ? href : `${origin}/${href}`;
    const item = classifyLink(fullUrl, label, categoryPatterns, pagePatterns);
    if (item) {
      items.push(item);
    }
  }
  
  return items;
}

function extractHierarchicalMenu(
  html: string,
  origin: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[],
  blacklist: string[]
): MenuItem[] {
  const items: MenuItem[] = [];
  const seenUrls = new Set<string>();
  
  // Find list items with potential nested structure
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  
  // First pass: extract from <li> elements (preserves hierarchy)
  while ((liMatch = liPattern.exec(html)) !== null) {
    const liContent = liMatch[1];
    
    // Get the first/main link
    const linkMatch = liContent.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]*(?:<[^a][^>]*>[^<]*)*)<\/a>/i);
    if (!linkMatch) continue;
    
    const [, href, rawLabel] = linkMatch;
    const label = rawLabel.replace(/<[^>]+>/g, '').trim();
    
    if (!href || !label || seenUrls.has(href)) continue;
    if (href === '#' || href === 'javascript:void(0)') continue;
    
    const fullUrl = href.startsWith('/') ? `${origin}${href}` : href.startsWith('http') ? href : `${origin}/${href}`;
    
    // Skip blacklisted
    const path = new URL(fullUrl).pathname.toLowerCase();
    if (blacklist.some(term => path.includes(`/${term}`))) continue;
    
    seenUrls.add(href);
    
    const item = classifyLink(fullUrl, label, categoryPatterns, pagePatterns);
    if (!item) continue;
    
    // Check for nested ul (submenu)
    const nestedUl = liContent.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (nestedUl) {
      const childItems = extractHierarchicalMenu(nestedUl[1], origin, categoryPatterns, pagePatterns, blacklist);
      if (childItems.length > 0) {
        item.children = childItems;
      }
    }
    
    items.push(item);
  }
  
  // If no li items found, try direct link extraction
  if (items.length === 0) {
    const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
      const [, href, label] = match;
      if (!href || seenUrls.has(href)) continue;
      if (href === '#' || href === 'javascript:void(0)') continue;
      
      const fullUrl = href.startsWith('/') ? `${origin}${href}` : href.startsWith('http') ? href : `${origin}/${href}`;
      
      // Skip blacklisted
      try {
        const path = new URL(fullUrl).pathname.toLowerCase();
        if (blacklist.some(term => path.includes(`/${term}`))) continue;
      } catch {
        continue;
      }
      
      seenUrls.add(href);
      
      const item = classifyLink(fullUrl, label.trim(), categoryPatterns, pagePatterns);
      if (item) {
        items.push(item);
      }
    }
  }
  
  return items;
}

function classifyLink(
  url: string,
  label: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[]
): MenuItem | null {
  let path: string;
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  
  // Check if it's a category
  for (const pattern of categoryPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(url);
    if (match && match[1]) {
      const slug = match[1].toLowerCase().replace(/[^a-z0-9-]/g, '-');
      return {
        label: label || slugToLabel(slug),
        url: `/categoria/${slug}`,
        originalUrl: url,
        type: 'category'
      };
    }
  }
  
  // Check if it's a page
  for (const pattern of pagePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(url);
    if (match && match[1]) {
      const slug = match[1].toLowerCase().replace(/[^a-z0-9-]/g, '-');
      return {
        label: label || slugToLabel(slug),
        url: `/pagina/${slug}`,
        originalUrl: url,
        type: 'page'
      };
    }
  }
  
  // Check for common institutional page patterns
  const institutionalPatterns = [
    { pattern: /\/(sobre|about|quem-somos|about-us)/i, slug: 'sobre' },
    { pattern: /\/(contato|contact|fale-conosco)/i, slug: 'contato' },
    { pattern: /\/(politica|policy|privacidade|privacy)/i, slug: 'politica-privacidade' },
    { pattern: /\/(termos|terms|condicoes)/i, slug: 'termos' },
    { pattern: /\/(troca|devolucao|exchange|return)/i, slug: 'trocas-devolucoes' },
    { pattern: /\/(faq|ajuda|help|perguntas)/i, slug: 'faq' },
    { pattern: /\/(entrega|shipping|frete)/i, slug: 'entrega' },
  ];
  
  for (const { pattern, slug } of institutionalPatterns) {
    if (pattern.test(path)) {
      return {
        label: label || slugToLabel(slug),
        url: `/pagina/${slug}`,
        originalUrl: url,
        type: 'page'
      };
    }
  }
  
  // External link (different domain)
  try {
    const urlOrigin = new URL(url).origin;
    if (!url.startsWith(urlOrigin)) {
      return {
        label,
        url,
        originalUrl: url,
        type: 'external'
      };
    }
  } catch {
    // Invalid URL
  }
  
  return null;
}

// ===========================================
// PERSISTENCE
// ===========================================

async function saveMenus(
  supabase: any,
  tenantId: string,
  menuStructure: MenuStructure,
  categoryMap: Map<string, string>,
  pageMap: Map<string, string>,
  importedMenuIds: string[]
): Promise<{ header: number; footer1: number; footer2: number }> {
  const stats = { header: 0, footer1: 0, footer2: 0 };
  
  const saveMenu = async (
    location: 'header' | 'footer_1' | 'footer_2',
    name: string,
    items: MenuItem[]
  ): Promise<number> => {
    if (items.length === 0) return 0;
    
    // Upsert menu
    const { data: menu, error: menuError } = await supabase
      .from('menus')
      .upsert({ 
        tenant_id: tenantId, 
        name, 
        location 
      }, { 
        onConflict: 'tenant_id,location' 
      })
      .select('id')
      .single();
    
    if (menuError || !menu) {
      console.error(`[Menus] Error creating menu ${location}:`, menuError);
      return 0;
    }
    
    importedMenuIds.push(menu.id);
    
    // Delete existing items
    await supabase.from('menu_items').delete().eq('menu_id', menu.id);
    
    // Insert new items with hierarchy
    let totalItems = 0;
    let sortOrder = 0;
    
    for (const item of items) {
      // Try to find ref_id by matching slug
      let refId: string | null = null;
      if (item.type === 'category') {
        const slug = item.url.replace('/categoria/', '').toLowerCase();
        refId = categoryMap.get(slug) || null;
      } else if (item.type === 'page') {
        const slug = item.url.replace('/pagina/', '').toLowerCase();
        refId = pageMap.get(slug) || null;
      }
      
      const { data: parentItem, error: parentError } = await supabase
        .from('menu_items')
        .insert({
          tenant_id: tenantId,
          menu_id: menu.id,
          label: item.label,
          url: item.type === 'external' ? item.url : null,
          item_type: item.type,
          ref_id: refId,
          sort_order: sortOrder++,
          parent_id: null
        })
        .select('id')
        .single();
      
      if (!parentError && parentItem) {
        totalItems++;
        
        // Add children (submenus)
        if (item.children && item.children.length > 0) {
          let childOrder = 0;
          for (const child of item.children) {
            let childRefId: string | null = null;
            if (child.type === 'category') {
              const slug = child.url.replace('/categoria/', '').toLowerCase();
              childRefId = categoryMap.get(slug) || null;
            } else if (child.type === 'page') {
              const slug = child.url.replace('/pagina/', '').toLowerCase();
              childRefId = pageMap.get(slug) || null;
            }
            
            const { error: childError } = await supabase
              .from('menu_items')
              .insert({
                tenant_id: tenantId,
                menu_id: menu.id,
                label: child.label,
                url: child.type === 'external' ? child.url : null,
                item_type: child.type,
                ref_id: childRefId,
                sort_order: childOrder++,
                parent_id: parentItem.id
              });
            
            if (!childError) {
              totalItems++;
            }
          }
        }
      }
    }
    
    return totalItems;
  };
  
  // Save all menus
  stats.header = await saveMenu('header', 'Menu Principal', menuStructure.header);
  stats.footer1 = await saveMenu('footer_1', 'Menu Footer', menuStructure.footer1);
  stats.footer2 = await saveMenu('footer_2', 'Políticas', menuStructure.footer2);
  
  return stats;
}

// ===========================================
// MAIN HANDLER
// ===========================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Não autorizado' });
    }

    const body = await req.json() as ImportRequest;
    const { tenantId, storeUrl, platform } = body;

    if (!tenantId || !storeUrl) {
      return jsonResponse({ success: false, error: 'tenantId e storeUrl são obrigatórios' });
    }

    console.log(`[Menus] Starting import for tenant ${tenantId}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')!;

    // Validate user
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ success: false, error: 'Usuário não autenticado' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate tenant access
    const { data: belongsToTenant } = await supabase.rpc('user_belongs_to_tenant', {
      _user_id: user.id,
      _tenant_id: tenantId
    });

    if (!belongsToTenant) {
      return jsonResponse({ success: false, error: 'Acesso negado' });
    }

    // Get existing categories and pages for linking
    const { data: categories } = await supabase
      .from('categories')
      .select('id, slug')
      .eq('tenant_id', tenantId);
    
    const { data: pages } = await supabase
      .from('store_pages')
      .select('id, slug')
      .eq('tenant_id', tenantId);

    const categoryMap = new Map<string, string>();
    (categories || []).forEach(cat => categoryMap.set(cat.slug.toLowerCase(), cat.id));

    const pageMap = new Map<string, string>();
    (pages || []).forEach(page => pageMap.set(page.slug.toLowerCase(), page.id));

    console.log(`[Menus] Available: ${categoryMap.size} categories, ${pageMap.size} pages`);

    // Extract menu structure
    const menuStructure = await extractMenuStructure(storeUrl, firecrawlApiKey);

    // Track imported menu IDs
    const importedMenuIds: string[] = [];

    // Save menus
    const stats = await saveMenus(supabase, tenantId, menuStructure, categoryMap, pageMap, importedMenuIds);

    // Register imported menus in import_items for cleanup tracking
    for (const menuId of importedMenuIds) {
      await supabase.from('import_items').upsert({
        tenant_id: tenantId,
        job_id: null,
        module: 'menus',
        internal_id: menuId,
        external_id: storeUrl,
        status: 'success',
        data: { 
          headerItems: stats.header,
          footer1Items: stats.footer1,
          footer2Items: stats.footer2
        }
      }, {
        onConflict: 'tenant_id,module,internal_id',
        ignoreDuplicates: false
      });
    }

    const totalItems = stats.header + stats.footer1 + stats.footer2;
    console.log(`[Menus] Import completed: ${totalItems} items total`);

    return jsonResponse({
      success: true,
      stats,
      totalItems,
      message: `Importação concluída: ${stats.header} itens no header, ${stats.footer1} no footer 1, ${stats.footer2} no footer 2`
    });

  } catch (error) {
    console.error('[Menus] Unexpected error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    });
  }
});
