import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InstitutionalPage {
  title: string;
  slug: string;
  url: string;
  source: 'footer' | 'header' | 'sitemap' | 'global';
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
async function scrapePageContent(url: string): Promise<{ html: string; markdown: string; title: string; description: string } | null> {
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
        waitFor: 2000, // Wait for dynamic content
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error(`Failed to scrape ${url}:`, data.error || JSON.stringify(data));
      return null;
    }

    // Firecrawl v1 response structure: data.data.html, data.data.markdown, etc.
    const rawHtml = data.data?.html || data.html || '';
    const markdown = data.data?.markdown || data.markdown || '';
    const title = data.data?.metadata?.title || data.metadata?.title || '';
    const description = data.data?.metadata?.description || data.metadata?.description || '';

    console.log(`Scraped ${url}: html length=${rawHtml.length}, markdown length=${markdown.length}`);

    // Clean the HTML content while preserving important elements
    const cleanedHtml = cleanHtmlContent(rawHtml, markdown);

    return { html: cleanedHtml, markdown, title, description };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

// Clean HTML content for safe display - preserve more content
function cleanHtmlContent(html: string, markdown?: string): string {
  if (!html && !markdown) return '';

  // If HTML is too short or looks like an error, try to convert markdown to HTML
  if (html.length < 100 && markdown && markdown.length > 50) {
    console.log('HTML too short, using markdown converted to HTML');
    return convertMarkdownToHtml(markdown);
  }

  let cleaned = html;

  // Remove dangerous elements first
  cleaned = cleaned
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // Remove event handlers
  cleaned = cleaned.replace(/\s*on\w+="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s*on\w+='[^']*'/gi, '');

  // Remove navigation/layout elements that are not content
  cleaned = cleaned
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  // Try to extract main content area
  let mainContent = '';
  
  // Priority 1: <main> element
  const mainMatch = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(cleaned);
  if (mainMatch && mainMatch[1].length > 100) {
    mainContent = mainMatch[1];
  }
  
  // Priority 2: <article> element
  if (!mainContent) {
    const articleMatch = /<article[^>]*>([\s\S]*?)<\/article>/i.exec(cleaned);
    if (articleMatch && articleMatch[1].length > 100) {
      mainContent = articleMatch[1];
    }
  }
  
  // Priority 3: Shopify page content
  if (!mainContent) {
    const shopifyMatch = /<div[^>]*id="?MainContent"?[^>]*>([\s\S]*?)<\/div>\s*(?:<\/main>|$)/i.exec(cleaned);
    if (shopifyMatch && shopifyMatch[1].length > 100) {
      mainContent = shopifyMatch[1];
    }
  }
  
  // Priority 4: div with content/page class
  if (!mainContent) {
    const contentMatch = /<div[^>]*class="[^"]*(?:page-content|content|rte|entry-content)[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(cleaned);
    if (contentMatch && contentMatch[1].length > 100) {
      mainContent = contentMatch[1];
    }
  }

  // Priority 5: Use full body or cleaned content
  if (!mainContent) {
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(cleaned);
    if (bodyMatch) {
      mainContent = bodyMatch[1];
    } else {
      mainContent = cleaned;
    }
  }

  // Keep more tags - including images, videos, iframes (YouTube/Vimeo)
  const allowedTags = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark',
    'ul', 'ol', 'li',
    'a',
    'span', 'div',
    'blockquote', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'img',
    'figure', 'figcaption',
    'video', 'source',
    'iframe', // For YouTube/Vimeo embeds
  ];

  // Process tags - keep allowed ones with safe attributes
  mainContent = mainContent.replace(/<(\w+)([^>]*)>/gi, (match, tag, attrs) => {
    const lowerTag = tag.toLowerCase();
    if (!allowedTags.includes(lowerTag)) {
      return '';
    }

    // Keep specific attributes based on tag type
    let safeAttrs = '';
    
    if (lowerTag === 'a') {
      const hrefMatch = /href="([^"]+)"/.exec(attrs);
      const targetMatch = /target="([^"]+)"/.exec(attrs);
      if (hrefMatch) safeAttrs += ` href="${hrefMatch[1]}"`;
      if (targetMatch) safeAttrs += ` target="${targetMatch[1]}"`;
    } else if (lowerTag === 'img') {
      const srcMatch = /src="([^"]+)"/.exec(attrs);
      const altMatch = /alt="([^"]+)"/.exec(attrs);
      const widthMatch = /width="([^"]+)"/.exec(attrs);
      const heightMatch = /height="([^"]+)"/.exec(attrs);
      if (srcMatch) safeAttrs += ` src="${srcMatch[1]}"`;
      if (altMatch) safeAttrs += ` alt="${altMatch[1]}"`;
      if (widthMatch) safeAttrs += ` width="${widthMatch[1]}"`;
      if (heightMatch) safeAttrs += ` height="${heightMatch[1]}"`;
    } else if (lowerTag === 'iframe') {
      const srcMatch = /src="([^"]+)"/.exec(attrs);
      // Only allow YouTube/Vimeo iframes
      if (srcMatch && /(youtube|vimeo|youtu\.be)/i.test(srcMatch[1])) {
        safeAttrs += ` src="${srcMatch[1]}"`;
        const widthMatch = /width="([^"]+)"/.exec(attrs);
        const heightMatch = /height="([^"]+)"/.exec(attrs);
        if (widthMatch) safeAttrs += ` width="${widthMatch[1]}"`;
        if (heightMatch) safeAttrs += ` height="${heightMatch[1]}"`;
        safeAttrs += ' frameborder="0" allowfullscreen';
      } else {
        return ''; // Skip non-video iframes
      }
    } else if (lowerTag === 'video' || lowerTag === 'source') {
      const srcMatch = /src="([^"]+)"/.exec(attrs);
      const typeMatch = /type="([^"]+)"/.exec(attrs);
      if (srcMatch) safeAttrs += ` src="${srcMatch[1]}"`;
      if (typeMatch) safeAttrs += ` type="${typeMatch[1]}"`;
      if (lowerTag === 'video') safeAttrs += ' controls';
    }

    return `<${lowerTag}${safeAttrs}>`;
  });

  // Close unmatched tags
  mainContent = mainContent.replace(/<\/(\w+)>/gi, (match, tag) => {
    const lowerTag = tag.toLowerCase();
    return allowedTags.includes(lowerTag) ? `</${lowerTag}>` : '';
  });

  // Clean up excessive whitespace but preserve structure
  mainContent = mainContent
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/>\s+</g, '> <')
    .trim();

  // If still too short or empty, try markdown fallback
  if (mainContent.length < 50 && markdown && markdown.length > 50) {
    console.log('Cleaned HTML too short, using markdown converted to HTML');
    return convertMarkdownToHtml(markdown);
  }

  return mainContent || '<p>Conteúdo da página</p>';
}

