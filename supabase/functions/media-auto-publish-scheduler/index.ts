import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS

    console.log(`Running auto-publish scheduler at ${todayStr} ${currentTime}`);

    // Find approved blog items that should be published today
    const { data: items, error: itemsError } = await supabase
      .from("media_calendar_items")
      .select(`
        *,
        campaign:media_campaigns!inner(
          id,
          tenant_id,
          auto_publish
        )
      `)
      .eq("target_channel", "blog")
      .eq("status", "approved")
      .is("blog_post_id", null)
      .lte("scheduled_date", todayStr);

    if (itemsError) {
      console.error("Error fetching items:", itemsError);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar itens para publicar" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum item para publicar", published: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${items.length} items to check for auto-publish`);

    let published = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        // Check if campaign has auto_publish enabled
        if (!item.campaign.auto_publish) {
          console.log(`Skipping item ${item.id} - auto_publish disabled`);
          skipped++;
          continue;
        }

        // Check if scheduled time has passed
        const scheduledTime = item.scheduled_time || "10:00:00";
        if (item.scheduled_date === todayStr && scheduledTime > currentTime) {
          console.log(`Skipping item ${item.id} - scheduled for later today at ${scheduledTime}`);
          skipped++;
          continue;
        }

        // Call the publish function
        const publishUrl = `${supabaseUrl}/functions/v1/media-publish-blog`;
        const response = await fetch(publishUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            calendar_item_id: item.id,
            publish_now: true,
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          published++;
          console.log(`Published blog post for item ${item.id}: ${result.slug}`);
        } else {
          console.error(`Failed to publish item ${item.id}:`, result.error);
        }
      } catch (itemError) {
        console.error(`Error processing item ${item.id}:`, itemError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        published,
        skipped,
        message: `Publicados ${published} posts, ${skipped} pulados` 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in media-auto-publish-scheduler:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
