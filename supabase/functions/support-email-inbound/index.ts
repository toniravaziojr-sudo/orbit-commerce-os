import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SendGrid Inbound Parse sends multipart/form-data
interface SendGridInboundEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  headers: string; // Raw headers string
  envelope: string; // JSON string with from/to arrays
  attachments?: string; // Number of attachments
  'attachment-info'?: string; // JSON with attachment metadata
}

interface AttachmentInfo {
  filename: string;
  type: string;
  'content-id'?: string;
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== SUPPORT EMAIL INBOUND (SendGrid) ===');
  console.log('Method:', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // SendGrid Inbound Parse sends multipart/form-data
    const formData = await req.formData();
    
    const payload: SendGridInboundEmail = {
      from: formData.get('from') as string || '',
      to: formData.get('to') as string || '',
      subject: formData.get('subject') as string || '',
      text: formData.get('text') as string || '',
      html: formData.get('html') as string || '',
      headers: formData.get('headers') as string || '',
      envelope: formData.get('envelope') as string || '{}',
      attachments: formData.get('attachments') as string,
      'attachment-info': formData.get('attachment-info') as string,
    };

    console.log('Inbound email received:', {
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
    });

    // Parse headers from raw string format
    const parsedHeaders: Record<string, string> = {};
    if (payload.headers) {
      const headerLines = payload.headers.split('\n');
      for (const line of headerLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          parsedHeaders[key] = value;
        }
      }
    }

    // Extract email address from "Name <email@domain.com>" format
    const extractEmail = (str: string): string => {
      const match = str.match(/<([^>]+)>/);
      return match ? match[1].toLowerCase() : str.toLowerCase();
    };

    const extractName = (str: string): string => {
      const match = str.match(/^([^<]+)</);
      return match ? match[1].trim() : str.split('@')[0];
    };

    const toEmail = extractEmail(payload.to);
    const fromEmail = extractEmail(payload.from);
    const fromName = extractName(payload.from);

    console.log('Parsed:', { toEmail, fromEmail, fromName });

    // Find tenant by email destination
    // Check both from_email and support_email_address
    const { data: emailConfig, error: configError } = await supabase
      .from('email_provider_configs')
      .select('tenant_id, from_email, support_email_address, support_reply_from_name')
      .or(`from_email.ilike.${toEmail},support_email_address.ilike.${toEmail}`)
      .eq('support_email_enabled', true)
      .single();

    if (configError || !emailConfig) {
      console.error('No tenant found for email:', toEmail, configError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found for this email address' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = emailConfig.tenant_id;
    console.log('Found tenant:', tenantId);

    // Extract Message-ID and References for threading from parsed headers
    const messageId = parsedHeaders['Message-ID'] || parsedHeaders['message-id'] || null;
    const inReplyTo = parsedHeaders['In-Reply-To'] || parsedHeaders['in-reply-to'] || null;
    const references = parsedHeaders['References'] || parsedHeaders['references'] || null;

    console.log('Email threading:', { messageId, inReplyTo, references });

    // Try to find existing conversation by thread
    let conversationId: string | null = null;
    
    if (inReplyTo || references) {
      // Look for existing conversation by external_message_id or external_thread_id
      const threadIds = [inReplyTo, ...(references?.split(/\s+/) || [])].filter(Boolean);
      
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel_type', 'email')
        .or(threadIds.map(id => `external_thread_id.eq.${id}`).join(','))
        .limit(1)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
        console.log('Found existing conversation:', conversationId);
      }
    }

    // If no existing conversation, check by customer email
    if (!conversationId) {
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('channel_type', 'email')
        .eq('customer_email', fromEmail)
        .in('status', ['new', 'open', 'bot'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingConv) {
        conversationId = existingConv.id;
        console.log('Found existing open conversation by email:', conversationId);
      }
    }

    // Check for customer in database
    const { data: customer } = await supabase
      .from('customers')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .ilike('email', fromEmail)
      .single();

    // Create new conversation if needed
    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          tenant_id: tenantId,
          channel_type: 'email',
          status: 'new',
          customer_id: customer?.id || null,
          customer_name: customer?.full_name || fromName,
          customer_email: fromEmail,
          subject: payload.subject || '(Sem assunto)',
          external_conversation_id: messageId,
          external_thread_id: messageId,
        })
        .select('id')
        .single();

      if (convError) {
        console.error('Error creating conversation:', convError);
        throw convError;
      }

      conversationId = newConv.id;
      console.log('Created new conversation:', conversationId);
    }

    // Check for duplicate message
    if (messageId) {
      const { data: existingMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('external_message_id', messageId)
        .single();

      if (existingMsg) {
        console.log('Duplicate message, skipping:', messageId);
        return new Response(
          JSON.stringify({ success: true, duplicate: true, message_id: existingMsg.id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create message
    const { data: newMessage, error: msgError } = await supabase
      .from('messages')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        sender_type: 'customer',
        sender_name: fromName,
        direction: 'inbound',
        content: payload.text || payload.html || '',
        delivery_status: 'delivered',
        external_message_id: messageId,
        metadata: {
          subject: payload.subject,
          headers: parsedHeaders,
        },
      })
      .select('id')
      .single();

    if (msgError) {
      console.error('Error creating message:', msgError);
      throw msgError;
    }

    console.log('Created message:', newMessage.id);

    // Handle attachments (SendGrid sends them as separate form fields)
    const numAttachments = parseInt(payload.attachments || '0', 10);
    if (numAttachments > 0 && payload['attachment-info']) {
      try {
        const attachmentInfo: Record<string, AttachmentInfo> = JSON.parse(payload['attachment-info']);
        
        for (const [key, info] of Object.entries(attachmentInfo)) {
          // SendGrid sends attachment files as form fields named "attachment1", "attachment2", etc.
          const attachmentFile = formData.get(key) as File | null;
          
          if (attachmentFile) {
            // Convert to base64
            const arrayBuffer = await attachmentFile.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
            
            await supabase
              .from('message_attachments')
              .insert({
                tenant_id: tenantId,
                message_id: newMessage.id,
                file_name: info.filename || attachmentFile.name,
                file_path: `attachments/${tenantId}/${newMessage.id}/${info.filename || attachmentFile.name}`,
                mime_type: info.type || attachmentFile.type,
                file_size: attachmentFile.size,
                file_url: `data:${info.type || attachmentFile.type};base64,${base64}`,
              });
          }
        }
        console.log('Saved', numAttachments, 'attachments');
      } catch (e) {
        console.error('Error processing attachments:', e);
      }
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        status: 'new',
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // Log event
    await supabase
      .from('conversation_events')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        event_type: 'message_received',
        actor_type: 'customer',
        actor_name: fromName,
        description: `Email recebido: ${payload.subject || '(Sem assunto)'}`,
        metadata: { from: fromEmail, subject: payload.subject },
      });

    // Check if AI should respond
    const { data: aiConfig } = await supabase
      .from('ai_support_config')
      .select('is_enabled')
      .eq('tenant_id', tenantId)
      .single();

    if (aiConfig?.is_enabled) {
      console.log('AI is enabled, invoking ai-support-chat...');
      
      try {
        const aiResponse = await supabase.functions.invoke('ai-support-chat', {
          body: {
            conversation_id: conversationId,
            message_id: newMessage.id,
            auto_send: true,
          },
        });

        console.log('AI response:', aiResponse);
      } catch (aiError) {
        console.error('AI invocation error:', aiError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        conversation_id: conversationId,
        message_id: newMessage.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error processing inbound email:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
