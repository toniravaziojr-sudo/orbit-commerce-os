import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "2.0.0"; // Add cron mode: auto-sync all tenants without auth
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

/**
 * Sync listing statuses from Mercado Livre API.
 * 
 * Two modes:
 * 1. **User mode** (with Authorization header): Syncs listings for a specific tenant
 * 2. **Cron mode** (without auth, body: { cronMode: true }): Syncs ALL tenants with active ML connections
 */
serve(async (req) => {
  console.log(`[meli-sync-listings][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("Authorization");

    // ===== CRON MODE: No auth, process all tenants =====
    if (!authHeader || body.cronMode === true) {
      console.log(`[meli-sync-listings][${VERSION}] CRON mode — syncing all tenants`);
      return await handleCronMode(supabase);
    }

    // ===== USER MODE: Auth required, single tenant =====
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ success: false, error: "Sessão inválida" });
    }

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

    const result = await syncTenantListings(supabase, connection, tenantId, listingIds);
    return jsonResponse(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[meli-sync-listings] Error:`, error);
    return jsonResponse({ success: false, error: errorMessage });
  }
});

// ===== CRON MODE: Process all tenants with active ML connections =====
async function handleCronMode(supabase: any) {
  const { data: connections, error: connError } = await supabase
    .from("marketplace_connections")
    .select("id, tenant_id, access_token, refresh_token, expires_at")
    .eq("marketplace", "mercadolivre")
    .eq("is_active", true);

  if (connError || !connections || connections.length === 0) {
    console.log(`[meli-sync-listings] No active ML connections found`);
    return jsonResponse({ success: true, message: "Nenhuma conexão ativa", tenants: 0 });
  }

  console.log(`[meli-sync-listings] Found ${connections.length} active ML connections`);

  let totalSynced = 0;
  let totalUpdated = 0;
  let tenantsProcessed = 0;
  const tenantErrors: string[] = [];

  for (const connection of connections) {
    try {
      const result = await syncTenantListings(supabase, connection, connection.tenant_id);
      if (result.success) {
        totalSynced += result.synced || 0;
        totalUpdated += result.updated || 0;
        tenantsProcessed++;
      } else {
        tenantErrors.push(`${connection.tenant_id}: ${result.error}`);
      }
    } catch (err) {
      console.error(`[meli-sync-listings] Error syncing tenant ${connection.tenant_id}:`, err);
      tenantErrors.push(`${connection.tenant_id}: ${err instanceof Error ? err.message : "erro"}`);
    }
  }

  console.log(`[meli-sync-listings] CRON done: tenants=${tenantsProcessed}, synced=${totalSynced}, updated=${totalUpdated}, errors=${tenantErrors.length}`);

  return jsonResponse({
    success: true,
    message: `Sincronização automática concluída`,
    tenants: tenantsProcessed,
    synced: totalSynced,
    updated: totalUpdated,
    errors: tenantErrors.length > 0 ? tenantErrors : undefined,
  });
}

// ===== Core sync logic for a single tenant =====
async function syncTenantListings(
  supabase: any,
  connection: any,
  tenantId: string,
  listingIds?: string[]
) {
  let accessToken = connection.access_token;

  // Auto-refresh token if expired
  if (connection.expires_at && new Date(connection.expires_at) < new Date()) {
    console.log(`[meli-sync-listings] Token expired for tenant ${tenantId}, attempting refresh...`);
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
          return { success: false, error: "Token ML expirado", code: "token_expired" };
        }
      } else {
        return { success: false, error: "Token ML expirado", code: "token_expired" };
      }
    } catch (refreshErr) {
      console.error(`[meli-sync-listings] Token refresh failed for tenant ${tenantId}:`, refreshErr);
      return { success: false, error: "Token ML expirado", code: "token_expired" };
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
    console.error(`[meli-sync-listings] Error fetching listings for ${tenantId}:`, listingsError);
    return { success: false, error: "Erro ao buscar anúncios" };
  }

  if (!listings || listings.length === 0) {
    return { success: true, message: "Nenhum anúncio para sincronizar", synced: 0, updated: 0 };
  }

  console.log(`[meli-sync-listings] Tenant ${tenantId}: syncing ${listings.length} listings...`);

  let synced = 0;
  let updated = 0;
  const errors: string[] = [];

  // ML multiget endpoint: GET /items?ids=MLB123,MLB456 (max 20 per request)
  const chunks: typeof listings[] = [];
  for (let i = 0; i < listings.length; i += 20) {
    chunks.push(listings.slice(i, i + 20));
  }

  for (const chunk of chunks) {
    const itemIds = chunk.map((l: any) => l.meli_item_id).join(",");

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
        const listing = chunk.find((l: any) => l.meli_item_id === mlResult.body?.id);
        if (!listing) continue;

        synced++;

        if (mlResult.code !== 200 || !mlResult.body) {
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
        const mlStatus = mlItem.status;
        const mlSubStatus = mlItem.sub_status || [];

        // Map ML status to our internal status
        let newStatus = listing.status;
        let errorMessage: string | null = null;

        if (mlStatus === "closed") {
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

          if (mlItem.price !== undefined) {
            updateData.price = mlItem.price;
          }
          if (mlItem.available_quantity !== undefined) {
            updateData.available_quantity = mlItem.available_quantity;
          }

          if (mlItem.permalink) {
            updateData.meli_response = {
              permalink: mlItem.permalink,
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

  // Update last_sync_at on the connection
  await supabase
    .from("marketplace_connections")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("id", connection.id);

  console.log(`[meli-sync-listings] Tenant ${tenantId}: synced=${synced}, updated=${updated}, errors=${errors.length}`);

  return {
    success: true,
    message: updated > 0
      ? `${updated} anúncio${updated > 1 ? "s" : ""} atualizado${updated > 1 ? "s" : ""}`
      : "Todos os anúncios estão sincronizados",
    synced,
    updated,
    errors: errors.length > 0 ? errors : undefined,
  };
}
