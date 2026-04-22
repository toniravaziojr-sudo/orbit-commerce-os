import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse, metaApiErrorResponse } from "../_shared/error-response.ts";
import {
  renderTemplate,
  assertNoPlaceholders,
  renderForInternalLog,
  TemplateRenderError,
} from "../_shared/template-renderer.ts";
// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.2.0"; // Phase 3 — strict template render + no [Template:] leakage
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendMessageParams {
  tenant_id: string;
  phone: string;
  message: string;
  template_name?: string;
  template_language?: string;
  template_components?: any[];
  /** Optional raw template body (with {{vars}}) used to render the final visible content. */
  template_body?: string;
  /** Optional payload of variables to render `template_body` with. */
  template_payload?: Record<string, unknown>;
  /** Optional: when set, sends an image message (link + optional caption). Requires 24h window like text. */
  image_url?: string;
  /** Optional caption for the image (max 1024 chars per WhatsApp). */
  image_caption?: string;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-whatsapp-send][${traceId}] Request received (v${VERSION})`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const params: SendMessageParams = await req.json();
    const { tenant_id, phone, message, template_name, template_language, template_components, template_body, template_payload } = params;

    if (!tenant_id || !phone) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id e phone são obrigatórios" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message && !template_name) {
      return new Response(JSON.stringify({ success: false, error: "message ou template_name é obrigatório" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[meta-whatsapp-send][${traceId}] Tenant: ${tenant_id}, Phone: ${phone}`);

    // Get tenant's Meta WhatsApp config
    const { data: config, error: configError } = await supabase
      .from("whatsapp_configs")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("provider", "meta")
      .eq("connection_status", "connected")
      .single();

    if (configError || !config) {
      console.error(`[meta-whatsapp-send][${traceId}] No Meta config for tenant`);
      return new Response(JSON.stringify({ success: false, error: "WhatsApp Meta não configurado ou desconectado" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone_number_id, access_token, token_expires_at } = config;

    if (!phone_number_id || !access_token) {
      return new Response(JSON.stringify({ success: false, error: "Configuração incompleta do WhatsApp Meta" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if token is expired
    if (token_expires_at && new Date(token_expires_at) < new Date()) {
      console.error(`[meta-whatsapp-send][${traceId}] Token expired`);
      await supabase
        .from("whatsapp_configs")
        .update({ connection_status: "token_expired", last_error: "Token expirado" })
        .eq("id", config.id);

      return new Response(JSON.stringify({ success: false, error: "Token do WhatsApp expirado. Reconecte sua conta." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= 24h WINDOW AUDIT (Phase 5 — Sales Mode) =============
    // Mensagem livre (sem template) só pode ser enviada se houver mensagem do cliente nas últimas 24h.
    if (!template_name) {
      try {
        const { data: convo } = await supabase
          .from("conversations")
          .select("id, last_customer_message_at")
          .eq("tenant_id", tenant_id)
          .eq("channel_type", "whatsapp")
          .eq("customer_phone", phone)
          .order("last_customer_message_at", { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();

        const lastInbound = convo?.last_customer_message_at ? new Date(convo.last_customer_message_at) : null;
        const ageMs = lastInbound ? Date.now() - lastInbound.getTime() : Infinity;
        const WINDOW_MS = 24 * 60 * 60 * 1000;

        if (ageMs > WINDOW_MS) {
          console.warn(`[meta-whatsapp-send][${traceId}] Outside 24h window (last_inbound=${lastInbound?.toISOString() ?? "never"}). Free text BLOCKED.`);
          await supabase.from("whatsapp_messages").insert({
            tenant_id,
            recipient_phone: phone,
            message_type: "text",
            message_content: (message ?? "").substring(0, 500),
            status: "failed",
            error_message: "Fora da janela de 24h: só é permitido enviar template aprovado.",
          });
          return new Response(JSON.stringify({
            success: false,
            error: "Fora da janela de 24h do WhatsApp. Use um template aprovado para reabrir a conversa.",
            code: "OUTSIDE_24H_WINDOW",
            last_customer_message_at: lastInbound?.toISOString() ?? null,
          }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (winErr) {
        console.warn(`[meta-whatsapp-send][${traceId}] 24h window check failed (non-fatal):`, winErr);
      }
    }

    // ============= PHASE 3: Render final visible content (no placeholders!) =============
    // For text messages: render `message` against `template_payload` if vars exist.
    // For template messages: render `template_body` to build the timeline-visible content.
    let visibleContent: string;
    try {
      if (template_name) {
        // Template path — Meta API receives the template name + params; the timeline must
        // show the rendered body (or a clean fallback if no body was provided).
        const source = template_body && template_body.length > 0 ? template_body : (message ?? "");
        if (source && source.length > 0) {
          const rendered = renderTemplate(source, template_payload ?? {}, { mode: "strict" });
          assertNoPlaceholders(rendered.text, { stage: "meta-whatsapp-send/template", templateName: template_name });
          visibleContent = rendered.text;
        } else {
          visibleContent = "Mensagem do sistema";
        }
      } else {
        // Plain text path
        const rendered = renderTemplate(message ?? "", template_payload ?? {}, { mode: "strict" });
        assertNoPlaceholders(rendered.text, { stage: "meta-whatsapp-send/text" });
        visibleContent = rendered.text;
      }
    } catch (err) {
      if (err instanceof TemplateRenderError) {
        console.error(`[meta-whatsapp-send][${traceId}] Template render blocked:`, err.message);
        // Internal traceable record — DO NOT send to customer, DO NOT pollute timeline as bubble
        const safeForLog = renderForInternalLog(template_body ?? message ?? "", template_payload ?? {});
        await supabase.from("whatsapp_messages").insert({
          tenant_id,
          recipient_phone: phone,
          message_type: template_name ? "template" : "text",
          message_content: safeForLog.text.substring(0, 500),
          status: "failed",
          error_message: `Template render blocked (missing: ${err.missing.join(", ") || "—"})`,
        });
        return new Response(JSON.stringify({
          success: false,
          error: "Mensagem bloqueada: variáveis obrigatórias ausentes no template",
          missing: err.missing,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw err;
    }

    // Get graph API version from platform credentials
    const { data: versionCred } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();

    const graphApiVersion = versionCred?.credential_value || "v21.0";

    // Format phone number (remove non-digits, ensure country code)
    let formattedPhone = phone.replace(/\D/g, "");
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "55" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("55") && formattedPhone.length <= 11) {
      formattedPhone = "55" + formattedPhone;
    }

    console.log(`[meta-whatsapp-send][${traceId}] Sending to: ${formattedPhone}`);

    // Build message payload
    let messagePayload: any;

    if (template_name) {
      const templateObj: any = {
        name: template_name,
        language: { code: template_language || "pt_BR" },
      };
      if (template_components && template_components.length > 0) {
        templateObj.components = template_components;
      }
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: templateObj,
      };
    } else {
      messagePayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: visibleContent },
      };
    }

    // Send message via Meta Graph API
    const sendUrl = `https://graph.facebook.com/${graphApiVersion}/${phone_number_id}/messages`;

    console.log(`[meta-whatsapp-send][${traceId}] URL: ${sendUrl}`);

    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const sendResult = await sendResponse.json();

    if (sendResult.error) {
      console.error(`[meta-whatsapp-send][${traceId}] Send error:`, sendResult.error);

      await supabase.from("whatsapp_messages").insert({
        tenant_id,
        recipient_phone: formattedPhone,
        message_type: template_name ? "template" : "text",
        message_content: visibleContent.substring(0, 500),
        status: "failed",
        error_message: sendResult.error.message,
      });

      return metaApiErrorResponse(sendResult.error, corsHeaders, { module: 'whatsapp-send' });
    }

    const messageId = sendResult.messages?.[0]?.id;
    console.log(`[meta-whatsapp-send][${traceId}] Message sent - ID: ${messageId}`);

    // Log successful message — RENDERED content only, no [Template: ...] prefix
    await supabase.from("whatsapp_messages").insert({
      tenant_id,
      recipient_phone: formattedPhone,
      message_type: template_name ? "template" : "text",
      message_content: visibleContent.substring(0, 500),
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: messageId,
    });

    return new Response(JSON.stringify({
      success: true,
      data: {
        message_id: messageId,
        phone: formattedPhone,
        rendered_content: visibleContent,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[meta-whatsapp-send][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: 'whatsapp-send', action: 'send' });
  }
});
