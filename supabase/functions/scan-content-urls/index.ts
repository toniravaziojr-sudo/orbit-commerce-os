import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ViolationRecord {
  tenant_id: string;
  host: string;
  path: string;
  violation_type: string;
  details: Record<string, unknown>;
  source: string;
}

// Patterns to detect
const STORE_PATH_PATTERN = /\/store\/[a-z0-9_-]+/gi;
const APP_DOMAIN_PATTERN = /app\.comandocentral\.com\.br/gi;
const PREVIEW_PARAM_PATTERN = /[?&]preview=1/gi;
const PREVIEW_ID_PATTERN = /[?&]previewId=[^&"'\s]+/gi;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log('[scan-content-urls] Starting content URL scan...');

  const violations: ViolationRecord[] = [];
  const scannedTenants: string[] = [];

  try {
    // Get all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, slug')
      .limit(100);

    if (tenantsError) {
      console.error('[scan-content-urls] Error fetching tenants:', tenantsError);
      throw tenantsError;
    }

    for (const tenant of tenants || []) {
      console.log(`[scan-content-urls] Scanning tenant: ${tenant.slug}`);
      scannedTenants.push(tenant.slug);

      // Scan storefront_page_templates
      const { data: templates } = await supabase
        .from('storefront_page_templates')
        .select('id, page_type, header_props, footer_props, blocks')
        .eq('tenant_id', tenant.id);

      for (const template of templates || []) {
        const jsonStr = JSON.stringify(template);
        
        // Check for /store/ patterns
        const storeMatches = jsonStr.match(STORE_PATH_PATTERN);
        if (storeMatches) {
          violations.push({
            tenant_id: tenant.id,
            host: tenant.slug,
            path: `storefront_page_templates/${template.page_type}`,
            violation_type: 'content_hardcoded_url',
            details: {
              table: 'storefront_page_templates',
              record_id: template.id,
              matches: [...new Set(storeMatches)],
              page_type: template.page_type,
              pattern: 'store_path',
            },
            source: 'scanner',
          });
        }

        // Check for app domain
        const appMatches = jsonStr.match(APP_DOMAIN_PATTERN);
        if (appMatches) {
          violations.push({
            tenant_id: tenant.id,
            host: tenant.slug,
            path: `storefront_page_templates/${template.page_type}`,
            violation_type: 'app_domain_link',
            details: {
              table: 'storefront_page_templates',
              record_id: template.id,
              matches: [...new Set(appMatches)],
              page_type: template.page_type,
            },
            source: 'scanner',
          });
        }

        // Check for preview params in stored content
        const previewMatches = jsonStr.match(PREVIEW_PARAM_PATTERN);
        const previewIdMatches = jsonStr.match(PREVIEW_ID_PATTERN);
        if (previewMatches || previewIdMatches) {
          violations.push({
            tenant_id: tenant.id,
            host: tenant.slug,
            path: `storefront_page_templates/${template.page_type}`,
            violation_type: 'preview_in_public',
            details: {
              table: 'storefront_page_templates',
              record_id: template.id,
              matches: [...new Set([...(previewMatches || []), ...(previewIdMatches || [])])],
              page_type: template.page_type,
            },
            source: 'scanner',
          });
        }
      }

      // Scan store_pages
      const { data: pages } = await supabase
        .from('store_pages')
        .select('id, slug, content')
        .eq('tenant_id', tenant.id);

      for (const page of pages || []) {
        const jsonStr = JSON.stringify(page.content);
        
        const storeMatches = jsonStr.match(STORE_PATH_PATTERN);
        if (storeMatches) {
          violations.push({
            tenant_id: tenant.id,
            host: tenant.slug,
            path: `store_pages/${page.slug}`,
            violation_type: 'content_hardcoded_url',
            details: {
              table: 'store_pages',
              record_id: page.id,
              matches: [...new Set(storeMatches)],
              page_slug: page.slug,
            },
            source: 'scanner',
          });
        }

        const appMatches = jsonStr.match(APP_DOMAIN_PATTERN);
        if (appMatches) {
          violations.push({
            tenant_id: tenant.id,
            host: tenant.slug,
            path: `store_pages/${page.slug}`,
            violation_type: 'app_domain_link',
            details: {
              table: 'store_pages',
              record_id: page.id,
              matches: [...new Set(appMatches)],
              page_slug: page.slug,
            },
            source: 'scanner',
          });
        }
      }

      // Scan menu_items
      const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id, label, url, menu_id')
        .eq('tenant_id', tenant.id);

      for (const item of menuItems || []) {
        if (item.url) {
          if (STORE_PATH_PATTERN.test(item.url)) {
            violations.push({
              tenant_id: tenant.id,
              host: tenant.slug,
              path: `menu_items/${item.label}`,
              violation_type: 'content_hardcoded_url',
              details: {
                table: 'menu_items',
                record_id: item.id,
                url: item.url,
                label: item.label,
              },
              source: 'scanner',
            });
          }
          if (APP_DOMAIN_PATTERN.test(item.url)) {
            violations.push({
              tenant_id: tenant.id,
              host: tenant.slug,
              path: `menu_items/${item.label}`,
              violation_type: 'app_domain_link',
              details: {
                table: 'menu_items',
                record_id: item.id,
                url: item.url,
                label: item.label,
              },
              source: 'scanner',
            });
          }
          if (PREVIEW_PARAM_PATTERN.test(item.url)) {
            violations.push({
              tenant_id: tenant.id,
              host: tenant.slug,
              path: `menu_items/${item.label}`,
              violation_type: 'preview_in_public',
              details: {
                table: 'menu_items',
                record_id: item.id,
                url: item.url,
                label: item.label,
              },
              source: 'scanner',
            });
          }
        }
      }

      // Scan landing_pages
      const { data: landingPages } = await supabase
        .from('landing_pages')
        .select('id, slug, blocks')
        .eq('tenant_id', tenant.id);

      for (const lp of landingPages || []) {
        const jsonStr = JSON.stringify(lp.blocks);
        
        const storeMatches = jsonStr.match(STORE_PATH_PATTERN);
        if (storeMatches) {
          violations.push({
            tenant_id: tenant.id,
            host: tenant.slug,
            path: `landing_pages/${lp.slug}`,
            violation_type: 'content_hardcoded_url',
            details: {
              table: 'landing_pages',
              record_id: lp.id,
              matches: [...new Set(storeMatches)],
              lp_slug: lp.slug,
            },
            source: 'scanner',
          });
        }

        const appMatches = jsonStr.match(APP_DOMAIN_PATTERN);
        if (appMatches) {
          violations.push({
            tenant_id: tenant.id,
            host: tenant.slug,
            path: `landing_pages/${lp.slug}`,
            violation_type: 'app_domain_link',
            details: {
              table: 'landing_pages',
              record_id: lp.id,
              matches: [...new Set(appMatches)],
              lp_slug: lp.slug,
            },
            source: 'scanner',
          });
        }
      }
    }

    console.log(`[scan-content-urls] Found ${violations.length} violations across ${scannedTenants.length} tenants`);

    // Insert violations (with dedup - don't insert if same violation exists in last 24h)
    let inserted = 0;
    for (const violation of violations) {
      const since = new Date();
      since.setDate(since.getDate() - 1);

      // Check if similar violation exists
      const { data: existing } = await supabase
        .from('storefront_runtime_violations')
        .select('id')
        .eq('tenant_id', violation.tenant_id)
        .eq('path', violation.path)
        .eq('violation_type', violation.violation_type)
        .gte('created_at', since.toISOString())
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase
          .from('storefront_runtime_violations')
          .insert(violation);
        inserted++;
        console.log(`[scan-content-urls] Inserted violation: ${violation.path} (${violation.violation_type})`);
      }
    }

    // Record scan execution for observability
    try {
      await supabase.from('job_runs').insert({
        job_name: 'scan-content-urls',
        result: 'success',
        affected_count: violations.length,
        details: {
          tenants_scanned: scannedTenants.length,
          violations_found: violations.length,
          violations_inserted: inserted,
        },
      });
    } catch (err) {
      console.log('[scan-content-urls] Could not record job run:', err);
    }

    return new Response(JSON.stringify({
      success: true,
      tenants_scanned: scannedTenants.length,
      violations_found: violations.length,
      violations_inserted: inserted,
      violations: violations.map(v => ({
        tenant: v.host,
        path: v.path,
        type: v.violation_type,
      })),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[scan-content-urls] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
