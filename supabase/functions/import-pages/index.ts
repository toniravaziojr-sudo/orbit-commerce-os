import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { mapClassificationToBlocks, type BlockNode, type ClassificationResult } from '../_shared/intelligent-block-mapper.ts';
import { composePageStructure, validatePageQuality } from '../_shared/page-composer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// =====================================================
// INTELLIGENT PAGE IMPORTER v2
// =====================================================
// Flow:
// 1. Fetch HTML from URL
// 2. Extract main content (remove header/footer/nav)
// 3. Segment HTML into smaller sections (improved multi-platform)
// 4. Preprocess each section (remove noise)
// 5. Classify each section with AI
// 6. Map classifications to native blocks
// 7. Compose page structure (order, deduplicate)
// 8. Validate quality
// 9. Save to database
// =====================================================

interface ImportRequest {
  tenantId: string;
  url: string;
  slug?: string;
  title?: string;
}

// =====================================================
// HTML FETCHING
// =====================================================
async function fetchHtml(url: string): Promise<{ html: string; title: string }> {
  console.log(`[FETCH] Fetching URL: ${url}`);
  
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  
  if (firecrawlKey) {
    try {
      console.log('[FETCH] Using Firecrawl...');
      const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          pageOptions: {
            onlyMainContent: false,
            includeHtml: true,
            waitFor: 3000,
          },
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.html) {
          console.log(`[FETCH] Firecrawl success: ${data.data.html.length} chars`);
          return {
            html: data.data.html,
            title: data.data.metadata?.title || extractTitleFromHtml(data.data.html) || 'Página Importada',
          };
        }
      }
      console.warn('[FETCH] Firecrawl failed, falling back to direct fetch');
    } catch (err) {
      console.warn('[FETCH] Firecrawl error:', err);
    }
  }
  
  // Direct fetch fallback
  console.log('[FETCH] Using direct fetch...');
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status}`);
  }
  
  const html = await response.text();
  console.log(`[FETCH] Direct fetch success: ${html.length} chars`);
  
  return {
    html,
    title: extractTitleFromHtml(html) || 'Página Importada',
  };
}

function extractTitleFromHtml(html: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].trim().split('|')[0].split('-')[0].trim();
  }
  return null;
}

// =====================================================
// HTML SEGMENTATION (Simple)
// =====================================================
function extractMainContent(html: string): string {
  // Try to find <main>
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    console.log('[SEGMENT] Found <main> tag');
    return mainMatch[1];
  }
  
  // Try article
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    console.log('[SEGMENT] Found <article> tag');
    return articleMatch[1];
  }
  
  // Fallback: extract body content, remove obvious nav/footer
  let content = html;
  
  // Remove header/nav
  content = content.replace(/<header[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<nav[\s\S]*?<\/nav>/gi, '');
  
  // Remove footer
  content = content.replace(/<footer[\s\S]*?<\/footer>/gi, '');
  
  // Remove scripts and styles
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  
  // Try to find body
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }
  
  console.log(`[SEGMENT] Extracted content: ${content.length} chars`);
  return content;
}

interface Section {
  html: string;
  index: number;
}

function segmentHtml(html: string): Section[] {
  const sections: Section[] = [];
  
  // =====================================================
  // MULTI-PLATFORM SEGMENTATION
  // Supports: Shopify, Dooca, VTEX, Nuvemshop, WooCommerce, Generic
  // =====================================================
  
  // 1. Try Shopify sections first
  const shopifyRegex = /(<div[^>]*(?:class="[^"]*shopify-section[^"]*"|id="shopify-section-[^"]*")[^>]*>[\s\S]*?)(?=<div[^>]*(?:class="[^"]*shopify-section|id="shopify-section-)|$)/gi;
  let matches = [...html.matchAll(shopifyRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[1].trim().length > 100) {
        sections.push({ html: match[1], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] Shopify: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  
  // 2. Try Dooca/Tray sections
  const doocaRegex = /<(?:section|div)[^>]*(?:class="[^"]*(?:section-|dooca-|tray-)[^"]*")[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(doocaRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] Dooca/Tray: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 3. Try VTEX sections
  const vtexRegex = /<(?:section|div)[^>]*(?:class="[^"]*vtex[^"]*"|data-vtex[^>]*)[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(vtexRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] VTEX: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 4. Try Nuvemshop sections
  const nuvemRegex = /<(?:section|div)[^>]*(?:class="[^"]*(?:js-|nuvem-|section)[^"]*"|id="section-[^"]*")[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(nuvemRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] Nuvemshop: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 5. Try WooCommerce/WordPress sections
  const wooRegex = /<(?:section|div)[^>]*class="[^"]*(?:wp-block-|woocommerce-|elementor-)[^"]*"[^>]*>[\s\S]*?<\/(?:section|div)>/gi;
  matches = [...html.matchAll(wooRegex)];
  if (matches.length >= 2) {
    for (const match of matches) {
      if (match[0].trim().length > 100) {
        sections.push({ html: match[0], index: sections.length });
      }
    }
    if (sections.length >= 2) {
      console.log(`[SEGMENT] WooCommerce/WordPress: ${sections.length} sections`);
      return subdivideIfNeeded(sections);
    }
  }
  sections.length = 0;
  
  // 6. Try generic <section> tags
  const sectionMatches = html.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/gi);
  for (const match of sectionMatches) {
    if (match[0].trim().length > 100) {
      sections.push({ html: match[0], index: sections.length });
    }
  }
  if (sections.length >= 2) {
    console.log(`[SEGMENT] Generic <section>: ${sections.length} sections`);
    return subdivideIfNeeded(sections);
  }
  sections.length = 0;
  
  // 7. Try splitting by semantic dividers (h2, h3, hr, large row divs)
  const semanticParts = html.split(/(?=<h[23][^>]*>)|<hr[^>]*>|(?=<div[^>]*class="[^"]*(?:row|container|wrapper)[^"]*"[^>]*>)/gi);
  for (const part of semanticParts) {
    if (part.trim().length > 200) {
      sections.push({ html: part.trim(), index: sections.length });
    }
  }
  if (sections.length >= 2) {
    console.log(`[SEGMENT] Semantic split: ${sections.length} sections`);
    return subdivideIfNeeded(sections);
  }
  
  // 8. Last resort: treat entire content as one section but try to subdivide
  console.log('[SEGMENT] Using entire content, attempting subdivision');
  return subdivideIfNeeded([{ html, index: 0 }]);
}

// Subdivide large sections (>4000 chars) by headings - REDUCED threshold
function subdivideIfNeeded(sections: Section[]): Section[] {
  const result: Section[] = [];
  const MAX_SECTION_SIZE = 4000; // Reduced from 10000
  
  for (const section of sections) {
    if (section.html.length > MAX_SECTION_SIZE) {
      // Try to split by h2/h3/h4
      const parts = section.html.split(/(?=<h[2-4][^>]*>)/gi);
      if (parts.length > 1) {
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed.length > 100 && trimmed.length <= MAX_SECTION_SIZE * 2) {
            result.push({ html: trimmed, index: result.length });
          } else if (trimmed.length > MAX_SECTION_SIZE * 2) {
            // Still too large, split by divs with common classes
            const subParts = trimmed.split(/(?=<div[^>]*class="[^"]*(?:row|container|wrapper|section|block)[^"]*"[^>]*>)/gi);
            for (const subPart of subParts) {
              if (subPart.trim().length > 100) {
                result.push({ html: subPart.trim(), index: result.length });
              }
            }
          }
        }
        console.log(`[SEGMENT] Subdivided large section (${section.html.length} chars) into ${result.length - result.length + parts.length} parts`);
        continue;
      }
    }
    result.push({ ...section, index: result.length });
  }
  
  return result;
}

// Preprocess section HTML to remove noise before AI analysis
function preprocessSection(html: string): string {
  return html
    // Remove scripts, styles, noscript
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Remove SVGs (often decorative)
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove empty tags
    .replace(/<(\w+)[^>]*>\s*<\/\1>/gi, '')
    // Remove inline styles (reduce noise)
    .replace(/\s*style="[^"]*"/gi, '')
    // Remove data attributes (reduce noise)
    .replace(/\s*data-[a-z-]+="[^"]*"/gi, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// =====================================================
// AI CLASSIFICATION
// =====================================================
async function classifySection(
  html: string,
  pageTitle: string,
  sectionIndex: number,
  totalSections: number
): Promise<ClassificationResult | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[CLASSIFY] Missing Supabase config');
    return null;
  }
  
  try {
    console.log(`[CLASSIFY] Classifying section ${sectionIndex + 1}/${totalSections} (${html.length} chars)`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/classify-content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        html,
        pageContext: {
          title: pageTitle,
          sectionIndex,
          totalSections,
        },
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CLASSIFY] API error: ${response.status}`, errorText);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.success || !data.classification) {
      console.warn('[CLASSIFY] Classification failed:', data.error);
      return null;
    }
    
    console.log(`[CLASSIFY] Result: type=${data.classification.sectionType}, conf=${data.classification.confidence}`);
    return data.classification;
    
  } catch (error) {
    console.error('[CLASSIFY] Error:', error);
    return null;
  }
}

