import { createClient } from "npm:@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL_GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), c => c.charCodeAt(0));

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  const type = url.searchParams.get("type"); // "open" or "click"
  const redirect = url.searchParams.get("url"); // destination for clicks

  if (!token) {
    return new Response("Missing token", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch token record
    const { data: trackingToken, error } = await supabase
      .from("email_tracking_tokens")
      .select("id, campaign_id, subscriber_id, tenant_id, opened_at, clicked_at, open_count, click_count")
      .eq("token", token)
      .single();

    if (error || !trackingToken) {
      if (type === "click" && redirect) {
        return Response.redirect(redirect, 302);
      }
      return new Response(PIXEL_GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
    }

    const isFirstOpen = !trackingToken.opened_at;
    const isFirstClick = !trackingToken.clicked_at;

    if (type === "click") {
      // Update token click
      await supabase
        .from("email_tracking_tokens")
        .update({
          clicked_at: trackingToken.clicked_at || new Date().toISOString(),
          click_count: trackingToken.click_count + 1,
        })
        .eq("id", trackingToken.id);

      // Increment campaign click counters
      const updates: Record<string, any> = { click_count: (await getCampaignField(supabase, trackingToken.campaign_id, "click_count")) + 1 };
      if (isFirstClick) {
        updates.unique_click_count = (await getCampaignField(supabase, trackingToken.campaign_id, "unique_click_count")) + 1;
      }
      await supabase
        .from("email_marketing_campaigns")
        .update(updates)
        .eq("id", trackingToken.campaign_id);

      if (redirect) {
        return Response.redirect(redirect, 302);
      }
      return new Response("OK", { status: 200 });
    } else {
      // Open tracking (pixel)
      await supabase
        .from("email_tracking_tokens")
        .update({
          opened_at: trackingToken.opened_at || new Date().toISOString(),
          open_count: trackingToken.open_count + 1,
        })
        .eq("id", trackingToken.id);

      const openUpdates: Record<string, any> = { open_count: (await getCampaignField(supabase, trackingToken.campaign_id, "open_count")) + 1 };
      if (isFirstOpen) {
        openUpdates.unique_open_count = (await getCampaignField(supabase, trackingToken.campaign_id, "unique_open_count")) + 1;
      }
      await supabase
        .from("email_marketing_campaigns")
        .update(openUpdates)
        .eq("id", trackingToken.campaign_id);

      return new Response(PIXEL_GIF, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      });
    }
  } catch (err) {
    console.error("Tracking error:", err);
    if (type === "click" && redirect) {
      return Response.redirect(redirect, 302);
    }
    return new Response(PIXEL_GIF, { headers: { "Content-Type": "image/gif" } });
  }
});

async function getCampaignField(supabase: any, campaignId: string, field: string): Promise<number> {
  const { data } = await supabase
    .from("email_marketing_campaigns")
    .select(field)
    .eq("id", campaignId)
    .single();
  return data?.[field] ?? 0;
}
