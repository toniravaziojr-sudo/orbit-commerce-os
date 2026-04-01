import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface StorefrontRevalidationResult {
  staleCount: number;
  cachePurged: boolean;
  prerenderTriggered: boolean;
  purgeStatus: number | null;
  prerenderStatus: number | null;
}

interface RevalidationParams {
  supabase: SupabaseClient;
  supabaseUrl: string;
  supabaseServiceKey: string;
  tenantId: string;
  reason: string;
}

/**
 * Revalida imediatamente a loja publicada após mudanças que afetam o HTML público.
 * Pipeline:
 * 1. Marca snapshots ativos como stale (garante live render imediato no próximo hit)
 * 2. Purga cache CDN do host público
 * 3. Dispara re-prerender completo em background
 */
export async function revalidateStorefrontAfterTrackingChange(
  params: RevalidationParams,
): Promise<StorefrontRevalidationResult> {
  const { supabase, supabaseUrl, supabaseServiceKey, tenantId, reason } = params;

  console.log(`[storefront-revalidation] Starting for tenant ${tenantId} (${reason})`);

  const { data: staleRows, error: staleError } = await supabase
    .from("storefront_prerendered_pages")
    .update({ status: "stale" })
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .select("id");

  if (staleError) {
    console.error(`[storefront-revalidation] Failed to mark pages stale for ${tenantId}:`, staleError.message);
    throw staleError;
  }

  const staleCount = staleRows?.length || 0;
  console.log(`[storefront-revalidation] ${staleCount} active pages marked stale for ${tenantId}`);

  let cachePurged = false;
  let purgeStatus: number | null = null;
  try {
    const purgeRes = await fetch(`${supabaseUrl}/functions/v1/storefront-cache-purge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        resource_type: "full",
      }),
    });

    purgeStatus = purgeRes.status;
    const purgeBody = await purgeRes.text();
    cachePurged = purgeRes.ok;
    console.log(`[storefront-revalidation] Cache purge status=${purgeStatus} tenant=${tenantId} body=${purgeBody}`);
  } catch (error) {
    console.warn(`[storefront-revalidation] Cache purge failed for ${tenantId}:`, (error as Error).message);
  }

  let prerenderTriggered = false;
  let prerenderStatus: number | null = null;
  try {
    const prerenderRes = await fetch(`${supabaseUrl}/functions/v1/storefront-prerender`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        trigger_type: "manual",
      }),
    });

    prerenderStatus = prerenderRes.status;
    const prerenderBody = await prerenderRes.text();
    prerenderTriggered = prerenderRes.ok;
    console.log(`[storefront-revalidation] Prerender status=${prerenderStatus} tenant=${tenantId} body=${prerenderBody}`);
  } catch (error) {
    console.warn(`[storefront-revalidation] Prerender trigger failed for ${tenantId}:`, (error as Error).message);
  }

  return {
    staleCount,
    cachePurged,
    prerenderTriggered,
    purgeStatus,
    prerenderStatus,
  };
}
