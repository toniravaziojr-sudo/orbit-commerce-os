// Extract banner images from a category page
// Fetches the category URL and extracts hero/banner images for desktop and mobile

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CategoryBannerResult {
  success: boolean;
  bannerDesktop?: string;
  bannerMobile?: string;
  error?: string;
}

function extractBannerFromHtml(html: string, baseUrl: string): { desktop?: string; mobile?: string } {
  const result: { desktop?: string; mobile?: string } = {};
  
  // Helper to normalize URLs
  const normalizeUrl = (src: string): string => {
    if (!src) return '';
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) return `${baseUrl}${src}`;
    if (src.startsWith('http')) return src;
    return `${baseUrl}/${src}`;
  };

  // Strategy 1: Look for common category banner patterns
  // Shopify collection banner patterns
  const bannerPatterns = [
    // Shopify collection-hero
    /<div[^>]*class="[^"]*collection-hero[^"]*"[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>/gi,
    // Collection banner image
    /<img[^>]*class="[^"]*(?:collection|category)[-_]?(?:banner|hero|image)[^"]*"[^>]*src=["']([^"']+)["'][^>]*>/gi,
    // Background image in style
    /class="[^"]*(?:collection|category)[-_]?(?:banner|hero)[^"]*"[^>]*style="[^"]*background[-_]?image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi,
    // Picture element with source
    /<picture[^>]*>[\s\S]*?<source[^>]*media=["']\([^"']*min-width[^"']*\)["'][^>]*srcset=["']([^"']+)["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>[\s\S]*?<\/picture>/gi,
    // Standard hero/banner sections
    /<section[^>]*class="[^"]*(?:hero|banner|collection-header)[^"]*"[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>/gi,
  ];

  // Try to find banners
  for (const pattern of bannerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const imgUrl = match[1] || match[2];
      if (imgUrl && !result.desktop) {
        result.desktop = normalizeUrl(imgUrl);
        
        // Look for mobile variant nearby
        if (match[2]) {
          result.mobile = normalizeUrl(match[2]);
        }
      }
    }
    if (result.desktop) break;
  }

  // Strategy 2: Look for srcset with mobile/desktop variants
  if (!result.desktop) {
    const srcsetPattern = /<img[^>]*(?:class="[^"]*(?:banner|hero|collection)[^"]*"[^>]*)?srcset=["']([^"']+)["'][^>]*>/gi;
    let srcsetMatch;
    while ((srcsetMatch = srcsetPattern.exec(html)) !== null) {
      const srcset = srcsetMatch[1];
      // Parse srcset entries
      const entries = srcset.split(',').map(s => {
        const parts = s.trim().split(/\s+/);
        const url = parts[0];
        const width = parseInt(parts[1] || '0');
        return { url, width };
      }).filter(e => e.url);

      if (entries.length > 0) {
        // Sort by width
        entries.sort((a, b) => b.width - a.width);
        // Largest = desktop, smallest = mobile
        if (entries.length > 0) {
          result.desktop = normalizeUrl(entries[0].url);
        }
        if (entries.length > 1) {
          result.mobile = normalizeUrl(entries[entries.length - 1].url);
        }
        break;
      }
    }
  }

  // Strategy 3: Look for any large image in the header section
  if (!result.desktop) {
    const headerPattern = /<header[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
    const headerMatch = headerPattern.exec(html);
    if (headerMatch) {
      result.desktop = normalizeUrl(headerMatch[1]);
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { categoryUrl } = await req.json();

    if (!categoryUrl) {
      return new Response(
        JSON.stringify({ success: false, error: 'categoryUrl é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting banners from category:', categoryUrl);

    // Parse base URL
    let baseUrl = '';
    try {
      const urlObj = new URL(categoryUrl);
      baseUrl = urlObj.origin;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'URL inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the category page
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch category page:', response.status);
      return new Response(
        JSON.stringify({ success: false, error: `Falha ao acessar página: ${response.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    const banners = extractBannerFromHtml(html, baseUrl);

    console.log('Extracted banners:', banners);

    return new Response(
      JSON.stringify({
        success: true,
        bannerDesktop: banners.desktop || null,
        bannerMobile: banners.mobile || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting category banners:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao extrair banners',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
