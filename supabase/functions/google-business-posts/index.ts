import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: sync, list, create actions
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const BUSINESS_API = "https://mybusiness.googleapis.com/v4";

Deno.serve(async (req) => {
  console.log(`[google-business-posts][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, tenantId, locationId, post } = body;

    if (!tenantId) {
      return jsonResponse({ success: false, error: "tenantId obrigatório" });
    }

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
      case 'create':
        return await handleCreate(supabase, accessToken, tenantId, locationId, post);
      case 'delete':
        return await handleDelete(supabase, accessToken, tenantId, locationId, body.postName);
      default:
        return jsonResponse({ success: false, error: `Ação desconhecida: ${action}` });
    }
  } catch (err) {
    console.error(`[google-business-posts][${VERSION}] Error:`, err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Erro interno" });
  }
});

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ===== SYNC POSTS =====
async function handleSync(supabase: any, accessToken: string, tenantId: string, locationId?: string) {
  if (!locationId) {
    return jsonResponse({ success: false, error: "locationId obrigatório para sync" });
  }

  const postsUrl = `${BUSINESS_API}/${locationId}/localPosts`;
  let allPosts: any[] = [];
  let pageToken: string | undefined;

  do {
    const url = pageToken ? `${postsUrl}?pageToken=${pageToken}` : postsUrl;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!res.ok) {
      console.error('[google-business-posts] Posts API error:', data);
      return jsonResponse({ success: false, error: "Falha ao buscar posts", details: data });
    }

    if (data.localPosts) {
      allPosts.push(...data.localPosts);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`[google-business-posts] Fetched ${allPosts.length} posts`);

  if (allPosts.length === 0) {
    return jsonResponse({ success: true, data: { synced: 0 } });
  }

  const records = allPosts.map((p: any) => ({
    tenant_id: tenantId,
    location_id: locationId,
    post_id: p.name || p.localPostId,
    topic_type: p.topicType || 'STANDARD',
    summary: p.summary || null,
    media_url: p.media?.[0]?.googleUrl || p.media?.[0]?.sourceUrl || null,
    call_to_action_type: p.callToAction?.actionType || null,
    call_to_action_url: p.callToAction?.url || null,
    event_title: p.event?.title || null,
    event_start: p.event?.schedule?.startDate ? formatEventDate(p.event.schedule.startDate, p.event.schedule.startTime) : null,
    event_end: p.event?.schedule?.endDate ? formatEventDate(p.event.schedule.endDate, p.event.schedule.endTime) : null,
    offer_coupon_code: p.offer?.couponCode || null,
    offer_redeem_url: p.offer?.redeemOnlineUrl || null,
    state: p.state || 'LIVE',
    search_url: p.searchUrl || null,
    create_time: p.createTime || null,
    update_time: p.updateTime || null,
  }));

  const { error: upsertError } = await supabase
    .from('google_business_posts')
    .upsert(records, { onConflict: 'tenant_id,location_id,post_id' });

  if (upsertError) {
    console.error('[google-business-posts] Upsert error:', upsertError);
    return jsonResponse({ success: false, error: upsertError.message });
  }

  return jsonResponse({ success: true, data: { synced: records.length } });
}

// ===== LIST CACHED POSTS =====
async function handleList(supabase: any, tenantId: string, locationId?: string) {
  let query = supabase
    .from('google_business_posts')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('create_time', { ascending: false })
    .limit(200);

  if (locationId) query = query.eq('location_id', locationId);

  const { data, error } = await query;

  if (error) {
    return jsonResponse({ success: false, error: error.message });
  }

  return jsonResponse({ success: true, data });
}

// ===== CREATE POST =====
async function handleCreate(
  supabase: any,
  accessToken: string,
  tenantId: string,
  locationId: string,
  post: any
) {
  if (!locationId || !post) {
    return jsonResponse({ success: false, error: "locationId e post obrigatórios" });
  }

  const createUrl = `${BUSINESS_API}/${locationId}/localPosts`;

  const postBody: any = {
    topicType: post.topicType || 'STANDARD',
    languageCode: 'pt-BR',
  };

  if (post.summary) postBody.summary = post.summary;

  if (post.mediaUrl) {
    postBody.media = [{
      mediaFormat: 'PHOTO',
      sourceUrl: post.mediaUrl,
    }];
  }

  if (post.callToAction) {
    postBody.callToAction = {
      actionType: post.callToAction.type || 'LEARN_MORE',
      url: post.callToAction.url,
    };
  }

  if (post.event) {
    postBody.event = {
      title: post.event.title,
      schedule: {
        startDate: parseDateToGoogleDate(post.event.startDate),
        endDate: parseDateToGoogleDate(post.event.endDate),
      },
    };
    postBody.topicType = 'EVENT';
  }

  if (post.offer) {
    postBody.offer = {
      couponCode: post.offer.couponCode,
      redeemOnlineUrl: post.offer.redeemUrl,
      termsConditions: post.offer.terms,
    };
    postBody.topicType = 'OFFER';
  }

  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(postBody),
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    console.error('[google-business-posts] Create API error:', data);
    return jsonResponse({ success: false, error: "Falha ao criar post", details: data });
  }

  // Save to cache
  await supabase
    .from('google_business_posts')
    .upsert({
      tenant_id: tenantId,
      location_id: locationId,
      post_id: data.name || data.localPostId,
      topic_type: data.topicType || postBody.topicType,
      summary: postBody.summary || null,
      media_url: post.mediaUrl || null,
      call_to_action_type: postBody.callToAction?.actionType || null,
      call_to_action_url: postBody.callToAction?.url || null,
      state: 'LIVE',
      create_time: data.createTime || new Date().toISOString(),
    }, { onConflict: 'tenant_id,location_id,post_id' });

  return jsonResponse({ success: true, data });
}

// ===== DELETE POST =====
async function handleDelete(
  supabase: any,
  accessToken: string,
  tenantId: string,
  locationId: string,
  postName: string
) {
  if (!postName) {
    return jsonResponse({ success: false, error: "postName obrigatório" });
  }

  const deleteUrl = `${BUSINESS_API}/${postName}`;

  const res = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  const text = await res.text();
  if (!res.ok) {
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return jsonResponse({ success: false, error: "Falha ao deletar post", details: data });
  }

  // Remove from cache
  await supabase
    .from('google_business_posts')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('post_id', postName);

  return jsonResponse({ success: true });
}

function formatEventDate(dateObj: any, timeObj?: any): string {
  if (!dateObj) return new Date().toISOString();
  const y = dateObj.year || 2025;
  const m = String(dateObj.month || 1).padStart(2, '0');
  const d = String(dateObj.day || 1).padStart(2, '0');
  const h = timeObj ? String(timeObj.hours || 0).padStart(2, '0') : '00';
  const min = timeObj ? String(timeObj.minutes || 0).padStart(2, '0') : '00';
  return `${y}-${m}-${d}T${h}:${min}:00Z`;
}

function parseDateToGoogleDate(dateStr: string): any {
  if (!dateStr) return { year: 2025, month: 1, day: 1 };
  const d = new Date(dateStr);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}
