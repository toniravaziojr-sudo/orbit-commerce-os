// =============================================================
// CONVERSATIONS AUTO-RESOLVE — Cron diário (Eixo 2 do Cérebro Regenerativo)
// =============================================================
// Regra de negócio:
//   1. Conversa em waiting_customer há mais de 72h SEM humano atribuído
//      (assigned_to IS NULL) é marcada como resolved automaticamente.
//   2. Conversa em waiting_customer há mais de 72h COM humano atribuído NÃO
//      é tocada — o humano é dono e decide quando encerrar.
//   3. Conversa em waiting_agent (na fila) NUNCA é auto-resolvida —
//      cliente está esperando humano, fechar seria abandono.
//   4. Conversa em open (humano respondendo) NUNCA é auto-resolvida —
//      humano está no controle.
//
// Marcar como resolved libera a conversa para o pipeline de aprendizado
// (Eixo 4) consumir como sinal pronto para análise.
// =============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startedAt = new Date().toISOString();
  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

  console.log(
    `[conversations-auto-resolve] Started at ${startedAt}. Cutoff (72h): ${cutoff}`,
  );

  // 1. Buscar candidatas: waiting_customer + sem humano + sem mensagem do
  //    cliente nas últimas 72h. Usamos last_customer_message_at quando
  //    disponível; fallback para last_message_at.
  const { data: candidates, error: queryError } = await supabase
    .from("conversations")
    .select(
      "id, tenant_id, last_customer_message_at, last_message_at, channel_type",
    )
    .eq("status", "waiting_customer")
    .is("assigned_to", null)
    .or(
      `last_customer_message_at.lt.${cutoff},and(last_customer_message_at.is.null,last_message_at.lt.${cutoff})`,
    )
    .limit(500);

  if (queryError) {
    console.error("[conversations-auto-resolve] Query error:", queryError);
    return new Response(
      JSON.stringify({ success: false, error: queryError.message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const total = candidates?.length ?? 0;
  console.log(`[conversations-auto-resolve] Found ${total} candidates.`);

  if (total === 0) {
    return new Response(
      JSON.stringify({
        success: true,
        resolved: 0,
        message: "no candidates",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 2. Resolver em batch
  const ids = candidates!.map((c) => c.id);
  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("conversations")
    .update({ status: "resolved", resolved_at: nowIso })
    .in("id", ids);

  if (updateError) {
    console.error("[conversations-auto-resolve] Update error:", updateError);
    return new Response(
      JSON.stringify({ success: false, error: updateError.message }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // 3. Registrar evento de auditoria por conversa
  const events = candidates!.map((c) => ({
    tenant_id: c.tenant_id,
    conversation_id: c.id,
    event_type: "status_changed",
    actor_type: "system",
    actor_name: "auto-resolve-72h",
    new_value: { status: "resolved", reason: "auto_resolve_inactivity_72h" },
    metadata: {
      cutoff_used: cutoff,
      last_customer_message_at: c.last_customer_message_at,
    },
  }));
  await supabase.from("conversation_events").insert(events);

  console.log(`[conversations-auto-resolve] Resolved ${total} conversations.`);

  return new Response(
    JSON.stringify({
      success: true,
      resolved: total,
      cutoff,
      finishedAt: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
