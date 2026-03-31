import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";
import { errorResponse } from "../_shared/error-response.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v3.0.0"; // Lote B: Legacy marketplace_connections removed
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Token Refresh — V4 Only (Lote B)
 * 
 * Renova tokens long-lived da Meta antes da expiração (~60 dias).
 * V4: Renova token no grant (re-criptografa via RPC)
 * 
 * Modos de operação:
 * 1. POST { tenantId } → Renova token de um tenant específico
 * 2. POST { refreshAll: true } → Renova TODOS os tokens que expiram em <7 dias (para cron)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[meta-token-refresh][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tenantId, refreshAll } = body;

    // Buscar credenciais Meta
    const [appId, appSecret, graphVersion] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "META_APP_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "META_APP_SECRET"),
      getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION"),
    ]);

    if (!appId || !appSecret) {
      console.error(`[meta-token-refresh][${VERSION}] Credenciais Meta não configuradas`);
      return jsonResponse({ success: false, error: "Credenciais Meta não configuradas" });
    }

    const apiVersion = graphVersion || "v21.0";

    if (refreshAll) {
      return await refreshAllExpiring(supabase, appId, appSecret, apiVersion, supabaseServiceKey);
    }

    if (!tenantId) {
      return jsonResponse({ success: false, error: "tenantId ou refreshAll obrigatório" });
    }

    const result = await refreshTenantToken(supabase, tenantId, appId, appSecret, apiVersion, supabaseServiceKey);
    return jsonResponse(result);

  } catch (error) {
    console.error(`[meta-token-refresh][${VERSION}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'meta-token-refresh' });
  }
});

async function refreshTenantToken(
  supabase: any,
  tenantId: string,
  appId: string,
  appSecret: string,
  apiVersion: string,
  serviceRoleKey: string
): Promise<{ success: boolean; error?: string; source?: string; already_valid?: boolean }> {
  const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || serviceRoleKey;

  // ── V4: Try grant first ──
  const { data: activeGrant } = await supabase
    .from("tenant_meta_auth_grants")
    .select("id, token_expires_at")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();

  if (activeGrant) {
    // Check if still valid (buffer 7 days)
    if (activeGrant.token_expires_at) {
      const expiresAt = new Date(activeGrant.token_expires_at);
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      if (expiresAt.getTime() - Date.now() > sevenDaysMs) {
        console.log(`[meta-token-refresh][${VERSION}] V4 grant token still valid for tenant ${tenantId}`);
        return { success: true, source: "v4_grant", already_valid: true };
      }
    }

    // Decrypt current token
    const { data: tokenData, error: tokenError } = await supabase.rpc("get_meta_grant_token", {
      p_grant_id: activeGrant.id,
      p_encryption_key: encryptionKey,
    });

    if (tokenError || !tokenData?.[0]?.access_token) {
      console.error(`[meta-token-refresh][${VERSION}] V4 token decrypt failed for tenant ${tenantId}:`, tokenError?.message);
      // Fall through to legacy
    } else {
      const currentToken = tokenData[0].access_token;
      const exchangeResult = await exchangeToken(currentToken, appId, appSecret, apiVersion);

      if (!exchangeResult.success) {
        // If expired/revoked, mark grant
        if (exchangeResult.isExpiredOrRevoked) {
          await supabase
            .from("tenant_meta_auth_grants")
            .update({ status: "expired", revoked_at: new Date().toISOString(), revoke_reason: `token_refresh_failed: ${exchangeResult.error}` })
            .eq("id", activeGrant.id);
        }
        return { success: false, error: exchangeResult.error, source: "v4_grant" };
      }

      // Re-encrypt new token via RPC
      const { error: updateError } = await supabase.rpc("update_meta_grant_token", {
        p_grant_id: activeGrant.id,
        p_new_token: exchangeResult.accessToken,
        p_encryption_key: encryptionKey,
        p_new_expires_at: exchangeResult.expiresAt,
      });

      if (updateError) {
        // Try alternative: if RPC doesn't exist yet, log warning
        console.error(`[meta-token-refresh][${VERSION}] update_meta_grant_token RPC failed:`, updateError.message);
        // Fallback: update expires_at at least
        await supabase
          .from("tenant_meta_auth_grants")
          .update({ token_expires_at: exchangeResult.expiresAt })
          .eq("id", activeGrant.id);
      }

      console.log(`[meta-token-refresh][${VERSION}] V4 grant token refreshed for tenant ${tenantId}`);

      // Sync CAPI token
      await supabase
        .from("marketing_integrations")
        .update({ meta_access_token: exchangeResult.accessToken })
        .eq("tenant_id", tenantId);

      return { success: true, source: "v4_grant" };
    }
  }

  return { success: false, error: "Nenhum grant V4 ativo encontrado", source: "none" };
}

async function exchangeToken(
  currentToken: string,
  appId: string,
  appSecret: string,
  apiVersion: string
): Promise<{ success: boolean; accessToken?: string; expiresAt?: string; error?: string; isExpiredOrRevoked?: boolean }> {
  const exchangeUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
  exchangeUrl.searchParams.set("client_id", appId);
  exchangeUrl.searchParams.set("client_secret", appSecret);
  exchangeUrl.searchParams.set("fb_exchange_token", currentToken);

  const tokenRes = await fetch(exchangeUrl.toString());
  const tokenText = await tokenRes.text();
  let tokenData: any;

  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    return { success: false, error: "Erro ao processar resposta da Meta" };
  }

  if (!tokenRes.ok || tokenData.error) {
    const errorMsg = tokenData.error?.message || tokenData.error_description || tokenData.error || "Falha ao renovar token";
    const isExpiredOrRevoked = tokenData.error?.code === 190 ||
      errorMsg.includes("expired") ||
      errorMsg.includes("revoked") ||
      errorMsg.includes("invalid");

    return { success: false, error: errorMsg, isExpiredOrRevoked };
  }

  const newExpiresIn = tokenData.expires_in || 5184000;
  const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString();

  return { success: true, accessToken: tokenData.access_token, expiresAt: newExpiresAt };
}



async function refreshAllExpiring(
  supabase: any,
  appId: string,
  appSecret: string,
  apiVersion: string,
  serviceRoleKey: string
) {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // V4: Find grants expiring soon
  const { data: expiringGrants } = await supabase
    .from("tenant_meta_auth_grants")
    .select("tenant_id")
    .eq("status", "active")
    .lt("token_expires_at", sevenDaysFromNow);

  // Collect tenant IDs from V4 grants
  const allTenantIds = new Set<string>();
  for (const g of expiringGrants || []) allTenantIds.add(g.tenant_id);

  console.log(`[meta-token-refresh][${VERSION}] Batch: ${allTenantIds.size} tenants to refresh`);

  const results = { refreshed: 0, failed: 0, skipped: 0, errors: [] as string[] };

  for (const tenantId of allTenantIds) {
    try {
      const result = await refreshTenantToken(supabase, tenantId, appId, appSecret, apiVersion, serviceRoleKey);
      if (result.success) {
        result.already_valid ? results.skipped++ : results.refreshed++;
      } else {
        results.failed++;
        results.errors.push(`${tenantId}: ${result.error}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${tenantId}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  console.log(`[meta-token-refresh][${VERSION}] Batch complete: ${JSON.stringify(results)}`);
  return jsonResponse({ success: true, ...results });
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
