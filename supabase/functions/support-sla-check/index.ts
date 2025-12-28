import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SLAConfig {
  target_first_response_seconds: number | null;
  target_resolution_minutes: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all tenants with AI support config (contains SLA settings)
    const { data: configs } = await supabase
      .from("ai_support_config")
      .select("tenant_id, target_first_response_seconds, target_resolution_minutes");

    if (!configs || configs.length === 0) {
      console.log("No SLA configs found");
      return new Response(
        JSON.stringify({ success: true, alerts: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let alertsCreated = 0;
    const now = new Date();

    for (const config of configs) {
      const { tenant_id, target_first_response_seconds, target_resolution_minutes } = config as SLAConfig & { tenant_id: string };

      // Skip if no SLA targets configured
      if (!target_first_response_seconds && !target_resolution_minutes) {
        continue;
      }

      // Check for first response SLA breaches
      if (target_first_response_seconds) {
        const thresholdTime = new Date(now.getTime() - target_first_response_seconds * 1000);

        const { data: breachedConversations } = await supabase
          .from("conversations")
          .select("id, customer_name, created_at, assigned_to")
          .eq("tenant_id", tenant_id)
          .is("first_response_at", null)
          .in("status", ["open", "pending"])
          .lt("created_at", thresholdTime.toISOString());

        if (breachedConversations && breachedConversations.length > 0) {
          for (const conv of breachedConversations) {
            // Check if we already logged this breach recently (avoid spam)
            const { data: existingEvent } = await supabase
              .from("conversation_events")
              .select("id")
              .eq("conversation_id", conv.id)
              .eq("event_type", "sla_first_response_breached")
              .gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString()) // Last hour
              .maybeSingle();

            if (!existingEvent) {
              await supabase.from("conversation_events").insert({
                conversation_id: conv.id,
                tenant_id,
                event_type: "sla_first_response_breached",
                description: `SLA de primeira resposta excedido (${Math.round(target_first_response_seconds / 60)} min)`,
                actor_type: "system",
                metadata: {
                  sla_target_seconds: target_first_response_seconds,
                  created_at: conv.created_at,
                },
              });
              alertsCreated++;
              console.log(`SLA first response breached for conversation ${conv.id}`);
            }
          }
        }
      }

      // Check for resolution SLA breaches
      if (target_resolution_minutes) {
        const thresholdTime = new Date(now.getTime() - target_resolution_minutes * 60 * 1000);

        const { data: breachedConversations } = await supabase
          .from("conversations")
          .select("id, customer_name, created_at, assigned_to")
          .eq("tenant_id", tenant_id)
          .in("status", ["open", "pending"])
          .lt("created_at", thresholdTime.toISOString());

        if (breachedConversations && breachedConversations.length > 0) {
          for (const conv of breachedConversations) {
            // Check if we already logged this breach recently
            const { data: existingEvent } = await supabase
              .from("conversation_events")
              .select("id")
              .eq("conversation_id", conv.id)
              .eq("event_type", "sla_resolution_breached")
              .gte("created_at", new Date(now.getTime() - 60 * 60 * 1000).toISOString())
              .maybeSingle();

            if (!existingEvent) {
              await supabase.from("conversation_events").insert({
                conversation_id: conv.id,
                tenant_id,
                event_type: "sla_resolution_breached",
                description: `SLA de resolução excedido (${target_resolution_minutes} min)`,
                actor_type: "system",
                metadata: {
                  sla_target_minutes: target_resolution_minutes,
                  created_at: conv.created_at,
                },
              });
              alertsCreated++;
              console.log(`SLA resolution breached for conversation ${conv.id}`);
            }
          }
        }
      }

      // Check for approaching SLA (warning at 80%)
      if (target_first_response_seconds) {
        const warningThreshold = target_first_response_seconds * 0.8;
        const warningTime = new Date(now.getTime() - warningThreshold * 1000);
        const breachTime = new Date(now.getTime() - target_first_response_seconds * 1000);

        const { data: warningConversations } = await supabase
          .from("conversations")
          .select("id")
          .eq("tenant_id", tenant_id)
          .is("first_response_at", null)
          .in("status", ["open", "pending"])
          .lt("created_at", warningTime.toISOString())
          .gte("created_at", breachTime.toISOString());

        if (warningConversations && warningConversations.length > 0) {
          for (const conv of warningConversations) {
            const { data: existingEvent } = await supabase
              .from("conversation_events")
              .select("id")
              .eq("conversation_id", conv.id)
              .eq("event_type", "sla_first_response_warning")
              .gte("created_at", new Date(now.getTime() - 30 * 60 * 1000).toISOString())
              .maybeSingle();

            if (!existingEvent) {
              await supabase.from("conversation_events").insert({
                conversation_id: conv.id,
                tenant_id,
                event_type: "sla_first_response_warning",
                description: "SLA de primeira resposta próximo de ser excedido (80%)",
                actor_type: "system",
              });
              alertsCreated++;
            }
          }
        }
      }
    }

    console.log(`Created ${alertsCreated} SLA alerts`);

    return new Response(
      JSON.stringify({ success: true, alerts: alertsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SLA check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
