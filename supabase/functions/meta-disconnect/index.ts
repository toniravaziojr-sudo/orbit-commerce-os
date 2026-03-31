import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

// ===== VERSION =====
const VERSION = "v2.0.0"; // Lote B: Legacy marketplace_connections removed
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Meta Disconnect — V4
 * 
 * Desconecta a conta Meta de um tenant:
 * 1. Marca grant ativo como "revoked" em tenant_meta_auth_grants
 * 2. Desativa todas as integrações em tenant_meta_integrations
 * 3. Best-effort: revoga permissões na API Meta (DELETE /me/permissions)
 *    → Falha remota NUNCA bloqueia a desconexão local
 * 
 * Body: { tenant_id: string }
 * Contrato: HTTP 200 + { success: true/false }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-disconnect][${VERSION}][${traceId}] Request received`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Service role client — for actual operations (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.warn(`[meta-disconnect][${VERSION}][${traceId}] Auth failed:`, authError?.message);
      return jsonResponse({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" });
    }

    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return jsonResponse({ success: false, error: "tenant_id obrigatório", code: "MISSING_TENANT" });
    }

    // User-context client — for tenant access check (uses auth.uid() inside RPC)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: hasAccess, error: accessError } = await userClient.rpc("user_has_tenant_access", {
      p_tenant_id: tenant_id,
    });

    console.log(`[meta-disconnect][${VERSION}][${traceId}] Access check: hasAccess=${hasAccess}, error=${accessError?.message || 'none'}, user=${user.id}, tenant=${tenant_id}`);

    if (accessError || !hasAccess) {
      return jsonResponse({ success: false, error: "Sem acesso ao tenant", code: "FORBIDDEN" });
    }

    console.log(`[meta-disconnect][${VERSION}][${traceId}] Disconnecting tenant ${tenant_id}`);

    // ── Step 1: Find and revoke active V4 grant ──
    const { data: activeGrant } = await supabase
      .from("tenant_meta_auth_grants")
      .select("id, meta_user_id")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle();

    let grantRevoked = false;
    let remoteRevocationResult = "skipped";

    if (activeGrant) {
      // Try best-effort remote revocation BEFORE revoking locally
      // (we need the token to call Meta API)
      try {
        const encryptionKey = Deno.env.get("META_TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
        const { data: tokenData } = await supabase.rpc("get_meta_grant_token", {
          p_grant_id: activeGrant.id,
          p_encryption_key: encryptionKey,
        });

        const accessToken = tokenData?.[0]?.access_token;
        if (accessToken) {
          try {
            const revokeRes = await fetch(
              `https://graph.facebook.com/v21.0/me/permissions?access_token=${accessToken}`,
              { method: "DELETE" }
            );
            const revokeData = await revokeRes.json();
            remoteRevocationResult = revokeData.success ? "success" : `failed: ${JSON.stringify(revokeData)}`;
            console.log(`[meta-disconnect][${VERSION}][${traceId}] Remote revocation: ${remoteRevocationResult}`);
          } catch (remoteErr) {
            remoteRevocationResult = `error: ${(remoteErr as Error).message}`;
            console.warn(`[meta-disconnect][${VERSION}][${traceId}] Remote revocation failed (best-effort):`, remoteErr);
            // Best-effort: do NOT throw — continue with local disconnect
          }
        }
      } catch (tokenErr) {
        remoteRevocationResult = `token_error: ${(tokenErr as Error).message}`;
        console.warn(`[meta-disconnect][${VERSION}][${traceId}] Could not decrypt token for remote revocation`);
      }

      // Revoke the grant locally (this always executes regardless of remote result)
      const { error: revokeError } = await supabase
        .from("tenant_meta_auth_grants")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoke_reason: "user_disconnect",
        })
        .eq("id", activeGrant.id);

      if (revokeError) {
        console.error(`[meta-disconnect][${VERSION}][${traceId}] Failed to revoke grant:`, revokeError);
      } else {
        grantRevoked = true;
        console.log(`[meta-disconnect][${VERSION}][${traceId}] Grant ${activeGrant.id} revoked`);
      }
    }

    // ── Step 2: Deactivate all tenant_meta_integrations ──
    const { data: deactivated, error: integError } = await supabase
      .from("tenant_meta_integrations")
      .update({ status: "inactive" })
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .select("integration_id");

    if (integError) {
      console.error(`[meta-disconnect][${VERSION}][${traceId}] Failed to deactivate integrations:`, integError);
    } else {
      console.log(`[meta-disconnect][${VERSION}][${traceId}] Deactivated ${deactivated?.length || 0} integrations`);
    }

    // ── Step 3: Deactivate WhatsApp configs linked to Meta ──
    await supabase
      .from("whatsapp_configs")
      .update({
        is_enabled: false,
        connection_status: "disconnected",
        last_error: "Conta Meta desconectada",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta");

    // ── Step 4: Clear Meta Pixel from marketing_integrations ──
    const { error: pixelClearError } = await supabase
      .from("marketing_integrations")
      .update({
        meta_pixel_id: null,
        meta_enabled: false,
        meta_capi_enabled: false,
        meta_status: "disconnected",
        meta_last_error: "Conta Meta desconectada",
        meta_additional_pixel_ids: null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id);

    if (pixelClearError) {
      console.warn(`[meta-disconnect][${VERSION}][${traceId}] Failed to clear pixel:`, pixelClearError);
    } else {
      console.log(`[meta-disconnect][${VERSION}][${traceId}] Pixel cleared from marketing_integrations`);
    }

    console.log(`[meta-disconnect][${VERSION}][${traceId}] Disconnect complete. Grant revoked: ${grantRevoked}, Remote: ${remoteRevocationResult}, Integrations deactivated: ${deactivated?.length || 0}`);

    return jsonResponse({
      success: true,
      grant_revoked: grantRevoked,
      integrations_deactivated: deactivated?.length || 0,
      remote_revocation: remoteRevocationResult,
    });

  } catch (error) {
    console.error(`[meta-disconnect][${VERSION}][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: "meta-disconnect" });
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
