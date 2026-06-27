// v8.36.0 — Consome um token ?ah=<token> emitido por email-track.
// Atomicamente marca como usado (TTL 5 min, single-use) e devolve o bundle
// de hashes que o storefront grava em localStorage._sf_identity quando o
// cofre local está vazio. Não bloqueia navegação em hipótese alguma.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token || !/^ah_[a-f0-9]{16,}$/i.test(token)) {
      return json({ ok: false, reason: "invalid_token" });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Atômico: marca used_at apenas se ainda não usado e não expirado
    const { data, error } = await supabase
      .from("identity_prehydration_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("identity_bundle, tenant_id")
      .maybeSingle();

    if (error || !data) {
      return json({ ok: false, reason: "expired_or_used" });
    }

    return json({ ok: true, bundle: data.identity_bundle });
  } catch (e) {
    console.error("[identity-prehydrate] error:", (e as Error).message);
    return json({ ok: false, reason: "internal_error" });
  }
});

function json(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}
