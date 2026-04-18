import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { errorResponse } from "../_shared/error-response.ts";
import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";

/**
 * Meta Token Health Check
 *
 * Detecta tokens Meta invalidados (erro 190 / subcodes 460, 458, 463, etc.)
 * que ainda estão marcados como `active` no banco mas que a Meta já revogou
 * por mudança de senha, remoção do app, ou política de segurança.
 *
 * Quando detecta invalidação, marca o grant como `expired` automaticamente,
 * permitindo que a UI mostre o estado real e instrua reconexão.
 *
 * Modos:
 * - POST { tenantId } → Checa um tenant específico
 * - POST { checkAll: true } → Checa TODOS os grants ativos (cron diário)
 */

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CheckResult {
  tenant_id: string;
  grant_id: string;
  ok: boolean;
  marked_expired: boolean;
  error?: string;
  error_code?: number;
  error_subcode?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  try {
    console.log(`[meta-token-health-check][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { tenantId, checkAll } = body as { tenantId?: string; checkAll?: boolean };

    const graphVersion = await getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION");
    const apiVersion = graphVersion || "v21.0";
    const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;

    let query = supabase
      .from("tenant_meta_auth_grants")
      .select("id, tenant_id")
      .eq("status", "active");

    if (!checkAll) {
      if (!tenantId) {
        return jsonResponse({ success: false, error: "tenantId ou checkAll obrigatório" });
      }
      query = query.eq("tenant_id", tenantId);
    }

    const { data: grants, error: fetchError } = await query;
    if (fetchError) {
      console.error(`[meta-token-health-check][${VERSION}] fetch error:`, fetchError);
      return jsonResponse({ success: false, error: fetchError.message });
    }

    console.log(`[meta-token-health-check][${VERSION}] Checking ${grants?.length ?? 0} grants`);

    const results: CheckResult[] = [];

    for (const g of grants ?? []) {
      const r = await checkGrant(supabase, g.id, g.tenant_id, apiVersion, encryptionKey);
      results.push(r);
    }

    const summary = {
      checked: results.length,
      healthy: results.filter((r) => r.ok).length,
      marked_expired: results.filter((r) => r.marked_expired).length,
      errors: results.filter((r) => !r.ok && !r.marked_expired).length,
    };

    console.log(`[meta-token-health-check][${VERSION}] done:`, summary);

    return jsonResponse({ success: true, ...summary, results });
  } catch (error) {
    console.error(`[meta-token-health-check][${VERSION}] error:`, error);
    return errorResponse(error, corsHeaders, { module: "meta-token-health-check" });
  }
});

async function checkGrant(
  supabase: any,
  grantId: string,
  tenantId: string,
  apiVersion: string,
  encryptionKey: string,
): Promise<CheckResult> {
  // Decrypt token via RPC
  const { data: tokenData, error: tokenError } = await supabase.rpc("get_meta_grant_token", {
    p_grant_id: grantId,
    p_encryption_key: encryptionKey,
  });

  if (tokenError || !tokenData?.[0]?.access_token) {
    return {
      tenant_id: tenantId,
      grant_id: grantId,
      ok: false,
      marked_expired: false,
      error: `decrypt_failed: ${tokenError?.message ?? "no token"}`,
    };
  }

  const accessToken = tokenData[0].access_token;

  // Probe Meta /me — barato e definitivo: token inválido devolve erro 190.
  const probeUrl = `https://graph.facebook.com/${apiVersion}/me?fields=id&access_token=${encodeURIComponent(accessToken)}`;
  let probeRes: Response;
  let probeJson: any;
  try {
    probeRes = await fetch(probeUrl);
    probeJson = await probeRes.json();
  } catch (err) {
    // Erro de rede — não invalida grant
    return {
      tenant_id: tenantId,
      grant_id: grantId,
      ok: false,
      marked_expired: false,
      error: `network: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  if (probeRes.ok && probeJson?.id) {
    return { tenant_id: tenantId, grant_id: grantId, ok: true, marked_expired: false };
  }

  const errCode = probeJson?.error?.code;
  const errSub = probeJson?.error?.error_subcode;
  const errMsg = probeJson?.error?.message ?? "unknown_error";

  // Erro 190 = token expirado/revogado/invalidado pela Meta
  // Subcodes comuns: 460 (senha trocada), 458 (app removido), 463 (token expirado), 467 (token inválido)
  const isInvalidated = errCode === 190 || errCode === 102;

  if (isInvalidated) {
    const reason = `health_check_failed: code=${errCode} subcode=${errSub ?? "none"} msg=${errMsg}`.slice(0, 500);
    const { error: updateError } = await supabase
      .from("tenant_meta_auth_grants")
      .update({
        status: "expired",
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq("id", grantId);

    if (updateError) {
      console.error(`[meta-token-health-check] update failed for ${grantId}:`, updateError);
      return {
        tenant_id: tenantId,
        grant_id: grantId,
        ok: false,
        marked_expired: false,
        error: `update_failed: ${updateError.message}`,
        error_code: errCode,
        error_subcode: errSub,
      };
    }

    console.log(`[meta-token-health-check] grant ${grantId} (tenant ${tenantId}) marked expired: ${reason}`);
    return {
      tenant_id: tenantId,
      grant_id: grantId,
      ok: false,
      marked_expired: true,
      error: errMsg,
      error_code: errCode,
      error_subcode: errSub,
    };
  }

  // Outros erros (rate limit, transient) — não invalidamos
  return {
    tenant_id: tenantId,
    grant_id: grantId,
    ok: false,
    marked_expired: false,
    error: errMsg,
    error_code: errCode,
    error_subcode: errSub,
  };
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
