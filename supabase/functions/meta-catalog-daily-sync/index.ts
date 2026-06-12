import { createClient } from "npm:@supabase/supabase-js@2";
import { getMetaConnectionForTenant, getIntegrationAssets } from "../_shared/meta-connection.ts";

// ===== VERSION =====
const VERSION = "v3.0.0"; // Lote B: Legacy marketplace_connections removed
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Catalog Daily Sync — V4 Only (Lote B)
 * 
 * Executa diariamente via cron.
 * V4: Busca tenants com grants ativos e integração de catálogo ativa
 */
Deno.serve(async (req) => {
  console.log(`[meta-catalog-daily-sync][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let targetTenantId: string | null = null;
    
    try {
      const body = await req.json();
      targetTenantId = body?.tenantId || null;
    } catch {
      // No body = sync all tenants
    }

    // Collect tenants to sync from V4 + legacy
    const tenantsToSync: Array<{ tenantId: string; catalogId: string; source: string }> = [];
    const seenTenants = new Set<string>();

    // ── Lê a chave canônica da UI: 'catalogos'. Fallback para legado 'catalogo_meta'. ──
    let v4Query = supabase
      .from("tenant_meta_integrations")
      .select("tenant_id, integration_id, selected_assets, auth_grant_id")
      .in("integration_id", ["catalogos", "catalogo_meta"])
      .eq("status", "active");

    if (targetTenantId) {
      v4Query = v4Query.eq("tenant_id", targetTenantId);
    }

    const { data: v4Integrations } = await v4Query;

    // Prefere 'catalogos' (UI canônico) sobre 'catalogo_meta' (legado) por tenant.
    const byTenant: Record<string, { catalogId: string; source: string }> = {};
    for (const integ of v4Integrations || []) {
      const sa = integ.selected_assets || {};
      const catalogId = sa.catalog?.id || sa.catalog_id || sa.catalogs?.[0]?.id || null;
      if (!catalogId) continue;
      const prev = byTenant[integ.tenant_id];
      if (!prev || integ.integration_id === "catalogos") {
        byTenant[integ.tenant_id] = { catalogId, source: integ.integration_id };
      }
    }
    for (const [tenantId, info] of Object.entries(byTenant)) {
      tenantsToSync.push({ tenantId, catalogId: info.catalogId, source: info.source });
      seenTenants.add(tenantId);
    }

    console.log(`[meta-catalog-daily-sync][${VERSION}] Found ${tenantsToSync.length} tenants to sync`);

    const results: any[] = [];

    for (const { tenantId, catalogId, source } of tenantsToSync) {
      try {
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-catalog-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ tenantId, catalogId }),
        });

        const syncResult = await syncResponse.json();
        console.log(`[meta-catalog-daily-sync] Tenant ${tenantId} (${source}): synced=${syncResult?.data?.synced || 0}, failed=${syncResult?.data?.failed || 0}`);
        
        results.push({
          tenantId,
          source,
          status: syncResult.success ? "synced" : "error",
          synced: syncResult?.data?.synced || 0,
          failed: syncResult?.data?.failed || 0,
          error: syncResult?.error || null,
        });
      } catch (syncErr) {
        console.error(`[meta-catalog-daily-sync] Tenant ${tenantId} sync exception:`, syncErr);
        results.push({ tenantId, source, status: "error", error: String(syncErr) });
      }
    }

    const totalSynced = results.filter(r => r.status === "synced").length;
    console.log(`[meta-catalog-daily-sync][${VERSION}] Complete: ${totalSynced}/${tenantsToSync.length} tenants synced`);

    return new Response(
      JSON.stringify({ success: true, data: { total: tenantsToSync.length, results } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[meta-catalog-daily-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