// =====================================================
// PAGE BUILDING
// =====================================================
function buildPageContent(blocks: BlockNode[]): BlockNode {
  return {
    id: `page-${Date.now().toString(36)}`,
    type: 'Page',
    props: {},
    children: blocks,
  };
}

// =====================================================
// SLUG GENERATION
// =====================================================
function generateSlug(url: string, title?: string): string {
  // Try to extract from URL path
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
    const lastPart = pathParts[pathParts.length - 1];
    
    if (lastPart && lastPart.length > 2 && !lastPart.includes('.')) {
      return lastPart.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }
  } catch {}
  
  // Fallback to title
  if (title) {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  return `pagina-${Date.now().toString(36)}`;
}

// =====================================================
// MAIN HANDLER
// =====================================================
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { tenantId, url, slug: customSlug, title: customTitle } = await req.json() as ImportRequest;
    
    // Validate
    if (!tenantId || !url) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId e url são obrigatórios' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    console.log(`[IMPORT] Starting import for tenant ${tenantId}: ${url}`);
    
    // 1. Fetch HTML
    const { html, title: extractedTitle } = await fetchHtml(url);
    const pageTitle = customTitle || extractedTitle;
    
    // 2. Extract main content
    const mainContent = extractMainContent(html);
    
    // 3. Segment into sections
    const sections = segmentHtml(mainContent);
    console.log(`[IMPORT] Found ${sections.length} sections`);
    
    // 4. Classify each section and build blocks
    const allBlocks: BlockNode[] = [];
    
    for (const section of sections) {
      // Preprocess section to remove noise
      const cleanedHtml = preprocessSection(section.html);
      
      // Skip sections that are too small after cleaning
      if (cleanedHtml.length < 100) {
        console.log(`[IMPORT] Section ${section.index + 1}: skipped (too small after preprocessing)`);
        continue;
      }
      
      const classification = await classifySection(
        cleanedHtml,
        pageTitle,
        section.index,
        sections.length
      );
      
      if (classification) {
        const blocks = mapClassificationToBlocks(classification);
        allBlocks.push(...blocks);
        console.log(`[IMPORT] Section ${section.index + 1}: ${classification.sectionType} -> ${blocks.length} blocks`);
      } else {
        console.log(`[IMPORT] Section ${section.index + 1}: classification failed, skipping`);
      }
    }
    
    // 5. Compose page structure (order + deduplicate)
    const composedBlocks = composePageStructure(allBlocks);
    console.log(`[IMPORT] Composed: ${allBlocks.length} raw blocks -> ${composedBlocks.length} ordered blocks`);
    
    // 6. Validate quality
    const quality = validatePageQuality(composedBlocks);
    console.log(`[IMPORT] Quality: score=${quality.score}, valid=${quality.valid}`);
    if (quality.issues.length > 0) {
      console.log(`[IMPORT] Quality issues: ${quality.issues.join(', ')}`);
    }
    
    // 7. Build page content
    if (composedBlocks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Não foi possível extrair conteúdo da página. A página pode estar vazia ou protegida.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    const pageContent = buildPageContent(composedBlocks);
    const slug = customSlug || generateSlug(url, pageTitle);
    
    // 8. Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check for existing page with same slug
    const { data: existingPage } = await supabase
      .from('store_pages')
      .select('id, slug')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .single();
    
    if (existingPage) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Já existe uma página com o slug "${slug}"`,
          existingPageId: existingPage.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }
    
    // Create the page
    const { data: newPage, error: insertError } = await supabase
      .from('store_pages')
      .insert({
        tenant_id: tenantId,
        title: pageTitle,
        slug,
        content: pageContent,
        status: 'draft',
        is_published: false,
        type: 'institutional',
        seo_title: pageTitle,
        seo_description: `Página ${pageTitle}`,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[IMPORT] Database error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: `Erro ao salvar: ${insertError.message}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    console.log(`[IMPORT] Success! Page created: ${newPage.id} (${slug})`);
    
    return new Response(
      JSON.stringify({
        success: true,
        page: {
          id: newPage.id,
          slug: newPage.slug,
          title: newPage.title,
        },
        stats: {
          sectionsFound: sections.length,
          blocksCreated: composedBlocks.length,
          rawBlocks: allBlocks.length,
          qualityScore: quality.score,
          qualityIssues: quality.issues,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[IMPORT] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
