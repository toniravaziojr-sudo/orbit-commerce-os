import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Fase 12 — TikTok Content Publish
// ===========================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

Deno.serve(async (req) => {
  console.log(`[tiktok-content-publish][${VERSION}] Request received`);

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

    // Auth user
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant
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

    console.log(`[tiktok-content-publish][${VERSION}] Action: ${action}, tenant: ${tenantId}`);

    // Get content connection
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
        // List videos from DB
        const { data: videos, error } = await supabase
          .from('tiktok_content_videos')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(body.limit || 50);

        if (error) {
          console.error(`[tiktok-content-publish] List error:`, error);
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, videos }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'sync': {
        // Sync videos from TikTok Content API
        const accessToken = connection.access_token;
        const openId = connection.open_id;

        // Fetch user's video list
        const videosRes = await fetch(`${TIKTOK_API_BASE}/video/list/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            max_count: body.max_count || 20,
            cursor: body.cursor || 0,
          }),
        });

        const videosText = await videosRes.text();
        let videosData;
        try {
          videosData = JSON.parse(videosText);
        } catch {
          console.error(`[tiktok-content-publish] Parse error:`, videosText.substring(0, 500));
          return new Response(JSON.stringify({ success: false, error: 'Failed to parse TikTok response' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (videosData.error?.code !== 'ok' && videosData.error?.code) {
          console.error(`[tiktok-content-publish] TikTok API error:`, videosData.error);
          return new Response(JSON.stringify({ success: false, error: videosData.error.message || 'TikTok API error' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const videos = videosData.data?.videos || [];
        let synced = 0;

        for (const video of videos) {
          const { error: upsertError } = await supabase
            .from('tiktok_content_videos')
            .upsert({
              tenant_id: tenantId,
              tiktok_video_id: video.id,
              open_id: openId,
              title: video.title || '',
              description: video.video_description || video.title || '',
              cover_url: video.cover_image_url,
              share_url: video.share_url,
              status: 'published',
              duration_seconds: video.duration,
              width: video.width,
              height: video.height,
              published_at: video.create_time ? new Date(video.create_time * 1000).toISOString() : null,
              metadata: {
                like_count: video.like_count,
                comment_count: video.comment_count,
                share_count: video.share_count,
                view_count: video.view_count,
              },
            }, {
              onConflict: 'tenant_id,tiktok_video_id',
              ignoreDuplicates: false,
            });

          if (upsertError) {
            console.error(`[tiktok-content-publish] Upsert error for video ${video.id}:`, upsertError);
          } else {
            synced++;
          }
        }

        console.log(`[tiktok-content-publish][${VERSION}] Synced ${synced}/${videos.length} videos`);

        return new Response(JSON.stringify({
          success: true,
          synced,
          total: videos.length,
          has_more: videosData.data?.has_more || false,
          cursor: videosData.data?.cursor,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'init_upload': {
        // Initialize video upload via TikTok Content Posting API
        const accessToken = connection.access_token;
        const { title, description, privacy_level, video_size, chunk_size, total_chunk_count } = body;

        // Create post info
        const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/inbox/video/init/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source_info: {
              source: 'FILE_UPLOAD',
              video_size: video_size,
              chunk_size: chunk_size || video_size,
              total_chunk_count: total_chunk_count || 1,
            },
          }),
        });

        const initText = await initRes.text();
        let initData;
        try {
          initData = JSON.parse(initText);
        } catch {
          console.error(`[tiktok-content-publish] Init parse error:`, initText.substring(0, 500));
          return new Response(JSON.stringify({ success: false, error: 'Failed to parse init response' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (initData.error?.code !== 'ok' && initData.error?.code) {
          return new Response(JSON.stringify({ success: false, error: initData.error.message || 'Init upload failed' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Save draft record
        const { data: videoRecord, error: insertError } = await supabase
          .from('tiktok_content_videos')
          .insert({
            tenant_id: tenantId,
            open_id: connection.open_id,
            title: title || 'Sem título',
            description: description || '',
            status: 'uploading',
            privacy_level: privacy_level || 'public',
            publish_id: initData.data?.publish_id,
            upload_status: 'initialized',
            metadata: { upload_url: initData.data?.upload_url },
          })
          .select()
          .single();

        if (insertError) {
          console.error(`[tiktok-content-publish] Insert error:`, insertError);
        }

        return new Response(JSON.stringify({
          success: true,
          publish_id: initData.data?.publish_id,
          upload_url: initData.data?.upload_url,
          video_record_id: videoRecord?.id,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'check_status': {
        // Check publish status
        const accessToken = connection.access_token;
        const { publish_id } = body;

        const statusRes = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publish_id }),
        });

        const statusText = await statusRes.text();
        let statusData;
        try {
          statusData = JSON.parse(statusText);
        } catch {
          return new Response(JSON.stringify({ success: false, error: 'Failed to parse status response' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const publishStatus = statusData.data?.status;

        // Update local record if we have publish_id
        if (publish_id) {
          const updateData: Record<string, unknown> = {
            upload_status: publishStatus,
          };

          if (publishStatus === 'PUBLISH_COMPLETE') {
            updateData.status = 'published';
            updateData.published_at = new Date().toISOString();
          } else if (publishStatus === 'FAILED') {
            updateData.status = 'failed';
            updateData.error_message = statusData.data?.fail_reason || 'Unknown error';
          }

          await supabase
            .from('tiktok_content_videos')
            .update(updateData)
            .eq('tenant_id', tenantId)
            .eq('publish_id', publish_id);
        }

        return new Response(JSON.stringify({
          success: true,
          status: publishStatus,
          data: statusData.data,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        // Delete video record (local only — TikTok doesn't support remote delete via API)
        const { video_id } = body;

        const { error } = await supabase
          .from('tiktok_content_videos')
          .delete()
          .eq('id', video_id)
          .eq('tenant_id', tenantId);

        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error(`[tiktok-content-publish][${VERSION}] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
