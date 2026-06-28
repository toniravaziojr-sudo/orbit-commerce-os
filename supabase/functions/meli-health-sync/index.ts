/**
 * meli-health-sync — Onda A
 *
 * Backfill/reconciliação da saúde (qualidade) dos anúncios do tenant
 * publicados no Mercado Livre. Pode ser invocada pela aba "Anúncios" para
 * recarregar a nota e a lista de pendências sob demanda.
 *
 * Reaproveita a mesma chave de conexão e o auto-refresh já usado por
 * meli-publish-listing e o helper único `_shared/meli/health.ts`. Não
 * substitui nenhum fluxo existente — apenas alimenta os novos campos
 * `health_score / health_actions / health_checked_at` em meli_listings.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { fetchAndPersistMeliHealth } from "../_shared/meli/health.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ success: false, error: "Não autorizado" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse({ success: false, error: "Sessão inválida" }, 401);

    const { tenantId, listingIds, limit = 100 } = await req.json().catch(() => ({} as any));
    if (!tenantId) return jsonResponse({ success: false, error: "tenantId obrigatório" }, 400);

    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!userRole) return jsonResponse({ success: false, error: "Sem acesso ao tenant" }, 403);

    // Conexão + auto-refresh de token
    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .maybeSingle();
    if (!connection?.access_token) {
      return jsonResponse({ success: false, error: "Mercado Livre não conectado" }, 400);
    }

    let accessToken: string = connection.access_token;
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      const refreshRes = await supabase.functions.invoke("meli-token-refresh", {
        body: { connectionId: connection.id },
      });
      if (refreshRes.data?.success) {
        const { data: refreshed } = await supabase
          .from("marketplace_connections")
          .select("access_token")
          .eq("id", connection.id)
          .maybeSingle();
        if (refreshed?.access_token) accessToken = refreshed.access_token;
      }
    }

    // Seleciona anúncios alvo
    let query = supabase
      .from("meli_listings")
      .select("id, meli_item_id")
      .eq("tenant_id", tenantId)
      .eq("status", "published")
      .not("meli_item_id", "is", null);
    if (Array.isArray(listingIds) && listingIds.length > 0) {
      query = query.in("id", listingIds);
    } else {
      query = query
        .order("health_checked_at", { ascending: true, nullsFirst: true })
        .limit(Math.min(Number(limit) || 100, 300));
    }

    const { data: listings, error: lerr } = await query;
    if (lerr) return jsonResponse({ success: false, error: lerr.message }, 500);

    const targets = (listings ?? []).filter((l: any) => l.meli_item_id);
    console.log(`[meli-health-sync] tenant=${tenantId} processing=${targets.length}`);

    // Concorrência leve (5 em paralelo) para não estourar rate-limit do ML.
    const results: any[] = [];
    const queue = [...targets];
    const workers = Array.from({ length: Math.min(5, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) break;
        const r = await fetchAndPersistMeliHealth(supabase, accessToken, item.id, item.meli_item_id);
        results.push({ id: item.id, meli_item_id: item.meli_item_id, score: r?.score ?? null });
      }
    });
    await Promise.all(workers);

    return jsonResponse({ success: true, processed: results.length, results });
  } catch (err: any) {
    console.error("[meli-health-sync] error", err);
    return jsonResponse({ success: false, error: String(err?.message || err) }, 500);
  }
});
