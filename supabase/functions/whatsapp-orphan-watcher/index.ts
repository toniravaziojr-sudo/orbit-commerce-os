import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * whatsapp-orphan-watcher
 *
 * Cron a cada 15 minutos. Anti-regressão para o cenário jan/fev:
 *   "mensagens caíram em whatsapp_inbound_messages, mas processed_at ficou null
 *    porque o roteamento/IA não foi disparado".
 *
 * Para cada tenant Meta ativo, conta mensagens recebidas nas últimas 2h
 * com processed_at IS NULL e idade >= 5 minutos. Se houver, abre/atualiza
 * incidente "orphan_messages" em whatsapp_health_incidents.
 *
 * Quando todas as mensagens recentes foram processadas, fecha o incidente
 * automaticamente. Sem reprocessamento — apenas visibilidade.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[wa-orphan-watcher][${traceId}] start`);

  try {
    const { data: configs } = await supabase
      .from("whatsapp_configs")
      .select("tenant_id")
      .eq("provider", "meta")
      .eq("is_enabled", true);

    const summary = {
      checked: 0,
      with_orphans: 0,
      incidents_opened: 0,
      incidents_resolved: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    for (const cfg of configs || []) {
      summary.checked++;

      // Mensagens com mais de 5 min e ainda sem processamento (janela de 2h)
      const { data: orphans, error } = await supabase
        .from("whatsapp_inbound_messages")
        .select("id, from_phone, timestamp, message_type")
        .eq("tenant_id", cfg.tenant_id)
        .gte("timestamp", twoHoursAgo)
        .lte("timestamp", fiveMinAgo)
        .is("processed_at", null)
        .order("timestamp", { ascending: false })
        .limit(50);

      if (error) {
        summary.details.push({ tenant_id: cfg.tenant_id, error: error.message });
        continue;
      }

      const count = orphans?.length || 0;

      // Buscar incidente aberto
      const { data: existing } = await supabase
        .from("whatsapp_health_incidents")
        .select("id, metadata")
        .eq("tenant_id", cfg.tenant_id)
        .eq("incident_type", "orphan_messages")
        .eq("status", "open")
        .maybeSingle();

      if (count > 0) {
        summary.with_orphans++;
        const sample = (orphans || []).slice(0, 5).map((o) => ({
          from: o.from_phone,
          at: o.timestamp,
          type: o.message_type,
        }));

        if (existing) {
          // Atualiza contagem
          await supabase
            .from("whatsapp_health_incidents")
            .update({
              detail: `${count} mensagem(ns) chegaram nas últimas 2h e ainda não foram processadas pela IA.`,
              metadata: { count, sample, last_check: new Date().toISOString() },
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("whatsapp_health_incidents").insert({
            tenant_id: cfg.tenant_id,
            incident_type: "orphan_messages",
            severity: "critical",
            title: "Mensagens recebidas sem resposta da IA",
            detail: `${count} mensagem(ns) chegaram nas últimas 2h e ainda não foram processadas pela IA.`,
            metadata: { count, sample, first_detected: new Date().toISOString() },
          });
          summary.incidents_opened++;
        }
        summary.details.push({ tenant_id: cfg.tenant_id, orphans: count });
      } else if (existing) {
        // Resolveu sozinho — fecha incidente
        await supabase
          .from("whatsapp_health_incidents")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        summary.incidents_resolved++;
      }
    }

    console.log(`[wa-orphan-watcher][${traceId}] done`, JSON.stringify(summary));
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[wa-orphan-watcher][${traceId}] fatal`, error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
