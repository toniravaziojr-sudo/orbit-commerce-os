// =============================================
// META CONNECTION HELPER (V4 + Legacy Fallback)
// Centralizes Meta token retrieval for all consumers.
// V4: tenant_meta_auth_grants (encrypted tokens)
// Fallback: marketplace_connections (legacy plain text)
// =============================================

const HELPER_VERSION = "v1.0.0";

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

/**
 * getMetaConnectionForTenant
 * 
 * Tries V4 model first (tenant_meta_auth_grants + decrypted token).
 * Falls back to marketplace_connections if no active V4 grant found.
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
      .select("id, status, granted_scopes, meta_user_name")
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
        // Get metadata/assets from marketplace_connections for backward compatibility
        // (assets like ad_accounts, pages are still stored there during transition)
        const metadata = await getMetadataFromLegacy(supabase, tenantId);

        console.log(`${tag} V4 grant resolved (grant=${activeGrant.id.substring(0, 8)})`);
        return {
          access_token: tokenData[0].access_token,
          metadata: metadata || { assets: {} },
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
 * Helper to retrieve metadata/assets from the legacy table.
 * Used when V4 grant is active but assets are still in marketplace_connections.
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
