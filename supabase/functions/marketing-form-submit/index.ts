import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FormSubmitRequest {
  tenant_id: string;
  form_slug?: string;
  list_id?: string;
  fields: Record<string, string>;
  source?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, form_slug, list_id, fields, source }: FormSubmitRequest = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email
    const email = fields.email ? normalizeEmail(fields.email) : null;
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid email is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let effectiveListId = list_id;
    let formData = null;
    let tagsToAdd: string[] = [];

    // If form_slug provided, fetch form config
    if (form_slug) {
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

      formData = form;
      effectiveListId = form.list_id || effectiveListId;
      tagsToAdd = form.tags_to_add || [];
    }

    // Get the tag_id from the list if exists
    let tagId: string | null = null;
    if (effectiveListId) {
      const { data: listData } = await supabase
        .from("email_marketing_lists")
        .select("id, tag_id")
        .eq("id", effectiveListId)
        .single();
      
      if (listData?.tag_id) {
        tagId = listData.tag_id;
      }
    }

    // Use the canonical sync function to upsert subscriber + customer + apply tag
    const { data: syncResult, error: syncError } = await supabase.rpc(
      "sync_subscriber_to_customer_with_tag",
      {
        p_tenant_id: tenant_id,
        p_email: email,
        p_name: fields.name || null,
        p_phone: fields.phone || null,
        p_birth_date: fields.birth_date || null,
        p_source: source || (form_slug ? `form:${form_slug}` : "newsletter_form"),
        p_list_id: effectiveListId || null,
        p_tag_id: tagId,
      }
    );

    if (syncError) {
      console.error("Error syncing subscriber:", syncError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save subscriber" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscriberId = syncResult?.subscriber_id;

    // Add additional tags if form has tags_to_add (legacy support)
    if (tagsToAdd.length > 0 && subscriberId) {
      const { data: subscriber } = await supabase
        .from("email_marketing_subscribers")
        .select("tags")
        .eq("id", subscriberId)
        .single();

      if (subscriber) {
        const existingTags = subscriber.tags || [];
        const newTags = [...new Set([...existingTags, ...tagsToAdd])];
        await supabase
          .from("email_marketing_subscribers")
          .update({ tags: newTags })
          .eq("id", subscriberId);
      }
    }

    // Record event
    await supabase.from("email_events").insert({
      tenant_id,
      subscriber_id: subscriberId,
      event_type: "form_submitted",
      data: { 
        form_id: formData?.id, 
        form_slug, 
        list_id: effectiveListId,
        fields 
      },
    });

    // Check for automation triggers
    if (subscriberId) {
      await triggerAutomations(supabase, tenant_id, "subscribed", subscriberId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriber_id: subscriberId,
        message: formData?.success_message || "Obrigado por se inscrever!",
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
