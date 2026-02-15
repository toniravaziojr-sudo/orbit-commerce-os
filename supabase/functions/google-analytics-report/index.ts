import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: GA4 report + realtime + list
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GA4_DATA_API = "https://analyticsdata.googleapis.com/v1beta";

async function refreshAccessToken(
  supabase: any,
  tenantId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) return null;

  await supabase
    .from("google_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  return data.access_token;
}

async function getValidToken(supabase: any, tenantId: string): Promise<{ token: string; conn: any } | null> {
  const { data: conn } = await supabase
    .from("google_connections")
    .select("access_token, refresh_token, token_expires_at, scope_packs, assets, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return null;
  if (!conn.scope_packs?.includes("analytics")) return null;

  const isExpired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : true;
  let token = conn.access_token;

  if (isExpired && conn.refresh_token) {
    const newToken = await refreshAccessToken(supabase, tenantId, conn.refresh_token);
    if (!newToken) return null;
    token = newToken;
  }

  return { token, conn };
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[google-analytics-report][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action") || "list";
    const tenantId = body.tenant_id || url.searchParams.get("tenant_id");

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // SYNC — Pull report data from GA4 Data API
    // ========================
    if (action === "sync") {
      const auth = await getValidToken(supabase, tenantId);
      if (!auth) {
        return new Response(
          JSON.stringify({ success: false, error: "Google Analytics não conectado ou pack 'analytics' não habilitado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const properties = auth.conn.assets?.analytics_properties || [];
      const propertyId = body.property_id || properties[0]?.id;
      if (!propertyId) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma propriedade GA4 encontrada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const dateFrom = body.date_from || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const dateTo = body.date_to || new Date().toISOString().split("T")[0];

      // GA4 Data API - runReport
      const cleanPropertyId = propertyId.replace("properties/", "");
      const reportRes = await fetch(
        `${GA4_DATA_API}/properties/${cleanPropertyId}:runReport`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateRanges: [{ startDate: dateFrom, endDate: dateTo }],
            dimensions: [{ name: "date" }],
            metrics: [
              { name: "sessions" },
              { name: "totalUsers" },
              { name: "newUsers" },
              { name: "screenPageViews" },
              { name: "bounceRate" },
              { name: "averageSessionDuration" },
              { name: "conversions" },
              { name: "totalRevenue" },
            ],
            orderBys: [{ dimension: { dimensionName: "date" }, desc: true }],
          }),
        }
      );

      const reportText = await reportRes.text();
      if (!reportRes.ok) {
        console.error(`[google-analytics-report][${traceId}] API error:`, reportText);
        let errorMsg = "Erro na API do Google Analytics";
        try {
          const errData = JSON.parse(reportText);
          errorMsg = errData.error?.message || errorMsg;
        } catch {}
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let reportData: any;
      try {
        reportData = JSON.parse(reportText);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao processar resposta" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metricHeaders = (reportData.metricHeaders || []).map((h: any) => h.name);
      const rows = reportData.rows || [];

      let synced = 0;
      for (const row of rows) {
        const dateRaw = row.dimensionValues?.[0]?.value;
        if (!dateRaw) continue;

        // GA4 returns date as YYYYMMDD
        const formattedDate = `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`;

        const metricsObj: Record<string, number> = {};
        (row.metricValues || []).forEach((mv: any, i: number) => {
          const name = metricHeaders[i] || `metric_${i}`;
          metricsObj[name] = parseFloat(mv.value || "0");
        });

        const { error } = await supabase
          .from("google_analytics_reports")
          .upsert({
            tenant_id: tenantId,
            property_id: cleanPropertyId,
            report_type: "daily_overview",
            date: formattedDate,
            dimensions: { date: formattedDate },
            metrics: metricsObj,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,property_id,report_type,date,dimensions" });

        if (error) {
          console.error(`[google-analytics-report][${traceId}] Upsert error:`, error);
        } else {
          synced++;
        }
      }

      console.log(`[google-analytics-report][${traceId}] Synced ${synced}/${rows.length} rows`);

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: rows.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // REALTIME — Live users via GA4 Data API
    // ========================
    if (action === "realtime") {
      const auth = await getValidToken(supabase, tenantId);
      if (!auth) {
        return new Response(
          JSON.stringify({ success: false, error: "Google Analytics não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const properties = auth.conn.assets?.analytics_properties || [];
      const propertyId = body.property_id || properties[0]?.id;
      if (!propertyId) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma propriedade GA4 encontrada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanPropertyId = propertyId.replace("properties/", "");

      const realtimeRes = await fetch(
        `${GA4_DATA_API}/properties/${cleanPropertyId}:runRealtimeReport`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metrics: [
              { name: "activeUsers" },
              { name: "screenPageViews" },
              { name: "conversions" },
            ],
          }),
        }
      );

      const realtimeText = await realtimeRes.text();
      if (!realtimeRes.ok) {
        console.error(`[google-analytics-report][${traceId}] Realtime error:`, realtimeText);
        let errorMsg = "Erro ao buscar dados em tempo real";
        try {
          const errData = JSON.parse(realtimeText);
          errorMsg = errData.error?.message || errorMsg;
        } catch {}
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let realtimeData: any;
      try {
        realtimeData = JSON.parse(realtimeText);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao processar resposta" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metricHeaders = (realtimeData.metricHeaders || []).map((h: any) => h.name);
      const row = realtimeData.rows?.[0];
      const result: Record<string, number> = {};

      if (row) {
        (row.metricValues || []).forEach((mv: any, i: number) => {
          result[metricHeaders[i]] = parseFloat(mv.value || "0");
        });
      }

      return new Response(
        JSON.stringify({ success: true, data: result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const propertyId = body.property_id || url.searchParams.get("property_id");
      const dateFrom = body.date_from || url.searchParams.get("date_from");
      const dateTo = body.date_to || url.searchParams.get("date_to");

      let query = supabase
        .from("google_analytics_reports")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false });

      if (propertyId) query = query.eq("property_id", propertyId.replace("properties/", ""));
      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data, error } = await query.limit(500);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // SUMMARY — Aggregate from cache
    // ========================
    if (action === "summary") {
      const propertyId = body.property_id || url.searchParams.get("property_id");
      const dateFrom = body.date_from || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const dateTo = body.date_to || new Date().toISOString().split("T")[0];

      let query = supabase
        .from("google_analytics_reports")
        .select("metrics")
        .eq("tenant_id", tenantId)
        .eq("report_type", "daily_overview")
        .gte("date", dateFrom)
        .lte("date", dateTo);

      if (propertyId) query = query.eq("property_id", propertyId.replace("properties/", ""));

      const { data, error } = await query;
      if (error) throw error;

      const summary = (data || []).reduce((acc: any, row: any) => {
        const m = row.metrics || {};
        return {
          sessions: acc.sessions + (m.sessions || 0),
          totalUsers: acc.totalUsers + (m.totalUsers || 0),
          newUsers: acc.newUsers + (m.newUsers || 0),
          pageViews: acc.pageViews + (m.screenPageViews || 0),
          conversions: acc.conversions + (m.conversions || 0),
          revenue: acc.revenue + (m.totalRevenue || 0),
        };
      }, { sessions: 0, totalUsers: 0, newUsers: 0, pageViews: 0, conversions: 0, revenue: 0 });

      // Average bounce rate
      const bounceRates = (data || [])
        .map((r: any) => r.metrics?.bounceRate)
        .filter((v: any) => v !== undefined && v !== null);
      summary.avgBounceRate = bounceRates.length > 0
        ? bounceRates.reduce((s: number, v: number) => s + v, 0) / bounceRates.length
        : 0;

      return new Response(
        JSON.stringify({ success: true, data: summary }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[google-analytics-report][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
