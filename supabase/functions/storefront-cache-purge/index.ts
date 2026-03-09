// ============================================
// STOREFRONT CACHE PURGE
// v1.0.0: Purge Cloudflare edge cache for storefront-html
// Called by admin after saving products, templates, settings
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PurgeRequest {
  tenant_id: string;
  // What changed — determines which URLs to purge
  resource_type: 'product' | 'category' | 'template' | 'settings' | 'menu' | 'full';
  // Optional: specific slug for targeted purge
  resource_slug?: string;
}

serve(async (req) => {
  console.log(`[storefront-cache-purge][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const cloudflareApiToken = Deno.env.get('CLOUDFLARE_API_TOKEN');
    const cloudflareZoneId = Deno.env.get('CLOUDFLARE_ZONE_ID');

    // Validate auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: PurgeRequest = await req.json();
    const { tenant_id, resource_type, resource_slug } = body;

    if (!tenant_id || !resource_type) {
      return new Response(JSON.stringify({ error: 'tenant_id and resource_type required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to tenant
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!role) {
      return new Response(JSON.stringify({ error: 'No access to tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all active domains for this tenant
    const { data: domains } = await supabase
      .from('tenant_domains')
      .select('domain')
      .eq('tenant_id', tenant_id)
      .eq('status', 'verified')
      .eq('ssl_status', 'active');

    // Also get tenant slug for platform subdomain
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenant_id)
      .single();

    const hosts: string[] = [];
    if (domains) {
      domains.forEach((d: any) => hosts.push(d.domain));
    }
    if (tenant?.slug) {
      hosts.push(`${tenant.slug}.shops.comandocentral.com.br`);
    }

    if (hosts.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active domains to purge',
        purged_urls: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build URLs to purge based on resource type
    const urlsToPurge: string[] = [];

    for (const host of hosts) {
      const base = `https://${host}`;

      switch (resource_type) {
        case 'product':
          // Purge specific product page + home (may show featured products)
          if (resource_slug) {
            urlsToPurge.push(`${base}/produto/${resource_slug}`);
          }
          urlsToPurge.push(`${base}/`);
          break;

        case 'category':
          // Purge specific category + home
          if (resource_slug) {
            urlsToPurge.push(`${base}/categoria/${resource_slug}`);
          }
          urlsToPurge.push(`${base}/`);
          break;

        case 'template':
        case 'settings':
        case 'menu':
          // These affect all pages — purge everything for this host
          urlsToPurge.push(`${base}/`);
          // Also purge with trailing variants
          break;

        case 'full':
          // Nuclear option: purge everything
          urlsToPurge.push(`${base}/`);
          break;
      }
    }

    // Remove duplicates
    const uniqueUrls = [...new Set(urlsToPurge)];

    // If no Cloudflare credentials, just log
    if (!cloudflareApiToken || !cloudflareZoneId) {
      console.log(`[storefront-cache-purge] No Cloudflare credentials. Would purge: ${uniqueUrls.join(', ')}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Cache purge skipped (no Cloudflare credentials)',
        would_purge: uniqueUrls,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For template/settings/menu/full — use prefix-based purge (purge all pages for hosts)
    const shouldPurgeAll = ['template', 'settings', 'menu', 'full'].includes(resource_type);

    let purgeResult;
    if (shouldPurgeAll) {
      // Purge by host prefix — purges all cached URLs for these hosts
      // Cloudflare API: purge_cache with prefixes
      // IMPORTANT: Cloudflare prefix purge does NOT accept URI schemes (https://)
      // Only hostname + path prefix is allowed
      const prefixes = hosts.map(h => `${h}/`);
      console.log(`[storefront-cache-purge] Purging by prefix (no scheme): ${prefixes.join(', ')}`);
      
      purgeResult = await fetch(
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
    } else {
      // Purge specific URLs
      purgeResult = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/purge_cache`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cloudflareApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ files: uniqueUrls }),
        }
      );
    }

    const purgeData = await purgeResult.json();
    
    if (!purgeData.success) {
      console.error('[storefront-cache-purge] Cloudflare purge failed:', purgeData.errors);
      
      // Fallback: try purging individual files if prefix purge failed
      if (shouldPurgeAll && uniqueUrls.length > 0) {
        const fallbackResult = await fetch(
          `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/purge_cache`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${cloudflareApiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: uniqueUrls }),
          }
        );
        const fallbackData = await fallbackResult.json();
        
        return new Response(JSON.stringify({
          success: fallbackData.success,
          message: fallbackData.success ? 'Cache purged (fallback to file-based)' : 'Purge failed',
          purged_urls: uniqueUrls.length,
          resource_type,
          hosts,
          errors: fallbackData.success ? undefined : fallbackData.errors,
        }), {
          status: fallbackData.success ? 200 : 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: false,
        message: 'Cloudflare purge failed',
        errors: purgeData.errors,
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[storefront-cache-purge] Purged ${shouldPurgeAll ? 'all pages for ' + hosts.join(', ') : uniqueUrls.length + ' URLs'}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Cache purged for ${resource_type}`,
      purged_urls: uniqueUrls.length,
      resource_type,
      hosts,
      method: shouldPurgeAll ? 'prefix' : 'files',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[storefront-cache-purge] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
