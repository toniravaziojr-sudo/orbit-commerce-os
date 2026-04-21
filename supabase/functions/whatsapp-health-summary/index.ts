import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * whatsapp-health-summary
 *
 * Resumo de saúde do WhatsApp do tenant para o card da Central de Comando.
 * Retorna:
 *   - last_inbound_at: última mensagem recebida
 *   - last_ai_reply_at: última resposta automatizada (mensagem outbound da IA)
 *   - subscription_status: green | yellow | red
 *   - open_incidents: lista de incidentes abertos
 *   - silence_alert: amarelo após 12h sem mensagens, vermelho após 24h
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { tenant_id } = body as { tenant_id?: string };
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Acesso ao tenant
    const { data: role } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("tenant_id", tenant_id).maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ success: false, error: "Sem acesso" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Config do WhatsApp (estendido para Fase 1 v2: 3 sinais separados)
    const { data: cfg } = await supabase
      .from("whatsapp_configs")
      .select("provider, is_enabled, connection_status, webhook_subscribed_at, last_diagnosed_at, last_error, display_phone_number, last_health_payload, phone_number_id, waba_id, previous_phone_number_id, previous_waba_id, linked_at, migration_observation_until, last_inbound_at, last_inbound_validated_at, last_validation_attempt_at, validation_window_opened_at, v2_ui_active_at, channel_state")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .maybeSingle();

    if (!cfg) {
      return new Response(JSON.stringify({
        success: true,
        data: { configured: false },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Última mensagem recebida
    const { data: lastIn } = await supabase
      .from("whatsapp_inbound_messages")
      .select("timestamp, processed_at, from_phone")
      .eq("tenant_id", tenant_id)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Última resposta da IA (mensagem outbound do tipo bot)
    const { data: lastOut } = await supabase
      .from("messages")
      .select("created_at, sender_type, conversation_id")
      .eq("tenant_id", tenant_id)
      .eq("sender_type", "bot")
      .in("conversation_id", await (async () => {
        const { data: botConversations } = await supabase
          .from("conversations")
          .select("id")
          .eq("tenant_id", tenant_id)
          .eq("channel_type", "whatsapp");
        return (botConversations || []).map((row) => row.id);
      })())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Incidentes abertos
    const { data: incidents } = await supabase
      .from("whatsapp_health_incidents")
      .select("id, incident_type, severity, title, detail, metadata, detected_at")
      .eq("tenant_id", tenant_id)
      .eq("status", "open")
      .order("detected_at", { ascending: false });

    // === LAYER 1: vínculo técnico ===
    const healthPayload = (cfg.last_health_payload || {}) as Record<string, any>;
    const diagnosisStatus = healthPayload?.diagnosis_status as string | undefined;
    const hasCriticalIssues = Array.isArray(healthPayload?.issues)
      ? healthPayload.issues.some((issue: Record<string, unknown>) => issue?.severity === "critical")
      : false;
    const appWebhookMatches = healthPayload?.app_webhook?.callback_matches === true;
    const appWebhookMessages = healthPayload?.app_webhook?.has_messages_field === true;
    const wabaSubscribed = healthPayload?.webhook?.subscribed === true;

    const tokenBroken = cfg.connection_status === "token_invalid" || cfg.connection_status === "disconnected";
    const linkBroken = tokenBroken || diagnosisStatus === "needs_attention" || hasCriticalIssues
      || !appWebhookMatches || !appWebhookMessages || !wabaSubscribed;

    let linkStatus: "connected" | "incomplete" | "broken" = "connected";
    let linkLabel = "Vínculo técnico ativo";
    if (tokenBroken) {
      linkStatus = "broken";
      linkLabel = "Conta Meta desconectada";
    } else if (linkBroken) {
      linkStatus = "broken";
      linkLabel = "Vínculo com defeito";
    } else if (!cfg.webhook_subscribed_at) {
      linkStatus = "incomplete";
      linkLabel = "Vínculo incompleto";
    }

    // === LAYER 2: operação real ===
    const lastInboundAt = lastIn?.timestamp || cfg.last_inbound_at || null;
    const observationUntil = cfg.migration_observation_until ? new Date(cfg.migration_observation_until).getTime() : null;
    const inObservation = observationUntil !== null && observationUntil > Date.now();
    const justSwapped = !!cfg.previous_phone_number_id || !!cfg.previous_waba_id;

    const hoursSinceInbound = lastInboundAt
      ? (Date.now() - new Date(lastInboundAt).getTime()) / 36e5
      : null;

    let operationalStatus: "healthy" | "observation" | "degraded" | "no_delivery" | "unknown" = "unknown";
    let operationalLabel = "Operação ainda não comprovada";

    if (linkStatus === "broken") {
      operationalStatus = "no_delivery";
      operationalLabel = "Recepção comprometida";
    } else if (inObservation && hoursSinceInbound === null) {
      operationalStatus = "observation";
      operationalLabel = justSwapped
        ? "Vínculo trocado, aguardando primeira mensagem"
        : "Aguardando comprovação operacional";
    } else if (hoursSinceInbound !== null && hoursSinceInbound < 12) {
      operationalStatus = "healthy";
      operationalLabel = "Recebendo normalmente";
    } else if (hoursSinceInbound !== null && hoursSinceInbound < 24) {
      operationalStatus = "degraded";
      operationalLabel = "Recepção instável";
    } else if (hoursSinceInbound !== null) {
      operationalStatus = "no_delivery";
      operationalLabel = "Sem mensagens há mais de 24h";
    } else if (!inObservation) {
      // No inbound ever and outside observation window
      operationalStatus = "no_delivery";
      operationalLabel = "Nunca recebeu mensagens";
    }

    // === Status público combinado (semáforo legacy mantido p/ compatibilidade) ===
    let subscriptionStatus: "green" | "yellow" | "red" = "green";
    if (linkStatus === "broken" || operationalStatus === "no_delivery") {
      subscriptionStatus = "red";
    } else if (linkStatus === "incomplete" || operationalStatus === "observation" || operationalStatus === "degraded") {
      subscriptionStatus = "yellow";
    }

    // Alerta de silêncio
    let silenceAlert: "none" | "yellow" | "red" = "none";
    if (hoursSinceInbound !== null) {
      if (hoursSinceInbound > 24) silenceAlert = "red";
      else if (hoursSinceInbound > 12) silenceAlert = "yellow";
    }

    // Contagem de órfãs nas últimas 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: orphanCount } = await supabase
      .from("whatsapp_inbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .gte("timestamp", dayAgo)
      .is("processed_at", null);

    // === FASE 1 v2: 3 SINAIS SEPARADOS + ESTADO OFICIAL ===
    const technicalSignal = !linkBroken;
    const adminAuthorizationSignal = appWebhookMatches && wabaSubscribed && !linkBroken;
    const realReceptionSignal = !!cfg.last_inbound_validated_at;

    // Estado oficial: usa channel_state persistido pelo detector se disponível,
    // senão calcula on-the-fly (mesma lógica refinada).
    let channelState = cfg.channel_state as string | null;
    if (!channelState) {
      if (cfg.connection_status === "disconnected" || cfg.connection_status === "token_invalid") {
        channelState = "disconnected";
      } else if (!realReceptionSignal) {
        channelState = "real_reception_pending";
      } else {
        const hoursSinceValidated = cfg.last_inbound_validated_at
          ? (Date.now() - new Date(cfg.last_inbound_validated_at).getTime()) / 36e5
          : null;
        if (hoursSinceValidated !== null && hoursSinceValidated < 24) channelState = "operational_validated";
        else channelState = "no_recent_evidence";
      }
    }

    const validationWindowOpenUntil = cfg.validation_window_opened_at
      ? new Date(new Date(cfg.validation_window_opened_at).getTime() + 10 * 60 * 1000).toISOString()
      : null;
    const validationWindowActive = !!validationWindowOpenUntil && new Date(validationWindowOpenUntil).getTime() > Date.now();

    const v2VisuallyActive = !!cfg.v2_ui_active_at && new Date(cfg.v2_ui_active_at).getTime() <= Date.now();

    return new Response(JSON.stringify({
      success: true,
      data: {
        configured: true,
        is_enabled: cfg.is_enabled,
        connection_status: cfg.connection_status,
        display_phone_number: cfg.display_phone_number,
        last_error: cfg.last_error,
        webhook_subscribed_at: cfg.webhook_subscribed_at,
        last_diagnosed_at: cfg.last_diagnosed_at,
        diagnosis_status: diagnosisStatus || null,
        last_inbound_at: lastInboundAt,
        last_inbound_validated_at: cfg.last_inbound_validated_at || null,
        last_inbound_processed: lastIn?.processed_at !== null,
        last_ai_reply_at: lastOut?.created_at || null,
        link_status: linkStatus,
        link_label: linkLabel,
        operational_status: operationalStatus,
        operational_label: operationalLabel,
        in_post_migration_observation: inObservation,
        observation_until: cfg.migration_observation_until || null,
        previous_phone_number_id: cfg.previous_phone_number_id || null,
        previous_waba_id: cfg.previous_waba_id || null,
        linked_at: cfg.linked_at || null,
        // === FASE 1 v2 ===
        channel_state: channelState,
        signals: {
          technical: technicalSignal,
          admin_authorization: adminAuthorizationSignal,
          real_reception: realReceptionSignal,
        },
        validation_window: {
          active: validationWindowActive,
          opened_at: cfg.validation_window_opened_at || null,
          expires_at: validationWindowOpenUntil,
          last_attempt_at: cfg.last_validation_attempt_at || null,
        },
        v2_visually_active: v2VisuallyActive,
        v2_ui_active_at: cfg.v2_ui_active_at || null,
        // Legacy
        subscription_status: subscriptionStatus,
        silence_alert: silenceAlert,
        orphan_count_24h: orphanCount || 0,
        open_incidents: incidents || [],
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[wa-health-summary] error", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
