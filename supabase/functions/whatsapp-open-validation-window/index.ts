import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * whatsapp-open-validation-window
 *
 * Abre uma janela de 10 minutos para o tenant comprovar recepção real enviando
 * uma mensagem ao número conectado. Quando o webhook receber POST real dentro
 * dessa janela, promove o canal para "operational_validated".
 *
 * Não promove estado por si só. Apenas marca tentativa e abre janela.
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

    // Tenant access check
    const { data: role } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("tenant_id", tenant_id).maybeSingle();
    if (!role) {
      return new Response(JSON.stringify({ success: false, error: "Sem acesso" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();
    const { data: cfg, error } = await supabase
      .from("whatsapp_configs")
      .update({
        validation_window_opened_at: nowIso,
        last_validation_attempt_at: nowIso,
      })
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .select("display_phone_number, last_inbound_validated_at")
      .maybeSingle();

    if (error || !cfg) {
      return new Response(JSON.stringify({ success: false, error: error?.message || "Canal não encontrado" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return new Response(JSON.stringify({
      success: true,
      data: {
        opened_at: nowIso,
        expires_at: expiresAt,
        window_minutes: 10,
        display_phone_number: cfg.display_phone_number,
        previously_validated: !!cfg.last_inbound_validated_at,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
