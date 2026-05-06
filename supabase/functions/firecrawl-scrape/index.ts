import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
import { chargeAfter } from "../_shared/credits/charge-after.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const { url, options, tenant_id } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Scraping URL:', formattedUrl);

    const includeScreenshot = options?.includeScreenshot ?? false;
    const baseFormats = options?.formats || ['markdown', 'html', 'links'];
    const formats = includeScreenshot && !baseFormats.includes('screenshot')
      ? [...baseFormats, 'screenshot']
      : baseFormats;

    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats,
        onlyMainContent: options?.onlyMainContent ?? false,
        waitFor: options?.waitFor || (includeScreenshot ? 3000 : undefined),
        location: options?.location,
        screenshot: includeScreenshot ? {
          fullPage: options?.fullPageScreenshot ?? true,
        } : undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Request failed with status ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const screenshot = data.data?.screenshot || data.screenshot;
    console.log('Scrape successful', screenshot ? '(with screenshot)' : '(no screenshot)');

    // Cobrança pós-uso (motor universal). Requer tenant_id no body.
    if (tenant_id) {
      chargeAfter({
        tenantId: tenant_id,
        serviceKey: "firecrawl-scrape-page",
        units: { pages: 1 },
        jobId: `${Date.now()}-${formattedUrl}`,
        feature: "firecrawl-scrape",
        metadata: { url: formattedUrl, screenshot: !!screenshot },
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to scrape';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
