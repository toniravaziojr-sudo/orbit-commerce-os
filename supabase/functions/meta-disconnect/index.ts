import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";
import { revalidateStorefrontAfterTrackingChange } from "../_shared/storefront-revalidation.ts";

import { loadPlatformCredentials } from "../_shared/load-platform-credentials.ts";
const VERSION = "v3.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Meta Disconnect — V3.1
 *
 * Desconecta a conta Meta de um tenant com limpeza completa e revalidação imediata da loja.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  await loadPlatformCredentials();

  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-disconnect][${VERSION}][${traceId}] Request received`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: hasAccess, error: accessError } = await userClient.rpc("user_has_tenant_access", {
      p_tenant_id: tenant_id,
    });

    if (accessError || !hasAccess) {
      console.warn(`[meta-disconnect][${VERSION}][${traceId}] Access denied for user ${user.id}`);
      return jsonResponse({ success: false, error: "Sem acesso ao tenant", code: "FORBIDDEN" });
    }

    console.log(`[meta-disconnect][${VERSION}][${traceId}] Disconnecting tenant ${tenant_id}`);

    const results: Record<string, any> = {};

    const { data: activeGrant } = await supabase
      .from("tenant_meta_auth_grants")
      .select("id, meta_user_id")
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .maybeSingle();

    let remoteRevocationResult = "skipped";

    if (activeGrant) {
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
          } catch (remoteErr) {
            remoteRevocationResult = `error: ${(remoteErr as Error).message}`;
          }
        }
      } catch (tokenErr) {
        remoteRevocationResult = `token_error: ${(tokenErr as Error).message}`;
      }
      console.log(`[meta-disconnect][${VERSION}][${traceId}] Remote revocation: ${remoteRevocationResult}`);

      const { error: revokeError } = await supabase
        .from("tenant_meta_auth_grants")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoke_reason: "user_disconnect",
        })
        .eq("id", activeGrant.id);

      results.grant_revoked = !revokeError;
      if (revokeError) {
        console.error(`[meta-disconnect][${VERSION}][${traceId}] Failed to revoke grant:`, revokeError);
      } else {
        console.log(`[meta-disconnect][${VERSION}][${traceId}] Grant ${activeGrant.id} revoked`);
      }
    } else {
      results.grant_revoked = false;
      console.log(`[meta-disconnect][${VERSION}][${traceId}] No active grant found`);
    }

    const { data: deactivated, error: integError } = await supabase
      .from("tenant_meta_integrations")
      .update({
        status: "disconnected",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id)
      .eq("status", "active")
      .select("integration_id");

    if (integError) {
      console.error(`[meta-disconnect][${VERSION}][${traceId}] CRITICAL: Failed to deactivate integrations:`, integError.message);
      results.integrations_error = integError.message;
    }
    results.integrations_deactivated = deactivated?.length || 0;
    console.log(`[meta-disconnect][${VERSION}][${traceId}] Deactivated ${results.integrations_deactivated} integrations`);

    const { error: whatsappError } = await supabase
      .from("whatsapp_configs")
      .update({
        is_enabled: false,
        connection_status: "disconnected",
        last_error: "Conta Meta desconectada",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta");

    if (whatsappError) {
      console.warn(`[meta-disconnect][${VERSION}][${traceId}] WhatsApp cleanup error:`, whatsappError.message);
    }
    results.whatsapp_cleaned = !whatsappError;

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
      console.warn(`[meta-disconnect][${VERSION}][${traceId}] Pixel cleanup error:`, pixelClearError.message);
    }
    results.pixel_cleared = !pixelClearError;

    try {
      results.storefront_revalidation = await revalidateStorefrontAfterTrackingChange({
        supabase,
        supabaseUrl,
        supabaseServiceKey,
        tenantId: tenant_id,
        reason: "meta-disconnect",
      });
    } catch (revalidationErr) {
      console.warn(`[meta-disconnect][${VERSION}][${traceId}] Storefront revalidation failed:`, (revalidationErr as Error).message);
      results.storefront_revalidation = {
        staleCount: 0,
        cachePurged: false,
        prerenderTriggered: false,
        purgeStatus: null,
        prerenderStatus: null,
      };
    }

    console.log(`[meta-disconnect][${VERSION}][${traceId}] Disconnect complete.`, JSON.stringify(results));

    return jsonResponse({
      success: true,
      ...results,
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
