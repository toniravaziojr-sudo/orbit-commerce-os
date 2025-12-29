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
  headers: string;
  envelope: string;
  attachments?: string;
  'attachment-info'?: string;
}

interface AttachmentInfo {
  filename: string;
  type: string;
  'content-id'?: string;
}

serve(async (req: Request): Promise<Response> => {
  console.log('=== SUPPORT EMAIL INBOUND (SendGrid) ===');
  console.log('Method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Parse headers
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
    const toDomain = toEmail.split('@')[1] || '';

    console.log('Parsed:', { toEmail, fromEmail, fromName, toDomain });

    // Step 1: Find tenant by domain
    const { data: emailConfig, error: configError } = await supabase
      .from('email_provider_configs')
      .select('tenant_id, from_email, support_email_address, support_email_enabled, support_reply_from_name, sending_domain')
      .or(`sending_domain.eq.${toDomain},from_email.ilike.%@${toDomain},support_email_address.ilike.%@${toDomain}`)
      .limit(1)
      .single();

    if (configError || !emailConfig) {
      console.error('No tenant found for email domain:', toDomain, configError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found for this email address' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = emailConfig.tenant_id as string;
    console.log('Found tenant:', tenantId);

    // Step 2: Determine routing
    // Normalize support email address - it may be stored as just the prefix or full email
    let supportEmailAddress = (emailConfig.support_email_address as string || '').toLowerCase().trim();
    
    // If support email doesn't contain @, add the domain
    if (supportEmailAddress && !supportEmailAddress.includes('@')) {
      supportEmailAddress = `${supportEmailAddress}@${toDomain}`;
    }
    
    const isSupportEmail = emailConfig.support_email_enabled && 
                           supportEmailAddress && 
                           toEmail === supportEmailAddress;

    console.log('Routing decision:', { 
      toEmail, 
      supportEmailAddress, 
      support_email_enabled: emailConfig.support_email_enabled,
      isSupportEmail 
    });

    const messageId = parsedHeaders['Message-ID'] || parsedHeaders['message-id'] || null;
    const inReplyTo = parsedHeaders['In-Reply-To'] || parsedHeaders['in-reply-to'] || null;
    const references = parsedHeaders['References'] || parsedHeaders['references'] || null;

    if (isSupportEmail) {
      // ========== ROUTE TO SUPPORT/ATENDIMENTO ==========
      console.log('=== ROUTING TO SUPPORT/ATENDIMENTO ===');

      let conversationId: string | null = null;
      
      // Find existing conversation by thread
      if (inReplyTo || references) {
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
          conversationId = (existingConv as { id: string }).id;
          console.log('Found existing conversation:', conversationId);
        }
      }

      // Find by customer email
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
          conversationId = (existingConv as { id: string }).id;
          console.log('Found existing open conversation by email:', conversationId);
        }
      }

      // Check for customer
      const { data: customer } = await supabase
        .from('customers')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .ilike('email', fromEmail)
        .single();

      const customerData = customer as { id: string; full_name: string } | null;

      // Check if AI is enabled BEFORE creating conversation
      const { data: aiConfigCheck } = await supabase
        .from('ai_support_config')
        .select('is_enabled')
        .eq('tenant_id', tenantId)
        .single();

      const aiEnabled = (aiConfigCheck as { is_enabled: boolean } | null)?.is_enabled === true;
      const initialStatus = aiEnabled ? 'bot' : 'new';

      // Create new conversation if needed
      if (!conversationId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            tenant_id: tenantId,
            channel_type: 'email',
            status: initialStatus,
            customer_id: customerData?.id || null,
            customer_name: customerData?.full_name || fromName,
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

        conversationId = (newConv as { id: string }).id;
        console.log('Created new conversation with status:', initialStatus, 'id:', conversationId);
      }

      // Check for duplicate message
      if (messageId && conversationId) {
        const { data: existingMsg } = await supabase
          .from('messages')
          .select('id')
          .eq('conversation_id', conversationId)
          .eq('external_message_id', messageId)
          .single();

        if (existingMsg) {
          console.log('Duplicate message, skipping:', messageId);
          return new Response(
            JSON.stringify({ success: true, duplicate: true, message_id: (existingMsg as { id: string }).id }),
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

      const messageData = newMessage as { id: string };
      console.log('Created message:', messageData.id);

      // Handle attachments
      const numAttachments = parseInt(payload.attachments || '0', 10);
      if (numAttachments > 0 && payload['attachment-info']) {
        try {
          const attachmentInfo: Record<string, AttachmentInfo> = JSON.parse(payload['attachment-info']);
          for (const [key, info] of Object.entries(attachmentInfo)) {
            await supabase.from('message_attachments').insert({
              tenant_id: tenantId,
              message_id: messageData.id,
              file_name: info.filename,
              file_path: `attachments/${tenantId}/${messageData.id}/${info.filename}`,
              mime_type: info.type,
              file_size: 0,
            });
          }
          console.log('Saved', numAttachments, 'attachments');
        } catch (e) {
          console.error('Error processing attachments:', e);
        }
      }

      // Update conversation - keep status as 'bot' if AI is enabled, otherwise 'new'
      await supabase
        .from('conversations')
        .update({
          status: initialStatus,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      // Log event
      await supabase.from('conversation_events').insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        event_type: 'message_received',
        actor_type: 'customer',
        actor_name: fromName,
        description: `Email recebido: ${payload.subject || '(Sem assunto)'}`,
        metadata: { from: fromEmail, subject: payload.subject },
      });

      // Invoke AI if enabled
      if (aiEnabled) {
        console.log('AI is enabled, invoking ai-support-chat...');
        try {
          const aiResponse = await supabase.functions.invoke('ai-support-chat', {
            body: { conversation_id: conversationId, tenant_id: tenantId },
          });
          console.log('AI response:', aiResponse);
        } catch (aiError) {
          console.error('AI invocation error:', aiError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          destination: 'support',
          conversation_id: conversationId,
          message_id: messageData.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // ========== ROUTE TO MANUAL MAILBOX ==========
      console.log('=== ROUTING TO MANUAL MAILBOX ===');

      // Find mailbox
      const { data: mailbox } = await supabase
        .from('mailboxes')
        .select('id, email_address, display_name')
        .eq('tenant_id', tenantId)
        .ilike('email_address', toEmail)
        .single();

      let targetMailbox = mailbox as { id: string; email_address: string; display_name: string } | null;

      if (!targetMailbox) {
        // Try to find any mailbox for this domain
        const { data: domainMailbox } = await supabase
          .from('mailboxes')
          .select('id, email_address, display_name')
          .eq('tenant_id', tenantId)
          .ilike('email_address', `%@${toDomain}`)
          .limit(1)
          .single();

        targetMailbox = domainMailbox as { id: string; email_address: string; display_name: string } | null;
        
        if (targetMailbox) {
          console.log('Using fallback mailbox:', targetMailbox.email_address);
        }
      }

      if (!targetMailbox) {
        console.error('No mailbox found for email:', toEmail);
        return new Response(
          JSON.stringify({ error: 'Mailbox not found for this email address' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Found mailbox:', targetMailbox.id, targetMailbox.email_address);

      // Find inbox folder
      const { data: inboxFolder, error: folderError } = await supabase
        .from('email_folders')
        .select('id')
        .eq('mailbox_id', targetMailbox.id)
        .eq('slug', 'inbox')
        .single();

      if (folderError || !inboxFolder) {
        console.error('No inbox folder found for mailbox:', targetMailbox.id);
        return new Response(
          JSON.stringify({ error: 'Inbox folder not found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const folderData = inboxFolder as { id: string };

      // Check for duplicate
      if (messageId) {
        const { data: existingMsg } = await supabase
          .from('email_messages')
          .select('id')
          .eq('mailbox_id', targetMailbox.id)
          .eq('external_message_id', messageId)
          .single();

        if (existingMsg) {
          console.log('Duplicate email message, skipping:', messageId);
          return new Response(
            JSON.stringify({ success: true, duplicate: true, message_id: (existingMsg as { id: string }).id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Create email message
      const { data: newMessage, error: msgError } = await supabase
        .from('email_messages')
        .insert({
          tenant_id: tenantId,
          mailbox_id: targetMailbox.id,
          folder_id: folderData.id,
          from_email: fromEmail,
          from_name: fromName,
          to_emails: [toEmail],
          subject: payload.subject || '(Sem assunto)',
          body_text: payload.text || '',
          body_html: payload.html || '',
          snippet: (payload.text || payload.html || '').substring(0, 200),
          external_message_id: messageId,
          in_reply_to: inReplyTo,
          thread_id: inReplyTo || messageId,
          is_read: false,
          is_starred: false,
          is_sent: false,
          received_at: new Date().toISOString(),
          has_attachments: parseInt(payload.attachments || '0', 10) > 0,
          attachment_count: parseInt(payload.attachments || '0', 10),
        })
        .select('id')
        .single();

      if (msgError) {
        console.error('Error creating email message:', msgError);
        throw msgError;
      }

      const emailMessageData = newMessage as { id: string };
      console.log('Created email message:', emailMessageData.id);

      // Handle attachments
      const numAttachments = parseInt(payload.attachments || '0', 10);
      if (numAttachments > 0 && payload['attachment-info']) {
        try {
          const attachmentInfo: Record<string, AttachmentInfo> = JSON.parse(payload['attachment-info']);
          for (const [key, info] of Object.entries(attachmentInfo)) {
            await supabase.from('email_attachments').insert({
              message_id: emailMessageData.id,
              filename: info.filename,
              content_type: info.type,
              content_id: info['content-id'] || null,
              is_inline: !!info['content-id'],
            });
          }
          console.log('Saved', numAttachments, 'email attachments');
        } catch (e) {
          console.error('Error processing email attachments:', e);
        }
      }

      // Update folder unread count by incrementing
      const { data: currentFolder } = await supabase
        .from('email_folders')
        .select('unread_count')
        .eq('id', folderData.id)
        .single();
      
      const newFolderUnread = ((currentFolder as { unread_count: number } | null)?.unread_count || 0) + 1;
      
      await supabase
        .from('email_folders')
        .update({ unread_count: newFolderUnread })
        .eq('id', folderData.id);

      // Update mailbox unread count and total messages
      const { data: currentMailbox } = await supabase
        .from('mailboxes')
        .select('unread_count, total_messages')
        .eq('id', targetMailbox.id)
        .single();
      
      const mailboxData = currentMailbox as { unread_count: number; total_messages: number } | null;
      
      await supabase
        .from('mailboxes')
        .update({ 
          unread_count: (mailboxData?.unread_count || 0) + 1,
          total_messages: (mailboxData?.total_messages || 0) + 1,
          last_received_at: new Date().toISOString(),
        })
        .eq('id', targetMailbox.id);

      return new Response(
        JSON.stringify({
          success: true,
          destination: 'mailbox',
          mailbox_id: targetMailbox.id,
          message_id: emailMessageData.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error processing inbound email:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
