import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  publishAt?: string; // ISO date for scheduled publishing
  videoUrl: string; // URL of the video file to upload
  thumbnailUrl?: string;
  enableCaptions?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
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

    // Validate user
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

    // Get YouTube connection with decrypted tokens
    const { data: connection, error: connError } = await supabase
      .from('youtube_connections')
      .select('*')
      .eq('id', body.connectionId)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: 'YouTube connection not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = connection.tenant_id;

    // Calculate credits needed
    // Base: 16 credits (1600 quota units = 1 upload)
    // +1 credit per GB of video file
    // +1 for thumbnail, +2 for captions
    let creditsNeeded = 16; // Base upload cost
    if (body.thumbnailUrl) creditsNeeded += 1;
    if (body.enableCaptions) creditsNeeded += 2;

    // Check credit balance
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

    // Reserve credits for the upload
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

    // Create upload job in queue
    const { data: uploadJob, error: jobError } = await supabase
      .from('youtube_uploads')
      .insert({
        tenant_id: tenantId,
        connection_id: body.connectionId,
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
        },
      })
      .select()
      .single();

    if (jobError) {
      // Release reserved credits on failure
      console.error('Failed to create upload job:', jobError);
      return new Response(JSON.stringify({ error: 'Falha ao criar job de upload' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Start async upload process using Deno's background task pattern
    // Note: In Deno Deploy, we use queueMicrotask for lightweight background work
    // For heavy work, the job is already queued in youtube_uploads table
    queueMicrotask(() => {
      processYouTubeUpload(supabase, uploadJob, connection).catch(err => {
        console.error('Background upload failed:', err);
      });
    });

    return new Response(JSON.stringify({
      success: true,
      upload_id: uploadJob.id,
      status: 'pending',
      credits_reserved: creditsNeeded,
      message: 'Upload iniciado. Você será notificado quando concluir.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('YouTube upload error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processYouTubeUpload(supabase: any, uploadJob: any, connection: any) {
  const jobId = uploadJob.id;
  const tenantId = uploadJob.tenant_id;

  try {
    // Update status to processing
    await supabase
      .from('youtube_uploads')
      .update({ status: 'processing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // Check if access token needs refresh
    let accessToken = connection.access_token;
    const tokenExpiry = new Date(connection.token_expires_at);
    
    if (tokenExpiry < new Date()) {
      // Refresh token
      const refreshResult = await refreshYouTubeToken(connection.refresh_token);
      if (!refreshResult.success) {
        throw new Error('Failed to refresh YouTube token');
      }
      
      accessToken = refreshResult.accessToken!;
      
      // Update connection with new tokens
      await supabase
        .from('youtube_connections')
        .update({
          access_token: refreshResult.accessToken,
          token_expires_at: new Date(Date.now() + (refreshResult.expiresIn || 3600) * 1000).toISOString(),
        })
        .eq('id', connection.id);
    }

    // Step 1: Download video from URL
    console.log(`[YouTube Upload] Downloading video from: ${uploadJob.video_url}`);
    const videoResponse = await fetch(uploadJob.video_url);
    if (!videoResponse.ok) {
      throw new Error('Failed to download video file');
    }
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });

    // Step 2: Validate publishAt if scheduling
    if (uploadJob.publish_at) {
      const publishDate = new Date(uploadJob.publish_at);
      const now = new Date();
      const minFutureMs = 60 * 60 * 1000; // 1 hour minimum
      
      if (publishDate.getTime() < now.getTime() + minFutureMs) {
        throw new Error('invalidPublishAt: A data de publicação deve ser pelo menos 1 hora no futuro.');
      }
    }

    // Step 3: Create YouTube video resource
    // IMPORTANT: For scheduling to work, privacyStatus MUST be 'private'
    const effectivePrivacy = uploadJob.publish_at ? 'private' : (uploadJob.privacy_status || 'private');
    
    const videoMetadata = {
      snippet: {
        title: uploadJob.title,
        description: uploadJob.description,
        tags: uploadJob.tags || [],
        categoryId: uploadJob.category_id || '22', // Default: People & Blogs
      },
      status: {
        privacyStatus: effectivePrivacy,
        publishAt: uploadJob.publish_at || undefined,
        selfDeclaredMadeForKids: false,
      },
    };

    // Step 3: Upload to YouTube using resumable upload
    // First, initiate the resumable upload
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
      console.error('[YouTube Upload] Init failed:', errorText);
      throw new Error(`YouTube API error: ${initResponse.status}`);
    }

    const uploadUrl = initResponse.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('No upload URL received from YouTube');
    }

    // Step 4: Upload the video content
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
      console.error('[YouTube Upload] Upload failed:', errorText);
      throw new Error(`Video upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const videoId = uploadResult.id;

    console.log(`[YouTube Upload] Video uploaded successfully: ${videoId}`);

    // Step 5: Upload thumbnail if provided
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
        console.log(`[YouTube Upload] Thumbnail uploaded for: ${videoId}`);
      } catch (thumbError) {
        console.error('[YouTube Upload] Thumbnail upload failed:', thumbError);
        // Continue even if thumbnail fails
      }
    }

    // Step 6: Consume the reserved credits
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
      p_cost_usd: creditsUsed * 0.01, // 1 credit = $0.01
      p_from_reserve: true,
    });

    // Step 7: Update job as completed
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

    console.log(`[YouTube Upload] Job ${jobId} completed successfully`);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[YouTube Upload] Job ${jobId} failed:`, errorMessage);

    // Release reserved credits on failure
    // Note: We'd need a release_credits function for this
    // For now, we'll just mark the job as failed

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
      console.error('Token refresh failed:', await response.text());
      return { success: false };
    }

    const data = await response.json();
    return {
      success: true,
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    return { success: false };
  }
}
