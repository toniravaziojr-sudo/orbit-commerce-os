import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: sync, list, reply actions
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const BUSINESS_API = "https://mybusiness.googleapis.com/v4";
const BUSINESS_API_V1 = "https://mybusinessbusinessinformation.googleapis.com/v1";

Deno.serve(async (req) => {
  console.log(`[google-business-reviews][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, tenantId, locationId, reviewId, replyText } = body;

    if (!tenantId) {
      return jsonResponse({ success: false, error: "tenantId obrigatório" });
    }

    // Fetch connection
    const { data: connection, error: connError } = await supabase
      .from('google_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return jsonResponse({ success: false, error: "Conexão Google não encontrada", code: "NO_CONNECTION" });
    }

    const scopePacks: string[] = connection.scope_packs || [];
    if (!scopePacks.includes('business')) {
      return jsonResponse({ success: false, error: "Pack 'business' não habilitado", code: "MISSING_SCOPE" });
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
        return jsonResponse({ success: false, error: "Falha ao renovar token", code: "TOKEN_REFRESH_FAILED" });
      }
    }

    switch (action) {
      case 'sync':
        return await handleSync(supabase, accessToken, tenantId, locationId);
      case 'list':
        return await handleList(supabase, tenantId, locationId);
      case 'reply':
        return await handleReply(supabase, accessToken, tenantId, locationId, reviewId, replyText);
      case 'locations':
        return await handleLocations(accessToken);
      default:
        return jsonResponse({ success: false, error: `Ação desconhecida: ${action}` });
    }
  } catch (err) {
    console.error(`[google-business-reviews][${VERSION}] Error:`, err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Erro interno" });
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ===== LIST LOCATIONS (accounts + locations) =====
async function handleLocations(accessToken: string) {
  // List accounts
  const accountsRes = await fetch(`${BUSINESS_API}/accounts`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  const accountsText = await accountsRes.text();
  let accountsData;
  try { accountsData = JSON.parse(accountsText); } catch { accountsData = { raw: accountsText }; }

  if (!accountsRes.ok) {
    console.error('[google-business-reviews] Accounts API error:', accountsData);
    return jsonResponse({ success: false, error: "Falha ao listar contas", details: accountsData });
  }

  const accounts = accountsData.accounts || [];
  const allLocations: any[] = [];

  for (const account of accounts) {
    const accountName = account.name; // "accounts/123"
    try {
      const locRes = await fetch(`${BUSINESS_API_V1}/${accountName}/locations?readMask=name,title,storefrontAddress`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      const locText = await locRes.text();
      let locData;
      try { locData = JSON.parse(locText); } catch { locData = { raw: locText }; }

      if (locRes.ok && locData.locations) {
        allLocations.push(...locData.locations.map((loc: any) => ({
          ...loc,
          accountName,
          accountTitle: account.accountName || account.name,
        })));
      }
    } catch (err) {
      console.error(`[google-business-reviews] Error listing locations for ${accountName}:`, err);
    }
  }

  return jsonResponse({ success: true, data: allLocations });
}

// ===== SYNC REVIEWS =====
async function handleSync(supabase: any, accessToken: string, tenantId: string, locationId?: string) {
  if (!locationId) {
    return jsonResponse({ success: false, error: "locationId obrigatório para sync" });
  }

  // Use the account reviews API
  const reviewsUrl = `${BUSINESS_API}/${locationId}/reviews`;
  let allReviews: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = pageToken ? `${reviewsUrl}?pageToken=${pageToken}` : reviewsUrl;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      console.error('[google-business-reviews] Reviews API error:', data);
      return jsonResponse({ success: false, error: "Falha ao buscar avaliações", details: data });
    }

    if (data.reviews) {
      allReviews.push(...data.reviews);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`[google-business-reviews] Fetched ${allReviews.length} reviews`);

  if (allReviews.length === 0) {
    return jsonResponse({ success: true, data: { synced: 0 } });
  }

  const records = allReviews.map((review: any) => ({
    tenant_id: tenantId,
    location_id: locationId,
    review_id: review.reviewId || review.name,
    reviewer_name: review.reviewer?.displayName || null,
    reviewer_photo_url: review.reviewer?.profilePhotoUrl || null,
    star_rating: starRatingToNumber(review.starRating),
    comment: review.comment || null,
    review_reply: review.reviewReply?.comment || null,
    reply_updated_at: review.reviewReply?.updateTime || null,
    create_time: review.createTime || null,
    update_time: review.updateTime || null,
  }));

  // Upsert
  const { error: upsertError } = await supabase
    .from('google_business_reviews')
    .upsert(records, { onConflict: 'tenant_id,location_id,review_id' });

  if (upsertError) {
    console.error('[google-business-reviews] Upsert error:', upsertError);
    return jsonResponse({ success: false, error: upsertError.message });
  }

  // Update last_sync_at
  await supabase
    .from('google_connections')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('tenant_id', tenantId);

  return jsonResponse({ success: true, data: { synced: records.length } });
}

// ===== LIST CACHED REVIEWS =====
async function handleList(supabase: any, tenantId: string, locationId?: string) {
  let query = supabase
    .from('google_business_reviews')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('create_time', { ascending: false })
    .limit(500);

  if (locationId) query = query.eq('location_id', locationId);

  const { data, error } = await query;

  if (error) {
    return jsonResponse({ success: false, error: error.message });
  }

  return jsonResponse({ success: true, data });
}

// ===== REPLY TO REVIEW =====
async function handleReply(
  supabase: any,
  accessToken: string,
  tenantId: string,
  locationId: string,
  reviewId: string,
  replyText: string
) {
  if (!locationId || !reviewId || !replyText) {
    return jsonResponse({ success: false, error: "locationId, reviewId e replyText obrigatórios" });
  }

  const replyUrl = `${BUSINESS_API}/${locationId}/reviews/${reviewId}/reply`;

  const res = await fetch(replyUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: replyText }),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error('[google-business-reviews] Reply API error:', data);
    return jsonResponse({ success: false, error: "Falha ao responder avaliação", details: data });
  }

  // Update local cache
  await supabase
    .from('google_business_reviews')
    .update({
      review_reply: replyText,
      reply_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .eq('location_id', locationId)
    .eq('review_id', reviewId);

  return jsonResponse({ success: true, data });
}

function starRatingToNumber(rating: string): number {
  const map: Record<string, number> = {
    'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5,
  };
  return map[rating] || 0;
}
