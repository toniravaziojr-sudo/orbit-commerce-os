// Shared role-check helper for fiscal edge functions.
// Enforces RBAC consistently across fiscal-* and dce-* functions.
//
// Usage:
//   const auth = await requireFiscalRole(req, supabaseClient, ['owner', 'admin']);
//   if (!auth.ok) return auth.response;
//   const { user, tenantId } = auth;

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type FiscalRole = "owner" | "admin" | "operator" | "member" | "viewer";

export interface FiscalAuthOk {
  ok: true;
  user: { id: string };
  tenantId: string;
  role: FiscalRole;
  serviceClient: SupabaseClient;
}

export interface FiscalAuthFail {
  ok: false;
  response: Response;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function fail(status: number, error: string, code?: string): FiscalAuthFail {
  return {
    ok: false,
    response: new Response(
      JSON.stringify({ success: false, error, code }),
      { status, headers: corsHeaders },
    ),
  };
}

/**
 * Validates that the request comes from an authenticated user with one of the
 * allowed roles in their current tenant. Returns a service-role client for
 * subsequent operations (after tenant_id is established).
 *
 * Service-role calls (Authorization: Bearer SERVICE_ROLE_KEY) bypass auth and
 * must explicitly pass `tenant_id` in the request body — caller's responsibility.
 */
export async function requireFiscalRole(
  req: Request,
  allowedRoles: FiscalRole[],
): Promise<FiscalAuthOk | FiscalAuthFail> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return fail(401, "Não autorizado", "no_auth_header");
  }

  const serviceClient = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return fail(401, "Usuário não autenticado", "invalid_token");
  }

  const user = userData.user;

  // Resolve tenant via profile.current_tenant_id (canonical pattern in this project)
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("current_tenant_id")
    .eq("id", user.id)
    .single();

  const tenantId = profile?.current_tenant_id;
  if (!tenantId) {
    return fail(400, "Tenant do usuário não encontrado", "no_tenant");
  }

  // Resolve role on this tenant
  const { data: roleRow } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const role = (roleRow?.role ?? "viewer") as FiscalRole;

  if (!allowedRoles.includes(role)) {
    return fail(
      403,
      `Permissão insuficiente. Requer: ${allowedRoles.join(" ou ")}`,
      "insufficient_role",
    );
  }

  return { ok: true, user: { id: user.id }, tenantId, role, serviceClient };
}

/**
 * Validates the FOCUS_NFE_WEBHOOK_SECRET against incoming webhook request.
 * Accepts the secret via:
 *   - X-Webhook-Secret header
 *   - ?secret=... query param
 *   - HTTP Basic auth password
 *
 * Returns null when valid, or a Response (401) when invalid/missing.
 * If the secret env var is NOT configured, returns null (fail-open) — the
 * caller MUST log a warning so this state is visible.
 */
export function validateWebhookSecret(req: Request): Response | null {
  const expected = Deno.env.get("FOCUS_NFE_WEBHOOK_SECRET");
  if (!expected) {
    console.warn(
      "[webhook-secret] FOCUS_NFE_WEBHOOK_SECRET not configured — webhook is UNPROTECTED",
    );
    return null;
  }

  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret");
  const fromHeader = req.headers.get("x-webhook-secret") ||
    req.headers.get("x-focus-webhook-secret");

  let fromBasic: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = atob(authHeader.slice(6).trim());
      // Format: "user:password" — accept password (or whole string) as the secret
      const colon = decoded.indexOf(":");
      fromBasic = colon >= 0 ? decoded.slice(colon + 1) : decoded;
    } catch {
      fromBasic = null;
    }
  }

  const provided = fromHeader || fromQuery || fromBasic;
  if (provided && provided === expected) {
    return null;
  }

  console.error(
    "[webhook-secret] Invalid or missing webhook secret. Rejecting request.",
  );
  return new Response(
    JSON.stringify({ success: false, error: "Invalid webhook secret" }),
    { status: 401, headers: corsHeaders },
  );
}
