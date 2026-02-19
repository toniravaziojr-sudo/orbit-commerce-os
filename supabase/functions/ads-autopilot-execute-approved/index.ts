import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.2.0"; // Revalidação de budget com snapshot (pending_reserved) antes de executar

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-execute-approved][${VERSION}] Request received`);

  try {
    const { tenant_id, action_id } = await req.json();

    if (!tenant_id || !action_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing tenant_id or action_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch the pending action (accept both pending_approval and approved statuses)
    const { data: action, error: fetchErr } = await supabase
      .from("ads_autopilot_actions")
      .select("*")
      .eq("id", action_id)
      .eq("tenant_id", tenant_id)
      .in("status", ["pending_approval", "approved"])
      .maybeSingle();

    if (fetchErr || !action) {
      return new Response(
        JSON.stringify({ success: false, error: "Action not found or already processed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ads-autopilot-execute-approved][${VERSION}] Executing action ${action_id} type=${action.action_type}`);

    // v1.2.0: Revalidate budget before execution (for create_campaign only)
    if (action.action_type === "create_campaign" && action.channel === "meta") {
      const adAccountId = action.action_data?.ad_account_id;
      const proposedBudgetCents = action.action_data?.daily_budget_cents || action.action_data?.preview?.daily_budget_cents || 0;

      if (adAccountId && proposedBudgetCents > 0) {
        // Get account config for limit
        const { data: acctConfig } = await supabase
          .from("ads_autopilot_account_configs")
          .select("budget_cents")
          .eq("tenant_id", tenant_id)
          .eq("ad_account_id", adAccountId)
          .maybeSingle();

        const limitCents = acctConfig?.budget_cents || 0;

        if (limitCents > 0) {
          // Get active campaigns budget
          const { data: aiCampaigns } = await supabase
            .from("meta_ad_campaigns")
            .select("daily_budget_cents")
            .eq("tenant_id", tenant_id)
            .eq("ad_account_id", adAccountId)
            .eq("status", "ACTIVE")
            .ilike("name", "[AI]%");

          const activeCents = (aiCampaigns || []).reduce((sum: number, c: any) => sum + (c.daily_budget_cents || 0), 0);

          // Get other pending proposals (excluding this one)
          const ttlCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: pendingActions } = await supabase
            .from("ads_autopilot_actions")
            .select("id, action_data")
            .eq("tenant_id", tenant_id)
            .eq("status", "pending_approval")
            .eq("action_type", "create_campaign")
            .eq("channel", "meta")
            .neq("id", action_id)
            .gte("created_at", ttlCutoff);

          let pendingReservedCents = 0;
          for (const pa of (pendingActions || [])) {
            const budgetVal = pa.action_data?.daily_budget_cents || pa.action_data?.preview?.daily_budget_cents || 0;
            pendingReservedCents += Number(budgetVal) || 0;
          }

          const totalAfter = activeCents + pendingReservedCents + proposedBudgetCents;

          console.log(`[ads-autopilot-execute-approved][${VERSION}] Budget revalidation: active=${activeCents} pending_excl_self=${pendingReservedCents} proposed=${proposedBudgetCents} total=${totalAfter} limit=${limitCents}`);

          if (totalAfter > limitCents) {
            // Block execution — budget exceeded
            await supabase
              .from("ads_autopilot_actions")
              .update({
                status: "rejected",
                rejection_reason: `Aprovar esta campanha excederia o limite diário. Ativo: R$ ${(activeCents / 100).toFixed(2)} | Reservado: R$ ${(pendingReservedCents / 100).toFixed(2)} | Proposta: R$ ${(proposedBudgetCents / 100).toFixed(2)} | Limite: R$ ${(limitCents / 100).toFixed(2)}/dia. Ajuste o orçamento ou rejeite outra proposta pendente.`,
              })
              .eq("id", action_id);

            return new Response(
              JSON.stringify({
                success: false,
                error: `Aprovar esta campanha excederia o limite diário de R$ ${(limitCents / 100).toFixed(2)}. Ativo: R$ ${(activeCents / 100).toFixed(2)} | Reservado: R$ ${(pendingReservedCents / 100).toFixed(2)}. Ajuste o orçamento ou rejeite outra proposta.`,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }
    }

    // Trigger analysis with the approved action context
    const { data: result, error: analyzeErr } = await supabase.functions.invoke("ads-autopilot-analyze", {
      body: {
        tenant_id,
        trigger_type: "approved_action",
        approved_action_id: action_id,
      },
    });

    if (analyzeErr) {
      // Mark as failed
      await supabase
        .from("ads_autopilot_actions")
        .update({ status: "failed", error_message: analyzeErr.message })
        .eq("id", action_id);

      return new Response(
        JSON.stringify({ success: false, error: analyzeErr.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark as executed
    await supabase
      .from("ads_autopilot_actions")
      .update({ status: "executed", executed_at: new Date().toISOString() })
      .eq("id", action_id);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error(`[ads-autopilot-execute-approved][${VERSION}] Error:`, err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
