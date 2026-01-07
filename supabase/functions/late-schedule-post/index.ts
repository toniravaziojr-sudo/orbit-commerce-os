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
    const { calendar_item_ids, tenant_id } = await req.json();
    
    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!calendar_item_ids || !Array.isArray(calendar_item_ids) || calendar_item_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "calendar_item_ids array is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user belongs to tenant with admin role
    const { data: roleCheck, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .in("role", ["owner", "admin"])
      .maybeSingle();

    if (roleError || !roleCheck) {
      return new Response(
        JSON.stringify({ success: false, error: "User not authorized for this tenant" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Late connection
    const { data: connection, error: connError } = await supabaseAdmin
      .from("late_connections")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("status", "connected")
      .maybeSingle();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ success: false, error: "Late not connected. Please connect first." }),
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

    // Fetch calendar items
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("media_calendar_items")
      .select(`
        *,
        campaign:media_campaigns(target_channel)
      `)
      .in("id", calendar_item_ids)
      .eq("tenant_id", tenant_id);

    if (itemsError || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No valid calendar items found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get connected social accounts
    const connectedAccounts = connection.connected_accounts || [];
    
    // Filter for Facebook/Instagram accounts
    const fbAccount = connectedAccounts.find((a: any) => 
      a.platform === "facebook" || a.type === "facebook"
    );
    const igAccount = connectedAccounts.find((a: any) => 
      a.platform === "instagram" || a.type === "instagram"
    );

    const results: any[] = [];
    const errors: any[] = [];

    for (const item of items) {
      try {
        // Determine target platforms based on campaign channel
        const targetChannel = item.campaign?.target_channel || "all";
        const platforms: string[] = [];

        if (targetChannel === "facebook" || targetChannel === "all") {
          if (fbAccount) platforms.push("facebook");
        }
        if (targetChannel === "instagram" || targetChannel === "all") {
          if (igAccount) platforms.push("instagram");
        }

        if (platforms.length === 0) {
          errors.push({
            item_id: item.id,
            error: "No connected accounts for target platform(s)",
          });
          continue;
        }

        // Prepare post content
        const caption = item.copy || item.caption || "";
        const scheduledFor = item.scheduled_date 
          ? new Date(item.scheduled_date).toISOString()
          : new Date(Date.now() + 60000).toISOString(); // Default to 1 min from now

        // Build media array if we have generated image
        const media: any[] = [];
        if (item.generated_image_url) {
          media.push({
            type: "image",
            url: item.generated_image_url,
          });
        }

        // Schedule post via Late API
        const postPayload: any = {
          caption,
          scheduled_at: scheduledFor,
          platforms,
        };

        if (media.length > 0) {
          postPayload.media = media;
        }

        const scheduleRes = await fetch(
          `https://getlate.dev/api/v1/profiles/${connection.late_profile_id}/posts`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lateApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(postPayload),
          }
        );

        const scheduleData = await scheduleRes.json();

        if (!scheduleRes.ok) {
          console.error("[late-schedule-post] Late API error:", scheduleData);
          errors.push({
            item_id: item.id,
            error: scheduleData.message || scheduleData.error || "Failed to schedule",
          });

          // Save failed attempt
          await supabaseAdmin
            .from("late_scheduled_posts")
            .upsert({
              tenant_id,
              calendar_item_id: item.id,
              provider: "late",
              target_platforms: platforms,
              status: "failed",
              scheduled_for: scheduledFor,
              last_error: scheduleData.message || scheduleData.error || "Failed to schedule",
              raw_response: scheduleData,
            }, { onConflict: "calendar_item_id,provider" });

          continue;
        }

        // Save successful schedule
        await supabaseAdmin
          .from("late_scheduled_posts")
          .upsert({
            tenant_id,
            calendar_item_id: item.id,
            provider: "late",
            target_platforms: platforms,
            external_post_id: scheduleData.id,
            external_post_ids: scheduleData,
            status: "scheduled",
            scheduled_for: scheduledFor,
            raw_response: scheduleData,
            last_error: null,
          }, { onConflict: "calendar_item_id,provider" });

        // Update calendar item status
        await supabaseAdmin
          .from("media_calendar_items")
          .update({ status: "scheduled" })
          .eq("id", item.id);

        results.push({
          item_id: item.id,
          external_post_id: scheduleData.id,
          platforms,
          scheduled_for: scheduledFor,
        });
      } catch (e: unknown) {
        console.error("[late-schedule-post] Error scheduling item:", item.id, e);
        errors.push({
          item_id: item.id,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: results.length,
        failed: errors.length,
        results,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[late-schedule-post] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
