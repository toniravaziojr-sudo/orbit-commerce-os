import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Mercado Livre Token Refresh
 * 
 * Renova tokens que estão próximos de expirar.
 * Pode ser chamado manualmente ou via scheduler.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { connectionId, refreshAll } = body;

    // Buscar credenciais do app
    const clientId = await getCredential(supabaseUrl, supabaseServiceKey, "MELI_APP_ID");
    const clientSecret = await getCredential(supabaseUrl, supabaseServiceKey, "MELI_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais ML não configuradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexões para renovar
    let query = supabase
      .from("marketplace_connections")
      .select("*")
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .not("refresh_token", "is", null);

    if (connectionId) {
      query = query.eq("id", connectionId);
    } else if (refreshAll) {
      // Renovar todas que expiram nas próximas 2 horas
      const threshold = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      query = query.lt("expires_at", threshold);
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "connectionId ou refreshAll é obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: connections, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma conexão para renovar", refreshed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meli-token-refresh] Renovando ${connections.length} conexões`);

    const results = {
      refreshed: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const connection of connections) {
      try {
        // Chamar API de refresh do ML
        const tokenResponse = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: connection.refresh_token,
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error(`[meli-token-refresh] Erro para ${connection.id}:`, errorData);
          
          // Marcar conexão como inativa se refresh falhou
          await supabase
            .from("marketplace_connections")
            .update({ 
              is_active: false,
              last_error: `Refresh failed: ${errorData}`,
            })
            .eq("id", connection.id);

          results.failed++;
          results.errors.push(`${connection.external_username || connection.id}: ${errorData}`);
          continue;
        }

        const tokenData = await tokenResponse.json();
        const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

        // Atualizar tokens no banco
        const { error: updateError } = await supabase
          .from("marketplace_connections")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            last_error: null,
          })
          .eq("id", connection.id);

        if (updateError) {
          throw updateError;
        }

        results.refreshed++;
        console.log(`[meli-token-refresh] Token renovado para ${connection.external_username || connection.id}`);

      } catch (err) {
        results.failed++;
        results.errors.push(`${connection.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, ...results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[meli-token-refresh] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
