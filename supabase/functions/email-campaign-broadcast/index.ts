import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BroadcastRequest {
  campaign_id: string;
  scheduled_at?: string; // Optional: schedule for later
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
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

    // Fetch campaign with template
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

    // Get active subscribers from the list
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

    // Filter active subscribers
    const activeSubscribers = (listMembers || [])
      .filter((m: any) => m.email_marketing_subscribers?.status === "active")
      .map((m: any) => m.email_marketing_subscribers);

    if (activeSubscribers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No active subscribers in this list" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create queue entries
    const queueEntries = activeSubscribers.map((subscriber: any) => ({
      tenant_id: tenantId,
      campaign_id: campaign.id,
      subscriber_id: subscriber.id,
      to_email: subscriber.email,
      subject: template.subject.replace("{{name}}", subscriber.name || ""),
      body_html: template.body_html.replace("{{name}}", subscriber.name || ""),
      body_text: template.body_text?.replace("{{name}}", subscriber.name || ""),
      scheduled_at: scheduleTime,
      status: "queued",
      metadata: { broadcast: true },
    }));

    // Insert in batches
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < queueEntries.length; i += BATCH_SIZE) {
      const batch = queueEntries.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from("email_send_queue")
        .insert(batch);
      
      if (insertError) {
        console.error("Error inserting batch:", insertError);
        continue;
      }
      insertedCount += batch.length;
    }

    // Update campaign status
    await supabase
      .from("email_marketing_campaigns")
      .update({ status: "active" })
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
