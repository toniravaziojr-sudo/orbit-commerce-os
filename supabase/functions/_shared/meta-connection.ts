// =============================================
// META CONNECTION HELPER (V4 + Legacy Fallback)
// Centralizes Meta token retrieval for all consumers.
// V4: tenant_meta_auth_grants (encrypted tokens + discovered_assets)
// Fallback: marketplace_connections (legacy plain text)
// =============================================
// Phase 6: V4-first metadata — discovered_assets from grant, fallback to legacy

const HELPER_VERSION = "v2.0.0";

export interface MetaConnection {
  access_token: string;
  metadata: {
    assets?: {
      ad_accounts?: Array<{ id: string; name: string }>;
      pages?: Array<{ id: string; name: string; access_token?: string }>;
      catalogs?: Array<{ id: string; name: string }>;
    };
    scope_packs?: string[];
  };
  source: "v4_grant" | "legacy";
  grant_id?: string;
}

// Integration IDs that may contain page_id in selected_assets
export const PAGE_BEARING_INTEGRATIONS = [
  "facebook_publicacoes",
  "facebook_messenger",
  "facebook_comentarios",
  "facebook_lives",
  "instagram_publicacoes",
  "instagram_comentarios",
  "facebook_lead_ads",
] as const;

/**
 * getMetaConnectionForTenant
 * 
 * Tries V4 model first (tenant_meta_auth_grants + decrypted token).
 * Falls back to marketplace_connections if no active V4 grant found.
 * 
 * Phase 6: metadata is now V4-first (discovered_assets from grant),
 * with fallback to marketplace_connections only when V4 metadata is empty.
 * 
 * @param supabase - Service-role Supabase client
 * @param tenantId - Tenant UUID
 * @param traceId  - Optional trace ID for logging
 * @returns MetaConnection or null if no connection found
 */
export async function getMetaConnectionForTenant(
  supabase: any,
  tenantId: string,
  traceId?: string
): Promise<MetaConnection | null> {
  const tag = traceId ? `[meta-conn][${traceId}]` : "[meta-conn]";

  // ── V4: Try tenant_meta_auth_grants first ──
  try {
    const { data: activeGrant } = await supabase
      .from("tenant_meta_auth_grants")
      .select("id, status, granted_scopes, meta_user_name, discovered_assets")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeGrant) {
      // Decrypt token via RPC
      const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { data: tokenData, error: tokenError } = await supabase.rpc("get_meta_grant_token", {
        p_grant_id: activeGrant.id,
        p_encryption_key: encryptionKey,
      });

      if (tokenError || !tokenData?.[0]?.access_token) {
        console.warn(`${tag} V4 grant found but token decrypt failed, falling back to legacy. Error:`, tokenError?.message);
      } else {
        // Phase 6: V4-first metadata resolution
        // 1. Try discovered_assets from grant (raw discovery from OAuth)
        // 2. Fallback to legacy only if grant has no discovered_assets
        const grantDiscovered = activeGrant.discovered_assets;
        const hasV4Metadata = grantDiscovered && Object.keys(grantDiscovered).length > 0 && grantDiscovered.businesses;

        let metadata: MetaConnection["metadata"];
        if (hasV4Metadata) {
          // Build assets from discovered_assets (same shape as legacy for backward compat)
          metadata = buildMetadataFromDiscoveredAssets(grantDiscovered);
          console.log(`${tag} V4 grant resolved with V4 metadata (grant=${activeGrant.id.substring(0, 8)})`);
        } else {
          // Fallback: get metadata from legacy table (tenants that connected before Phase 6)
          const legacyMeta = await getMetadataFromLegacy(supabase, tenantId);
          metadata = legacyMeta || { assets: {} };
          console.log(`${tag} V4 grant resolved with legacy metadata fallback (grant=${activeGrant.id.substring(0, 8)})`);
        }

        return {
          access_token: tokenData[0].access_token,
          metadata,
          source: "v4_grant",
          grant_id: activeGrant.id,
        };
      }
    }
  } catch (err) {
    console.warn(`${tag} V4 lookup error, falling back to legacy:`, (err as Error).message);
  }

  // ── Legacy fallback: marketplace_connections ──
  const { data: legacyConn } = await supabase
    .from("marketplace_connections")
    .select("access_token, metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (legacyConn) {
    console.log(`${tag} Legacy connection resolved`);
    return {
      access_token: legacyConn.access_token,
      metadata: legacyConn.metadata || { assets: {} },
      source: "legacy",
    };
  }

  console.log(`${tag} No Meta connection found`);
  return null;
}