// Convert markdown to basic HTML
function convertMarkdownToHtml(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^\*\*\*+$/gm, '<hr>');

  // Lists
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Wrap consecutive li elements in ul/ol
  html = html.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs - wrap remaining text blocks
  const lines = html.split('\n');
  const processed: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processed.push('');
    } else if (
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<img') ||
      trimmed.startsWith('<blockquote')
    ) {
      processed.push(trimmed);
    } else {
      processed.push(`<p>${trimmed}</p>`);
    }
  }

  return processed.join('\n').replace(/<p><\/p>/g, '').trim();
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
      pages: [] as { slug: string; title: string; hasContent: boolean }[],
    };

    for (const page of pages) {
      try {
        // Normalize slug - remove leading slash
        const normalizedSlug = page.slug.replace(/^\/+/, '').toLowerCase();
        
        // Check if page already exists
        const { data: existing } = await supabase
          .from('store_pages')
          .select('id, slug')
          .eq('tenant_id', tenantId)
          .eq('slug', normalizedSlug)
          .maybeSingle();

        if (existing) {
          console.log(`Page ${normalizedSlug} already exists, skipping`);
          results.skipped++;
          continue;
        }

        // Scrape page content
        const scraped = await scrapePageContent(page.url);

        let pageContent: object;
        let seoTitle = page.title;
        let seoDescription = '';
        let hasRealContent = false;

        if (scraped && (scraped.html.length > 100 || scraped.markdown.length > 100)) {
          pageContent = generatePageContent(scraped.html, scraped.title || page.title);
          seoTitle = scraped.title || page.title;
          seoDescription = scraped.description || '';
          hasRealContent = true;
          console.log(`Page ${normalizedSlug} has real content: ${scraped.html.length} chars`);
        } else {
          // Create as DRAFT if no content was extracted (don't publish empty pages)
          console.warn(`Page ${normalizedSlug} has no content, creating as draft`);
          pageContent = generatePageContent(`<p>Conteúdo de ${page.title} não pôde ser importado automaticamente.</p>`, page.title);
        }

        // Insert page - published only if has real content
        const { error: insertError } = await supabase
          .from('store_pages')
          .insert({
            tenant_id: tenantId,
            title: page.title,
            slug: normalizedSlug,
            type: 'institutional',
            status: hasRealContent ? 'published' : 'draft',
            content: pageContent,
            is_published: hasRealContent,
            is_system: false,
            seo_title: seoTitle,
            seo_description: seoDescription,
          });

        if (insertError) {
          console.error(`Error inserting page ${normalizedSlug}:`, insertError);
          results.failed++;
          results.errors.push(`${page.title} (${normalizedSlug}): ${insertError.message}`);
        } else {
          console.log(`Imported page: ${normalizedSlug} (hasContent: ${hasRealContent})`);
          results.imported++;
          results.pages.push({ 
            slug: normalizedSlug, 
            title: page.title,
            hasContent: hasRealContent,
          });
        }
      } catch (error) {
        console.error(`Error processing page ${page.slug}:`, error);
        results.failed++;
        results.errors.push(`${page.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
