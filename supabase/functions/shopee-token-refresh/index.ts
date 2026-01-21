import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Shopee Token Refresh
 * 
 * Renova tokens que estão próximos de expirar.
 * Pode ser chamado manualmente ou via scheduler.
 * 
 * Docs: https://open.shopee.com/documents/v2/v2.auth.access_token.get
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
    const partnerId = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_ID");
    const partnerKey = await getCredential(supabaseUrl, supabaseServiceKey, "SHOPEE_PARTNER_KEY");

    if (!partnerId || !partnerKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Shopee não configuradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexões para renovar
    let query = supabase
      .from("marketplace_connections")
      .select("*")
      .eq("marketplace", "shopee")
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

    console.log(`[shopee-token-refresh] Renovando ${connections.length} conexões`);

    const results = {
      refreshed: 0,
      failed: 0,
      errors: [] as string[],
    };

    const shopeeHost = "https://partner.shopeemobile.com";

    for (const connection of connections) {
      try {
        const metadata = connection.metadata as Record<string, any> || {};
        const shopId = metadata.shop_id || parseInt(connection.external_user_id);

        // Gerar timestamp e assinatura
        const timestamp = Math.floor(Date.now() / 1000);
        const path = "/api/v2/auth/access_token/get";
        
        const baseString = `${partnerId}${path}${timestamp}`;
        const hmac = createHmac("sha256", partnerKey);
        hmac.update(baseString);
        const sign = hmac.digest("hex");

        const tokenUrl = `${shopeeHost}${path}?partner_id=${partnerId}&timestamp=${timestamp}&sign=${sign}`;
        
        const tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            refresh_token: connection.refresh_token,
            shop_id: shopId,
            partner_id: parseInt(partnerId),
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error(`[shopee-token-refresh] Erro para ${connection.id}:`, errorData);
          
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
        
        if (tokenData.error) {
          console.error(`[shopee-token-refresh] API error for ${connection.id}:`, tokenData.error);
          
          await supabase
            .from("marketplace_connections")
            .update({ 
              is_active: false,
              last_error: `API error: ${tokenData.error} - ${tokenData.message}`,
            })
            .eq("id", connection.id);

          results.failed++;
          results.errors.push(`${connection.id}: ${tokenData.error}`);
          continue;
        }

        const expiresAt = new Date(Date.now() + (tokenData.expire_in * 1000)).toISOString();
        const refreshExpiresAt = new Date(Date.now() + (tokenData.refresh_expire_in || 30 * 24 * 60 * 60) * 1000).toISOString();

        // Atualizar tokens no banco
        const { error: updateError } = await supabase
          .from("marketplace_connections")
          .update({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: expiresAt,
            last_error: null,
            metadata: {
              ...metadata,
              refresh_expires_at: refreshExpiresAt,
            },
          })
          .eq("id", connection.id);

        if (updateError) {
          throw updateError;
        }

        results.refreshed++;
        console.log(`[shopee-token-refresh] Token renovado para ${connection.external_username || connection.id}`);

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
    console.error("[shopee-token-refresh] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Erro interno" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
