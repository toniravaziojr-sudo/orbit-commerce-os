// ============================================
// STOREFRONT CACHE PURGE
// v2.0.0: Hostname-based purge (works on all Cloudflare plans)
//         + purge_everything fallback + sequential confirmation
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const VERSION = "v2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ResourceType = 'product' | 'category' | 'template' | 'settings' | 'menu' | 'full';

interface PurgeRequest {
  tenant_id: string;
  resource_type: ResourceType;
  resource_slug?: string;
}

// ── Auth helpers ──

async function authenticateCaller(
  req: Request,
  supabaseUrl: string,
  supabaseServiceKey: string,
): Promise<{ isServiceRole: boolean; userId: string | null; error?: Response }> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return {
      isServiceRole: false,
      userId: null,
      error: jsonResponse({ error: 'Unauthorized' }, 401),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  if (token === supabaseServiceKey) {
    return { isServiceRole: true, userId: null };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return {
      isServiceRole: false,
      userId: null,
      error: jsonResponse({ error: 'Invalid token' }, 401),
    };
  }

  return { isServiceRole: false, userId: user.id };
}

async function authorizeTenant(
  supabaseUrl: string,
  supabaseServiceKey: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .single();
  return !!role;
}

// ── Domain resolution ──

async function resolveHostsForTenant(
  supabaseUrl: string,
  supabaseServiceKey: string,
  tenantId: string,
): Promise<string[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const [domainsResult, tenantResult] = await Promise.all([
    supabase
      .from('tenant_domains')
      .select('domain')
      .eq('tenant_id', tenantId)
      .in('status', ['verified', 'active'])
      .eq('ssl_status', 'active'),
    supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single(),
  ]);

  const hosts: string[] = [];
  if (domainsResult.data) {
    domainsResult.data.forEach((d: any) => hosts.push(d.domain));
  }
  if (tenantResult.data?.slug) {
    hosts.push(`${tenantResult.data.slug}.shops.comandocentral.com.br`);
  }
  return hosts;
}

// ── Cloudflare purge strategies ──

interface CloudflarePurgeResult {
  success: boolean;
  method: 'hostname' | 'purge_everything' | 'files' | 'skipped';
  errors?: unknown;
}

/**
 * Purges CDN cache by hostname (all pages for those hosts).
 * Works on all Cloudflare plans.
 * Falls back to purge_everything if hostname purge fails.
 */
async function purgeByHostname(
  apiToken: string,
  zoneId: string,
  hosts: string[],
): Promise<CloudflarePurgeResult> {
  // Strategy 1: Purge by hostname (available on all plans)
  const result = await cloudflarePurgeRequest(apiToken, zoneId, { hosts });

  if (result.success) {
    console.log(`[cache-purge] Hostname purge succeeded for: ${hosts.join(', ')}`);
    return { success: true, method: 'hostname' };
  }

  console.warn(`[cache-purge] Hostname purge failed, falling back to purge_everything`);

  // Strategy 2: Purge everything (nuclear fallback)
  const fallback = await cloudflarePurgeRequest(apiToken, zoneId, { purge_everything: true });

  if (fallback.success) {
    console.log(`[cache-purge] purge_everything succeeded`);
    return { success: true, method: 'purge_everything' };
  }

  console.error(`[cache-purge] All purge strategies failed:`, fallback.errors);
  return { success: false, method: 'purge_everything', errors: fallback.errors };
}

/**
 * Purges specific URLs from CDN cache.
 * Used for granular purges (single product, single category).
 */
async function purgeByFiles(
  apiToken: string,
  zoneId: string,
  urls: string[],
): Promise<CloudflarePurgeResult> {
  const result = await cloudflarePurgeRequest(apiToken, zoneId, { files: urls });

  if (result.success) {
    console.log(`[cache-purge] File purge succeeded for ${urls.length} URLs`);
    return { success: true, method: 'files' };
  }

  console.error(`[cache-purge] File purge failed:`, result.errors);
  return { success: false, method: 'files', errors: result.errors };
}

/**
 * Low-level Cloudflare API call.
 */
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

// ── URL builder for granular purge ──

function buildUrlsToPurge(hosts: string[], resourceType: ResourceType, resourceSlug?: string): string[] {
  const urls: string[] = [];

  for (const host of hosts) {
    const base = `https://${host}`;

    switch (resourceType) {
      case 'product':
        if (resourceSlug) urls.push(`${base}/produto/${resourceSlug}`);
        urls.push(`${base}/`);
        break;

      case 'category':
        if (resourceSlug) urls.push(`${base}/categoria/${resourceSlug}`);
        urls.push(`${base}/`);
        break;

      default:
        // template, settings, menu, full → handled by hostname purge
        break;
    }
  }

  return [...new Set(urls)];
}

// ── Purge orchestrator ──

function shouldUseHostnamePurge(resourceType: ResourceType): boolean {
  return ['template', 'settings', 'menu', 'full'].includes(resourceType);
}

async function executePurge(
  apiToken: string,
  zoneId: string,
  hosts: string[],
  resourceType: ResourceType,
  resourceSlug?: string,
): Promise<CloudflarePurgeResult> {
  if (shouldUseHostnamePurge(resourceType)) {
    return purgeByHostname(apiToken, zoneId, hosts);
  }

  const urls = buildUrlsToPurge(hosts, resourceType, resourceSlug);
  if (urls.length === 0) {
    return { success: true, method: 'skipped' };
  }

  return purgeByFiles(apiToken, zoneId, urls);
}

// ── Response helper ──

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Main handler ──

Deno.serve(async (req) => {
  console.log(`[storefront-cache-purge][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');

    // 1. Authenticate
    const auth = await authenticateCaller(req, supabaseUrl, supabaseServiceKey);
    if (auth.error) return auth.error;

    // 2. Parse & validate input
    const body: PurgeRequest = await req.json();
    const { tenant_id, resource_type, resource_slug } = body;

    if (!tenant_id || !resource_type) {
      return jsonResponse({ error: 'tenant_id and resource_type required' }, 400);
    }

    // 3. Authorize tenant access (skip for service role)
    if (!auth.isServiceRole && auth.userId) {
      const authorized = await authorizeTenant(supabaseUrl, supabaseServiceKey, auth.userId, tenant_id);
      if (!authorized) {
        return jsonResponse({ error: 'No access to tenant' }, 403);
      }
    }

    // 4. Resolve hosts
    const hosts = await resolveHostsForTenant(supabaseUrl, supabaseServiceKey, tenant_id);

    if (hosts.length === 0) {
      return jsonResponse({
        success: true,
        message: 'No active domains to purge',
        purged_hosts: 0,
      });
    }

    // 5. Execute purge
    if (!cloudflareApiToken || !cloudflareZoneId) {
      console.log(`[storefront-cache-purge] No Cloudflare credentials. Hosts: ${hosts.join(', ')}`);
      return jsonResponse({
        success: true,
        message: 'Cache purge skipped (no Cloudflare credentials)',
        hosts,
      });
    }

    const result = await executePurge(cloudflareApiToken, cloudflareZoneId, hosts, resource_type, resource_slug);

    console.log(`[storefront-cache-purge] Done: method=${result.method} success=${result.success} hosts=${hosts.join(',')}`);

    return jsonResponse({
      success: result.success,
      message: result.success ? `Cache purged for ${resource_type}` : 'Purge failed',
      method: result.method,
      resource_type,
      hosts,
      caller: auth.isServiceRole ? 'service_role' : 'user',
      errors: result.success ? undefined : result.errors,
    }, result.success ? 200 : 502);

  } catch (error) {
    console.error('[storefront-cache-purge] Error:', error);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
