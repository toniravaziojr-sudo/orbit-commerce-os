// =============================================
// META CONNECTION HELPER (V4 Only — Lote B)
// Centralizes Meta token retrieval for all consumers.
// V4: tenant_meta_auth_grants (encrypted tokens + discovered_assets)
// Legacy fallback: REMOVED (Lote B complete)
// =============================================

const HELPER_VERSION = "v3.0.0"; // Lote B: Legacy fallback removed

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
  source: "v4_grant";
  grant_id: string;
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
 * Retrieves the active V4 grant for a tenant and decrypts the token.
 * 
 * @param supabase - Service-role Supabase client
 * @param tenantId - Tenant UUID
 * @param traceId  - Optional trace ID for logging
 * @returns MetaConnection or null if no active grant found
 */
export async function getMetaConnectionForTenant(
  supabase: any,
  tenantId: string,
  traceId?: string
): Promise<MetaConnection | null> {
  const tag = traceId ? `[meta-conn][${traceId}]` : "[meta-conn]";

  try {
    const { data: activeGrant } = await supabase
      .from("tenant_meta_auth_grants")
      .select("id, status, granted_scopes, meta_user_name, discovered_assets")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeGrant) {
      console.log(`${tag} No active V4 grant found`);
      return null;
    }

    // Decrypt token via RPC
    const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { data: tokenData, error: tokenError } = await supabase.rpc("get_meta_grant_token", {
      p_grant_id: activeGrant.id,
      p_encryption_key: encryptionKey,
    });

    if (tokenError || !tokenData?.[0]?.access_token) {
      console.error(`${tag} V4 grant found but token decrypt failed. Error:`, tokenError?.message);
      return null;
    }

    // Build metadata from discovered_assets
    const grantDiscovered = activeGrant.discovered_assets;
    const hasMetadata = grantDiscovered && Object.keys(grantDiscovered).length > 0 && grantDiscovered.businesses;

    const metadata: MetaConnection["metadata"] = hasMetadata
      ? buildMetadataFromDiscoveredAssets(grantDiscovered)
      : { assets: {} };

    console.log(`${tag} V4 grant resolved (grant=${activeGrant.id.substring(0, 8)})`);

    return {
      access_token: tokenData[0].access_token,
      metadata,
      source: "v4_grant",
      grant_id: activeGrant.id,
    };
  } catch (err) {
    console.error(`${tag} V4 lookup error:`, (err as Error).message);
    return null;
  }
}

/**
 * getIntegrationAssets
 * 
 * Retrieves the user-selected assets for a specific integration from
 * tenant_meta_integrations.selected_assets.
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
 * Searches tenant_meta_integrations.selected_assets (V4 only).
 */
export async function findTenantByPageIdV4(
  supabase: any,
  pageId: string
): Promise<string | null> {
  const { data: integrations } = await supabase
    .from("tenant_meta_integrations")
    .select("tenant_id, integration_id, selected_assets")
    .in("integration_id", PAGE_BEARING_INTEGRATIONS as unknown as string[])
    .eq("status", "active");

  if (integrations) {
    for (const integ of integrations) {
      const assets = integ.selected_assets;
      if (!assets) continue;

      const pages = assets.pages || [];
      if (pages.some((p: any) => p.id === pageId)) {
        return integ.tenant_id;
      }

      if (assets.page_id === pageId) {
        return integ.tenant_id;
      }
    }
  }

  return null;
}

/**
 * Build metadata in the standard shape from discovered_assets (V4 grant).
 */
function buildMetadataFromDiscoveredAssets(discovered: any): MetaConnection["metadata"] {
  const businesses = discovered.businesses || [];
  
  const allPages: Array<{ id: string; name: string; access_token?: string }> = [];
  const allAdAccounts: Array<{ id: string; name: string }> = [];
  const allCatalogs: Array<{ id: string; name: string }> = [];

  for (const biz of businesses) {
    if (biz.pages) allPages.push(...biz.pages);
    if (biz.ad_accounts) allAdAccounts.push(...biz.ad_accounts);
  }

  return {
    assets: {
      pages: allPages,
      ad_accounts: allAdAccounts,
      catalogs: allCatalogs,
    },
  };
}
