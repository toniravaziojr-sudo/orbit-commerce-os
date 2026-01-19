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

// ===========================================
// MENU EXTRACTION
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

  // Category patterns
  const categoryPatterns = [
    /\/(?:collections?|categoria|categorias|category|categories|c)\/([^/?#"']+)/gi,
    /\/(?:departamento|departamentos|department|departments|dept)\/([^/?#"']+)/gi,
    /\/(?:shop|loja|store)\/([^/?#"']+)/gi,
  ];

  // Page patterns
  const pagePatterns = [
    /\/(?:pages?|pagina|paginas)\/([^/?#"']+)/gi,
    /\/(?:policies|politicas?|termos|terms|privacy|privacidade)\/([^/?#"']+)/gi,
  ];

  // Extract header navigation
  const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
  if (headerMatch) {
    const headerHtml = headerMatch[1];
    menuStructure.header = extractMenuItems(headerHtml, origin, categoryPatterns, pagePatterns);
  }

  // Extract footer navigation
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch) {
    const footerHtml = footerMatch[1];
    
    // Try to find multiple nav/menu sections in footer
    const navSections = footerHtml.match(/<(?:nav|ul)[^>]*(?:class|id)="[^"]*(?:menu|nav|links)[^"]*"[^>]*>([\s\S]*?)<\/(?:nav|ul)>/gi) || [];
    
    if (navSections.length >= 2) {
      menuStructure.footer1 = extractMenuItems(navSections[0], origin, categoryPatterns, pagePatterns);
      menuStructure.footer2 = extractMenuItems(navSections[1], origin, categoryPatterns, pagePatterns);
    } else {
      // Split footer items between footer1 and footer2 based on content
      const allFooterItems = extractMenuItems(footerHtml, origin, categoryPatterns, pagePatterns);
      
      // Separate categories (footer1) from pages (footer2)
      menuStructure.footer1 = allFooterItems.filter(item => item.type === 'category');
      menuStructure.footer2 = allFooterItems.filter(item => item.type === 'page' || item.type === 'external');
    }
  }

  console.log(`[Menus] Extracted: header=${menuStructure.header.length}, footer1=${menuStructure.footer1.length}, footer2=${menuStructure.footer2.length}`);
  
  return menuStructure;
}

function extractMenuItems(
  html: string,
  origin: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[]
): MenuItem[] {
  const items: MenuItem[] = [];
  const seenUrls = new Set<string>();
  
  // Find all nav/ul structures with potential hierarchy
  const navStructures = html.match(/<(?:nav|ul)[^>]*>([\s\S]*?)<\/(?:nav|ul)>/gi) || [];
  
  for (const nav of navStructures) {
    // Extract top-level li items
    const topLevelItems = extractTopLevelItems(nav, origin, categoryPatterns, pagePatterns, seenUrls);
    items.push(...topLevelItems);
  }
  
  // Fallback: extract all links if no structured nav found
  if (items.length === 0) {
    const linkPattern = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let match;
    
    while ((match = linkPattern.exec(html)) !== null) {
      const [, href, label] = match;
      if (!href || seenUrls.has(href)) continue;
      
      const fullUrl = href.startsWith('/') ? `${origin}${href}` : href;
      if (!fullUrl.startsWith(origin)) continue;
      
      seenUrls.add(href);
      
      const item = classifyLink(fullUrl, label.trim(), categoryPatterns, pagePatterns);
      if (item) {
        items.push(item);
      }
    }
  }
  
  return items;
}

function extractTopLevelItems(
  navHtml: string,
  origin: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[],
  seenUrls: Set<string>
): MenuItem[] {
  const items: MenuItem[] = [];
  
  // Match li elements with potential nested ul
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let liMatch;
  
  while ((liMatch = liPattern.exec(navHtml)) !== null) {
    const liContent = liMatch[1];
    
    // Extract the main link
    const linkMatch = liContent.match(/<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (!linkMatch) continue;
    
    const [, href, label] = linkMatch;
    if (!href || seenUrls.has(href)) continue;
    
    const fullUrl = href.startsWith('/') ? `${origin}${href}` : href;
    if (!fullUrl.startsWith(origin) && !href.startsWith('#')) continue;
    
    seenUrls.add(href);
    
    const item = classifyLink(fullUrl, label.trim(), categoryPatterns, pagePatterns);
    if (!item) continue;
    
    // Check for nested ul (submenu)
    const nestedUl = liContent.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
    if (nestedUl) {
      item.children = extractTopLevelItems(nestedUl[1], origin, categoryPatterns, pagePatterns, seenUrls);
    }
    
    items.push(item);
  }
  
  return items;
}

function classifyLink(
  url: string,
  label: string,
  categoryPatterns: RegExp[],
  pagePatterns: RegExp[]
): MenuItem | null {
  // Skip blacklisted URLs
  const blacklist = ['cart', 'carrinho', 'checkout', 'login', 'cadastro', 'search', 'busca', 'account', 'conta'];
  const path = new URL(url).pathname.toLowerCase();
  if (blacklist.some(term => path.includes(`/${term}`))) {
    return null;
  }
  
  // Check if it's a category
  for (const pattern of categoryPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(url);
    if (match) {
      const slug = match[1].toLowerCase();
      return {
        label: label || slugToLabel(slug),
        url: `/categoria/${slug}`,
        type: 'category'
      };
    }
  }
  
  // Check if it's a page
  for (const pattern of pagePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(url);
    if (match) {
      const slug = match[1].toLowerCase();
      return {
        label: label || slugToLabel(slug),
        url: `/pagina/${slug}`,
        type: 'page'
      };
    }
  }
  
  // Check for common institutional page patterns without /pages/ prefix
  const institutionalPatterns = [
    /\/(sobre|about|quem-somos|about-us)/i,
    /\/(contato|contact|fale-conosco)/i,
    /\/(politica|policy|privacidade|privacy)/i,
    /\/(termos|terms|condicoes)/i,
    /\/(troca|devolucao|exchange|return)/i,
    /\/(faq|ajuda|help|perguntas)/i,
  ];
  
  for (const pattern of institutionalPatterns) {
    const match = pattern.exec(path);
    if (match) {
      const slug = match[1].toLowerCase();
      return {
        label: label || slugToLabel(slug),
        url: `/pagina/${slug}`,
        type: 'page'
      };
    }
  }
  
  // External link
  if (url.startsWith('http') && !url.includes(new URL(url).hostname)) {
    return {
      label,
      url,
      type: 'external'
    };
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
  
  // Helper to save a menu
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
    
    // Track menu ID for cleanup
    importedMenuIds.push(menu.id);
    
    // Delete existing items
    await supabase.from('menu_items').delete().eq('menu_id', menu.id);
    
    // Insert new items with hierarchy
    let totalItems = 0;
    let sortOrder = 0;
    
    for (const item of items) {
      const refId = item.type === 'category' 
        ? categoryMap.get(item.url.replace('/categoria/', ''))
        : item.type === 'page'
          ? pageMap.get(item.url.replace('/pagina/', ''))
          : null;
      
      const { data: parentItem, error: parentError } = await supabase
        .from('menu_items')
        .insert({
          tenant_id: tenantId,
          menu_id: menu.id,
          label: item.label,
          url: item.type === 'external' ? item.url : null,
          item_type: item.type,
          ref_id: refId || null,
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
            const childRefId = child.type === 'category'
              ? categoryMap.get(child.url.replace('/categoria/', ''))
              : child.type === 'page'
                ? pageMap.get(child.url.replace('/pagina/', ''))
                : null;
            
            const { error: childError } = await supabase
              .from('menu_items')
              .insert({
                tenant_id: tenantId,
                menu_id: menu.id,
                label: child.label,
                url: child.type === 'external' ? child.url : null,
                item_type: child.type,
                ref_id: childRefId || null,
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
        job_id: null, // Structure import doesn't have a specific job
        module: 'menus',
        internal_id: menuId,
        external_id: `menu-${menuId}`,
        status: 'success',
        data: { storeUrl }
      }, {
        onConflict: 'tenant_id,module,external_id',
        ignoreDuplicates: false
      });
    }

    const totalItems = stats.header + stats.footer1 + stats.footer2;

    console.log(`[Menus] Import completed: ${totalItems} items, ${importedMenuIds.length} menus tracked`);

    return jsonResponse({
      success: true,
      stats,
      totalItems,
      menusImported: importedMenuIds.length,
      message: `Importados ${totalItems} itens de menu`
    });

  } catch (error) {
    console.error('[Menus] Unexpected error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    });
  }
});
