import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * meta-whatsapp-diagnose
 *
 * Diagnóstico completo da integração WhatsApp Meta de um tenant.
 * Verifica os 4 pontos críticos onde o número pode travar em "Pendente":
 *  1. Token Meta válido (/me)
 *  2. Status do número (PENDING vs CONNECTED)
 *  3. Saúde da WABA (health_status — billing, account review)
 *  4. Webhook assinado (subscribed_apps)
 *
 * Retorna um relatório estruturado com:
 *  - issues: lista de problemas encontrados (com causa e ação sugerida)
 *  - auto_repairable: quais ações podem ser executadas automaticamente
 *  - user_action_required: o que depende do usuário (billing, verificação)
 */

interface DiagnoseRequest {
  tenant_id: string;
}

interface Issue {
  code: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  cause: string;
  action_type: "auto" | "user" | "support";
  action_label?: string;
  user_instruction?: string;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-diagnose][${traceId}] Request received`);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // Auth: aceita usuário do tenant OU service_role (cron)
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(supabaseServiceKey);

    const { tenant_id }: DiagnoseRequest = await req.json();
    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validar acesso (a menos que seja service_role)
    if (!isServiceRole) {
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: role } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("tenant_id", tenant_id).maybeSingle();
      if (!role) {
        return new Response(JSON.stringify({ success: false, error: "Sem acesso a este tenant" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Carregar config
    const { data: config } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number_id, waba_id, access_token, token_expires_at, connection_status, register_pin")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .maybeSingle();

    if (!config) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          status: "not_configured",
          issues: [{
            code: "NOT_CONFIGURED",
            severity: "critical",
            title: "WhatsApp não configurado",
            description: "Nenhuma integração WhatsApp Meta foi conectada ainda.",
            cause: "Tenant nunca passou pelo fluxo de conexão.",
            action_type: "user",
            user_instruction: "Vá em Integrações → Meta e conecte sua conta.",
          }],
          auto_repairable: false,
          user_action_required: true,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!config.access_token) {
      return new Response(JSON.stringify({
        success: true,
        data: {
          status: "no_token",
          issues: [{
            code: "NO_TOKEN",
            severity: "critical",
            title: "Token de acesso ausente",
            description: "A conexão existe mas não há token Meta salvo.",
            cause: "Reconexão incompleta ou desconexão prévia.",
            action_type: "user",
            user_instruction: "Vá em Integrações → Meta e clique em Reconectar.",
          }],
          auto_repairable: false,
          user_action_required: true,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Graph API version
    const { data: ver } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true).maybeSingle();
    const apiVersion = ver?.credential_value || "v21.0";

    const issues: Issue[] = [];
    const autoActions: string[] = [];
    const checks: Record<string, unknown> = {};

    // === Check 1: Token válido ===
    const meResp = await fetch(`https://graph.facebook.com/${apiVersion}/me?access_token=${config.access_token}`);
    const meData = await meResp.json();
    checks.token_check = { ok: !meData.error, error: meData.error || null };

    if (meData.error?.code === 190) {
      issues.push({
        code: "TOKEN_INVALID",
        severity: "critical",
        title: "Sessão Meta expirada",
        description: "Seu token Meta foi invalidado (código 190).",
        cause: "Troca de senha, logout ou revogação manual de permissões no Facebook.",
        action_type: "user",
        action_label: "Reconectar Meta",
        user_instruction: "Vá em Integrações → Meta e clique em Reconectar.",
      });

      await supabase.from("whatsapp_configs").update({
        connection_status: "token_invalid",
        last_error: "Sessão Meta expirou. Reconecte a conta.",
        last_diagnosed_at: new Date().toISOString(),
        last_health_payload: { token_check: checks.token_check },
      }).eq("id", config.id);

      return new Response(JSON.stringify({
        success: true,
        data: {
          status: "token_invalid",
          issues, auto_repairable: false, user_action_required: true,
          checks,
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // === Check 2: Status do número ===
    const phoneResp = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,name_status,status,throughput,health_status`,
      { headers: { "Authorization": `Bearer ${config.access_token}` } },
    );
    const phoneData = await phoneResp.json();
    checks.phone = phoneData;

    // === Check 3: Webhook subscription ===
    // IMPORTANTE: existir entry em subscribed_apps NÃO garante que os campos
    // (messages, etc.) estão inscritos. A Graph API v21 não retorna subscribed_fields
    // para apps comuns, então a única forma confiável de garantir entrega é
    // re-postar a inscrição com subscribed_fields explícitos sempre que houver
    // qualquer suspeita (ou periodicamente via monitor).
    const subsResp = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.waba_id}/subscribed_apps`,
      { headers: { "Authorization": `Bearer ${config.access_token}` } },
    );
    const subsData = await subsResp.json();
    const subsList = Array.isArray(subsData?.data) ? subsData.data : [];
    const isSubscribed = subsList.length > 0;
    // Tenta detectar se algum app retornou subscribed_fields (alguns apps com permissão retornam).
    const anyWithFields = subsList.some((a: Record<string, unknown>) => {
      const fields = (a as { subscribed_fields?: unknown[] }).subscribed_fields;
      return Array.isArray(fields) && fields.length > 0;
    });
    checks.webhook = { subscribed: isSubscribed, has_fields: anyWithFields, raw: subsData };

    // Se não está inscrito OU está inscrito sem fields visíveis há mais de 1 hora sem mensagens,
    // forçar re-inscrição com fields explícitos.
    if (!isSubscribed) {
      issues.push({
        code: "WEBHOOK_NOT_SUBSCRIBED",
        severity: "critical",
        title: "Webhook não assinado",
        description: "O sistema não está inscrito para receber mensagens deste número.",
        cause: "A inscrição foi perdida (desconexão, recriação da WABA ou primeira conexão incompleta).",
        action_type: "auto",
        action_label: "Assinar webhook automaticamente",
      });
      autoActions.push("subscribe_webhook");
    } else if (!anyWithFields) {
      // Inscrição existe mas sem campos visíveis — re-postar para garantir messages está ativo.
      // Esse é o cenário "saída funciona / entrada não chega" pós-aprovação.
      issues.push({
        code: "WEBHOOK_FIELDS_MISSING",
        severity: "critical",
        title: "Inscrição de mensagens incompleta",
        description: "O app está vinculado à conta WhatsApp, mas o campo 'messages' pode não estar ativo. Mensagens recebidas não chegam ao atendimento.",
        cause: "Pós-migração teste→produção ou troca de App, a inscrição precisa ser re-postada com os campos explícitos.",
        action_type: "auto",
        action_label: "Re-inscrever campos automaticamente",
      });
      autoActions.push("subscribe_webhook");
    }

    // === Analisar health_status do número ===
    if (phoneData?.health_status?.entities) {
      const entities = phoneData.health_status.entities as Array<Record<string, unknown>>;

      // WABA health (billing, account_review)
      const wabaEntity = entities.find((e) => e.entity_type === "WABA");
      if (wabaEntity?.can_send_message === "BLOCKED") {
        const errs = (wabaEntity.errors as Array<Record<string, unknown>>) || [];
        const billingErr = errs.find((e) => e.error_code === 141006);
        if (billingErr) {
          issues.push({
            code: "BILLING_MISSING",
            severity: "critical",
            title: "Forma de pagamento ausente",
            description: "A Meta exige um método de pagamento ativo no portfólio para liberar a API do WhatsApp.",
            cause: "Cartão removido, recusado ou nunca cadastrado no Business Manager.",
            action_type: "user",
            action_label: "Adicionar cartão na Meta",
            user_instruction: "Acesse business.facebook.com → Cobrança e Pagamentos → adicione um cartão e vincule à conta do WhatsApp.",
          });
        } else {
          issues.push({
            code: "WABA_BLOCKED",
            severity: "critical",
            title: "Conta WhatsApp bloqueada",
            description: `A WABA está com restrição: ${errs.map((e) => e.error_description).join("; ")}`,
            cause: "Restrição imposta pela Meta (revisão de conta, política, etc.).",
            action_type: "support",
            user_instruction: "Entre em contato com o suporte da Meta.",
          });
        }
      }

      // Phone number health
      const phoneEntity = entities.find((e) => e.entity_type === "PHONE_NUMBER");
      if (phoneEntity?.can_send_message === "BLOCKED") {
        const errs = (phoneEntity.errors as Array<Record<string, unknown>>) || [];
        const notRegistered = errs.find((e) => e.error_code === 141000);
        if (notRegistered) {
          if (config.register_pin) {
            issues.push({
              code: "NUMBER_NOT_REGISTERED",
              severity: "critical",
              title: "Número não está registrado na Cloud API",
              description: "O número precisa ser re-registrado na infraestrutura Cloud da Meta.",
              cause: "Desativação automática pela Meta (geralmente após problema de billing já resolvido).",
              action_type: "auto",
              action_label: "Re-registrar automaticamente",
            });
            autoActions.push("register_phone");
          } else {
            issues.push({
              code: "NUMBER_NEEDS_PIN",
              severity: "critical",
              title: "Número precisa de PIN para registrar",
              description: "Para reativar o número, é necessário definir um PIN de 6 dígitos.",
              cause: "Primeiro registro ou PIN não foi salvo previamente.",
              action_type: "user",
              action_label: "Definir PIN",
              user_instruction: "Use o fluxo de registro abaixo para inserir um PIN de 6 dígitos.",
            });
          }
        }
      }
    }

    // === Status do número (PENDING) ===
    if (phoneData?.status === "PENDING" && issues.length === 0) {
      issues.push({
        code: "PENDING_NORMAL",
        severity: "info",
        title: "Provisionamento em andamento",
        description: "A Meta está finalizando o registro do número. Pode levar até 24h.",
        cause: "Fila interna da Meta após verificação concluída.",
        action_type: "user",
        user_instruction: "Aguarde algumas horas e verifique novamente.",
      });
    }

    const overallStatus = issues.some((i) => i.severity === "critical")
      ? "needs_attention"
      : issues.length > 0 ? "warning" : "healthy";

    // Persistir snapshot
    await supabase.from("whatsapp_configs").update({
      last_diagnosed_at: new Date().toISOString(),
      last_health_payload: { phone: phoneData?.health_status, webhook: checks.webhook, issues },
      webhook_subscribed_at: isSubscribed ? new Date().toISOString() : null,
    }).eq("id", config.id);

    console.log(`[meta-whatsapp-diagnose][${traceId}] Status: ${overallStatus}, issues: ${issues.length}, auto: ${autoActions.length}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        status: overallStatus,
        issues,
        auto_repairable: autoActions.length > 0,
        auto_actions: autoActions,
        user_action_required: issues.some((i) => i.action_type === "user"),
        checks,
        phone_status: phoneData?.status,
        verified_name: phoneData?.verified_name,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[meta-whatsapp-diagnose][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: "whatsapp-diagnose", action: "diagnose" });
  }
});
