// =============================================
// MARKETING FORM SUBMIT — Único ponto de captura de leads
// =============================================
// Origens suportadas (source):
//   - "popup"             → cria/usa lista "Leads Popup"
//   - "footer_newsletter" → cria/usa lista "Leads Newsletter Rodapé"
//   - "support_chat"      → cria/usa lista "Leads site"
//   - "block:<page>"      → cria/usa lista "Leads Formulário - <page>"
//   - "newsletter_form"   → cria/usa lista "Leads Formulário"
// Regras:
//   - Idempotente por (tenant_id, name) WHERE is_system=true
//   - Garante tag obrigatória (FK NOT NULL) antes de criar a lista
//   - Logging explícito de qualquer erro interno (anti-falha-silenciosa)
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FormSubmitRequest {
  tenant_id: string;
  form_slug?: string;
  list_id?: string;
  fields: Record<string, string>;
  source?: string;
  // Optional context for block-based custom forms
  block_id?: string;
  page_slug?: string;
}

interface SystemListSpec {
  name: string;
  description: string;
  tagName: string;
  tagColor: string;
  tagDescription: string;
}

function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

/**
 * Returns the system list specification for a given source.
 * Returns null when no auto-list should be created (e.g., when caller already passed list_id).
 */
function resolveSystemListSpec(
  source: string | undefined,
  pageSlug: string | undefined,
): SystemListSpec | null {
  if (!source) return null;

  if (source === "popup") {
    return {
      name: "Leads Popup",
      description: "Leads capturados pelo popup de newsletter",
      tagName: "Leads Popup",
      tagColor: "#8B5CF6",
      tagDescription: "Leads capturados pelo popup de newsletter",
    };
  }
  if (source === "footer_newsletter") {
    return {
      name: "Leads Newsletter Rodapé",
      description: "Leads capturados pela newsletter do rodapé",
      tagName: "Leads Newsletter Rodapé",
      tagColor: "#0EA5E9",
      tagDescription: "Leads capturados pela newsletter do rodapé",
    };
  }
  if (source === "support_chat") {
    return {
      name: "Leads site",
      description: "Leads capturados pelo chat do site",
      tagName: "Leads site",
      tagColor: "#6366F1",
      tagDescription: "Leads capturados pelo chat do site",
    };
  }
  if (source.startsWith("block:") || source === "newsletter_form") {
    const pageLabel = (pageSlug || "").trim();
    if (pageLabel) {
      const pretty = pageLabel.charAt(0).toUpperCase() + pageLabel.slice(1);
      return {
        name: `Leads Formulário - ${pretty}`,
        description: `Leads capturados pelo formulário inserido na página "${pretty}"`,
        tagName: `Leads Formulário - ${pretty}`,
        tagColor: "#F59E0B",
        tagDescription: `Leads do formulário em "${pretty}"`,
      };
    }
    return {
      name: "Leads Formulário",
      description: "Leads capturados por formulário customizado da loja",
      tagName: "Leads Formulário",
      tagColor: "#F59E0B",
      tagDescription: "Leads capturados por formulário customizado",
    };
  }
  return null;
}

/**
 * Idempotently ensures a system list exists for the given tenant + spec.
 * Uses unique index (tenant_id, name) WHERE is_system = true.
 * Returns the list_id (existing or newly created), or null on failure.
 */
