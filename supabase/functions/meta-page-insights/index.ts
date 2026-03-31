import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, metaApiErrorResponse } from "../_shared/error-response.ts";
import { getMetaConnectionForTenant } from "../_shared/meta-connection.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.1.0"; // Fase 5 Lote 3 — migração para helper central
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  console.log(`[meta-page-insights][${VERSION}] Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tenantId, action, pageId, period, metric, since, until } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar conexão Meta via helper central (V4 + fallback legado)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const metaConn = await getMetaConnectionForTenant(adminClient, tenantId, `page-insights`);
    if (!metaConn) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão Meta não encontrada", code: "NO_CONNECTION" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = metaConn.access_token;
    const pages = metaConn.metadata?.assets?.pages || [];
    const igAccounts = (metaConn.metadata?.assets as any)?.instagram_accounts || [];

    if (pages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma página conectada", code: "NO_PAGES" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiVersion = "v21.0";

    switch (action) {
      case "page_overview": {
        // Insights básicos da página (impressões, alcance, engajamento)
        const targetPageId = pageId || pages[0]?.id;
        const pageToken = pages.find((p: any) => p.id === targetPageId)?.access_token || accessToken;
        const metricParam = metric || "page_impressions,page_engaged_users,page_fans,page_views_total";
        const periodParam = period || "day";

        let url = `https://graph.facebook.com/${apiVersion}/${targetPageId}/insights?metric=${metricParam}&period=${periodParam}&access_token=${pageToken}`;
        if (since) url += `&since=${since}`;
        if (until) url += `&until=${until}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          console.error(`[meta-page-insights][${VERSION}] Graph API error:`, data.error);
          return metaApiErrorResponse(data.error, corsHeaders, { module: 'page-insights' });
        }

        return new Response(
          JSON.stringify({ success: true, data: data.data, paging: data.paging }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "page_demographics": {
        // Dados demográficos: idade/gênero, cidade, país
        const targetPageId = pageId || pages[0]?.id;
        const pageToken = pages.find((p: any) => p.id === targetPageId)?.access_token || accessToken;
        const metricParam = "page_fans_gender_age,page_fans_city,page_fans_country";

        const url = `https://graph.facebook.com/${apiVersion}/${targetPageId}/insights?metric=${metricParam}&period=lifetime&access_token=${pageToken}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          console.error(`[meta-page-insights][${VERSION}] Demographics error:`, data.error);
          return metaApiErrorResponse(data.error, corsHeaders, { module: 'page-insights' });
        }

        return new Response(
          JSON.stringify({ success: true, data: data.data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "ig_overview": {
        // Insights do Instagram Business Account
        const targetPageId = pageId || pages[0]?.id;
        const igAccount = igAccounts.find((ig: any) => ig.page_id === targetPageId) || igAccounts[0];

        if (!igAccount) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhuma conta Instagram conectada", code: "NO_IG_ACCOUNT" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const pageToken = pages.find((p: any) => p.id === (igAccount as any).page_id)?.access_token || accessToken;
        const metricParam = metric || "impressions,reach,accounts_engaged,total_interactions";
        const periodParam = period || "day";

        let url = `https://graph.facebook.com/${apiVersion}/${igAccount.id}/insights?metric=${metricParam}&period=${periodParam}&metric_type=total_value&access_token=${pageToken}`;
        if (since) url += `&since=${since}`;
        if (until) url += `&until=${until}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          console.error(`[meta-page-insights][${VERSION}] IG Insights error:`, data.error);
          return metaApiErrorResponse(data.error, corsHeaders, { module: 'page-insights' });
        }

        return new Response(
          JSON.stringify({ success: true, data: data.data, paging: data.paging }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "ig_demographics": {
        // Demográficos do IG: idade/gênero, cidade, país (requer engaged_audience_demographics)
        const targetPageId = pageId || pages[0]?.id;
        const igAccount = igAccounts.find((ig: any) => ig.page_id === targetPageId) || igAccounts[0];

        if (!igAccount) {
          return new Response(
            JSON.stringify({ success: false, error: "Nenhuma conta Instagram conectada", code: "NO_IG_ACCOUNT" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const pageToken = pages.find((p: any) => p.id === (igAccount as any).page_id)?.access_token || accessToken;
        const metricParam = "engaged_audience_demographics";

        const url = `https://graph.facebook.com/${apiVersion}/${igAccount.id}/insights?metric=${metricParam}&period=lifetime&metric_type=total_value&timeframe=this_month&breakdown=age,gender,city,country&access_token=${pageToken}`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          console.error(`[meta-page-insights][${VERSION}] IG Demographics error:`, data.error);
          return metaApiErrorResponse(data.error, corsHeaders, { module: 'page-insights' });
        }

        return new Response(
          JSON.stringify({ success: true, data: data.data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list_pages": {
        // Retornar páginas e contas IG disponíveis
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              pages: pages.map((p: any) => ({ id: p.id, name: p.name })),
              instagram_accounts: igAccounts.map((ig: any) => ({ id: ig.id, username: ig.username, page_id: ig.page_id })),
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Ação desconhecida: ${action}`, code: "UNKNOWN_ACTION" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err) {
    console.error(`[meta-page-insights][${VERSION}] Error:`, err);
    return errorResponse(err, corsHeaders, { module: 'page-insights' });
  }
});
