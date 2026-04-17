// ============================================
// CACHE PURGE INTERNAL
// v2.0.0: Hostname-based purge with purge_everything fallback
// Internal-only function for system pipelines
// ============================================
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function cloudflarePurgeRequest(
  apiToken: string,
  zoneId: string,
  body: Record<string, unknown>,
): Promise<{ success: boolean; errors?: unknown }> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const data = await res.json();
  return { success: data.success, errors: data.errors };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');

    if (!cloudflareApiToken || !cloudflareZoneId) {
      return jsonResponse({ error: 'No Cloudflare credentials configured' }, 500);
    }

    const body = await req.json();
    const hosts: string[] = body.hosts || [];

    if (hosts.length === 0) {
      return jsonResponse({ error: 'No hosts provided' }, 400);
    }

    // Strategy 1: Purge by hostname (works on all Cloudflare plans)
    const hostnameResult = await cloudflarePurgeRequest(cloudflareApiToken, cloudflareZoneId, { hosts });

    if (hostnameResult.success) {
      return jsonResponse({ success: true, method: 'hostname', hosts });
    }

    console.warn('[cache-purge-internal] Hostname purge failed, trying purge_everything...');

    // Strategy 2: purge_everything (nuclear fallback)
    const fallback = await cloudflarePurgeRequest(cloudflareApiToken, cloudflareZoneId, { purge_everything: true });

    return jsonResponse({
      success: fallback.success,
      method: 'purge_everything',
      errors: fallback.success ? undefined : fallback.errors,
    }, fallback.success ? 200 : 502);

  } catch (error) {
    console.error('Cache purge error:', error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