async function ensureSystemList(
  supabase: any,
  tenantId: string,
  spec: SystemListSpec,
): Promise<string | null> {
  // 1. Try to find existing system list by name
  const { data: existing, error: findErr } = await supabase
    .from("email_marketing_lists")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", spec.name)
    .eq("is_system", true)
    .maybeSingle();

  if (findErr) {
    console.error("[ensureSystemList] find error:", findErr);
  }
  if (existing?.id) return existing.id;

  // 2. Ensure tag exists (FK is NOT NULL on email_marketing_lists.tag_id)
  let tagId: string | null = null;
  const { data: existingTag, error: tagFindErr } = await supabase
    .from("customer_tags")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", spec.tagName)
    .maybeSingle();
  if (tagFindErr) {
    console.error("[ensureSystemList] tag find error:", tagFindErr);
  }
  if (existingTag?.id) {
    tagId = existingTag.id;
  } else {
    const { data: newTag, error: tagErr } = await supabase
      .from("customer_tags")
      .insert({
        tenant_id: tenantId,
        name: spec.tagName,
        color: spec.tagColor,
        description: spec.tagDescription,
      })
      .select("id")
      .single();
    if (tagErr) {
      console.error("[ensureSystemList] tag insert error:", tagErr);
      return null;
    }
    tagId = newTag?.id ?? null;
  }
  if (!tagId) return null;

  // 3. Create the list (handle race via unique index)
  const { data: created, error: createErr } = await supabase
    .from("email_marketing_lists")
    .insert({
      tenant_id: tenantId,
      name: spec.name,
      description: spec.description,
      tag_id: tagId,
      is_system: true,
    })
    .select("id")
    .single();

  if (createErr) {
    // Race condition: another request created the same list. Re-fetch.
    const { data: race } = await supabase
      .from("email_marketing_lists")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", spec.name)
      .eq("is_system", true)
      .maybeSingle();
    if (race?.id) return race.id;
    console.error("[ensureSystemList] create error:", createErr);
    return null;
  }
  return created?.id ?? null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: FormSubmitRequest = await req.json().catch(() => ({} as FormSubmitRequest));
    const { tenant_id, form_slug, list_id, fields, source, block_id, page_slug } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const email = fields?.email ? normalizeEmail(fields.email) : null;
    if (!email || !email.includes("@")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid email is required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let effectiveListId = list_id;
    let formData: any = null;
    let tagsToAdd: string[] = [];

    // 1) Forms registered via Builder (custom slug, persisted in email_marketing_forms)
    if (form_slug && !form_slug.startsWith("popup-") && form_slug !== "footer_newsletter") {
      const { data: form, error: formError } = await supabase
        .from("email_marketing_forms")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("slug", form_slug)
        .eq("status", "published")
        .maybeSingle();

      if (formError) {
        console.error("[marketing-form-submit] form lookup error:", formError);
      }
      if (form) {
        formData = form;
        effectiveListId = form.list_id || effectiveListId;
        tagsToAdd = form.tags_to_add || [];
      }
    }

    // 2) Auto-create system list per source if no list provided
    if (!effectiveListId) {
      const spec = resolveSystemListSpec(source, page_slug);
      if (spec) {
        const sysId = await ensureSystemList(supabase, tenant_id, spec);
        if (sysId) effectiveListId = sysId;
      }
    }

    // 3) Persist subscriber via canonical RPC (Lead ≠ Cliente)
    const { data: syncResult, error: syncError } = await supabase.rpc(
      "upsert_subscriber_only",
      {
        p_tenant_id: tenant_id,
        p_email: email,
        p_name: fields.name || null,
        p_phone: fields.phone || null,
        p_birth_date: fields.birth_date || null,
        p_source: source || (form_slug ? `form:${form_slug}` : "newsletter_form"),
        p_list_id: effectiveListId || null,
      },
    );

    if (syncError) {
      console.error("[marketing-form-submit] upsert_subscriber_only error:", syncError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save subscriber" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subscriberId = Array.isArray(syncResult)
      ? syncResult[0]?.subscriber_id
      : (syncResult as any)?.subscriber_id;

    // 4) Optional legacy tags from email_marketing_forms.tags_to_add
    if (tagsToAdd.length > 0 && subscriberId) {
      const { data: subscriber } = await supabase
        .from("email_marketing_subscribers")
        .select("tags")
        .eq("id", subscriberId)
        .maybeSingle();

      if (subscriber) {
        const existingTags = (subscriber as any).tags || [];
        const newTags = [...new Set([...existingTags, ...tagsToAdd])];
        await supabase
          .from("email_marketing_subscribers")
          .update({ tags: newTags })
          .eq("id", subscriberId);
      }
    }

    // 5) Audit event
    await supabase.from("email_events").insert({
      tenant_id,
      subscriber_id: subscriberId,
      event_type: "form_submitted",
      data: {
        form_id: formData?.id,
        form_slug,
        list_id: effectiveListId,
        source,
        block_id,
        page_slug,
        fields,
      },
    });

    // 6) Trigger automations
    if (subscriberId) {
      try {
        await triggerAutomations(supabase, tenant_id, "subscribed", subscriberId);
      } catch (autErr) {
        console.error("[marketing-form-submit] triggerAutomations error:", autErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscriber_id: subscriberId,
        list_id: effectiveListId,
        message: formData?.success_message || "Obrigado por se inscrever!",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[marketing-form-submit] unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function triggerAutomations(
  supabase: any,
  tenantId: string,
  triggerType: string,
  subscriberId: string,
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
        .maybeSingle();
      if (!template) continue;

      const { data: subscriber } = await supabase
        .from("email_marketing_subscribers")
        .select("email, name")
        .eq("id", subscriberId)
        .maybeSingle();
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
