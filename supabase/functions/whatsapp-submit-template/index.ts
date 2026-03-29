import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, metaApiErrorResponse } from "../_shared/error-response.ts";

// ===== VERSION =====
const VERSION = "v1.0.0";
// ====================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Submits a WhatsApp message template to Meta for approval.
 * Called automatically when a notification rule with WhatsApp channel is created/updated.
 * 
 * Input: { rule_id, tenant_id }
 * 
 * Flow:
 * 1. Read the notification_rule to get the whatsapp_message
 * 2. Get the tenant's WABA ID from whatsapp_configs
 * 3. Convert the message into a Meta template format
 * 4. Submit to Meta's Message Templates API
 * 5. Save the submission record in whatsapp_template_submissions
 * 6. Update notification_rules with meta_template_status = 'pending'
 */

// Convert user-friendly variables to Meta template format
// {{customer_first_name}} -> {{1}}, {{order_number}} -> {{2}}, etc.
function convertToMetaTemplate(message: string): { body: string; variables: string[] } {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let index = 0;
  
  const body = message.replace(variablePattern, (_match, varName) => {
    if (!variables.includes(varName)) {
      variables.push(varName);
      index++;
    }
    const varIndex = variables.indexOf(varName) + 1;
    return `{{${varIndex}}}`;
  });
  
  return { body, variables };
}

// Generate a safe template name from rule name
function generateTemplateName(ruleName: string, tenantId: string): string {
  const safe = ruleName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 40);
  
  const suffix = tenantId.substring(0, 6);
  return `${safe}_${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { rule_id, tenant_id } = await req.json();

    if (!rule_id || !tenant_id) {
      return new Response(JSON.stringify({ success: false, error: "rule_id e tenant_id são obrigatórios" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[whatsapp-submit-template][${VERSION}] Rule: ${rule_id}, Tenant: ${tenant_id}`);

    // 1. Get the notification rule
    const { data: rule, error: ruleError } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("id", rule_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (ruleError || !rule) {
      return new Response(JSON.stringify({ success: false, error: "Regra não encontrada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const whatsappMessage = rule.whatsapp_message as string;
    if (!whatsappMessage) {
      return new Response(JSON.stringify({ success: false, error: "Regra não possui mensagem WhatsApp" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get WhatsApp config (WABA ID)
    const { data: waConfig, error: waError } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .eq("connection_status", "connected")
      .single();

    if (waError || !waConfig) {
      return new Response(JSON.stringify({ success: false, error: "WhatsApp Meta não configurado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wabaId = waConfig.waba_id;
    const accessToken = waConfig.access_token;

    if (!wabaId || !accessToken) {
      return new Response(JSON.stringify({ success: false, error: "WABA ID ou Access Token não configurado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Convert message to Meta template format
    const { body: templateBody, variables } = convertToMetaTemplate(whatsappMessage);
    const templateName = generateTemplateName(rule.name, tenant_id);

    // Get graph API version
    const { data: versionCred } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();
    const graphApiVersion = versionCred?.credential_value || "v21.0";

    // 4. Build Meta template payload
    const components: any[] = [
      {
        type: "BODY",
        text: templateBody,
        ...(variables.length > 0
          ? {
              example: {
                body_text: [variables.map((v) => {
                  // Provide example values for Meta review
                  const examples: Record<string, string> = {
                    customer_first_name: "João",
                    customer_name: "João Silva",
                    order_number: "#1234",
                    order_total: "R$ 99,90",
                    tracking_code: "BR123456789",
                    store_name: "Minha Loja",
                    pix_code: "00020126...",
                  };
                  return examples[v] || `Valor ${v}`;
                })],
              },
            }
          : {}),
      },
    ];

    const templatePayload = {
      name: templateName,
      language: "pt_BR",
      category: "UTILITY",
      components,
    };

    console.log(`[whatsapp-submit-template] Submitting template: ${templateName}`);
    console.log(`[whatsapp-submit-template] Payload:`, JSON.stringify(templatePayload));

    // 5. Submit to Meta
    const submitUrl = `https://graph.facebook.com/${graphApiVersion}/${wabaId}/message_templates`;
    const submitResponse = await fetch(submitUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templatePayload),
    });

    const submitResult = await submitResponse.json();

    if (submitResult.error) {
      console.error(`[whatsapp-submit-template] Meta error:`, submitResult.error);

      // If template already exists, try to get its status
      if (submitResult.error.code === 2388023 || submitResult.error.message?.includes("already exists")) {
        console.log(`[whatsapp-submit-template] Template already exists, checking status...`);

        // Update rule with existing template name
        await supabase
          .from("notification_rules")
          .update({ meta_template_name: templateName, meta_template_status: "pending" })
          .eq("id", rule_id);

        // Upsert submission record
        await supabase
          .from("whatsapp_template_submissions")
          .upsert({
            tenant_id,
            rule_id,
            template_name: templateName,
            template_body: whatsappMessage,
            meta_status: "pending",
            submitted_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,rule_id" });

        return new Response(JSON.stringify({
          success: true,
          status: "pending",
          template_name: templateName,
          message: "Template já existe na Meta, aguardando verificação de status",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save error
      await supabase
        .from("notification_rules")
        .update({ meta_template_status: "error" })
        .eq("id", rule_id);

      return metaApiErrorResponse(submitResult.error, corsHeaders, { module: 'whatsapp-submit-template' });
    }

    const metaTemplateId = submitResult.id;
    const metaStatus = submitResult.status || "PENDING";
    console.log(`[whatsapp-submit-template] Template submitted: id=${metaTemplateId}, status=${metaStatus}`);

    // 6. Save submission record
    await supabase
      .from("whatsapp_template_submissions")
      .upsert({
        tenant_id,
        rule_id,
        template_name: templateName,
        template_body: whatsappMessage,
        meta_template_id: metaTemplateId,
        meta_status: metaStatus === "APPROVED" ? "approved" : "pending",
        submitted_at: new Date().toISOString(),
        ...(metaStatus === "APPROVED" ? { approved_at: new Date().toISOString() } : {}),
      }, { onConflict: "tenant_id,rule_id" });

    // 7. Update the rule
    await supabase
      .from("notification_rules")
      .update({
        meta_template_name: templateName,
        meta_template_status: metaStatus === "APPROVED" ? "approved" : "pending",
      })
      .eq("id", rule_id);

    return new Response(JSON.stringify({
      success: true,
      template_name: templateName,
      meta_template_id: metaTemplateId,
      status: metaStatus,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error(`[whatsapp-submit-template] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'whatsapp-submit-template' });
  }
});
