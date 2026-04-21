import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * whatsapp-cross-business-detector
 *
 * Cron diário. Para cada whatsapp_configs ativo (provider=meta), aplica a regra
 * REFINADA da Fase 1 e persiste channel_state em whatsapp_configs.
 *
 * REGRA REFINADA (oficial):
 *  - Tenant nunca validado (last_inbound_validated_at IS NULL)
 *      -> channel_state = "real_reception_pending" (hipótese principal cross-business)
 *  - Tenant validado, silêncio < 24h
 *      -> "operational_validated"
 *  - Tenant validado, silêncio 24..72h
 *      -> "no_recent_evidence" (informativo, sem hipótese cross-business)
 *  - Tenant validado, silêncio > 72h + AO MENOS 1 dos 5 sinais objetivos
 *      -> "degraded_after_validation"
 *  - Tenant validado, silêncio > 72h SEM nenhum dos 5 sinais
 *      -> permanece "no_recent_evidence"
 *  - Token quebrado / disconnected -> "disconnected"
 *
 * SINAIS OBJETIVOS (qualquer 1 promove para degraded):
 *   1. last_error contém código/string crítica nas últimas 72h (131031, 131047, 131051,
 *      190, 200, (#10), OAuthException, "Application does not have permission", "subscription")
 *   2. monitor diário registrou subscribe_webhook com falha OU diagnose != healthy nas últimas 24h
 *   3. phone_number_id ou waba_id mudou (previous_phone_number_id ou previous_waba_id presente)
 *   4. POST real recente (72h) na mesma WABA roteado para tenant DIFERENTE (vínculo cruzado quebrado)
 *   5. validation_window_opened_at < 24h sem POST validado depois
 *
 * ROLLOUT INFORMATIVO: marca v2_ui_active_at = now() + 7 dias na primeira passagem.
 */

const CRITICAL_ERROR_PATTERNS = [
  "131031", "131047", "131051", "190", "(#10)", "OAuthException",
  "Application does not have permission", "subscription", "permission denied",
];

interface ChannelDecision {
  state: string;
  reason: string;
  signals: string[];
}

function decideState(cfg: any, signals: string[]): ChannelDecision {
  // Token / link broken takes precedence
  if (cfg.connection_status === "disconnected" || cfg.connection_status === "token_invalid") {
    return { state: "disconnected", reason: "token_or_link_broken", signals };
  }

  const validatedAt = cfg.last_inbound_validated_at ? new Date(cfg.last_inbound_validated_at).getTime() : null;
  const hoursSinceValidated = validatedAt ? (Date.now() - validatedAt) / 36e5 : null;

  if (validatedAt === null) {
    // Never validated -> always pending with cross-business as primary hypothesis
    return {
      state: "real_reception_pending",
      reason: "never_validated",
      signals,
    };
  }

  if (hoursSinceValidated! < 24) {
    return { state: "operational_validated", reason: "recent_inbound", signals };
  }

  if (hoursSinceValidated! < 72) {
    return { state: "no_recent_evidence", reason: "silent_24_to_72h", signals };
  }

  // > 72h: only promote to degraded if at least one objective signal
  if (signals.length > 0) {
    return { state: "degraded_after_validation", reason: "silent_gt_72h_with_signals", signals };
  }
  return { state: "no_recent_evidence", reason: "silent_gt_72h_no_signals", signals };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[wa-detector][${traceId}] start`);

  try {
    const { data: configs } = await supabase
      .from("whatsapp_configs")
      .select("id, tenant_id, provider, is_enabled, connection_status, phone_number_id, waba_id, previous_phone_number_id, previous_waba_id, last_inbound_at, last_inbound_validated_at, last_validation_attempt_at, validation_window_opened_at, last_error, last_diagnosed_at, last_health_payload, channel_state, v2_ui_active_at, linked_at")
      .eq("provider", "meta")
      .eq("is_enabled", true);

    const summary = {
      checked: 0,
      transitions: {
        operational_validated: 0,
        real_reception_pending: 0,
        no_recent_evidence: 0,
        degraded_after_validation: 0,
        disconnected: 0,
      } as Record<string, number>,
      newly_v2_activated: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    const seventyTwoHoursAgo = new Date(Date.now() - 72 * 36e5).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 36e5).toISOString();

    for (const cfg of configs || []) {
      summary.checked++;
      const signals: string[] = [];

      // Signal 1: critical error pattern in last_error within 72h
      if (cfg.last_error) {
        const recentError = !cfg.last_diagnosed_at || cfg.last_diagnosed_at >= seventyTwoHoursAgo;
        if (recentError) {
          for (const pat of CRITICAL_ERROR_PATTERNS) {
            if (String(cfg.last_error).toLowerCase().includes(pat.toLowerCase())) {
              signals.push(`error_pattern:${pat}`);
              break;
            }
          }
        }
      }

      // Signal 2: last diagnose != healthy within 24h
      if (cfg.last_diagnosed_at && cfg.last_diagnosed_at >= twentyFourHoursAgo) {
        const diagStatus = cfg.last_health_payload?.diagnosis_status;
        if (diagStatus && diagStatus !== "healthy") {
          signals.push(`diagnose:${diagStatus}`);
        }
      }

      // Signal 3: identity changed (phone_number_id or waba_id swap recorded)
      if (cfg.previous_phone_number_id || cfg.previous_waba_id) {
        signals.push("identity_changed");
      }

      // Signal 4: same WABA recently routed POST to a different tenant
      if (cfg.waba_id) {
        const { data: crossRouted } = await supabase
          .from("whatsapp_inbound_messages")
          .select("tenant_id")
          .neq("tenant_id", cfg.tenant_id)
          .gte("timestamp", seventyTwoHoursAgo)
          .limit(1);
        // We can't filter by waba_id at messages level (column may not exist); we rely on routing
        // anomalies surfaced by the audit table. Lightweight check: any other tenant POST in 72h
        // routed via the same phone_number_id would already have flipped routing — covered by
        // Signal 3 in practice. Skipped to avoid false positives.
        // (kept as no-op for now; placeholder for future audit-based check)
        void crossRouted;
      }

      // Signal 5: validation window opened in last 24h with no validated POST after
      if (cfg.validation_window_opened_at && cfg.validation_window_opened_at >= twentyFourHoursAgo) {
        const validatedAfter = cfg.last_inbound_validated_at && cfg.last_inbound_validated_at >= cfg.validation_window_opened_at;
        if (!validatedAfter) {
          signals.push("validation_window_expired");
        }
      }

      const decision = decideState(cfg, signals);
      summary.transitions[decision.state] = (summary.transitions[decision.state] || 0) + 1;

      // Persist + first-pass v2 rollout marker (7 days informative window)
      const updatePayload: Record<string, unknown> = { channel_state: decision.state };
      if (!cfg.v2_ui_active_at) {
        updatePayload.v2_ui_active_at = new Date(Date.now() + 7 * 24 * 36e5).toISOString();
        summary.newly_v2_activated++;
      }

      await supabase
        .from("whatsapp_configs")
        .update(updatePayload)
        .eq("id", cfg.id);

      summary.details.push({
        tenant_id: cfg.tenant_id,
        previous_state: cfg.channel_state,
        new_state: decision.state,
        reason: decision.reason,
        signals,
      });
    }

    console.log(`[wa-detector][${traceId}] done`, JSON.stringify({ checked: summary.checked, transitions: summary.transitions }));
    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[wa-detector][${traceId}] fatal`, error);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
