import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authenticated" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const { tenant_id } = await req.json();
    
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to tenant
    const { data: roleCheck } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authorized for this tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Late connection
    const { data: connection } = await supabaseAdmin
      .from("late_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("status", "connected")
      .maybeSingle();

    if (!connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Late not connected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Late API Key
    const lateApiKey = await getCredential(supabaseUrl, supabaseServiceKey, "LATE_API_KEY");
    if (!lateApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Late API Key not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get pending/scheduled posts
    const { data: pendingPosts } = await supabaseAdmin
      .from("late_scheduled_posts")
      .select("*")
      .eq("tenant_id", tenant_id)
      .in("status", ["scheduled", "publishing"])
      .not("external_post_id", "is", null);

    if (!pendingPosts || pendingPosts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: "No pending posts to sync" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let updated = 0;
    const errors: any[] = [];

    for (const post of pendingPosts) {
      try {
        // Fetch post status from Late
        const postRes = await fetch(
          `https://api.getlate.dev/v1/profiles/${connection.late_profile_id}/posts/${post.external_post_id}`,
          {
            headers: {
              "Authorization": `Bearer ${lateApiKey}`,
            },
          }
        );

        if (!postRes.ok) {
          if (postRes.status === 404) {
            // Post not found, might have been deleted
            await supabaseAdmin
              .from("late_scheduled_posts")
              .update({ 
                status: "failed", 
                last_error: "Post not found in Late" 
              })
              .eq("id", post.id);
          }
          continue;
        }

        const postData = await postRes.json();
        
        // Map Late status to our status
        let newStatus = post.status;
        let publishedAt = post.published_at;

        switch (postData.status) {
          case "published":
          case "completed":
            newStatus = "published";
            publishedAt = postData.published_at || new Date().toISOString();
            break;
          case "publishing":
          case "processing":
            newStatus = "publishing";
            break;
          case "failed":
          case "error":
            newStatus = "failed";
            break;
          case "scheduled":
          case "pending":
            newStatus = "scheduled";
            break;
        }

        if (newStatus !== post.status) {
          await supabaseAdmin
            .from("late_scheduled_posts")
            .update({
              status: newStatus,
              published_at: publishedAt,
              raw_response: postData,
              last_error: postData.error || null,
            })
            .eq("id", post.id);

          // Update calendar item status if published
          if (newStatus === "published") {
            await supabaseAdmin
              .from("media_calendar_items")
              .update({ status: "published" })
              .eq("id", post.calendar_item_id);
          }

          updated++;
        }
      } catch (e) {
        console.error("[late-sync-status] Error syncing post:", post.id, e);
        errors.push({ post_id: post.id, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated,
        checked: pendingPosts.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[late-sync-status] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
