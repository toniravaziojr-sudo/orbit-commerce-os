import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 3: TikTok Shop OAuth start
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * TikTok Shop OAuth Start
 * 
 * Gera URL de autorização para conectar loja TikTok Shop (Seller API).
 * Usa credenciais separadas: TIKTOK_SHOP_APP_KEY e TIKTOK_SHOP_APP_SECRET.
 * 
 * Body: { tenantId, scopePacks?: string[], returnPath? }
 * Resposta: { success: true, authUrl, state }
 */

// Scope Pack Registry (TikTok Shop / Seller API)
const TIKTOK_SHOP_SCOPE_PACKS: Record<string, string[]> = {
  catalog: ["product.read", "product.edit"],
  orders: ["order.read", "order.edit"],
  fulfillment: ["fulfillment.read", "fulfillment.edit"],
  finance: ["finance.read"],
  customer_service: ["customer_service.read", "customer_service.write"],
};

serve(async (req) => {
  console.log(`[tiktok-shop-oauth-start][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Não autorizado", code: "UNAUTHORIZED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Sessão inválida", code: "INVALID_SESSION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      tenantId,
      scopePacks = ["catalog", "orders"],
      returnPath = "/integrations",
    } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id é obrigatório", code: "MISSING_TENANT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar acesso ao tenant
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .single();

    if (roleError || !userRole) {
      return new Response(
        JSON.stringify({ success: false, error: "Sem acesso a este tenant", code: "FORBIDDEN" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar credenciais do TikTok Shop (separadas das de Ads)
    const appKey = await getCredential(supabaseUrl, supabaseServiceKey, "TIKTOK_SHOP_APP_KEY");

    if (!appKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Integração TikTok Shop não configurada. Configure TIKTOK_SHOP_APP_KEY nas credenciais da plataforma.",
          code: "NOT_CONFIGURED",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolver escopos a partir dos packs
    const resolvedScopes = new Set<string>();
    const validPacks: string[] = [];

    for (const pack of scopePacks) {
      const scopes = TIKTOK_SHOP_SCOPE_PACKS[pack];
      if (scopes) {
        scopes.forEach((s) => resolvedScopes.add(s));
        validPacks.push(pack);
      } else {
        console.warn(`[tiktok-shop-oauth-start] Pack desconhecido: ${pack}`);
      }
    }

    // Gerar state único (anti-CSRF)
    const stateHash = crypto.randomUUID();

    // Salvar state no banco (reutiliza tiktok_oauth_states com product='shop')
    const { error: stateError } = await supabase
      .from("tiktok_oauth_states")
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        state_hash: stateHash,
        return_path: returnPath,
        scope_packs: validPacks,
        product: "shop",
      });

    if (stateError) {
      console.error("[tiktok-shop-oauth-start] Erro ao salvar state:", stateError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro interno ao iniciar autorização", code: "STATE_SAVE_FAILED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // URL base do app para redirect
    const appBaseUrl = Deno.env.get("APP_URL") || "https://app.comandocentral.com.br";
    const redirectUri = `${appBaseUrl}/integrations/tiktok/callback`;

    // Construir URL de autorização TikTok Shop
    // TikTok Shop usa o mesmo portal de auth mas com app_key diferente
    const authUrl = new URL("https://services.tiktokshop.com/open/authorize");
    authUrl.searchParams.set("app_key", appKey);
    authUrl.searchParams.set("state", stateHash);

    console.log(`[tiktok-shop-oauth-start][${VERSION}] URL gerada para tenant ${tenantId}, packs: ${validPacks.join(",")}`);

    return new Response(
      JSON.stringify({
        success: true,
        authUrl: authUrl.toString(),
        state: stateHash,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-shop-oauth-start][${VERSION}] Erro:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno",
        code: "INTERNAL_ERROR",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
