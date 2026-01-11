import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface QuizSubmitRequest {
  tenant_id: string;
  quiz_slug: string;
  answers: Record<string, any>;
  metadata?: Record<string, any>;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, quiz_slug, answers, metadata = {} }: QuizSubmitRequest = await req.json();

    if (!tenant_id || !quiz_slug) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id and quiz_slug are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the quiz with questions
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*, quiz_questions(*)")
      .eq("tenant_id", tenant_id)
      .eq("slug", quiz_slug)
      .eq("status", "published")
      .single();

    if (quizError || !quiz) {
      return new Response(
        JSON.stringify({ success: false, error: "Quiz not found or not published" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract email/name from answers if present
    let email: string | null = null;
    let name: string | null = null;
    let phone: string | null = null;
    const tagsToAdd: string[] = [...(quiz.tags_to_add || [])];

    const questions = quiz.quiz_questions || [];
    for (const question of questions) {
      const answer = answers[(question as any).id];
      if (!answer) continue;

      if ((question as any).type === "email") {
        email = String(answer).toLowerCase().trim();
      } else if ((question as any).type === "name") {
        name = String(answer).trim();
      } else if ((question as any).type === "phone") {
        phone = String(answer).trim();
      }

      // Apply tag mappings from question
      const mapping = (question as any).mapping;
      if (mapping?.tags && Array.isArray(mapping.tags)) {
        tagsToAdd.push(...mapping.tags);
      }
    }

    let subscriberId: string | null = null;

    // Create/update subscriber if we have email
    if (email && email.includes("@")) {
      const { data: subscriber, error: subError } = await supabase
        .from("email_marketing_subscribers")
        .upsert(
          {
            tenant_id,
            email,
            name: name || undefined,
            phone: phone || undefined,
            source: `quiz:${quiz_slug}`,
            metadata: { quiz_id: quiz.id, last_quiz_at: new Date().toISOString() },
          },
          { onConflict: "tenant_id,email" }
        )
        .select()
        .single();

      if (!subError && subscriber) {
        subscriberId = subscriber.id;

        // Add tags
        if (tagsToAdd.length > 0) {
          const existingTags = subscriber.tags || [];
          const uniqueTags = [...new Set([...existingTags, ...tagsToAdd])];
          await supabase
            .from("email_marketing_subscribers")
            .update({ tags: uniqueTags })
            .eq("id", subscriber.id);
        }

        // Add to list if quiz has list_id
        if (quiz.list_id) {
          await supabase
            .from("email_marketing_list_members")
            .upsert(
              {
                tenant_id,
                list_id: quiz.list_id,
                subscriber_id: subscriber.id,
              },
              { onConflict: "tenant_id,list_id,subscriber_id" }
            );
        }
      }
    }

    // Save quiz response
    const { data: response, error: responseError } = await supabase
      .from("quiz_responses")
      .insert({
        tenant_id,
        quiz_id: quiz.id,
        subscriber_id: subscriberId,
        answers,
        metadata,
      })
      .select()
      .single();

    if (responseError) {
      console.error("Error saving quiz response:", responseError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save response" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record event
    await supabase.from("email_events").insert({
      tenant_id,
      subscriber_id: subscriberId,
      event_type: "quiz_completed",
      data: { quiz_id: quiz.id, quiz_slug, response_id: response.id },
    });

    // Trigger automations for quiz_completed
    if (subscriberId) {
      await triggerAutomations(supabase, tenant_id, "quiz_completed", subscriberId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: quiz.outro_text || "Obrigado por completar o quiz!",
        response_id: response.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Quiz submit error:", error);
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

      const { data: template } = await supabase
        .from("email_marketing_templates")
        .select("*")
        .eq("id", step.template_id)
        .single();

      if (!template) continue;

      const { data: subscriber } = await supabase
        .from("email_marketing_subscribers")
        .select("email, name")
        .eq("id", subscriberId)
        .single();

      if (!subscriber) continue;

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
