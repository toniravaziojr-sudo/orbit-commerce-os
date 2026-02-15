import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: sync, list, summary actions
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

Deno.serve(async (req) => {
  console.log(`[google-search-console][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, tenantId, siteUrl, dateRange, dimensions } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenantId obrigatório" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch google connection for tenant
    const { data: connection, error: connError } = await supabase
      .from('google_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Conexão Google não encontrada", code: "NO_CONNECTION" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check search_console scope
    const scopePacks: string[] = connection.scope_packs || [];
    if (!scopePacks.includes('search_console')) {
      return new Response(
        JSON.stringify({ success: false, error: "Pack 'search_console' não habilitado", code: "MISSING_SCOPE" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh token if needed
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      const refreshRes = await fetch(`${supabaseUrl}/functions/v1/google-token-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({ tenantId }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.success && refreshData.data?.access_token) {
        accessToken = refreshData.data.access_token;
      } else {
        return new Response(
          JSON.stringify({ success: false, error: "Falha ao renovar token", code: "TOKEN_REFRESH_FAILED" }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    switch (action) {
      case 'sync':
        return await handleSync(supabase, accessToken, tenantId, siteUrl, dateRange);
      case 'list':
        return await handleList(supabase, tenantId, siteUrl, dateRange, dimensions);
      case 'summary':
        return await handleSummary(supabase, tenantId, siteUrl, dateRange);
      case 'sites':
        return await handleSites(accessToken);
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (err) {
    console.error(`[google-search-console][${VERSION}] Error:`, err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ===== LIST VERIFIED SITES =====
async function handleSites(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error('[google-search-console] Sites API error:', data);
    return new Response(
      JSON.stringify({ success: false, error: "Falha ao listar sites", details: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data: data.siteEntry || [] }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ===== SYNC SEARCH ANALYTICS =====
async function handleSync(
  supabase: any,
  accessToken: string,
  tenantId: string,
  siteUrl: string,
  dateRange?: { startDate: string; endDate: string }
) {
  if (!siteUrl) {
    return new Response(
      JSON.stringify({ success: false, error: "siteUrl obrigatório para sync" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const endDate = dateRange?.endDate || new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const encodedSiteUrl = encodeURIComponent(siteUrl);
  const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

  const payload = {
    startDate,
    endDate,
    dimensions: ['query', 'page', 'country', 'device', 'date'],
    rowLimit: 5000,
    startRow: 0,
  };

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error('[google-search-console] Search Analytics API error:', data);
    return new Response(
      JSON.stringify({ success: false, error: "Falha ao buscar dados do Search Console", details: data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const rows = data.rows || [];
  console.log(`[google-search-console] Fetched ${rows.length} rows from API`);

  if (rows.length === 0) {
    return new Response(
      JSON.stringify({ success: true, data: { synced: 0 } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Map API rows to DB records
  const records = rows.map((row: any) => {
    const keys = row.keys || [];
    return {
      tenant_id: tenantId,
      site_url: siteUrl,
      report_type: 'search_analytics',
      query: keys[0] || null,
      page: keys[1] || null,
      country: keys[2] || null,
      device: keys[3] || null,
      date: keys[4] || endDate,
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    };
  });

  // Upsert in batches
  const batchSize = 500;
  let totalUpserted = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error: upsertError } = await supabase
      .from('google_search_console_data')
      .upsert(batch, { onConflict: 'tenant_id,site_url,date,query,page,country,device' });

    if (upsertError) {
      console.error(`[google-search-console] Upsert batch error:`, upsertError);
    } else {
      totalUpserted += batch.length;
    }
  }

  // Update last_sync_at
  await supabase
    .from('google_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  console.log(`[google-search-console] Synced ${totalUpserted} rows`);

  return new Response(
    JSON.stringify({ success: true, data: { synced: totalUpserted, total: rows.length } }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ===== LIST CACHED DATA =====
async function handleList(
  supabase: any,
  tenantId: string,
  siteUrl?: string,
  dateRange?: { startDate: string; endDate: string },
  dimensions?: string[]
) {
  let query = supabase
    .from('google_search_console_data')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('date', { ascending: false })
    .limit(1000);

  if (siteUrl) query = query.eq('site_url', siteUrl);
  if (dateRange?.startDate) query = query.gte('date', dateRange.startDate);
  if (dateRange?.endDate) query = query.lte('date', dateRange.endDate);

  const { data, error } = await query;

  if (error) {
    console.error('[google-search-console] List error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ===== SUMMARY =====
async function handleSummary(
  supabase: any,
  tenantId: string,
  siteUrl?: string,
  dateRange?: { startDate: string; endDate: string }
) {
  const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];

  let query = supabase
    .from('google_search_console_data')
    .select('clicks, impressions, ctr, position, query, page, date')
    .eq('tenant_id', tenantId)
    .gte('date', startDate)
    .lte('date', endDate);

  if (siteUrl) query = query.eq('site_url', siteUrl);

  const { data, error } = await query;

  if (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const rows = data || [];
  const totalClicks = rows.reduce((s: number, r: any) => s + (r.clicks || 0), 0);
  const totalImpressions = rows.reduce((s: number, r: any) => s + (r.impressions || 0), 0);
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
  const avgPosition = rows.length > 0
    ? rows.reduce((s: number, r: any) => s + (r.position || 0), 0) / rows.length
    : 0;

  // Top queries by clicks
  const queryMap = new Map<string, number>();
  rows.forEach((r: any) => {
    if (r.query) queryMap.set(r.query, (queryMap.get(r.query) || 0) + (r.clicks || 0));
  });
  const topQueries = [...queryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([query, clicks]) => ({ query, clicks }));

  // Top pages by clicks
  const pageMap = new Map<string, number>();
  rows.forEach((r: any) => {
    if (r.page) pageMap.set(r.page, (pageMap.get(r.page) || 0) + (r.clicks || 0));
  });
  const topPages = [...pageMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([page, clicks]) => ({ page, clicks }));

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        totalClicks,
        totalImpressions,
        avgCtr: Math.round(avgCtr * 10000) / 10000,
        avgPosition: Math.round(avgPosition * 100) / 100,
        topQueries,
        topPages,
        period: { startDate, endDate },
        rowCount: rows.length,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
