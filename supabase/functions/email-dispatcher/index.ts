import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BATCH_SIZE = 10;

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email provider not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const now = new Date().toISOString();

    // Fetch queued emails ready to send (with row-level locking via status update)
    const { data: emails, error: fetchError } = await supabase
      .from("email_send_queue")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_at", now)
      .order("scheduled_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("Error fetching queue:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch queue" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!emails?.length) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No emails to send" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = {
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    for (const email of emails) {
      try {
        // Mark as sending (optimistic lock)
        const { error: lockError } = await supabase
          .from("email_send_queue")
          .update({ status: "sending" })
          .eq("id", email.id)
          .eq("status", "queued");

        if (lockError) {
          results.skipped++;
          continue;
        }

        // Check if subscriber is still active
        if (email.subscriber_id) {
          const { data: subscriber } = await supabase
            .from("email_marketing_subscribers")
            .select("status")
            .eq("id", email.subscriber_id)
            .single();

          if ((subscriber as any)?.status !== "active") {
            await supabase
              .from("email_send_queue")
              .update({
                status: "skipped",
                last_error: `Subscriber status: ${(subscriber as any)?.status || "not found"}`,
              })
              .eq("id", email.id);

            results.skipped++;
            continue;
          }
        }

        // Generate unsubscribe token and link
        let unsubscribeLink = "";
        if (email.subscriber_id) {
          const { data: token } = await supabase.rpc("generate_unsubscribe_token", {
            p_tenant_id: email.tenant_id,
            p_subscriber_id: email.subscriber_id,
          });
          if (token) {
            unsubscribeLink = `${supabaseUrl}/functions/v1/email-unsubscribe?token=${token}`;
          }
        }

        // Add unsubscribe link to HTML body
        let bodyHtml = email.body_html;
        if (unsubscribeLink) {
          bodyHtml += `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #666;">
              <p>Você está recebendo este email porque se inscreveu em nossa lista.</p>
              <p><a href="${unsubscribeLink}" style="color: #666;">Clique aqui para descadastrar</a></p>
            </div>
          `;
        }

        // Get tenant settings for from address
        const { data: tenant } = await supabase
          .from("tenants")
          .select("name, settings")
          .eq("id", email.tenant_id)
          .single();

        const fromName = (tenant as any)?.name || "Loja";
        const fromEmail = "marketing@resend.dev"; // Use resend domain for now

        // Send via Resend
        const { data: sendResult, error: sendError } = await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: [email.to_email],
          subject: email.subject,
          html: bodyHtml,
          text: email.body_text || undefined,
        });

        if (sendError) {
          throw sendError;
        }

        // Mark as sent
        await supabase
          .from("email_send_queue")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: (sendResult as any)?.id,
          })
          .eq("id", email.id);

        // Record event
        await supabase.from("email_events").insert({
          tenant_id: email.tenant_id,
          subscriber_id: email.subscriber_id,
          event_type: "email_sent",
          data: {
            queue_id: email.id,
            campaign_id: email.campaign_id,
            provider_message_id: (sendResult as any)?.id,
          },
        });

        // Update campaign sent_count manually
        if (email.campaign_id) {
          const { data: campaign } = await supabase
            .from("email_marketing_campaigns")
            .select("sent_count")
            .eq("id", email.campaign_id)
            .single();
          
          if (campaign) {
            await supabase
              .from("email_marketing_campaigns")
              .update({ sent_count: ((campaign as any).sent_count || 0) + 1 })
              .eq("id", email.campaign_id);
          }
        }

        results.sent++;
      } catch (sendError: any) {
        console.error(`Failed to send email ${email.id}:`, sendError);

        await supabase
          .from("email_send_queue")
          .update({
            status: "failed",
            last_error: sendError.message || "Unknown error",
          })
          .eq("id", email.id);

        // Record failed event
        await supabase.from("email_events").insert({
          tenant_id: email.tenant_id,
          subscriber_id: email.subscriber_id,
          event_type: "email_failed",
          data: {
            queue_id: email.id,
            error: sendError.message,
          },
        });

        results.failed++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: emails.length,
        ...results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Dispatcher error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
