import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRecipient {
  email: string;
  name?: string;
}

interface SendEmailRequest {
  mailbox_id: string;
  to_emails: EmailRecipient[];
  cc_emails?: EmailRecipient[];
  bcc_emails?: EmailRecipient[];
  subject: string;
  body_html: string;
  body_text?: string;
  in_reply_to?: string;
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== EMAIL SEND ===');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');

    if (!sendgridApiKey) {
      throw new Error('SENDGRID_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SendEmailRequest = await req.json();
    const { mailbox_id, to_emails, cc_emails, bcc_emails, subject, body_html, body_text, in_reply_to } = body;

    if (!mailbox_id || !to_emails || to_emails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: mailbox_id, to_emails' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the mailbox
    const { data: mailbox, error: mailboxError } = await supabase
      .from('mailboxes')
      .select('*')
      .eq('id', mailbox_id)
      .single();

    if (mailboxError || !mailbox) {
      return new Response(
        JSON.stringify({ error: 'Mailbox not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user has access to tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', mailbox.tenant_id)
      .single();

    if (!userRole) {
      return new Response(
        JSON.stringify({ error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build email body with signature
    let finalHtmlBody = body_html;
    if (mailbox.signature_html) {
      finalHtmlBody = `${body_html}<br><br>${mailbox.signature_html}`;
    }

    // Format recipients for SendGrid
    const formatRecipients = (recipients: EmailRecipient[]) => 
      recipients.map(r => r.name ? { email: r.email, name: r.name } : { email: r.email });

    // Prepare SendGrid payload
    const sendgridPayload: Record<string, unknown> = {
      personalizations: [{
        to: formatRecipients(to_emails),
        ...(cc_emails && cc_emails.length > 0 ? { cc: formatRecipients(cc_emails) } : {}),
        ...(bcc_emails && bcc_emails.length > 0 ? { bcc: formatRecipients(bcc_emails) } : {}),
      }],
      from: mailbox.display_name 
        ? { email: mailbox.email_address, name: mailbox.display_name }
        : { email: mailbox.email_address },
      subject: subject || '(Sem assunto)',
      content: [
        ...(body_text ? [{ type: 'text/plain', value: body_text }] : []),
        { type: 'text/html', value: finalHtmlBody },
      ],
    };

    // Add reply-to header if needed
    if (in_reply_to) {
      sendgridPayload.headers = {
        'In-Reply-To': in_reply_to,
        'References': in_reply_to,
      };
    }

    console.log('Sending email via SendGrid:', { to: to_emails, subject });

    // Send via SendGrid
    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendgridPayload),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error('SendGrid error:', errorText);
      throw new Error(`SendGrid error: ${sendgridResponse.status}`);
    }

    // Get message ID from SendGrid response header
    const messageId = sendgridResponse.headers.get('X-Message-Id');
    console.log('Email sent successfully, message ID:', messageId);

    // Get the sent folder
    const { data: sentFolder } = await supabase
      .from('email_folders')
      .select('id')
      .eq('mailbox_id', mailbox_id)
      .eq('slug', 'sent')
      .single();

    if (sentFolder) {
      // Store the sent email
      const { error: insertError } = await supabase
        .from('email_messages')
        .insert({
          mailbox_id: mailbox_id,
          folder_id: sentFolder.id,
          tenant_id: mailbox.tenant_id,
          external_message_id: messageId,
          in_reply_to: in_reply_to || null,
          from_email: mailbox.email_address,
          from_name: mailbox.display_name,
          to_emails: to_emails,
          cc_emails: cc_emails || [],
          bcc_emails: bcc_emails || [],
          subject: subject || null,
          body_html: finalHtmlBody,
          body_text: body_text || null,
          snippet: (body_text || body_html.replace(/<[^>]*>/g, '')).substring(0, 200),
          is_read: true,
          is_sent: true,
          sent_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error storing sent email:', insertError);
      }

      // Update mailbox stats
      await supabase
        .from('mailboxes')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('id', mailbox_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message_id: messageId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
