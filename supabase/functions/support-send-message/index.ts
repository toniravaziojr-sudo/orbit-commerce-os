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
        // Get WhatsApp config for tenant
        const { data: waConfig } = await supabase
          .from("whatsapp_configs")
          .select("*")
          .eq("tenant_id", message.tenant_id)
          .eq("is_enabled", true)
          .single();

        if (!waConfig || waConfig.connection_status !== "connected") {
          error = "WhatsApp not configured or disconnected";
          break;
        }

        // Send via WhatsApp edge function
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

        // Send via Resend
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (!RESEND_API_KEY) {
          error = "Resend API key not configured";
          break;
        }

        const customerEmail = conversation.customer_email;
        if (!customerEmail) {
          error = "Customer email not found";
          break;
        }

        console.log(`Sending email from "${fromName}" <${fromEmail}> to ${customerEmail}`);

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [customerEmail],
            subject: conversation.subject || "Re: Seu atendimento",
            text: message.content,
            reply_to: config.support_email_address || fromEmail,
          }),
        });

        if (!emailRes.ok) {
          const errText = await emailRes.text();
          error = `Email send failed: ${errText}`;
          console.error("Resend error:", errText);
        } else {
          const emailData = await emailRes.json();
          success = true;
          externalMessageId = emailData.id;
          deliveryStatus = "sent";
          console.log("Email sent successfully:", emailData.id);
        }
        break;
      }

      case "chat": {
        // Internal chat - just mark as delivered
        success = true;
        deliveryStatus = "delivered";
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
