import { createClient } from "npm:@supabase/supabase-js@2";
// NOTE: meta-catalog-daily-sync is a batch job iterating ALL tenants.
// It still reads from marketplace_connections directly for the multi-tenant query.
// Will be migrated to iterate tenant_meta_auth_grants in a future phase.

// ===== VERSION =====
const VERSION = "v1.1.0"; // Phase 5: Documented as pending batch migration
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Catalog Daily Sync
 * 
 * Executa diariamente via cron (pg_cron ou external scheduler).
 * Para cada tenant com catálogo Meta ativo, sincroniza todos os produtos ativos.
 * 
 * Pode ser chamado manualmente com { tenantId } para sync de um tenant específico.
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

    // Find all active Meta connections with catalog
    let query = supabase
      .from("marketplace_connections")
      .select("tenant_id, access_token, expires_at, metadata")
      .eq("marketplace", "meta")
      .eq("is_active", true);

    if (targetTenantId) {
      query = query.eq("tenant_id", targetTenantId);
    }

    const { data: connections, error: connError } = await query;

    if (connError || !connections) {
      console.error("[meta-catalog-daily-sync] Error fetching connections:", connError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar conexões" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const conn of connections) {
      const catalogId = (conn.metadata as any)?.meta_catalog_id;
      
      if (!catalogId) {
        console.log(`[meta-catalog-daily-sync] Tenant ${conn.tenant_id}: no catalog, skipping`);
        results.push({ tenantId: conn.tenant_id, status: "skipped", reason: "no_catalog" });
        continue;
      }

      // Check token expiry
      if (conn.expires_at && new Date(conn.expires_at) < new Date()) {
        console.warn(`[meta-catalog-daily-sync] Tenant ${conn.tenant_id}: token expired, skipping`);
        results.push({ tenantId: conn.tenant_id, status: "skipped", reason: "token_expired" });
        continue;
      }

      try {
        // Call meta-catalog-sync for this tenant
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/meta-catalog-sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            tenantId: conn.tenant_id,
            catalogId,
          }),
        });

        const syncResult = await syncResponse.json();
        console.log(`[meta-catalog-daily-sync] Tenant ${conn.tenant_id}: synced=${syncResult?.data?.synced || 0}, failed=${syncResult?.data?.failed || 0}`);
        
        results.push({
          tenantId: conn.tenant_id,
          status: syncResult.success ? "synced" : "error",
          synced: syncResult?.data?.synced || 0,
          failed: syncResult?.data?.failed || 0,
          error: syncResult?.error || null,
        });
      } catch (syncErr) {
        console.error(`[meta-catalog-daily-sync] Tenant ${conn.tenant_id} sync exception:`, syncErr);
        results.push({ tenantId: conn.tenant_id, status: "error", error: String(syncErr) });
      }
    }

    const totalSynced = results.filter(r => r.status === "synced").length;
    console.log(`[meta-catalog-daily-sync] Complete: ${totalSynced}/${connections.length} tenants synced`);

    return new Response(
      JSON.stringify({ success: true, data: { total: connections.length, results } }),
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