/**
 * getIntegrationAssets
 * 
 * Retrieves the user-selected assets for a specific integration from
 * tenant_meta_integrations.selected_assets.
 * 
 * Use this when you need the OPERATIONAL assets the user chose for a
 * specific feature (not the raw discovery from OAuth).
 * 
 * @param supabase - Service-role Supabase client
 * @param tenantId - Tenant UUID
 * @param integrationId - Integration ID (e.g. "facebook_publicacoes")
 * @returns selected_assets JSONB or null
 */
export async function getIntegrationAssets(
  supabase: any,
  tenantId: string,
  integrationId: string
): Promise<Record<string, any> | null> {
  const { data } = await supabase
    .from("tenant_meta_integrations")
    .select("selected_assets")
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .eq("status", "active")
    .maybeSingle();

  return data?.selected_assets || null;
}

/**
 * findTenantByPageIdV4
 * 
 * Resolves tenant_id from a Facebook Page ID.
 * Searches tenant_meta_integrations.selected_assets first (V4),
 * then falls back to marketplace_connections (legacy).
 * 
 * Only searches integrations that are known to contain page_id.
 * 
 * @param supabase - Service-role Supabase client
 * @param pageId - Facebook Page ID
 * @returns tenant_id or null
 */
export async function findTenantByPageIdV4(
  supabase: any,
  pageId: string
): Promise<string | null> {
  // V4: Search in tenant_meta_integrations (selected_assets contains pages)
  // Only search in integrations that are known to hold page references
  const { data: integrations } = await supabase
    .from("tenant_meta_integrations")
    .select("tenant_id, integration_id, selected_assets")
    .in("integration_id", PAGE_BEARING_INTEGRATIONS as unknown as string[])
    .eq("status", "active");

  if (integrations) {
    for (const integ of integrations) {
      const assets = integ.selected_assets;
      if (!assets) continue;

      // Check pages array
      const pages = assets.pages || [];
      if (pages.some((p: any) => p.id === pageId)) {
        return integ.tenant_id;
      }

      // Check page_id directly (some integrations store it as a single reference)
      if (assets.page_id === pageId) {
        return integ.tenant_id;
      }
    }
  }

  // Legacy fallback: marketplace_connections
  const { data: connections } = await supabase
    .from("marketplace_connections")
    .select("tenant_id, metadata")
    .eq("marketplace", "meta")
    .eq("is_active", true);

  if (connections) {
    for (const conn of connections) {
      const pages = conn.metadata?.assets?.pages || [];
      if (pages.some((p: any) => p.id === pageId)) {
        return conn.tenant_id;
      }
    }
  }

  return null;
}

/**
 * Build metadata in the standard shape from discovered_assets (V4 grant).
 * discovered_assets stores the full business portfolio structure from OAuth.
 */
function buildMetadataFromDiscoveredAssets(discovered: any): MetaConnection["metadata"] {
  const businesses = discovered.businesses || [];
  
  // Flatten all assets from all business portfolios
  const allPages: Array<{ id: string; name: string; access_token?: string }> = [];
  const allAdAccounts: Array<{ id: string; name: string }> = [];
  const allCatalogs: Array<{ id: string; name: string }> = [];

  for (const biz of businesses) {
    if (biz.pages) allPages.push(...biz.pages);
    if (biz.ad_accounts) allAdAccounts.push(...biz.ad_accounts);
    // catalogs may not be in discovered_assets (they're created later)
  }

  return {
    assets: {
      pages: allPages,
      ad_accounts: allAdAccounts,
      catalogs: allCatalogs,
    },
  };
}

/**
 * Helper to retrieve metadata/assets from the legacy table.
 * Used when V4 grant is active but discovered_assets is empty
 * (tenants that connected before Phase 6).
 */
async function getMetadataFromLegacy(supabase: any, tenantId: string): Promise<MetaConnection["metadata"] | null> {
  const { data } = await supabase
    .from("marketplace_connections")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();
  return data?.metadata || null;
}
