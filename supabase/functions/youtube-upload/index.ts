import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ===== VERSION =====
const VERSION = "v2.0.0"; // Phase 2: read from google_connections with legacy fallback
// ===================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadRequest {
  connectionId: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  privacyStatus: 'private' | 'unlisted' | 'public';
  publishAt?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  enableCaptions?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log(`[youtube-upload][${VERSION}] Request received`);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claims.claims.sub as string;
    const body: UploadRequest = await req.json();

    // === PHASE 2: Try google_connections first, fallback to youtube_connections ===
    let connection: any = null;
    let connectionSource = "legacy";

    if (body.connectionId === "google-hub") {
      // Frontend signals this is from Google Hub — resolve by tenant
      // Find tenant from user roles
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (userRoles?.tenant_id) {
        const { data: gc } = await supabase
          .from('google_connections')
          .select('*')
          .eq('tenant_id', userRoles.tenant_id)
          .eq('is_active', true)
          .maybeSingle();

        if (gc && (gc as any).scope_packs?.includes('youtube')) {
          connection = gc;
          connectionSource = "google_hub";
        }
      }
    }

    // Fallback: try youtube_connections by ID
    if (!connection) {
      const { data: ytConn, error: connError } = await supabase
        .from('youtube_connections')
        .select('*')
        .eq('id', body.connectionId)
        .single();

      if (!connError && ytConn) {
        connection = ytConn;
        connectionSource = "legacy";
      }
    }

    // Fallback: try google_connections by tenant (auto-resolve)
    if (!connection) {
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('tenant_id')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (userRoles?.tenant_id) {
        const { data: gc } = await supabase
          .from('google_connections')
          .select('*')
          .eq('tenant_id', userRoles.tenant_id)
          .eq('is_active', true)
          .maybeSingle();

        if (gc && (gc as any).scope_packs?.includes('youtube')) {
          connection = gc;
          connectionSource = "google_hub";
        }
      }
    }

    if (!connection) {
      return new Response(JSON.stringify({ error: 'YouTube connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[youtube-upload][${VERSION}] Using connection source: ${connectionSource}`);

    const tenantId = connection.tenant_id;

    // Calculate credits
    let creditsNeeded = 16;
    if (body.thumbnailUrl) creditsNeeded += 1;
    if (body.enableCaptions) creditsNeeded += 2;

    const { data: balanceCheck } = await supabase.rpc('check_credit_balance', {
      p_tenant_id: tenantId,
      p_credits_needed: creditsNeeded,
    });

    if (!balanceCheck?.[0]?.has_balance) {
      return new Response(JSON.stringify({
        error: 'Saldo insuficiente',
        credits_needed: creditsNeeded,
        current_balance: balanceCheck?.[0]?.current_balance || 0,
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const idempotencyKey = `youtube_upload_${tenantId}_${Date.now()}`;
    const { data: reserveResult } = await supabase.rpc('reserve_credits', {
      p_tenant_id: tenantId,
      p_credits: creditsNeeded,
      p_idempotency_key: idempotencyKey,
    });

    if (!reserveResult?.[0]?.success) {
      return new Response(JSON.stringify({
        error: reserveResult?.[0]?.error_message || 'Falha ao reservar créditos',
      }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use connection.id or generate a ref for the upload job
    const connectionRef = connectionSource === "google_hub" ? connection.id : body.connectionId;

    const { data: uploadJob, error: jobError } = await supabase
      .from('youtube_uploads')
      .insert({
        tenant_id: tenantId,
        connection_id: connectionRef,
        title: body.title,
        description: body.description,
        tags: body.tags,
        category_id: body.categoryId,
        privacy_status: body.privacyStatus,
        publish_at: body.publishAt || null,
        video_url: body.videoUrl,
        thumbnail_url: body.thumbnailUrl || null,
        status: 'pending',
        credits_reserved: creditsNeeded,
        metadata: {
          enable_captions: body.enableCaptions || false,
          idempotency_key: idempotencyKey,
          created_by: userId,
          connection_source: connectionSource,
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error(`[youtube-upload][${VERSION}] Failed to create upload job:`, jobError);
      return new Response(JSON.stringify({ error: 'Falha ao criar job de upload' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    queueMicrotask(() => {
      processYouTubeUpload(supabase, uploadJob, connection, connectionSource).catch(err => {
        console.error(`[youtube-upload][${VERSION}] Background upload failed:`, err);
      });
    });

    return new Response(JSON.stringify({
      success: true,
      upload_id: uploadJob.id,
      status: 'pending',
      credits_reserved: creditsNeeded,
      connection_source: connectionSource,
      message: 'Upload iniciado. Você será notificado quando concluir.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[youtube-upload][${VERSION}] Error:`, errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processYouTubeUpload(supabase: any, uploadJob: any, connection: any, connectionSource: string) {
  const jobId = uploadJob.id;
  const tenantId = uploadJob.tenant_id;

  try {
    await supabase
      .from('youtube_uploads')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    let accessToken = connection.access_token;
    const tokenExpiry = new Date(connection.token_expires_at);
    
    if (tokenExpiry < new Date()) {
      const refreshResult = await refreshYouTubeToken(connection.refresh_token);
      if (!refreshResult.success) {
        throw new Error('Failed to refresh YouTube token');
      }
      
      accessToken = refreshResult.accessToken!;
      
      // Update the correct table based on source
      if (connectionSource === "google_hub") {
        await supabase
          .from('google_connections')
          .update({
            access_token: refreshResult.accessToken,
            token_expires_at: new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000).toISOString(),
          })
          .eq('id', connection.id);
      } else {
        await supabase
          .from('youtube_connections')
          .update({
            access_token: refreshResult.accessToken,
            token_expires_at: new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000).toISOString(),
          })
          .eq('id', connection.id);
      }
    }

    // Download video
    console.log(`[youtube-upload][${VERSION}] Downloading video from: ${uploadJob.video_url}`);
    const videoResponse = await fetch(uploadJob.video_url);
    if (!videoResponse.ok) throw new Error('Failed to download video file');
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });

    // Validate publishAt
    if (uploadJob.publish_at) {
      const publishDate = new Date(uploadJob.publish_at);
      const now = new Date();
      if (publishDate.getTime() < now.getTime() + 60 * 60 * 1000) {
        throw new Error('invalidPublishAt: A data de publicação deve ser pelo menos 1 hora no futuro.');
      }
    }

    const effectivePrivacy = uploadJob.publish_at ? 'private' : (uploadJob.privacy_status || 'private');
    
    const videoMetadata = {
      snippet: {
        title: uploadJob.title,
        description: uploadJob.description,
        tags: uploadJob.tags || [],
        categoryId: uploadJob.category_id || '22',
      },
      status: {
        privacyStatus: effectivePrivacy,
        publishAt: uploadJob.publish_at || undefined,
        selfDeclaredMadeForKids: false,
      },
    };

    // Resumable upload
    const initResponse = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': videoBlob.size.toString(),
        },
        body: JSON.stringify(videoMetadata),
      }
    );

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      console.error(`[youtube-upload][${VERSION}] Init failed:`, errorText);
      throw new Error(`YouTube API error: ${initResponse.status}`);
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) throw new Error('No upload URL received from YouTube');

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBlob.size.toString(),
      },
      body: videoBlob,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error(`[youtube-upload][${VERSION}] Upload failed:`, errorText);
      throw new Error(`Video upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const videoId = uploadResult.id;

    console.log(`[youtube-upload][${VERSION}] Video uploaded successfully: ${videoId}`);

    // Upload thumbnail if provided
    if (uploadJob.thumbnail_url) {
      try {
        const thumbResponse = await fetch(uploadJob.thumbnail_url);
        const thumbBuffer = await thumbResponse.arrayBuffer();
        
        await fetch(
          `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'image/jpeg',
            },
            body: thumbBuffer,
          }
        );
        console.log(`[youtube-upload][${VERSION}] Thumbnail uploaded for: ${videoId}`);
      } catch (thumbError) {
        console.error(`[youtube-upload][${VERSION}] Thumbnail upload failed:`, thumbError);
      }
    }

    // Consume credits
    const creditsUsed = uploadJob.credits_reserved;
    const idempotencyKey = uploadJob.metadata?.idempotency_key || `youtube_consume_${jobId}`;
    
    await supabase.rpc('consume_credits', {
      p_tenant_id: tenantId,
      p_user_id: uploadJob.metadata?.created_by,
      p_credits: creditsUsed,
      p_idempotency_key: `${idempotencyKey}_consume`,
      p_provider: 'youtube',
      p_model: 'upload',
      p_feature: 'youtube_upload',
      p_units_json: JSON.stringify({ uploads: 1, has_thumbnail: !!uploadJob.thumbnail_url }),
      p_cost_usd: creditsUsed * 0.01,
      p_from_reserve: true,
    });

    await supabase
      .from('youtube_uploads')
      .update({
        status: 'completed',
        youtube_video_id: videoId,
        youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
        completed_at: new Date().toISOString(),
        credits_consumed: creditsUsed,
      })
      .eq('id', jobId);

    console.log(`[youtube-upload][${VERSION}] Job ${jobId} completed successfully`);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[youtube-upload][${VERSION}] Job ${jobId} failed:`, errorMessage);

    await supabase
      .from('youtube_uploads')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

async function refreshYouTubeToken(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  expiresIn?: number;
}> {
  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      console.error(`[youtube-upload][${VERSION}] Token refresh failed:`, await response.text());
      return { success: false };
    }

    const data = await response.json();
    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error(`[youtube-upload][${VERSION}] Token refresh error:`, error);
    return { success: false };
  }
}
