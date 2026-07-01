import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre — Orders Reconciliation Cron
 *
 * Reconciliação a cada 15 min: percorre todas as conexões ML ativas
 * e dispara meli-sync-orders (modo incremental — últimos 10 pedidos).
 * Serve como fallback caso um webhook orders_v2 seja perdido.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Regra §8 padroes-operacionais: filtrar por health_status, nunca só por is_active.
    const { data: connections, error } = await supabase
      .from("marketplace_connections")
      .select("tenant_id, expires_at, health_status")
      .eq("marketplace", "mercadolivre")
      .neq("health_status", "needs_reauth");

    if (error) throw error;

    const now = Date.now();
    const active = (connections || []).filter(
      (c: any) => !c.expires_at || new Date(c.expires_at).getTime() > now,
    );

    let dispatched = 0;
    const errors: string[] = [];

    for (const conn of active) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/meli-sync-orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ tenantId: conn.tenant_id }),
        });
        if (!res.ok) errors.push(`tenant ${conn.tenant_id}: HTTP ${res.status}`);
        dispatched++;
      } catch (e: any) {
        errors.push(`tenant ${conn.tenant_id}: ${e?.message || String(e)}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, dispatched, total: active.length, errors }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[meli-orders-reconcile] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
