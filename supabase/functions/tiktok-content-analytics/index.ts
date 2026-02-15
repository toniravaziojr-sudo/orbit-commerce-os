import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 12 — TikTok Content Analytics
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

Deno.serve(async (req) => {
  console.log(`[tiktok-content-analytics][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing authorization' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: role } = await supabase
      .from('user_roles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!role) {
      return new Response(JSON.stringify({ success: false, error: 'No tenant found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = role.tenant_id;
    const body = await req.json();
    const { action } = body;

    console.log(`[tiktok-content-analytics][${VERSION}] Action: ${action}, tenant: ${tenantId}`);

    const { data: connection } = await supabase
      .from('tiktok_content_connections')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (!connection) {
      return new Response(JSON.stringify({ success: false, error: 'TikTok Content não conectado' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    switch (action) {
      case 'list': {
        const { data: analytics, error } = await supabase
          .from('tiktok_content_analytics')
          .select('*, video:tiktok_content_videos(title, cover_url, share_url)')
          .eq('tenant_id', tenantId)
          .order('date', { ascending: false })
          .limit(body.limit || 100);

        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, analytics }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync': {
        const accessToken = connection.access_token;

        // Get videos from local DB to fetch analytics for
        const { data: videos } = await supabase
          .from('tiktok_content_videos')
          .select('id, tiktok_video_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'published')
          .not('tiktok_video_id', 'is', null)
          .limit(50);

        if (!videos || videos.length === 0) {
          return new Response(JSON.stringify({ success: true, synced: 0, message: 'No published videos to analyze' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const videoIds = videos.map(v => v.tiktok_video_id).filter(Boolean);

        // Query video data from TikTok
        const queryRes = await fetch(`${TIKTOK_API_BASE}/video/query/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filters: {
              video_ids: videoIds,
            },
            fields: [
              'id', 'title', 'like_count', 'comment_count', 'share_count',
              'view_count', 'duration',
            ],
          }),
        });

        const queryText = await queryRes.text();
        let queryData;
        try {
          queryData = JSON.parse(queryText);
        } catch {
          console.error(`[tiktok-content-analytics] Parse error:`, queryText.substring(0, 500));
          return new Response(JSON.stringify({ success: false, error: 'Failed to parse TikTok response' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (queryData.error?.code !== 'ok' && queryData.error?.code) {
          return new Response(JSON.stringify({ success: false, error: queryData.error.message || 'TikTok API error' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const tiktokVideos = queryData.data?.videos || [];
        const today = new Date().toISOString().split('T')[0];
        let synced = 0;

        for (const tv of tiktokVideos) {
          const localVideo = videos.find(v => v.tiktok_video_id === tv.id);

          const { error: upsertError } = await supabase
            .from('tiktok_content_analytics')
            .upsert({
              tenant_id: tenantId,
              video_id: localVideo?.id || null,
              tiktok_video_id: tv.id,
              open_id: connection.open_id,
              date: today,
              views: tv.view_count || 0,
              likes: tv.like_count || 0,
              comments: tv.comment_count || 0,
              shares: tv.share_count || 0,
              synced_at: new Date().toISOString(),
            }, {
              onConflict: 'tenant_id,tiktok_video_id,date',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`[tiktok-content-analytics] Upsert error for ${tv.id}:`, upsertError);
          } else {
            synced++;
          }
        }

        console.log(`[tiktok-content-analytics][${VERSION}] Synced ${synced}/${tiktokVideos.length} analytics`);

        return new Response(JSON.stringify({ success: true, synced, total: tiktokVideos.length }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error(`[tiktok-content-analytics][${VERSION}] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
