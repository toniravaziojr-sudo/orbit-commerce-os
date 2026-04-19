import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * meta-whatsapp-monitor-all
 *
 * Cron diário. Para cada WhatsApp Meta ativo:
 *  1. Roda meta-whatsapp-diagnose
 *  2. Auto-repara webhook (sempre seguro)
 *  3. Auto-repara registro de número SE PIN estiver salvo no banco
 *     (PIN salvo = consentimento explícito do usuário no onboarding/PIN manager,
 *     então execução automática mantém auditoria via audit_log do set-pin original).
 *  4. Loga incidentes que ainda dependem de ação humana (token revogado, billing).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[wa-monitor-all][${traceId}] start`);

  try {
    const { data: configs } = await supabase
      .from("whatsapp_configs")
      .select("id, tenant_id, register_pin")
      .eq("provider", "meta")
      .eq("is_enabled", true)
      .not("access_token", "is", null);

    const summary = {
      checked: 0, healthy: 0, repaired: 0, needs_user_action: 0, errors: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    for (const cfg of configs || []) {
      summary.checked++;
      try {
        // Diagnose
        const diagResp = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-diagnose`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ tenant_id: cfg.tenant_id }),
        });
        const diag = await diagResp.json();
        const status = diag?.data?.status;
        const autoActions = (diag?.data?.auto_actions || []) as string[];

        if (status === "healthy") {
          summary.healthy++;
          continue;
        }

        // Webhook é sempre seguro
        const safeActions = autoActions.filter((a) => a === "subscribe_webhook");
        // Registro do número é auto-reparado APENAS se PIN está salvo
        const canAutoRegister = autoActions.includes("register_phone") && !!cfg.register_pin;
        const fullActions = canAutoRegister
          ? [...safeActions, "register_phone"]
          : safeActions;

        if (fullActions.length > 0) {
          const recResp = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-recover`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              tenant_id: cfg.tenant_id,
              actions: fullActions,
              ...(canAutoRegister ? { pin: cfg.register_pin } : {}),
            }),
          });
          const rec = await recResp.json();
          if (rec?.data?.all_succeeded) summary.repaired++;
          summary.details.push({ tenant_id: cfg.tenant_id, repaired: fullActions, auto_registered: canAutoRegister, result: rec?.data });
        }

        if (diag?.data?.user_action_required) {
          summary.needs_user_action++;
          summary.details.push({
            tenant_id: cfg.tenant_id,
            needs_action: true,
            issues: diag?.data?.issues,
          });
        }
      } catch (e) {
        summary.errors++;
        summary.details.push({ tenant_id: cfg.tenant_id, error: (e as Error).message });
      }
    }

    console.log(`[wa-monitor-all][${traceId}] done`, JSON.stringify(summary));
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[wa-monitor-all][${traceId}] fatal`, error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
