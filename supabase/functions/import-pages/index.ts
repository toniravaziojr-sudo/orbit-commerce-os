import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstitutionalPage {
  title: string;
  slug: string;
  url: string;
  source: 'footer' | 'header' | 'sitemap';
}

interface ImportPagesRequest {
  tenantId: string;
  pages: InstitutionalPage[];
  platform?: string;
}

// Generate a unique block ID
function generateBlockId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Generate page content structure for Builder
function generatePageContent(htmlContent: string, pageTitle: string): object {
  return {
    id: generateBlockId('page'),
    type: 'Page',
    props: {},
    children: [
      {
        id: generateBlockId('Header'),
        type: 'Header',
        props: {},
      },
      {
        id: generateBlockId('Section'),
        type: 'Section',
        props: { paddingY: 48 },
        children: [
          {
            id: generateBlockId('RichText'),
            type: 'RichText',
            props: {
              title: pageTitle,
              content: htmlContent,
            },
          },
        ],
      },
      {
        id: generateBlockId('Footer'),
        type: 'Footer',
        props: {},
      },
    ],
  };
}

// Scrape page content using Firecrawl
async function scrapePageContent(url: string): Promise<{ html: string; title: string; description: string } | null> {
  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return null;
    }

    console.log(`Scraping page: ${url}`);

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['html', 'markdown'],
        onlyMainContent: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(`Failed to scrape ${url}:`, data.error);
      return null;
    }

    const html = data.data?.html || '';
    const title = data.data?.metadata?.title || '';
    const description = data.data?.metadata?.description || '';

    // Extract main content from HTML - remove scripts, styles, nav, header, footer
    const cleanedHtml = cleanHtmlContent(html);

    return { html: cleanedHtml, title, description };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

// Clean HTML content for safe display
function cleanHtmlContent(html: string): string {
  if (!html) return '';

  // Remove scripts, styles, and other unwanted elements
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // Remove event handlers
  cleaned = cleaned.replace(/\s*on\w+="[^"]*"/gi, '');

  // Try to extract main content area
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(cleaned);
  if (mainMatch) {
    cleaned = mainMatch[1];
  } else {
    // Try article
    const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(cleaned);
    if (articleMatch) {
      cleaned = articleMatch[1];
    } else {
      // Try div with content-related class
      const contentMatch = /<div[^>]*class="[^"]*(?:content|main|page|body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(cleaned);
      if (contentMatch) {
        cleaned = contentMatch[1];
      }
    }
  }

  // Keep only allowed tags
  const allowedTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote'];
  
  // Simple tag filter - keep structure but remove classes/ids
  cleaned = cleaned.replace(/<(\w+)[^>]*>/gi, (match, tag) => {
    const lowerTag = tag.toLowerCase();
    if (allowedTags.includes(lowerTag)) {
      // Keep href for links
      if (lowerTag === 'a') {
        const hrefMatch = /href="([^"]+)"/.exec(match);
        return hrefMatch ? `<a href="${hrefMatch[1]}">` : '<a>';
      }
      return `<${lowerTag}>`;
    }
    return '';
  });

  // Close unmatched tags
  cleaned = cleaned.replace(/<\/(\w+)>/gi, (match, tag) => {
    const lowerTag = tag.toLowerCase();
    if (allowedTags.includes(lowerTag)) {
      return `</${lowerTag}>`;
    }
    return '';
  });

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || '<p>Conteúdo da página</p>';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tenantId, pages } = await req.json() as ImportPagesRequest;

    if (!tenantId || !pages || !Array.isArray(pages)) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId e pages são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Importing ${pages.length} institutional pages for tenant ${tenantId}`);

    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
      pages: [] as { slug: string; title: string }[],
    };

    for (const page of pages) {
      try {
        // Check if page already exists
        const { data: existing } = await supabase
          .from('store_pages')
          .select('id, slug')
          .eq('tenant_id', tenantId)
          .eq('slug', page.slug)
          .maybeSingle();

        if (existing) {
          console.log(`Page ${page.slug} already exists, skipping`);
          results.skipped++;
          continue;
        }

        // Scrape page content
        const scraped = await scrapePageContent(page.url);

        let pageContent: object;
        let seoTitle = page.title;
        let seoDescription = '';

        if (scraped) {
          pageContent = generatePageContent(scraped.html, scraped.title || page.title);
          seoTitle = scraped.title || page.title;
          seoDescription = scraped.description || '';
        } else {
          // Create placeholder page if scraping failed
          pageContent = generatePageContent(`<p>Conteúdo de ${page.title}</p>`, page.title);
        }

        // Insert page
        const { error: insertError } = await supabase
          .from('store_pages')
          .insert({
            tenant_id: tenantId,
            title: page.title,
            slug: page.slug,
            type: 'institutional',
            status: 'published',
            content: pageContent,
            is_published: true,
            is_system: false,
            seo_title: seoTitle,
            seo_description: seoDescription,
          });

        if (insertError) {
          console.error(`Error inserting page ${page.slug}:`, insertError);
          results.failed++;
          results.errors.push(`${page.slug}: ${insertError.message}`);
        } else {
          console.log(`Imported page: ${page.slug}`);
          results.imported++;
          results.pages.push({ slug: page.slug, title: page.title });
        }
      } catch (error) {
        console.error(`Error processing page ${page.slug}:`, error);
        results.failed++;
        results.errors.push(`${page.slug}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`Import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Import pages error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
