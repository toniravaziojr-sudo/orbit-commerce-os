import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * WhatsApp Token Health-Check
 * Roda diariamente via cron. Para cada whatsapp_configs ativo:
 *  - chama GET /me com o access_token
 *  - se Meta responder erro 190 (token invalidado), marca connection_status='token_invalid'
 *    e grava last_error explicando que precisa reconectar.
 *  - se OK, garante last_error=null para limpar mensagens antigas.
 *
 * Anti-regressão: evita o cenário em que a sessão Meta foi invalidada (troca de senha,
 * revogação) e o sistema continua mostrando "connected" enquanto o número fica preso
 * em "Pendente" do lado da Meta porque a chamada /register falha silenciosamente.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[wa-token-healthcheck][${traceId}] start`);

  try {
    const { data: graphVersion } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .maybeSingle();
    const apiVersion = graphVersion?.credential_value || "v21.0";

    // Buscar todas as configs ativas que não estão claramente desconectadas
    const { data: configs, error } = await supabase
      .from("whatsapp_configs")
      .select("id, tenant_id, access_token, connection_status, phone_number_id")
      .eq("provider", "meta")
      .in("connection_status", ["connected", "pending_registration", "awaiting_verification"])
      .not("access_token", "is", null);

    if (error) throw error;

    const results = {
      checked: 0,
      ok: 0,
      invalidated: 0,
      errors: 0,
      details: [] as Array<Record<string, unknown>>,
    };

    for (const cfg of configs || []) {
      results.checked++;
      try {
        const meResp = await fetch(
          `https://graph.facebook.com/${apiVersion}/me?access_token=${cfg.access_token}`
        );
        const meData = await meResp.json();

        if (meData.error) {
          const code = meData.error.code;
          const isInvalid = code === 190;
          if (isInvalid) {
            await supabase
              .from("whatsapp_configs")
              .update({
                connection_status: "token_invalid",
                last_error:
                  "Sua sessão Meta expirou ou foi invalidada. Reconecte sua conta Meta para reativar o WhatsApp.",
                updated_at: new Date().toISOString(),
              })
              .eq("id", cfg.id);
            results.invalidated++;
            results.details.push({ tenant_id: cfg.tenant_id, status: "token_invalid", code });
          } else {
            results.errors++;
            results.details.push({
              tenant_id: cfg.tenant_id,
              status: "meta_error",
              code,
              message: meData.error.message,
            });
          }
        } else {
          // Token OK — limpar last_error antigo se ainda existir
          await supabase
            .from("whatsapp_configs")
            .update({ last_error: null, updated_at: new Date().toISOString() })
            .eq("id", cfg.id)
            .not("last_error", "is", null);
          results.ok++;
        }
      } catch (err) {
        results.errors++;
        results.details.push({
          tenant_id: cfg.tenant_id,
          status: "fetch_error",
          message: (err as Error).message,
        });
      }
    }

    console.log(`[wa-token-healthcheck][${traceId}] done`, JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[wa-token-healthcheck][${traceId}] fatal`, error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
