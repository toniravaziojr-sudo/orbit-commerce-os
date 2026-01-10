// =====================================================
// IMPORT PAGES WITH BLOCKS - Importa páginas com blocos
// =====================================================
// Importa home page e páginas institucionais detectando
// e extraindo blocos de conteúdo de e-commerces BR
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { extractSectionsFromHTML, extractPageLinks, mapSectionTypeToBlockType } from '../_shared/ecommerce-block-extractor.ts';
import { mapClassificationToBlocks } from '../_shared/intelligent-block-mapper.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

interface ImportRequest {
  tenantId: string;
  storeUrl?: string;  // Primary parameter from UI
  url?: string;       // Alternative/legacy parameter
  importType?: 'home' | 'all' | 'single';
  platform?: string;
  pageSlug?: string;
}

interface ImportResult {
  success: boolean;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    blocksCount: number;
    type: 'home' | 'institutional';
  }>;
  stats: {
    pagesImported: number;
    totalBlocks: number;
    processingTimeMs: number;
  };
  error?: string;
}

// Fetch HTML content
async function fetchPageContent(url: string): Promise<string> {
  if (FIRECRAWL_API_KEY) {
    try {
      console.log('[import-pages] Using Firecrawl...');
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['html'],
          onlyMainContent: false,
          waitFor: 3000,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.html) {
          return data.data.html;
        }
      }
    } catch (e) {
      console.error('[import-pages] Firecrawl error:', e);
    }
  }

  // Fallback to direct fetch
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PageImporter/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  return response.text();
}

// Convert extracted sections to builder blocks
function sectionsToBuilderBlocks(sections: ReturnType<typeof extractSectionsFromHTML>) {
  const blocks: any[] = [];

  for (const section of sections) {
    if (section.confidence < 0.3) continue;

    // Map section to classification format for block mapper
    const classification = {
      sectionType: mapSectionTypeToBlockType(section.type) as any,
      layout: 'stacked' as any,
      confidence: section.confidence,
      reasoning: `Detected ${section.type} section`,
      extractedContent: {
        title: section.metadata.title || null,
        subtitle: null,
        items: [],
        images: [],
        videos: [],
        buttons: [],
        paragraphs: [],
      },
    };

    const mappedBlocks = mapClassificationToBlocks(classification);
    blocks.push(...mappedBlocks);
  }

  return blocks;
}

// Generate unique slug
async function generateUniqueSlug(supabase: any, tenantId: string, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const { data } = await supabase
      .from('store_pages')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .maybeSingle();

    if (!data) return slug;
    slug = `${baseSlug}-${suffix++}`;
  }
}

// Main handler
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { tenantId, storeUrl, url: legacyUrl, importType = 'all', platform }: ImportRequest = await req.json();

    // Support both storeUrl and url parameters
    const targetUrl = storeUrl || legacyUrl;

    if (!tenantId || !targetUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId e storeUrl são obrigatórios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[import-pages] Starting import:', { tenantId, url: targetUrl, importType, platform });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const importedPages: ImportResult['pages'] = [];
    let totalBlocks = 0;

    // Fetch home page
    console.log('[import-pages] Fetching home page...');
    const homeHtml = await fetchPageContent(targetUrl);
    console.log('[import-pages] HTML fetched:', homeHtml.length, 'chars');

    // Extract sections from home page
    const homeSections = extractSectionsFromHTML(homeHtml);
    console.log('[import-pages] Extracted', homeSections.length, 'sections from home');

    // Convert to builder blocks
    const homeBlocks = sectionsToBuilderBlocks(homeSections);
    console.log('[import-pages] Created', homeBlocks.length, 'blocks for home');

    if (homeBlocks.length > 0) {
      // Build page content
      const pageContent = {
        type: 'Page',
        id: `page-${Date.now()}`,
        props: { backgroundColor: 'transparent', padding: 'none' },
        children: homeBlocks,
      };

      // Check if home template exists
      const { data: existingTemplate } = await supabase
        .from('store_page_templates')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('page_type', 'home')
        .maybeSingle();

      if (existingTemplate) {
        // Update existing
        await supabase
          .from('store_page_templates')
          .update({
            draft_version: pageContent,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingTemplate.id);

        importedPages.push({
          id: existingTemplate.id,
          title: 'Home',
          slug: 'home',
          blocksCount: homeBlocks.length,
          type: 'home',
        });
      } else {
        // Create new
        const { data: newTemplate } = await supabase
          .from('store_page_templates')
          .insert({
            tenant_id: tenantId,
            page_type: 'home',
            content: pageContent,
            draft_version: pageContent,
          })
          .select('id')
          .single();

        if (newTemplate) {
          importedPages.push({
            id: newTemplate.id,
            title: 'Home',
            slug: 'home',
            blocksCount: homeBlocks.length,
            type: 'home',
          });
        }
      }

      totalBlocks += homeBlocks.length;
    }

    // If importing all pages, get institutional pages
    if (importType === 'all') {
      const pageLinks = extractPageLinks(homeHtml, targetUrl);
      console.log('[import-pages] Found', pageLinks.institutionalPages.length, 'institutional pages');

      // Import first 5 institutional pages
      for (const page of pageLinks.institutionalPages.slice(0, 5)) {
        try {
          console.log('[import-pages] Importing:', page.url);
          const pageHtml = await fetchPageContent(page.url);
          const pageSections = extractSectionsFromHTML(pageHtml);
          const pageBlocks = sectionsToBuilderBlocks(pageSections);

          if (pageBlocks.length > 0) {
            const slug = await generateUniqueSlug(supabase, tenantId, page.slug);
            
            const pageContent = {
              type: 'Page',
              id: `page-${Date.now()}`,
              props: { backgroundColor: 'transparent', padding: 'none' },
              children: pageBlocks,
            };

            const { data: newPage } = await supabase
              .from('store_pages')
              .insert({
                tenant_id: tenantId,
                title: page.title,
                slug,
                type: 'institutional',
                status: 'draft',
                content: pageContent,
                builder_enabled: true,
              })
              .select('id')
              .single();

            if (newPage) {
              importedPages.push({
                id: newPage.id,
                title: page.title,
                slug,
                blocksCount: pageBlocks.length,
                type: 'institutional',
              });
              totalBlocks += pageBlocks.length;
            }
          }
        } catch (e) {
          console.error('[import-pages] Error importing page:', page.url, e);
        }
      }
    }

    // Calculate home sections count
    const homeSectionsCount = importedPages.find(p => p.type === 'home')?.blocksCount || 0;
    const pagesImported = importedPages.filter(p => p.type === 'institutional').length;

    // Build response with both legacy and new field names for compatibility
    const result = {
      success: true,
      pages: importedPages,
      // New field names expected by UI
      homeSectionsCount,
      pagesImported,
      totalSections: totalBlocks,
      // Legacy stats object
      stats: {
        pagesImported: importedPages.length,
        totalBlocks,
        processingTimeMs: Date.now() - startTime,
      },
      // Additional info
      homeTemplate: importedPages.find(p => p.type === 'home') ? {
        id: importedPages.find(p => p.type === 'home')!.id,
      } : null,
    };

    console.log('[import-pages] Complete:', result.stats);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[import-pages] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        pages: [],
        homeSectionsCount: 0,
        pagesImported: 0,
        totalSections: 0,
        stats: { pagesImported: 0, totalBlocks: 0, processingTimeMs: Date.now() - startTime },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
