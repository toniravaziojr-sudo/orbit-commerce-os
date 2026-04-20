import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * meta-whatsapp-recover
 *
 * Executa ações automáticas de reparo do WhatsApp Meta:
 *  1. subscribe_webhook → POST {WABA_ID}/subscribed_apps
 *  2. register_phone → POST {PHONE_ID}/register (usa register_pin salvo no banco)
 *
 * Não tenta consertar o que depende do usuário (billing, token inválido).
 * Body: { tenant_id, actions?: string[], pin?: string }
 *  - Se actions vazio: roda diagnóstico e executa todas as ações auto detectadas
 *  - Se pin fornecido: salva no register_pin e usa para registrar
 */

interface RecoverRequest {
  tenant_id: string;
  actions?: string[];
  pin?: string;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-recover][${traceId}] Request received`);

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
    const authHeader = req.headers.get("Authorization") || "";
    const isServiceRole = authHeader.includes(supabaseServiceKey);

    const body: RecoverRequest = await req.json();
    const { tenant_id, pin } = body;
    let actions = body.actions;

    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Se PIN foi fornecido e válido, salvar
    if (pin && /^\d{6}$/.test(pin)) {
      await supabase.from("whatsapp_configs").update({ register_pin: pin })
        .eq("tenant_id", tenant_id).eq("provider", "meta");
    }

    // Carregar config
    const { data: config } = await supabase
      .from("whatsapp_configs")
      .select("id, phone_number_id, waba_id, access_token, register_pin")
      .eq("tenant_id", tenant_id).eq("provider", "meta").maybeSingle();

    if (!config?.access_token) {
      return new Response(JSON.stringify({ success: false, error: "Configuração WhatsApp não encontrada ou sem token." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Se actions não veio, descobrir via diagnose
    if (!actions || actions.length === 0) {
      const diagResp = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-diagnose`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ tenant_id }),
      });
      const diag = await diagResp.json();
      actions = diag?.data?.auto_actions || [];
    }

    if (!actions || actions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        data: { executed: [], message: "Nenhuma ação automática necessária ou disponível." },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: ver } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true).maybeSingle();
    const apiVersion = ver?.credential_value || "v21.0";

    const executed: Array<{ action: string; success: boolean; detail?: string }> = [];

    // === Action: subscribe_webhook ===
    // CRÍTICO: precisa enviar subscribed_fields explicitamente, senão o app
    // fica vinculado à WABA mas sem nenhum campo de evento → recebimento quebra silenciosamente.
    if (actions.includes("subscribe_webhook")) {
      try {
        const subResp = await fetch(
          `https://graph.facebook.com/${apiVersion}/${config.waba_id}/subscribed_apps`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${config.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              subscribed_fields: [
                "messages",
                "message_template_status_update",
                "account_update",
                "phone_number_quality_update",
                "phone_number_name_update",
              ],
            }),
          },
        );
        const subData = await subResp.json();
        if (subData?.success === true) {
          await supabase.from("whatsapp_configs").update({
            webhook_subscribed_at: new Date().toISOString(),
          }).eq("id", config.id);
          executed.push({ action: "subscribe_webhook", success: true });
          console.log(`[meta-whatsapp-recover][${traceId}] Webhook subscribed`);
        } else {
          executed.push({
            action: "subscribe_webhook", success: false,
            detail: subData?.error?.message || JSON.stringify(subData),
          });
        }
      } catch (e) {
        executed.push({ action: "subscribe_webhook", success: false, detail: (e as Error).message });
      }
    }

    // === Action: register_phone ===
    if (actions.includes("register_phone")) {
      const usePin = pin || config.register_pin;
      if (!usePin || !/^\d{6}$/.test(usePin)) {
        executed.push({
          action: "register_phone", success: false,
          detail: "PIN não disponível. Forneça um PIN de 6 dígitos para registrar.",
        });
      } else {
        try {
          // Deregister primeiro (limpar estado)
          await fetch(`https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/deregister`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${config.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ messaging_product: "whatsapp" }),
          });

          const regResp = await fetch(
            `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/register`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${config.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ messaging_product: "whatsapp", pin: String(usePin) }),
            },
          );
          const regData = await regResp.json();

          if (regData?.success === true) {
            await supabase.from("whatsapp_configs").update({
              connection_status: "connected",
              last_error: null,
              register_pin: usePin,
            }).eq("id", config.id);
            executed.push({ action: "register_phone", success: true });
            console.log(`[meta-whatsapp-recover][${traceId}] Phone registered`);
          } else {
            executed.push({
              action: "register_phone", success: false,
              detail: regData?.error?.error_user_msg || regData?.error?.message || JSON.stringify(regData),
            });
          }
        } catch (e) {
          executed.push({ action: "register_phone", success: false, detail: (e as Error).message });
        }
      }
    }

    const allOk = executed.every((e) => e.success);
    return new Response(JSON.stringify({
      success: allOk,
      data: { executed, all_succeeded: allOk },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[meta-whatsapp-recover][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: "whatsapp-recover", action: "recover" });
  }
});
