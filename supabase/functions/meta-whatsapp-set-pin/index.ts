import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * meta-whatsapp-set-pin
 *
 * Salva (ou redefine) o PIN de 6 dígitos do número WhatsApp Cloud API.
 * Usado em 3 momentos do ciclo de vida:
 *  1. Onboarding (logo após Embedded Signup) — define o PIN inicial.
 *  2. Tela "Gerenciar PIN" — usuário troca o PIN preventivamente.
 *  3. Reset — quando usuário esqueceu o PIN antigo (a Meta exige fluxo na própria tela
 *     do Gerenciador para resetar PIN sem perder o número, mas conseguimos sobrescrever
 *     o que está salvo localmente para próximos registros).
 *
 * Body: { tenant_id: string, pin: string, register_now?: boolean }
 *  - register_now=true → após salvar, tenta re-registrar o número usando esse PIN.
 *
 * Auditoria: registra em conversation_events (system) o evento set_register_pin.
 */

interface SetPinRequest {
  tenant_id: string;
  pin: string;
  register_now?: boolean;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-set-pin][${traceId}] Request received`);

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

    const body: SetPinRequest = await req.json();
    const { tenant_id, pin, register_now } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!pin || !/^\d{6}$/.test(pin)) {
      return new Response(JSON.stringify({ success: false, error: "PIN deve conter exatamente 6 dígitos." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    let actorUserId: string | null = null;

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
      actorUserId = user.id;
    }

    const { data: config } = await supabase
      .from("whatsapp_configs")
      .select("id, register_pin")
      .eq("tenant_id", tenant_id).eq("provider", "meta").maybeSingle();

    if (!config?.id) {
      return new Response(JSON.stringify({ success: false, error: "Configuração WhatsApp não encontrada." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wasFirstTime = !config.register_pin;

    const { error: updateError } = await supabase
      .from("whatsapp_configs")
      .update({ register_pin: pin })
      .eq("id", config.id);

    if (updateError) throw updateError;

    console.log(`[meta-whatsapp-set-pin][${traceId}] PIN ${wasFirstTime ? "defined" : "updated"} for tenant ${tenant_id}`);

    // Auditoria mínima
    try {
      await supabase.from("audit_log").insert({
        tenant_id,
        actor_user_id: actorUserId,
        action: wasFirstTime ? "whatsapp_pin_defined" : "whatsapp_pin_updated",
        entity_type: "whatsapp_config",
        entity_id: config.id,
        metadata: { register_now: !!register_now },
      });
    } catch (e) {
      // audit_log pode não existir em algum tenant; ignorar
      console.log(`[meta-whatsapp-set-pin][${traceId}] audit log skipped:`, (e as Error).message);
    }

    let recoverResult: unknown = null;
    if (register_now) {
      try {
        const recResp = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-recover`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            tenant_id,
            actions: ["subscribe_webhook", "register_phone"],
            pin,
          }),
        });
        recoverResult = await recResp.json();
      } catch (e) {
        console.error(`[meta-whatsapp-set-pin][${traceId}] recover error:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        was_first_time: wasFirstTime,
        registered: register_now ? recoverResult : null,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[meta-whatsapp-set-pin][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: "whatsapp-set-pin", action: "set-pin" });
  }
});
