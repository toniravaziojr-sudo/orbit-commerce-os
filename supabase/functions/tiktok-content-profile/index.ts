import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIKTOK_API_BASE = "https://open.tiktokapis.com/v2";

Deno.serve(async (req) => {
  console.log(`[tiktok-content-profile][${VERSION}] Request received`);

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

    console.log(`[tiktok-content-profile][${VERSION}] Action: ${action}, tenant: ${tenantId}`);

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
      case 'sync_profile': {
        const accessToken = connection.access_token;

        // Fetch user info + stats from TikTok
        const userInfoRes = await fetch(`${TIKTOK_API_BASE}/user/info/?fields=open_id,union_id,avatar_url,display_name,bio_description,follower_count,following_count,likes_count,video_count`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        const userInfoText = await userInfoRes.text();
        let userInfoData;
        try {
          userInfoData = JSON.parse(userInfoText);
        } catch {
          console.error(`[tiktok-content-profile] Parse error:`, userInfoText.substring(0, 500));
          return new Response(JSON.stringify({ success: false, error: 'Failed to parse TikTok response' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        if (userInfoData.error?.code !== 'ok' && userInfoData.error?.code) {
          return new Response(JSON.stringify({ success: false, error: userInfoData.error?.message || 'TikTok API error' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const userData = userInfoData.data?.user || {};

        // Update connection with profile data
        const { error: updateError } = await supabase
          .from('tiktok_content_connections')
          .update({
            display_name: userData.display_name || connection.display_name,
            avatar_url: userData.avatar_url || connection.avatar_url,
            bio_description: userData.bio_description || null,
            follower_count: userData.follower_count || 0,
            following_count: userData.following_count || 0,
            likes_count: userData.likes_count || 0,
            video_count: userData.video_count || 0,
            profile_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', connection.id);

        if (updateError) {
          console.error(`[tiktok-content-profile] Update error:`, updateError);
          return new Response(JSON.stringify({ success: false, error: 'Failed to update profile data' }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        console.log(`[tiktok-content-profile][${VERSION}] Profile synced for ${userData.display_name}`);

        return new Response(JSON.stringify({
          success: true,
          profile: {
            display_name: userData.display_name,
            avatar_url: userData.avatar_url,
            bio_description: userData.bio_description,
            follower_count: userData.follower_count || 0,
            following_count: userData.following_count || 0,
            likes_count: userData.likes_count || 0,
            video_count: userData.video_count || 0,
          },
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_profile': {
        return new Response(JSON.stringify({
          success: true,
          profile: {
            display_name: connection.display_name,
            avatar_url: connection.avatar_url,
            bio_description: connection.bio_description,
            follower_count: connection.follower_count || 0,
            following_count: connection.following_count || 0,
            likes_count: connection.likes_count || 0,
            video_count: connection.video_count || 0,
            profile_synced_at: connection.profile_synced_at,
          },
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'publish_scheduled': {
        // Called by cron or manually — publish posts whose scheduled_at has passed
        const now = new Date().toISOString();
        const { data: pendingPosts } = await supabase
          .from('tiktok_content_scheduled_posts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('status', 'scheduled')
          .lte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(5);

        if (!pendingPosts || pendingPosts.length === 0) {
          return new Response(JSON.stringify({ success: true, published: 0 }), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let published = 0;
        const accessToken = connection.access_token;

        for (const post of pendingPosts) {
          try {
            // Mark as publishing
            await supabase
              .from('tiktok_content_scheduled_posts')
              .update({ status: 'publishing', updated_at: new Date().toISOString() })
              .eq('id', post.id);

            // Init upload via TikTok Content Posting API
            const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/inbox/video/init/`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                source_info: {
                  source: 'PULL_FROM_URL',
                  video_url: post.video_storage_path,
                  video_size: post.video_size || 0,
                },
                post_info: {
                  title: post.title,
                  description: post.description || '',
                  privacy_level: post.privacy_level || 'SELF_ONLY',
                },
              }),
            });

            const initData = await initRes.json();

            if (initData.error?.code !== 'ok' && initData.error?.code) {
              await supabase
                .from('tiktok_content_scheduled_posts')
                .update({
                  status: 'failed',
                  error_message: initData.error?.message || 'TikTok upload init failed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', post.id);
              continue;
            }

            const publishId = initData.data?.publish_id;

            await supabase
              .from('tiktok_content_scheduled_posts')
              .update({
                status: 'published',
                publish_id: publishId,
                published_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', post.id);

            published++;
          } catch (err) {
            console.error(`[tiktok-content-profile] Publish error for ${post.id}:`, err);
            await supabase
              .from('tiktok_content_scheduled_posts')
              .update({
                status: 'failed',
                error_message: (err as any).message || 'Unknown error',
                updated_at: new Date().toISOString(),
              })
              .eq('id', post.id);
          }
        }

        console.log(`[tiktok-content-profile][${VERSION}] Published ${published}/${pendingPosts.length} scheduled posts`);

        return new Response(JSON.stringify({ success: true, published, total: pendingPosts.length }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (err) {
    console.error(`[tiktok-content-profile][${VERSION}] Error:`, err);
    return new Response(JSON.stringify({ success: false, error: (err as any).message }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
