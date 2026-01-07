import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-late-signature",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Webhooks should be POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.text();
    const payload = JSON.parse(body);
    console.log("[late-webhook] Received event:", payload.event);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const event = payload.event;
    const post = payload.post;
    const timestamp = payload.timestamp;

    switch (event) {
      case "post.scheduled":
        await handlePostScheduled(supabaseAdmin, post, timestamp);
        break;

      case "post.published":
        await handlePostPublished(supabaseAdmin, post, timestamp);
        break;

      case "post.failed":
        await handlePostFailed(supabaseAdmin, post, timestamp);
        break;

      case "post.partial":
        await handlePostPartial(supabaseAdmin, post, timestamp);
        break;

      case "account.disconnected":
        await handleAccountDisconnected(supabaseAdmin, payload);
        break;

      default:
        console.log("[late-webhook] Unknown event type:", event);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[late-webhook] Error:", error);
    // Always return 200 for webhooks to prevent retries on our errors
    return new Response(JSON.stringify({ success: true, warning: "Error processing but acknowledged" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handlePostScheduled(supabase: any, post: any, timestamp: string) {
  console.log("[late-webhook] Post scheduled:", post.id);

  const { error } = await supabase
    .from("late_scheduled_posts")
    .update({
      late_status: "scheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("late_post_id", post.id);

  if (error) {
    console.error("[late-webhook] Error updating scheduled post:", error);
  }
}

async function handlePostPublished(supabase: any, post: any, timestamp: string) {
  console.log("[late-webhook] Post published:", post.id);

  // Get the scheduled post to find the calendar item
  const { data: scheduledPost, error: fetchError } = await supabase
    .from("late_scheduled_posts")
    .select("id, calendar_item_id, tenant_id")
    .eq("late_post_id", post.id)
    .single();

  if (fetchError) {
    console.error("[late-webhook] Error fetching scheduled post:", fetchError);
    return;
  }

  // Extract published URLs from platforms
  const publishedUrls: Record<string, string> = {};
  if (post.platforms && Array.isArray(post.platforms)) {
    for (const platform of post.platforms) {
      if (platform.publishedUrl) {
        publishedUrls[platform.platform] = platform.publishedUrl;
      }
    }
  }

  // Update scheduled post status
  const { error: updateError } = await supabase
    .from("late_scheduled_posts")
    .update({
      late_status: "published",
      published_at: post.publishedAt || timestamp,
      published_urls: publishedUrls,
      updated_at: new Date().toISOString(),
    })
    .eq("late_post_id", post.id);

  if (updateError) {
    console.error("[late-webhook] Error updating post to published:", updateError);
  }

  // Update calendar item status
  if (scheduledPost?.calendar_item_id) {
    const { error: calendarError } = await supabase
      .from("media_calendar_items")
      .update({
        status: "published",
        published_at: post.publishedAt || timestamp,
        published_urls: publishedUrls,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduledPost.calendar_item_id);

    if (calendarError) {
      console.error("[late-webhook] Error updating calendar item:", calendarError);
    }
  }
}

async function handlePostFailed(supabase: any, post: any, timestamp: string) {
  console.log("[late-webhook] Post failed:", post.id);

  // Extract error messages from platforms
  const errors: string[] = [];
  if (post.platforms && Array.isArray(post.platforms)) {
    for (const platform of post.platforms) {
      if (platform.error) {
        errors.push(`${platform.platform}: ${platform.error}`);
      }
    }
  }
  const errorMessage = errors.join("; ") || "Publication failed";

  // Get the scheduled post to find the calendar item
  const { data: scheduledPost, error: fetchError } = await supabase
    .from("late_scheduled_posts")
    .select("id, calendar_item_id, tenant_id")
    .eq("late_post_id", post.id)
    .single();

  if (fetchError) {
    console.error("[late-webhook] Error fetching scheduled post:", fetchError);
  }

  // Update scheduled post status
  const { error: updateError } = await supabase
    .from("late_scheduled_posts")
    .update({
      late_status: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("late_post_id", post.id);

  if (updateError) {
    console.error("[late-webhook] Error updating post to failed:", updateError);
  }

  // Update calendar item status back to approved (so user can retry)
  if (scheduledPost?.calendar_item_id) {
    const { error: calendarError } = await supabase
      .from("media_calendar_items")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduledPost.calendar_item_id);

    if (calendarError) {
      console.error("[late-webhook] Error updating calendar item:", calendarError);
    }
  }
}

async function handlePostPartial(supabase: any, post: any, timestamp: string) {
  console.log("[late-webhook] Post partial:", post.id);

  // Extract published URLs and errors from platforms
  const publishedUrls: Record<string, string> = {};
  const errors: string[] = [];
  
  if (post.platforms && Array.isArray(post.platforms)) {
    for (const platform of post.platforms) {
      if (platform.publishedUrl) {
        publishedUrls[platform.platform] = platform.publishedUrl;
      }
      if (platform.error) {
        errors.push(`${platform.platform}: ${platform.error}`);
      }
    }
  }

  const { data: scheduledPost } = await supabase
    .from("late_scheduled_posts")
    .select("id, calendar_item_id")
    .eq("late_post_id", post.id)
    .single();

  // Update scheduled post with partial status
  await supabase
    .from("late_scheduled_posts")
    .update({
      late_status: "partial",
      published_at: timestamp,
      published_urls: publishedUrls,
      error_message: errors.join("; "),
      updated_at: new Date().toISOString(),
    })
    .eq("late_post_id", post.id);

  // Update calendar item
  if (scheduledPost?.calendar_item_id) {
    await supabase
      .from("media_calendar_items")
      .update({
        status: "published",
        published_at: timestamp,
        published_urls: publishedUrls,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduledPost.calendar_item_id);
  }
}

async function handleAccountDisconnected(supabase: any, payload: any) {
  console.log("[late-webhook] Account disconnected:", payload);

  const accountId = payload.account?.id || payload.socialAccountId;
  if (!accountId) {
    console.error("[late-webhook] No account ID in disconnect event");
    return;
  }

  // Find and update the late_connection that has this account
  const { data: connections, error: fetchError } = await supabase
    .from("late_connections")
    .select("id, tenant_id, connected_accounts")
    .not("connected_accounts", "is", null);

  if (fetchError) {
    console.error("[late-webhook] Error fetching connections:", fetchError);
    return;
  }

  for (const connection of connections || []) {
    const accounts = connection.connected_accounts || [];
    const hasAccount = accounts.some((acc: any) => acc.id === accountId);

    if (hasAccount) {
      // Remove the disconnected account
      const updatedAccounts = accounts.filter((acc: any) => acc.id !== accountId);
      
      await supabase
        .from("late_connections")
        .update({
          connected_accounts: updatedAccounts,
          status: updatedAccounts.length > 0 ? "connected" : "disconnected",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      console.log("[late-webhook] Updated connection for tenant:", connection.tenant_id);
      break;
    }
  }
}
