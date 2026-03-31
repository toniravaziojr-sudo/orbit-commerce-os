import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== VERSION =====
const VERSION = "v2.0.0"; // Phase 7: Also revoke V4 grant on deauthorize
// ===================

/**
 * Meta Deauthorize Callback — V4 + Legacy
 * 
 * Recebe webhook do Meta quando usuário remove permissões do app.
 * Valida assinatura HMAC e desativa:
 * - V4: grants em tenant_meta_auth_grants + integrações
 * - Legacy: marketplace_connections (compatibilidade)
 */
Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-deauthorize-callback][${VERSION}][${traceId}] Request: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Parse body
    let signedRequest: string | null = null;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      signedRequest = formData.get("signed_request") as string;
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      signedRequest = body.signed_request;
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      signedRequest = params.get("signed_request");
    }

    if (!signedRequest) {
      console.error(`[meta-deauthorize-callback][${VERSION}][${traceId}] Missing signed_request`);
      return jsonResponse({ success: false, error: "Missing signed_request" });
    }

    // Buscar META_APP_SECRET
    const { data: secretData } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_APP_SECRET")
      .eq("is_active", true)
      .single();

    if (!secretData?.credential_value) {
      console.error(`[meta-deauthorize-callback][${VERSION}][${traceId}] META_APP_SECRET not configured`);
      return jsonResponse({ success: false, error: "App not configured" });
    }

    const appSecret = secretData.credential_value;
    const payload = parseSignedRequest(signedRequest, appSecret);
    
    if (!payload) {
      console.error(`[meta-deauthorize-callback][${VERSION}][${traceId}] Invalid signature`);
      return jsonResponse({ success: false, error: "Invalid signature" });
    }

    const userId = payload.user_id;
    if (!userId) {
      console.error(`[meta-deauthorize-callback][${VERSION}][${traceId}] Missing user_id in payload`);
      return jsonResponse({ success: false, error: "Missing user_id" });
    }

    console.log(`[meta-deauthorize-callback][${VERSION}][${traceId}] Deauthorizing Meta user ${userId}`);

    // ── V4: Revoke grants by meta_user_id ──
    const { data: grants } = await supabase
      .from("tenant_meta_auth_grants")
      .select("id, tenant_id")
      .eq("meta_user_id", userId)
      .eq("status", "active");

    if (grants && grants.length > 0) {
      console.log(`[meta-deauthorize-callback][${VERSION}][${traceId}] Revoking ${grants.length} V4 grant(s)`);

      for (const grant of grants) {
        await supabase
          .from("tenant_meta_auth_grants")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoke_reason: "meta_deauthorize_callback",
          })
          .eq("id", grant.id);

        // Deactivate integrations for this tenant
        await supabase
          .from("tenant_meta_integrations")
          .update({ status: "inactive" })
          .eq("tenant_id", grant.tenant_id)
          .eq("status", "active");

        // Deactivate WhatsApp configs
        await supabase
          .from("whatsapp_configs")
          .update({
            is_enabled: false,
            connection_status: "disconnected",
            last_error: "Usuário revogou permissões no Meta",
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", grant.tenant_id)
          .eq("provider", "meta");
      }
    }

    // ── Legacy: Deactivate marketplace_connections ──
    const { data: connections } = await supabase
      .from("marketplace_connections")
      .select("id, tenant_id")
      .eq("marketplace", "meta")
      .eq("external_user_id", userId)
      .eq("is_active", true);

    if (connections && connections.length > 0) {
      console.log(`[meta-deauthorize-callback][${VERSION}][${traceId}] Deactivating ${connections.length} legacy connection(s)`);

      await supabase
        .from("marketplace_connections")
        .update({
          is_active: false,
          last_error: "Usuário revogou permissões no Meta",
          updated_at: new Date().toISOString(),
        })
        .eq("marketplace", "meta")
        .eq("external_user_id", userId);

      // WhatsApp configs for legacy tenants (if not already handled by V4)
      const v4TenantIds = new Set((grants || []).map(g => g.tenant_id));
      for (const conn of connections) {
        if (!v4TenantIds.has(conn.tenant_id)) {
          await supabase
            .from("whatsapp_configs")
            .update({
              is_enabled: false,
              connection_status: "disconnected",
              last_error: "Usuário revogou permissões no Meta",
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", conn.tenant_id)
            .eq("provider", "meta");
        }
      }
    }

    console.log(`[meta-deauthorize-callback][${VERSION}][${traceId}] Deauthorize complete. V4 grants: ${grants?.length || 0}, Legacy: ${connections?.length || 0}`);

    const confirmationCode = crypto.randomUUID();
    const statusUrl = `https://app.comandocentral.com.br/integrations/meta/deletion-status?code=${confirmationCode}`;

    return new Response(JSON.stringify({
      url: statusUrl,
      confirmation_code: confirmationCode,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[meta-deauthorize-callback][${VERSION}][${traceId}] Error:`, error);
    return jsonResponse({ success: false, error: "Internal server error" });
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseSignedRequest(signedRequest: string, appSecret: string): Record<string, any> | null {
  try {
    const parts = signedRequest.split(".");
    if (parts.length !== 2) return null;

    const [encodedSig, encodedPayload] = parts;
    const sig = base64UrlDecode(encodedSig);
    const payloadStr = new TextDecoder().decode(base64UrlDecode(encodedPayload));
    const payload = JSON.parse(payloadStr);

    if (payload.algorithm?.toUpperCase() !== "HMAC-SHA256") return null;

    const expectedSig = createHmac("sha256", appSecret).update(encodedPayload).digest();

    if (!timingSafeEqual(sig, expectedSig)) return null;

    return payload;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
