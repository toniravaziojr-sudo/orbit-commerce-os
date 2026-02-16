import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Meta token refresh - renova long-lived tokens antes de expirar
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Meta Token Refresh
 * 
 * Renova tokens long-lived da Meta antes da expiração (~60 dias).
 * A Meta não usa refresh_token. Em vez disso, troca-se o token atual 
 * (ainda válido) por um novo long-lived token via fb_exchange_token.
 * 
 * Modos de operação:
 * 1. POST { tenantId } → Renova token de um tenant específico
 * 2. POST { refreshAll: true } → Renova TODOS os tokens que expiram em <7 dias (para cron)
 * 
 * Contrato:
 * - Erro = HTTP 200 + { success: false, error }
 * - Sucesso = HTTP 200 + { success: true, ... }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[meta-token-refresh][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { tenantId, refreshAll } = body;

    // Buscar credenciais Meta
    const [appId, appSecret, graphVersion] = await Promise.all([
      getCredential(supabaseUrl, supabaseServiceKey, "META_APP_ID"),
      getCredential(supabaseUrl, supabaseServiceKey, "META_APP_SECRET"),
      getCredential(supabaseUrl, supabaseServiceKey, "META_GRAPH_API_VERSION"),
    ]);

    if (!appId || !appSecret) {
      console.error(`[meta-token-refresh][${VERSION}] Credenciais Meta não configuradas`);
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Meta não configuradas" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiVersion = graphVersion || "v21.0";

    if (refreshAll) {
      // Modo batch: renovar todos os tokens que expiram em <7 dias
      return await refreshAllExpiring(supabase, supabaseUrl, appId, appSecret, apiVersion);
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId ou refreshAll obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Modo single tenant
    const result = await refreshTenantToken(supabase, supabaseUrl, tenantId, appId, appSecret, apiVersion);
    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[meta-token-refresh][${VERSION}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function refreshTenantToken(
  supabase: any,
  supabaseUrl: string,
  tenantId: string,
  appId: string,
  appSecret: string,
  apiVersion: string
): Promise<{ success: boolean; error?: string; access_token?: string; expires_at?: string; already_valid?: boolean }> {
  // Buscar conexão Meta do tenant
  const { data: conn, error: connError } = await supabase
    .from("marketplace_connections")
    .select("id, access_token, expires_at, is_active, metadata, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .single();

  if (connError || !conn) {
    return { success: false, error: "Conexão Meta não encontrada" };
  }

  if (!conn.access_token) {
    return { success: false, error: "Sem access token. Reconecte a conta Meta." };
  }

  // Verificar se token ainda é válido (buffer de 7 dias)
  if (conn.expires_at) {
    const expiresAt = new Date(conn.expires_at);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (expiresAt.getTime() - Date.now() > sevenDaysMs) {
      console.log(`[meta-token-refresh][${VERSION}] Token still valid for tenant ${tenantId}, expires ${conn.expires_at}`);
      return { success: true, access_token: conn.access_token, already_valid: true };
    }
  }

  // Trocar token atual por novo long-lived token
  const exchangeUrl = new URL(`https://graph.facebook.com/${apiVersion}/oauth/access_token`);
  exchangeUrl.searchParams.set("grant_type", "fb_exchange_token");
  exchangeUrl.searchParams.set("client_id", appId);
  exchangeUrl.searchParams.set("client_secret", appSecret);
  exchangeUrl.searchParams.set("fb_exchange_token", conn.access_token);

  const tokenRes = await fetch(exchangeUrl.toString());
  const tokenText = await tokenRes.text();
  let tokenData: any;

  try {
    tokenData = JSON.parse(tokenText);
  } catch {
    console.error(`[meta-token-refresh][${VERSION}] Parse error for tenant ${tenantId}:`, tokenText);
    return { success: false, error: "Erro ao processar resposta da Meta" };
  }

  if (!tokenRes.ok || tokenData.error) {
    const errorMsg = tokenData.error?.message || tokenData.error_description || tokenData.error || "Falha ao renovar token";
    console.error(`[meta-token-refresh][${VERSION}] Refresh failed for tenant ${tenantId}:`, tokenData);

    // Se o token expirou ou foi revogado, marcar conexão como erro
    const isExpiredOrRevoked = tokenData.error?.code === 190 || 
      errorMsg.includes("expired") || 
      errorMsg.includes("revoked") ||
      errorMsg.includes("invalid");

    if (isExpiredOrRevoked) {
      await supabase
        .from("marketplace_connections")
        .update({
          is_active: false,
          last_error: `Token expirado/revogado: ${errorMsg}`,
        })
        .eq("id", conn.id);
    }

    return { success: false, error: errorMsg };
  }

  const newAccessToken = tokenData.access_token;
  const newExpiresIn = tokenData.expires_in || 5184000; // ~60 dias
  const newExpiresAt = new Date(Date.now() + newExpiresIn * 1000).toISOString();

  // Atualizar conexão com novo token
  const updatedMetadata = {
    ...(conn.metadata || {}),
    last_token_refresh: new Date().toISOString(),
    token_refresh_count: ((conn.metadata as any)?.token_refresh_count || 0) + 1,
  };

  await supabase
    .from("marketplace_connections")
    .update({
      access_token: newAccessToken,
      expires_at: newExpiresAt,
      last_error: null,
      metadata: updatedMetadata,
    })
    .eq("id", conn.id);

  // Sincronizar novo token com marketing_integrations (CAPI)
  const metadata = conn.metadata as any;
  const pixelId = metadata?.assets?.pixels?.[0]?.id;
  if (pixelId) {
    await supabase
      .from("marketing_integrations")
      .update({
        meta_access_token: newAccessToken,
      })
      .eq("tenant_id", tenantId);
    
    console.log(`[meta-token-refresh][${VERSION}] CAPI token also synced for tenant ${tenantId}`);
  }

  console.log(`[meta-token-refresh][${VERSION}] Token refreshed for tenant ${tenantId}, new expiry: ${newExpiresAt}`);

  return { success: true, access_token: newAccessToken, expires_at: newExpiresAt };
}

async function refreshAllExpiring(
  supabase: any,
  supabaseUrl: string,
  appId: string,
  appSecret: string,
  apiVersion: string
) {
  // Buscar todas as conexões Meta ativas que expiram em <7 dias
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: connections, error } = await supabase
    .from("marketplace_connections")
    .select("id, tenant_id, access_token, expires_at, metadata")
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .lt("expires_at", sevenDaysFromNow);

  if (error || !connections) {
    console.error(`[meta-token-refresh][${VERSION}] Erro ao buscar conexões:`, error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro ao buscar conexões" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[meta-token-refresh][${VERSION}] Found ${connections.length} connections to refresh`);

  const results = { refreshed: 0, failed: 0, skipped: 0, errors: [] as string[] };

  for (const conn of connections) {
    try {
      const result = await refreshTenantToken(supabase, supabaseUrl, conn.tenant_id, appId, appSecret, apiVersion);
      if (result.success) {
        if (result.already_valid) {
          results.skipped++;
        } else {
          results.refreshed++;
        }
      } else {
        results.failed++;
        results.errors.push(`${conn.tenant_id}: ${result.error}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${conn.tenant_id}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  console.log(`[meta-token-refresh][${VERSION}] Batch complete: ${JSON.stringify(results)}`);

  return new Response(
    JSON.stringify({ success: true, ...results }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
