import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all unassigned open conversations
    const { data: unassignedConversations, error: convError } = await supabase
      .from("conversations")
      .select("id, tenant_id, channel_type, created_at")
      .is("assigned_to", null)
      .eq("status", "open")
      .order("created_at", { ascending: true });

    if (convError) {
      console.error("Error fetching unassigned conversations:", convError);
      throw convError;
    }

    if (!unassignedConversations || unassignedConversations.length === 0) {
      console.log("No unassigned conversations found");
      return new Response(
        JSON.stringify({ success: true, assigned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${unassignedConversations.length} unassigned conversations`);

    let assignedCount = 0;

    // Group by tenant
    const byTenant = unassignedConversations.reduce((acc, conv) => {
      if (!acc[conv.tenant_id]) acc[conv.tenant_id] = [];
      acc[conv.tenant_id].push(conv);
      return acc;
    }, {} as Record<string, typeof unassignedConversations>);

    for (const [tenantId, conversations] of Object.entries(byTenant)) {
      // Get available agents for this tenant (users with owner/admin role)
      const { data: agents } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("tenant_id", tenantId)
        .in("role", ["owner", "admin"]);

      if (!agents || agents.length === 0) {
        console.log(`No agents found for tenant ${tenantId}`);
        continue;
      }

      // Get current workload for each agent
      const agentIds = agents.map(a => a.user_id);
      const { data: workloads } = await supabase
        .from("conversations")
        .select("assigned_to")
        .in("assigned_to", agentIds)
        .in("status", ["open", "pending"]);

      // Count conversations per agent
      const workloadMap: Record<string, number> = {};
      agentIds.forEach(id => workloadMap[id] = 0);
      workloads?.forEach(w => {
        if (w.assigned_to) {
          workloadMap[w.assigned_to] = (workloadMap[w.assigned_to] || 0) + 1;
        }
      });

      // Round-robin assignment based on workload
      for (const conv of conversations) {
        // Find agent with lowest workload
        const [selectedAgent] = Object.entries(workloadMap)
          .sort(([, a], [, b]) => a - b)[0];

        if (!selectedAgent) continue;

        // Assign conversation
        const { error: assignError } = await supabase
          .from("conversations")
          .update({
            assigned_to: selectedAgent,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", conv.id);

        if (assignError) {
          console.error(`Error assigning conversation ${conv.id}:`, assignError);
          continue;
        }

        // Log event
        await supabase.from("conversation_events").insert({
          conversation_id: conv.id,
          tenant_id: tenantId,
          event_type: "auto_assigned",
          description: "Conversa atribuída automaticamente",
          actor_type: "system",
          metadata: { assigned_to: selectedAgent },
        });

        // Increment workload counter for round-robin
        workloadMap[selectedAgent]++;
        assignedCount++;

        console.log(`Assigned conversation ${conv.id} to agent ${selectedAgent}`);
      }
    }

    console.log(`Auto-assigned ${assignedCount} conversations`);

    return new Response(
      JSON.stringify({ success: true, assigned: assignedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Auto-assign error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
