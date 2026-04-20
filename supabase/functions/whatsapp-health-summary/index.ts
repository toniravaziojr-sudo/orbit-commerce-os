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

    // Config do WhatsApp
    const { data: cfg } = await supabase
      .from("whatsapp_configs")
      .select("provider, is_enabled, connection_status, webhook_subscribed_at, last_diagnosed_at, last_error, display_phone_number, last_health_payload")
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

    // Status da assinatura
    const healthPayload = (cfg.last_health_payload || {}) as Record<string, any>;
    const diagnosisStatus = healthPayload?.diagnosis_status as string | undefined;
    const hasCriticalIssues = Array.isArray(healthPayload?.issues)
      ? healthPayload.issues.some((issue: Record<string, unknown>) => issue?.severity === "critical")
      : false;
    const appWebhookMatches = healthPayload?.app_webhook?.callback_matches === true;
    const appWebhookMessages = healthPayload?.app_webhook?.has_messages_field === true;
    const wabaSubscribed = healthPayload?.webhook?.subscribed === true;

    let subscriptionStatus: "green" | "yellow" | "red" = "green";
    if (
      cfg.connection_status === "token_invalid" ||
      cfg.connection_status === "disconnected" ||
      diagnosisStatus === "needs_attention" ||
      hasCriticalIssues ||
      !appWebhookMatches ||
      !appWebhookMessages ||
      !wabaSubscribed
    ) {
      subscriptionStatus = "red";
    } else if (!cfg.webhook_subscribed_at) {
      subscriptionStatus = "yellow";
    } else {
      const ageHours = (Date.now() - new Date(cfg.webhook_subscribed_at).getTime()) / 36e5;
      if (ageHours > 48) subscriptionStatus = "yellow"; // monitor diário deveria refrescar
    }

    // Alerta de silêncio (sem mensagem nas últimas N horas)
    let silenceAlert: "none" | "yellow" | "red" = "none";
    if (lastIn?.timestamp) {
      const hoursSilent = (Date.now() - new Date(lastIn.timestamp).getTime()) / 36e5;
      if (hoursSilent > 24) silenceAlert = "red";
      else if (hoursSilent > 12) silenceAlert = "yellow";
    }

    // Contagem de órfãs nas últimas 24h
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: orphanCount } = await supabase
      .from("whatsapp_inbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .gte("timestamp", dayAgo)
      .is("processed_at", null);

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
        last_inbound_at: lastIn?.timestamp || null,
        last_inbound_processed: lastIn?.processed_at !== null,
        last_ai_reply_at: lastOut?.created_at || null,
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
