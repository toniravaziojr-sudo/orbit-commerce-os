import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SendGrid API helper
async function sendEmailViaSendGrid(
  apiKey: string,
  from: { email: string; name: string },
  to: string,
  subject: string,
  text: string,
  replyTo?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const payload: any = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from.email, name: from.name },
      subject,
      content: [{ type: "text/plain", value: text }],
    };

    if (replyTo) {
      payload.reply_to = { email: replyTo };
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[support-send-message] SendGrid error:", response.status, errorText);
      return { success: false, error: `SendGrid error: ${response.status} - ${errorText}` };
    }

    const messageId = response.headers.get("X-Message-Id") || undefined;
    return { success: true, messageId };
  } catch (error: any) {
    console.error("[support-send-message] SendGrid exception:", error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, channel_type } = await req.json();

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: "message_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get message details
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select(`
        *,
        conversation:conversations(*)
      `)
      .eq("id", message_id)
      .single();

    if (msgError || !message) {
      console.error("Message not found:", msgError);
      return new Response(
        JSON.stringify({ error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conversation = message.conversation;
    const channelToUse = channel_type || conversation.channel_type;

    console.log(`Sending message ${message_id} via ${channelToUse}`);

    let success = false;
    let externalMessageId: string | null = null;
    let deliveryStatus = "sent";
    let error: string | null = null;

    // Route to appropriate channel handler
    switch (channelToUse) {
      case "whatsapp": {
        // Get WhatsApp config for tenant - check for Meta first, then Z-API
        const { data: waConfig } = await supabase
          .from("whatsapp_configs")
          .select("*")
          .eq("tenant_id", message.tenant_id)
          .eq("is_enabled", true)
          .eq("connection_status", "connected")
          .single();

        if (!waConfig) {
          error = "WhatsApp not configured or disconnected";
          break;
        }

        // Route based on provider
        if (waConfig.provider === "meta") {
          // Send via Meta WhatsApp Cloud API
          const { data: metaResult, error: metaError } = await supabase.functions.invoke("meta-whatsapp-send", {
            body: {
              tenant_id: message.tenant_id,
              phone: conversation.customer_phone,
              message: message.content,
            },
          });

          if (metaError || !metaResult?.success) {
            error = metaError?.message || metaResult?.error || "Failed to send via Meta WhatsApp";
          } else {
            success = true;
            externalMessageId = metaResult.data?.message_id || null;
            deliveryStatus = "sent";
          }
        } else {
          // Send via Z-API (legacy/default)
          const { data: waResult, error: waError } = await supabase.functions.invoke("whatsapp-send", {
            body: {
              tenant_id: message.tenant_id,
              to: conversation.customer_phone,
              message: message.content,
            },
          });

          if (waError || !waResult?.success) {
            error = waError?.message || waResult?.error || "Failed to send WhatsApp";
          } else {
            success = true;
            externalMessageId = waResult.message_id;
            deliveryStatus = "sent";
          }
        }
        break;
      }

      case "email": {
        // Get email config for tenant
        const { data: emailConfig } = await supabase
          .from("email_provider_configs")
          .select("*")
          .eq("tenant_id", message.tenant_id)
          .single();

        if (!emailConfig?.from_email) {
          error = "Email not configured";
          break;
        }

        const config = emailConfig as any;
        
        // Determine which email address to use for support replies
        let fromName = config.from_name;
        let fromEmail = config.from_email;
        
        // If support email is enabled and configured, use those settings
        if (config.support_email_enabled && config.support_reply_from_email) {
          fromName = config.support_reply_from_name || fromName;
          fromEmail = config.support_reply_from_email;
        }

        // Send via SendGrid
        const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY");
        if (!SENDGRID_API_KEY) {
          error = "SendGrid API key not configured";
          break;
        }

        const customerEmail = conversation.customer_email;
        if (!customerEmail) {
          error = "Customer email not found";
          break;
        }

        // Construct proper reply-to email address
        // support_email_address might just be "atendimento" without domain, so we need to construct the full email
        let replyToEmail = fromEmail; // Default to from_email
        if (config.support_email_address && config.sending_domain) {
          // If support_email_address is just the local part (e.g., "atendimento"), append the domain
          if (config.support_email_address.includes("@")) {
            replyToEmail = config.support_email_address;
          } else {
            replyToEmail = `${config.support_email_address}@${config.sending_domain}`;
          }
        } else if (config.reply_to && config.reply_to.includes("@")) {
          // Use the configured reply_to if it's a valid email
          replyToEmail = config.reply_to;
        }

        console.log(`Sending email from "${fromName}" <${fromEmail}> to ${customerEmail}, reply-to: ${replyToEmail}`);

        const result = await sendEmailViaSendGrid(
          SENDGRID_API_KEY,
          { email: fromEmail, name: fromName },
          customerEmail,
          conversation.subject || "Re: Seu atendimento",
          message.content,
          replyToEmail
        );

        if (!result.success) {
          error = `Email send failed: ${result.error}`;
          console.error("SendGrid error:", result.error);
        } else {
          success = true;
          externalMessageId = result.messageId || null;
          deliveryStatus = "sent";
          console.log("Email sent successfully:", result.messageId);
        }
        break;
      }

      case "chat": {
        // Internal chat - just mark as delivered
        success = true;
        deliveryStatus = "delivered";
        break;
      }

      case "facebook_messenger":
      case "instagram_dm": {
        // Send via Meta Send Message API (unified for Messenger + IG DM)
        // Get recipient_id from conversation metadata or external_thread_id
        const recipientId = conversation.external_thread_id || conversation.metadata?.sender_id;

        if (!recipientId) {
          error = "Recipient ID não encontrado na conversa";
          break;
        }

        // Determine page_id from conversation metadata
        const metaPageId = conversation.metadata?.page_id;

        const { data: metaSendResult, error: metaSendError } = await supabase.functions.invoke("meta-send-message", {
          body: {
            tenant_id: message.tenant_id,
            channel: channelToUse,
            recipient_id: recipientId,
            message: message.content,
            page_id: metaPageId,
          },
        });

        if (metaSendError || !metaSendResult?.success) {
          error = metaSendError?.message || metaSendResult?.error || `Failed to send via ${channelToUse}`;
        } else {
          success = true;
          externalMessageId = metaSendResult.data?.message_id || null;
          deliveryStatus = "sent";
        }
        break;
      }

      default:
        error = `Channel ${channelToUse} not supported yet`;
    }

    // Update message status
    const updateData: Record<string, unknown> = {
      delivery_status: success ? deliveryStatus : "failed",
      updated_at: new Date().toISOString(),
    };

    if (externalMessageId) {
      updateData.external_message_id = externalMessageId;
    }

    if (success) {
      updateData.delivered_at = new Date().toISOString();
    } else {
      updateData.failed_at = new Date().toISOString();
      updateData.failure_reason = error;
    }

    await supabase
      .from("messages")
      .update(updateData)
      .eq("id", message_id);

    // Log event
    await supabase.from("conversation_events").insert({
      conversation_id: conversation.id,
      tenant_id: message.tenant_id,
      event_type: success ? "message_sent" : "message_failed",
      description: success
        ? `Mensagem enviada via ${channelToUse}`
        : `Falha ao enviar via ${channelToUse}: ${error}`,
      metadata: { channel: channelToUse, message_id, external_id: externalMessageId },
    });

    console.log(`Message ${message_id} ${success ? "sent" : "failed"}: ${error || "ok"}`);

    return new Response(
      JSON.stringify({
        success,
        message_id,
        external_message_id: externalMessageId,
        error,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
