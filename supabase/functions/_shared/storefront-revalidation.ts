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

// ── Step 1: Mark prerendered pages as stale ──

async function markPagesStale(
  supabase: SupabaseClient,
  tenantId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("storefront_prerendered_pages")
    .update({ status: "stale" })
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .select("id");

  if (error) {
    console.error(`[revalidation] Failed to mark stale for ${tenantId}:`, error.message);
    throw error;
  }

  return data?.length || 0;
}

// ── Step 2: Purge CDN cache (with confirmation) ──

async function purgeCdnCache(
  supabaseUrl: string,
  supabaseServiceKey: string,
  tenantId: string,
): Promise<{ purged: boolean; status: number }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/storefront-cache-purge`, {
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

  const body = await res.text();
  console.log(`[revalidation] CDN purge status=${res.status} tenant=${tenantId} body=${body}`);
  return { purged: res.ok, status: res.status };
}

// ── Step 3: Trigger re-prerender ──

async function triggerPrerender(
  supabaseUrl: string,
  supabaseServiceKey: string,
  tenantId: string,
): Promise<{ triggered: boolean; status: number }> {
  const res = await fetch(`${supabaseUrl}/functions/v1/storefront-prerender`, {
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

  const body = await res.text();
  console.log(`[revalidation] Prerender status=${res.status} tenant=${tenantId} body=${body}`);
  return { triggered: res.ok, status: res.status };
}

// ── Orchestrator: Sequential pipeline ──

/**
 * Revalidates the published storefront after changes that affect public HTML.
 *
 * SEQUENTIAL pipeline (each step waits for the previous):
 * 1. Mark snapshots as stale → forces live-render on next CDN miss
 * 2. Purge CDN hostname cache → confirmed before proceeding
 * 3. Trigger re-prerender → generates fresh HTML snapshots
 */
export async function revalidateStorefrontAfterTrackingChange(
  params: RevalidationParams,
): Promise<StorefrontRevalidationResult> {
  const { supabase, supabaseUrl, supabaseServiceKey, tenantId, reason } = params;

  console.log(`[revalidation] Starting for tenant ${tenantId} (${reason})`);

  // Step 1: Mark stale FIRST (guarantees live-render even if purge/prerender fail)
  const staleCount = await markPagesStale(supabase, tenantId);
  console.log(`[revalidation] ${staleCount} pages marked stale`);

  // Step 2: Purge CDN — wait for confirmation
  let cachePurged = false;
  let purgeStatus: number | null = null;
  try {
    const purgeResult = await purgeCdnCache(supabaseUrl, supabaseServiceKey, tenantId);
    cachePurged = purgeResult.purged;
    purgeStatus = purgeResult.status;
  } catch (error) {
    console.warn(`[revalidation] CDN purge failed for ${tenantId}:`, (error as Error).message);
  }

  // Step 3: Re-prerender ONLY after purge is confirmed/attempted
  let prerenderTriggered = false;
  let prerenderStatus: number | null = null;
  try {
    const prerenderResult = await triggerPrerender(supabaseUrl, supabaseServiceKey, tenantId);
    prerenderTriggered = prerenderResult.triggered;
    prerenderStatus = prerenderResult.status;
  } catch (error) {
    console.warn(`[revalidation] Prerender failed for ${tenantId}:`, (error as Error).message);
  }

  return { staleCount, cachePurged, prerenderTriggered, purgeStatus, prerenderStatus };
}
