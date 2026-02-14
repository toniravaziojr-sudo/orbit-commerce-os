import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Google Merchant Center status check
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MERCHANT_API_BASE = "https://shoppingcontent.googleapis.com/content/v2.1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[google-merchant-status][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tenantId, merchantAccountId, action = "summary" } = body;

    if (!tenantId) {
      return jsonResponse({ success: false, error: "tenantId obrigatório" });
    }

    if (action === "summary") {
      return await getSummary(supabase, tenantId, merchantAccountId);
    } else if (action === "check_statuses" && merchantAccountId) {
      return await checkProductStatuses(supabase, tenantId, merchantAccountId, supabaseUrl, supabaseServiceKey);
    } else {
      return jsonResponse({ success: false, error: "action inválida" });
    }
  } catch (error) {
    console.error(`[google-merchant-status][${VERSION}] Error:`, error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : "Erro interno" });
  }
});

async function getSummary(supabase: any, tenantId: string, merchantAccountId?: string) {
  let query = supabase
    .from("google_merchant_products")
    .select("sync_status, merchant_account_id")
    .eq("tenant_id", tenantId);

  if (merchantAccountId) {
    query = query.eq("merchant_account_id", merchantAccountId);
  }

  const { data, error } = await query;
  if (error) {
    return jsonResponse({ success: false, error: error.message });
  }

  const summary = {
    total: data?.length || 0,
    synced: 0,
    pending: 0,
    error: 0,
    disapproved: 0,
    pending_review: 0,
    accounts: new Set<string>(),
  };

  for (const item of (data || [])) {
    summary.accounts.add(item.merchant_account_id);
    switch (item.sync_status) {
      case "synced": summary.synced++; break;
      case "pending": summary.pending++; break;
      case "error": summary.error++; break;
      case "disapproved": summary.disapproved++; break;
      case "pending_review": summary.pending_review++; break;
    }
  }

  return jsonResponse({
    success: true,
    summary: {
      ...summary,
      accounts: Array.from(summary.accounts),
    },
  });
}

async function checkProductStatuses(
  supabase: any,
  tenantId: string,
  merchantAccountId: string,
  supabaseUrl: string,
  supabaseServiceKey: string,
) {
  // Get valid token
  const { data: conn } = await supabase
    .from("google_connections")
    .select("access_token, token_expires_at, refresh_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single();

  if (!conn) {
    return jsonResponse({ success: false, error: "Conexão Google não encontrada" });
  }

  let accessToken = conn.access_token;

  // Refresh if needed
  if (conn.token_expires_at && new Date(conn.token_expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    if (!conn.refresh_token) {
      return jsonResponse({ success: false, error: "Token expirado e sem refresh_token" });
    }

    const [clientId, clientSecret] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_CLIENT_SECRET"),
    ]);

    if (!clientId || !clientSecret) {
      return jsonResponse({ success: false, error: "Credenciais Google não configuradas" });
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: conn.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenData: any;
    try { tokenData = JSON.parse(tokenText); } catch {
      return jsonResponse({ success: false, error: "Erro ao renovar token" });
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      return jsonResponse({ success: false, error: "Falha ao renovar token" });
    }

    accessToken = tokenData.access_token;

    await supabase
      .from("google_connections")
      .update({
        access_token: accessToken,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
      })
      .eq("tenant_id", tenantId);
  }

  // Fetch product statuses from Merchant Center
  try {
    const res = await fetch(
      `${MERCHANT_API_BASE}/${merchantAccountId}/productstatuses?maxResults=250`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const resText = await res.text();
    let resData: any;
    try { resData = JSON.parse(resText); } catch {
      return jsonResponse({ success: false, error: "Erro ao ler resposta do Merchant Center" });
    }

    if (!res.ok) {
      return jsonResponse({ success: false, error: resData?.error?.message || "Erro ao consultar status" });
    }

    const statuses = resData.resources || [];
    let updated = 0;

    for (const status of statuses) {
      const offerId = status.productId;
      if (!offerId) continue;

      // Extract product ID from offerId (format: online:pt:BR:cc_UUID)
      const parts = offerId.split(":");
      const rawId = parts[parts.length - 1];
      const productId = rawId.startsWith("cc_") ? rawId.slice(3) : rawId;

      const hasIssues = status.itemLevelIssues?.length > 0;
      const disapprovedDestinations = (status.destinationStatuses || [])
        .filter((d: any) => d.status === "disapproved");

      let syncStatus = "synced";
      if (disapprovedDestinations.length > 0) syncStatus = "disapproved";
      else if (hasIssues) syncStatus = "pending_review";

      const { error: updateError } = await supabase
        .from("google_merchant_products")
        .update({
          sync_status: syncStatus,
          disapproval_reasons: hasIssues ? status.itemLevelIssues : null,
          last_sync_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .eq("merchant_account_id", merchantAccountId);

      if (!updateError) updated++;
    }

    console.log(`[google-merchant-status][${VERSION}] Updated ${updated} statuses for tenant ${tenantId}`);
    return jsonResponse({ success: true, updated, total_from_google: statuses.length });
  } catch (e) {
    return jsonResponse({ success: false, error: e instanceof Error ? e.message : "Erro" });
  }
}

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
