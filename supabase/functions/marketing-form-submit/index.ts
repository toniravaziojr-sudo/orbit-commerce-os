import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FormSubmitRequest {
  tenant_id: string;
  form_slug: string;
  fields: Record<string, string>;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, form_slug, fields }: FormSubmitRequest = await req.json();

    if (!tenant_id || !form_slug) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id and form_slug are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the form
    const { data: form, error: formError } = await supabase
      .from("email_marketing_forms")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("slug", form_slug)
      .eq("status", "published")
      .single();

    if (formError || !form) {
      return new Response(
        JSON.stringify({ success: false, error: "Form not found or not published" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate required fields
    const email = fields.email?.toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid email is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert subscriber
    const { data: subscriber, error: subError } = await supabase
      .from("email_marketing_subscribers")
      .upsert(
        {
          tenant_id,
          email,
          name: fields.name || null,
          phone: fields.phone || null,
          source: `form:${form_slug}`,
          metadata: { form_id: form.id, submitted_fields: fields },
          tags: form.tags_to_add || [],
        },
        { onConflict: "tenant_id,email" }
      )
      .select()
      .single();

    if (subError) {
      console.error("Error upserting subscriber:", subError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save subscriber" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add to list if form has list_id
    if (form.list_id && subscriber) {
      await supabase
        .from("email_marketing_list_members")
        .upsert(
          {
            tenant_id,
            list_id: form.list_id,
            subscriber_id: subscriber.id,
          },
          { onConflict: "tenant_id,list_id,subscriber_id" }
        );
    }

    // Add tags if form has tags_to_add
    if (form.tags_to_add?.length > 0 && subscriber) {
      const existingTags = subscriber.tags || [];
      const newTags = [...new Set([...existingTags, ...form.tags_to_add])];
      await supabase
        .from("email_marketing_subscribers")
        .update({ tags: newTags })
        .eq("id", subscriber.id);
    }

    // Record event
    await supabase.from("email_events").insert({
      tenant_id,
      subscriber_id: subscriber?.id,
      event_type: "form_submitted",
      data: { form_id: form.id, form_slug, fields },
    });

    // Check for automation triggers
    if (subscriber?.id) {
      await triggerAutomations(supabase, tenant_id, "subscribed", subscriber.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: form.success_message || "Obrigado por se inscrever!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Form submit error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function triggerAutomations(
  supabase: any,
  tenantId: string,
  triggerType: string,
  subscriberId: string
) {
  // Find active automations with this trigger
  const { data: automations } = await supabase
    .from("email_marketing_campaigns")
    .select("*, email_marketing_campaign_steps(*)")
    .eq("tenant_id", tenantId)
    .eq("type", "automation")
    .eq("status", "active")
    .eq("trigger_type", triggerType);

  if (!automations?.length) return;

  for (const automation of automations) {
    const steps = (automation as any).email_marketing_campaign_steps || [];
    for (const step of steps) {
      if (!step.template_id) continue;

      // Get template
      const { data: template } = await supabase
        .from("email_marketing_templates")
        .select("*")
        .eq("id", step.template_id)
        .single();

      if (!template) continue;

      // Get subscriber email
      const { data: subscriber } = await supabase
        .from("email_marketing_subscribers")
        .select("email, name")
        .eq("id", subscriberId)
        .single();

      if (!subscriber) continue;

      // Schedule email
      const scheduledAt = new Date(Date.now() + (step.delay_minutes || 0) * 60000);
      
      await supabase.from("email_send_queue").insert({
        tenant_id: tenantId,
        campaign_id: (automation as any).id,
        subscriber_id: subscriberId,
        to_email: (subscriber as any).email,
        subject: (template as any).subject.replace("{{name}}", (subscriber as any).name || ""),
        body_html: (template as any).body_html.replace("{{name}}", (subscriber as any).name || ""),
        body_text: (template as any).body_text?.replace("{{name}}", (subscriber as any).name || ""),
        scheduled_at: scheduledAt.toISOString(),
        status: "queued",
        metadata: { step_id: step.id, step_index: step.step_index },
      });
    }
  }
}
