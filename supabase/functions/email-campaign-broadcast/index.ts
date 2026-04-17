import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BroadcastRequest {
  campaign_id: string;
  scheduled_at?: string;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authorization" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { campaign_id, scheduled_at }: BroadcastRequest = await req.json();

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: "campaign_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("email_marketing_campaigns")
      .select("*, email_marketing_templates(*)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (campaign.type !== "broadcast") {
      return new Response(
        JSON.stringify({ success: false, error: "Only broadcast campaigns can be run this way" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!campaign.template_id || !campaign.email_marketing_templates) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign has no template" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!campaign.list_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign has no target list" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const template = campaign.email_marketing_templates;
    const tenantId = campaign.tenant_id;
    const scheduleTime = scheduled_at || new Date().toISOString();

    const { data: listMembers, error: membersError } = await supabase
      .from("email_marketing_list_members")
      .select("subscriber_id, email_marketing_subscribers(id, email, name, status)")
      .eq("list_id", campaign.list_id)
      .eq("tenant_id", tenantId);

    if (membersError) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch list members" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const activeSubscribers = (listMembers || [])
      .filter((m: any) => m.email_marketing_subscribers?.status === "active")
      .map((m: any) => m.email_marketing_subscribers);

    if (activeSubscribers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No active subscribers in this list" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build tracking base URL
    const trackBaseUrl = `${supabaseUrl}/functions/v1/email-track`;

    // Create tracking tokens for each subscriber
    const trackingTokens: { subscriberId: string; token: string }[] = [];
    const tokenInserts = activeSubscribers.map((sub: any) => {
      const tkn = crypto.randomUUID();
      trackingTokens.push({ subscriberId: sub.id, token: tkn });
      return {
        tenant_id: tenantId,
        campaign_id: campaign.id,
        subscriber_id: sub.id,
        token: tkn,
      };
    });

    // Insert tracking tokens in batches
    const TOKEN_BATCH = 100;
    for (let i = 0; i < tokenInserts.length; i += TOKEN_BATCH) {
      await supabase.from("email_tracking_tokens").insert(tokenInserts.slice(i, i + TOKEN_BATCH));
    }

    // Build subscriber→token map
    const tokenMap = new Map(trackingTokens.map(t => [t.subscriberId, t.token]));

    // Create queue entries with tracking injected
    const queueEntries = activeSubscribers.map((subscriber: any) => {
      const tkn = tokenMap.get(subscriber.id)!;
      const personalizedSubject = template.subject.replace(/\{\{name\}\}/g, subscriber.name || "");
      let personalizedHtml = template.body_html.replace(/\{\{name\}\}/g, subscriber.name || "");

      // Inject tracking into HTML
      personalizedHtml = injectTracking(personalizedHtml, trackBaseUrl, tkn);

      return {
        tenant_id: tenantId,
        campaign_id: campaign.id,
        subscriber_id: subscriber.id,
        to_email: subscriber.email,
        subject: personalizedSubject,
        body_html: personalizedHtml,
        body_text: template.body_text?.replace(/\{\{name\}\}/g, subscriber.name || ""),
        scheduled_at: scheduleTime,
        status: "queued",
        metadata: { broadcast: true },
      };
    });

    // Insert in batches
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < queueEntries.length; i += BATCH_SIZE) {
      const batch = queueEntries.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("email_send_queue").insert(batch);
      if (insertError) {
        console.error("Error inserting batch:", insertError);
        continue;
      }
      insertedCount += batch.length;
    }

    // Update campaign status and sent_count
    await supabase
      .from("email_marketing_campaigns")
      .update({ status: "active", sent_count: insertedCount })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({
        success: true,
        queued: insertedCount,
        total_subscribers: activeSubscribers.length,
        scheduled_at: scheduleTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Broadcast error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Inject tracking pixel and rewrite links for click tracking
 */
function injectTracking(html: string, trackBaseUrl: string, token: string): string {
  // 1. Rewrite all <a href="..."> to go through click tracker
  const rewritten = html.replace(
    /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>/gi,
    (match, before, href, after) => {
      // Skip mailto: and tel: links
      if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
        return match;
      }
      const trackedUrl = `${trackBaseUrl}?type=click&t=${token}&url=${encodeURIComponent(href)}`;
      return `<a ${before}href="${trackedUrl}"${after}>`;
    }
  );

  // 2. Append tracking pixel before </body> or at end
  const pixel = `<img src="${trackBaseUrl}?type=open&t=${token}" width="1" height="1" style="display:none" alt="" />`;
  if (rewritten.includes("</body>")) {
    return rewritten.replace("</body>", `${pixel}</body>`);
  }
  return rewritten + pixel;
}
