import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { tagId, tenantId } = await req.json();

    if (!tagId || !tenantId) {
      return new Response(
        JSON.stringify({ error: "tagId and tenantId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all customers for this tenant
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id")
      .eq("tenant_id", tenantId);

    if (customersError) throw customersError;

    if (!customers || customers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No customers found", assigned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get existing assignments for this tag
    const { data: existingAssignments, error: existingError } = await supabase
      .from("customer_tag_assignments")
      .select("customer_id")
      .eq("tag_id", tagId);

    if (existingError) throw existingError;

    const existingCustomerIds = new Set((existingAssignments || []).map(a => a.customer_id));
    
    // Filter out customers that already have the tag
    const customersToAssign = customers.filter(c => !existingCustomerIds.has(c.id));

    if (customersToAssign.length === 0) {
      return new Response(
        JSON.stringify({ message: "All customers already have this tag", assigned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert in batches of 500
    const batchSize = 500;
    let totalAssigned = 0;

    for (let i = 0; i < customersToAssign.length; i += batchSize) {
      const batch = customersToAssign.slice(i, i + batchSize);
      const assignments = batch.map(customer => ({
        customer_id: customer.id,
        tag_id: tagId,
      }));

      const { error: insertError } = await supabase
        .from("customer_tag_assignments")
        .insert(assignments);

      if (insertError) throw insertError;
      totalAssigned += batch.length;
    }

    return new Response(
      JSON.stringify({ 
        message: `Tag assigned to ${totalAssigned} customers`, 
        assigned: totalAssigned,
        skipped: existingCustomerIds.size
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
