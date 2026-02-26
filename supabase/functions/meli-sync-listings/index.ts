import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "1.0.0"; // Initial: sync listing statuses from ML API
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  console.log(`[meli-sync-listings][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, error: "Não autorizado" });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "Sessão inválida" });
    }

    const body = await req.json();
    const { tenantId, listingIds } = body;

    if (!tenantId) {
      return jsonResponse({ success: false, error: "tenantId é obrigatório" });
    }

    // Verify user access
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!userRole) {
      return jsonResponse({ success: false, error: "Sem acesso ao tenant" });
    }

    // Get ML connection
    const { data: connection } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("marketplace", "mercadolivre")
      .eq("is_active", true)
      .maybeSingle();

    if (!connection?.access_token) {
      return jsonResponse({ success: false, error: "Mercado Livre não conectado" });
    }

    let accessToken = connection.access_token;

    // Auto-refresh token if expired
    if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
      console.log(`[meli-sync-listings] Token expired, attempting auto-refresh...`);
      try {
        const refreshRes = await supabase.functions.invoke("meli-token-refresh", {
          body: { connectionId: connection.id },
        });
        if (refreshRes.data?.success && refreshRes.data?.refreshed > 0) {
          const { data: refreshedConn } = await supabase
            .from("marketplace_connections")
            .select("access_token")
            .eq("id", connection.id)
            .maybeSingle();
          if (refreshedConn?.access_token) {
            accessToken = refreshedConn.access_token;
          } else {
            return jsonResponse({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" });
          }
        } else {
          return jsonResponse({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" });
        }
      } catch (refreshErr) {
        console.error(`[meli-sync-listings] Token refresh failed:`, refreshErr);
        return jsonResponse({ success: false, error: "Token ML expirado. Reconecte sua conta.", code: "token_expired" });
      }
    }

    // Get published/paused listings to sync
    let query = supabase
      .from("meli_listings")
      .select("id, meli_item_id, status, title")
      .eq("tenant_id", tenantId)
      .not("meli_item_id", "is", null)
      .in("status", ["published", "paused", "publishing"]);

    if (listingIds && listingIds.length > 0) {
      query = query.in("id", listingIds);
    }

    const { data: listings, error: listingsError } = await query;

    if (listingsError) {
      console.error(`[meli-sync-listings] Error fetching listings:`, listingsError);
      return jsonResponse({ success: false, error: "Erro ao buscar anúncios" });
    }

    if (!listings || listings.length === 0) {
      return jsonResponse({ success: true, message: "Nenhum anúncio para sincronizar", synced: 0, updated: 0 });
    }

    console.log(`[meli-sync-listings] Syncing ${listings.length} listings...`);

    let synced = 0;
    let updated = 0;
    const errors: string[] = [];

    // ML multiget endpoint: GET /items?ids=MLB123,MLB456 (max 20 per request)
    const chunks: typeof listings[] = [];
    for (let i = 0; i < listings.length; i += 20) {
      chunks.push(listings.slice(i, i + 20));
    }

    for (const chunk of chunks) {
      const itemIds = chunk.map(l => l.meli_item_id).join(",");
      
      try {
        const mlRes = await fetch(
          `https://api.mercadolibre.com/items?ids=${itemIds}&attributes=id,status,sub_status,price,available_quantity,permalink`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!mlRes.ok) {
          console.error(`[meli-sync-listings] ML API error: ${mlRes.status}`);
          errors.push(`ML API retornou ${mlRes.status}`);
          continue;
        }

        const mlItems = await mlRes.json();

        for (const mlResult of mlItems) {
          const listing = chunk.find(l => l.meli_item_id === mlResult.body?.id);
          if (!listing) continue;

          synced++;

          if (mlResult.code !== 200 || !mlResult.body) {
            // Item not found or error — likely deleted on ML
            console.log(`[meli-sync-listings] Item ${listing.meli_item_id} not found on ML (code: ${mlResult.code})`);
            await supabase
              .from("meli_listings")
              .update({
                status: "error",
                error_message: `Anúncio não encontrado no Mercado Livre (excluído ou encerrado)`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", listing.id);
            updated++;
            continue;
          }

          const mlItem = mlResult.body;
          const mlStatus = mlItem.status; // active, paused, closed, under_review, inactive
          const mlSubStatus = mlItem.sub_status || [];

          // Map ML status to our internal status
          let newStatus = listing.status;
          let errorMessage: string | null = null;

          if (mlStatus === "closed") {
            // Closed on ML — mark as error with descriptive message
            const reason = mlSubStatus.includes("deleted") 
              ? "Excluído no Mercado Livre" 
              : mlSubStatus.includes("expired")
              ? "Expirado no Mercado Livre"
              : "Encerrado no Mercado Livre";
            newStatus = "error";
            errorMessage = reason;
          } else if (mlStatus === "paused") {
            newStatus = "paused";
          } else if (mlStatus === "active") {
            newStatus = "published";
          } else if (mlStatus === "under_review") {
            newStatus = "publishing";
            errorMessage = "Em revisão pelo Mercado Livre";
          } else if (mlStatus === "inactive") {
            newStatus = "paused";
            errorMessage = `Inativo: ${mlSubStatus.join(", ") || "sem detalhes"}`;
          }

          // Only update if status changed
          if (newStatus !== listing.status || errorMessage) {
            console.log(`[meli-sync-listings] ${listing.meli_item_id}: ${listing.status} → ${newStatus} (ML: ${mlStatus})`);
            
            const updateData: Record<string, any> = {
              status: newStatus,
              updated_at: new Date().toISOString(),
            };

            if (errorMessage) {
              updateData.error_message = errorMessage;
            } else {
              updateData.error_message = null;
            }

            // Also sync price and quantity from ML
            if (mlItem.price !== undefined) {
              updateData.price = mlItem.price;
            }
            if (mlItem.available_quantity !== undefined) {
              updateData.available_quantity = mlItem.available_quantity;
            }

            // Update permalink if available
            if (mlItem.permalink) {
              updateData.meli_response = { 
                ...(typeof listing === 'object' ? {} : {}),
                permalink: mlItem.permalink 
              };
            }

            await supabase
              .from("meli_listings")
              .update(updateData)
              .eq("id", listing.id);
            
            updated++;
          }
        }
      } catch (err) {
        console.error(`[meli-sync-listings] Error processing chunk:`, err);
        errors.push(err instanceof Error ? err.message : "Erro desconhecido");
      }
    }

    console.log(`[meli-sync-listings] Done: synced=${synced}, updated=${updated}, errors=${errors.length}`);

    return jsonResponse({
      success: true,
      message: updated > 0 
        ? `${updated} anúncio${updated > 1 ? "s" : ""} atualizado${updated > 1 ? "s" : ""}`
        : "Todos os anúncios estão sincronizados",
      synced,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[meli-sync-listings] Error:`, error);
    return jsonResponse({ success: false, error: errorMessage });
  }
});
