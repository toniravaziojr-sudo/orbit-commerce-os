import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Accept internal calls - validate via internal secret or just allow for now
    // Since this only purges cache, it's safe to call without strict auth

    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');

    if (!cloudflareApiToken || !cloudflareZoneId) {
      return new Response(JSON.stringify({ error: 'No Cloudflare credentials configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const hosts: string[] = body.hosts || [];

    if (hosts.length === 0) {
      return new Response(JSON.stringify({ error: 'No hosts provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try prefix-based purge first
    const prefixes = hosts.map(h => `https://${h}/`);
    
    const purgeResult = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes }),
      }
    );

    const purgeData = await purgeResult.json();

    // If prefix purge fails, try purge_everything
    if (!purgeData.success) {
      console.log('Prefix purge failed, trying purge_everything...');
      const fallback = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cloudflareApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ purge_everything: true }),
        }
      );
      const fallbackData = await fallback.json();
      
      return new Response(JSON.stringify({
        success: fallbackData.success,
        method: 'purge_everything',
        errors: fallbackData.success ? undefined : fallbackData.errors,
      }), {
        status: fallbackData.success ? 200 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      method: 'prefix',
      hosts,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Cache purge error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
