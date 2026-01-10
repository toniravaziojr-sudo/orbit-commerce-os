import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mercado Livre sends notifications as POST with JSON body
    const notification = await req.json();
    
    console.log("Received ML notification:", JSON.stringify(notification));

    // ML notification structure:
    // { resource: "/orders/123", user_id: 123, topic: "orders", application_id: 123, attempts: 1, sent: "2024-01-01T00:00:00.000Z", received: "2024-01-01T00:00:00.000Z" }
    const { resource, user_id, topic, application_id } = notification;

    if (!resource || !user_id || !topic) {
      console.error("Invalid notification format:", notification);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid notification format" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the connection for this ML user
    const { data: connection, error: connError } = await supabase
      .from("marketplace_connections")
      .select("*")
      .eq("marketplace", "mercadolivre")
      .eq("external_account_id", String(user_id))
      .eq("status", "active")
      .single();

    if (connError || !connection) {
      console.error("Connection not found for user_id:", user_id, connError);
      // Still return 200 to avoid ML retrying indefinitely
      return new Response(
        JSON.stringify({ success: false, error: "Connection not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the notification for processing
    await supabase.from("marketplace_sync_logs").insert({
      tenant_id: connection.tenant_id,
      connection_id: connection.id,
      marketplace: "mercadolivre",
      sync_type: `webhook_${topic}`,
      status: "pending",
      details: { notification, resource, topic },
    });

    // TODO: Process different notification topics
    // - orders: new order, order status change
    // - questions: new question on listing
    // - messages: new post-sale message
    // - items: listing changes
    // - payments: payment status changes

    console.log(`Logged ${topic} notification for tenant ${connection.tenant_id}`);

    return new Response(
      JSON.stringify({ success: true, message: "Notification received" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", error);
    // Return 200 even on error to prevent ML from retrying
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
