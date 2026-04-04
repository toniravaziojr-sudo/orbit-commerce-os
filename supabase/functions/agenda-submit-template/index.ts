import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, metaApiErrorResponse } from "../_shared/error-response.ts";

const VERSION = "v1.0.0";
const TEMPLATE_NAME = "agenda_lembrete";
const TEMPLATE_LANGUAGE = "pt_BR";
const TEMPLATE_CATEGORY = "UTILITY";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Submits the agenda_lembrete WhatsApp template to Meta for approval.
 * This is a standalone template (no notification rule) used by the Agenda agent
 * to send proactive reminders outside the 24-hour messaging window.
 *
 * Input: { tenant_id, action: "submit" | "check" }
 *
 * Template format:
 *   🔔 Lembrete: {{1}}
 *   📅 Vencimento: {{2}}
 *   📝 {{3}}
 */

const TEMPLATE_BODY = "🔔 Lembrete: {{1}}\n📅 Vencimento: {{2}}\n📝 {{3}}";
const TEMPLATE_EXAMPLES = [["Ligar pro fornecedor", "05/04/2026 às 10:00", "Negociar preço do lote novo"]];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { tenant_id, action } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[agenda-submit-template][${VERSION}] Action: ${action}, Tenant: ${tenant_id}`);

    // Get WhatsApp config
    const { data: waConfig } = await supabase
      .from("whatsapp_configs")
      .select("waba_id, access_token, connection_status")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .single();

    if (!waConfig?.waba_id || !waConfig?.access_token) {
      return new Response(JSON.stringify({
        success: false,
        error: "WhatsApp não configurado. Configure a integração antes de submeter o template.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get graph API version
    const { data: versionCred } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();
    const graphApiVersion = versionCred?.credential_value || "v21.0";

    if (action === "check") {
      return await checkTemplateStatus(supabase, tenant_id, waConfig, graphApiVersion);
    }

    // Default: submit
    return await submitTemplate(supabase, tenant_id, waConfig, graphApiVersion);

  } catch (error: any) {
    console.error(`[agenda-submit-template] Error:`, error);
    return errorResponse(error, corsHeaders, { module: "agenda-submit-template" });
  }
});

async function checkTemplateStatus(
  supabase: any,
  tenantId: string,
  waConfig: { waba_id: string; access_token: string },
  graphApiVersion: string,
) {
  // Check existing submission record
  const { data: submission } = await supabase
    .from("whatsapp_template_submissions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("template_name", TEMPLATE_NAME)
    .is("rule_id", null)
    .maybeSingle();

  // Also check Meta API directly
  const url = `https://graph.facebook.com/${graphApiVersion}/${waConfig.waba_id}/message_templates?name=${TEMPLATE_NAME}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${waConfig.access_token}` },
  });

  let metaStatus: string | null = null;
  let metaTemplateId: string | null = null;

  if (response.ok) {
    const result = await response.json();
    const template = result.data?.find((t: any) => t.name === TEMPLATE_NAME);
    if (template) {
      metaStatus = template.status?.toLowerCase();
      metaTemplateId = template.id;

      // Update our local record if status changed
      if (submission && submission.meta_status !== metaStatus) {
        const now = new Date().toISOString();
        const updateData: Record<string, any> = {
          meta_status: metaStatus,
          meta_template_id: metaTemplateId,
          last_checked_at: now,
        };
        if (metaStatus === "approved") updateData.approved_at = now;
        if (metaStatus === "rejected") updateData.rejected_at = now;

        await supabase
          .from("whatsapp_template_submissions")
          .update(updateData)
          .eq("id", submission.id);
      }
    }
  }

  return new Response(JSON.stringify({
    success: true,
    submission: submission ? {
      id: submission.id,
      meta_status: metaStatus || submission.meta_status,
      meta_template_id: metaTemplateId || submission.meta_template_id,
      submitted_at: submission.submitted_at,
      approved_at: submission.approved_at,
      rejected_at: submission.rejected_at,
      meta_reject_reason: submission.meta_reject_reason,
      last_checked_at: submission.last_checked_at,
    } : null,
    meta_status: metaStatus,
    meta_template_id: metaTemplateId,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function submitTemplate(
  supabase: any,
  tenantId: string,
  waConfig: { waba_id: string; access_token: string },
  graphApiVersion: string,
) {
  // Check if already submitted
  const { data: existing } = await supabase
    .from("whatsapp_template_submissions")
    .select("id, meta_status")
    .eq("tenant_id", tenantId)
    .eq("template_name", TEMPLATE_NAME)
    .is("rule_id", null)
    .maybeSingle();

  if (existing && ["approved", "pending"].includes(existing.meta_status)) {
    return new Response(JSON.stringify({
      success: true,
      status: existing.meta_status,
      message: existing.meta_status === "approved"
        ? "Template já aprovado pela Meta"
        : "Template já submetido, aguardando aprovação",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Build Meta template payload
  const templatePayload = {
    name: TEMPLATE_NAME,
    language: TEMPLATE_LANGUAGE,
    category: TEMPLATE_CATEGORY,
    components: [
      {
        type: "BODY",
        text: TEMPLATE_BODY,
        example: { body_text: TEMPLATE_EXAMPLES },
      },
    ],
  };

  console.log(`[agenda-submit-template] Submitting template: ${TEMPLATE_NAME}`);

  const submitUrl = `https://graph.facebook.com/${graphApiVersion}/${waConfig.waba_id}/message_templates`;
  const submitResponse = await fetch(submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${waConfig.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(templatePayload),
  });

  const submitResult = await submitResponse.json();

  if (submitResult.error) {
    console.error(`[agenda-submit-template] Meta error:`, submitResult.error);

    // Template already exists — just track it
    if (submitResult.error.code === 2388023 || submitResult.error.message?.includes("already exists")) {
      console.log(`[agenda-submit-template] Template already exists, tracking...`);

      const now = new Date().toISOString();
      if (existing) {
        await supabase
          .from("whatsapp_template_submissions")
          .update({ meta_status: "pending", submitted_at: now, last_checked_at: now })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("whatsapp_template_submissions")
          .insert({
            tenant_id: tenantId,
            rule_id: null,
            template_name: TEMPLATE_NAME,
            template_category: TEMPLATE_CATEGORY,
            template_language: TEMPLATE_LANGUAGE,
            template_body: TEMPLATE_BODY,
            meta_status: "pending",
            submitted_at: now,
          });
      }

      return new Response(JSON.stringify({
        success: true,
        status: "pending",
        message: "Template já existe na Meta, verificando status...",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return metaApiErrorResponse(submitResult.error, corsHeaders, { module: "agenda-submit-template" });
  }

  // Success
  const metaTemplateId = submitResult.id;
  const metaStatus = (submitResult.status || "PENDING").toLowerCase();
  const now = new Date().toISOString();

  console.log(`[agenda-submit-template] Submitted: id=${metaTemplateId}, status=${metaStatus}`);

  const submissionData = {
    tenant_id: tenantId,
    rule_id: null,
    template_name: TEMPLATE_NAME,
    template_category: TEMPLATE_CATEGORY,
    template_language: TEMPLATE_LANGUAGE,
    template_body: TEMPLATE_BODY,
    meta_template_id: metaTemplateId,
    meta_status: metaStatus === "approved" ? "approved" : "pending",
    submitted_at: now,
    ...(metaStatus === "approved" ? { approved_at: now } : {}),
  };

  if (existing) {
    await supabase
      .from("whatsapp_template_submissions")
      .update(submissionData)
      .eq("id", existing.id);
  } else {
    await supabase
      .from("whatsapp_template_submissions")
      .insert(submissionData);
  }

  return new Response(JSON.stringify({
    success: true,
    status: metaStatus,
    meta_template_id: metaTemplateId,
    message: metaStatus === "approved"
      ? "Template aprovado automaticamente!"
      : "Template submetido, aguardando aprovação da Meta",
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
