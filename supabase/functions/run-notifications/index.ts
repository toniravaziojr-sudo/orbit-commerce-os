import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Notification {
  id: string;
  tenant_id: string;
  event_id: string | null;
  rule_id: string | null;
  channel: string;
  recipient: string;
  template_key: string | null;
  payload: Record<string, unknown> | null;
  status: string;
  scheduled_for: string;
  next_attempt_at: string;
  attempt_count: number;
  max_attempts: number;
  last_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
}

interface EmailConfig {
  id: string;
  tenant_id: string;
  provider_type: string;
  from_name: string;
  from_email: string;
  reply_to: string | null;
  is_verified: boolean;
  sending_domain: string | null;
  verification_status: string | null;
}

interface RunnerStats {
  claimed_count: number;
  processed_success: number;
  processed_error: number;
  scheduled_retries: number;
  failed_final: number;
  unstuck_count: number;
}

// Cache for email configs per tenant
const emailConfigCache: Map<string, EmailConfig | null> = new Map();
let systemEmailConfigCache: EmailConfig | null | undefined = undefined;

// Get system email config as fallback
async function getSystemEmailConfig(supabase: any): Promise<EmailConfig | null> {
  if (systemEmailConfigCache !== undefined) {
    return systemEmailConfigCache;
  }

  const { data, error } = await supabase
    .from('system_email_config')
    .select('*')
    .single();

  if (error || !data) {
    console.log(`[RunNotifications] No system email config found`);
    systemEmailConfigCache = null;
    return null;
  }

  // Map system_email_config to EmailConfig interface
  const config: EmailConfig = {
    id: data.id,
    tenant_id: 'system',
    provider_type: data.provider_type || 'resend',
    from_name: data.from_name,
    from_email: data.from_email,
    reply_to: data.reply_to,
    is_verified: data.verification_status === 'verified',
    sending_domain: data.sending_domain,
    verification_status: data.verification_status
  };

  console.log(`[RunNotifications] Using system email config: ${config.from_email}`);
  systemEmailConfigCache = config;
  return config;
}

// Get email config for tenant (with system fallback)
async function getEmailConfig(supabase: any, tenantId: string): Promise<EmailConfig | null> {
  if (emailConfigCache.has(tenantId)) {
    return emailConfigCache.get(tenantId) || null;
  }

  // First try tenant-specific config
  const { data, error } = await supabase
    .from('email_provider_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (!error && data && data.verification_status === 'verified') {
    console.log(`[RunNotifications] Using tenant email config: ${data.from_email}`);
    emailConfigCache.set(tenantId, data);
    return data;
  }

  // Fallback to system email config
  console.log(`[RunNotifications] No verified tenant email config for ${tenantId}, trying system fallback`);
  const systemConfig = await getSystemEmailConfig(supabase);
  
  if (systemConfig) {
    emailConfigCache.set(tenantId, systemConfig);
    return systemConfig;
  }

  console.log(`[RunNotifications] No email config available for tenant ${tenantId}`);
  emailConfigCache.set(tenantId, null);
  return null;
}

// Convert basic markdown to HTML for emails
function markdownToHtml(text: string): string {
  if (!text) return '';
  
  return text
    // Bold: **text** or *text*
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    // Links: [text](url)
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: #667eea; text-decoration: underline;">$1</a>')
    // Line breaks
    .replace(/\n/g, '<br>');
}

// Build HTML email from subject and body
function buildEmailHtml(subject: string, body: string, fromName: string): string {
  const htmlBody = markdownToHtml(body);
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 30px 40px; border-bottom: 1px solid #e4e4e7;">
              <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #18181b;">${subject}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px;">
              <div style="font-size: 15px; line-height: 1.6; color: #3f3f46;">
                ${htmlBody}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; font-size: 12px; color: #71717a; text-align: center;">
                Enviado por ${fromName}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Send email via Resend
async function sendEmail(
  resend: Resend,
  config: EmailConfig,
  recipient: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const fromAddress = `${config.from_name} <${config.from_email}>`;
    const htmlContent = buildEmailHtml(subject, body, config.from_name);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: [recipient],
      reply_to: config.reply_to || undefined,
      subject: subject,
      html: htmlContent,
    });

    if (error) {
      console.error('[RunNotifications] Resend error:', error);
      return { success: false, error: error.message || JSON.stringify(error) };
    }

    return { success: true, messageId: data?.id };
  } catch (error: any) {
    console.error('[RunNotifications] Email send error:', error);
    return { success: false, error: error.message || 'Unknown error sending email' };
  }
}

// Send WhatsApp (mock for now - will be implemented later)
function sendWhatsApp(
  recipient: string,
  message: string
): { success: boolean; error?: string; response: Record<string, unknown> } {
  console.log(`[RunNotifications] WhatsApp (mock): To ${recipient}`);
  
  // Validate phone number
  const cleanPhone = (recipient || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      success: false,
      error: `Número de WhatsApp inválido: "${recipient}" (mínimo 10 dígitos)`,
      response: { mock: true, channel: 'whatsapp', to: recipient, validated: false }
    };
  }

  // For now, mock success - WhatsApp will be implemented in phase 2
  return {
    success: true,
    response: {
      mock: true,
      channel: 'whatsapp',
      to: recipient,
      message_preview: message?.substring(0, 50),
      sent_at: new Date().toISOString(),
      message_id: `whatsapp_mock_${Date.now()}`
    }
  };
}

// Calculate backoff: 60s, 120s, 240s, 480s... up to 1 hour max
function calculateBackoffSeconds(attemptNo: number): number {
  const baseSeconds = 60;
  const maxSeconds = 3600; // 1 hour
  const backoff = baseSeconds * Math.pow(2, attemptNo - 1);
  return Math.min(backoff, maxSeconds);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = resendApiKey ? new Resend(resendApiKey) : null;

    // Parse request body
    let limit = 25;
    let tenantId: string | null = null;
    
    try {
      const body = await req.json();
      limit = body.limit || 25;
      tenantId = body.tenant_id || null;
    } catch {
      // Empty body is ok, use defaults
    }

    console.log(`[RunNotifications] Starting with limit=${limit}, tenant_id=${tenantId || 'all'}, resend_configured=${!!resend}`);

    const stats: RunnerStats = {
      claimed_count: 0,
      processed_success: 0,
      processed_error: 0,
      scheduled_retries: 0,
      failed_final: 0,
      unstuck_count: 0
    };

    // Step 0: Unstuck notifications that are "sending" for too long (> 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    let unstuckQuery = supabase
      .from('notifications')
      .update({ status: 'retrying' })
      .eq('status', 'sending')
      .lt('last_attempt_at', fiveMinutesAgo);
    
    if (tenantId) {
      unstuckQuery = unstuckQuery.eq('tenant_id', tenantId);
    }
    
    const { data: unstuckData } = await unstuckQuery.select('id');
    stats.unstuck_count = unstuckData?.length || 0;
    if (stats.unstuck_count > 0) {
      console.log(`[RunNotifications] Unstuck ${stats.unstuck_count} notifications that were stuck in 'sending'`);
    }

    // Step 1: Find due notifications
    const now = new Date().toISOString();
    let selectQuery = supabase
      .from('notifications')
      .select('*')
      .in('status', ['scheduled', 'retrying'])
      .lte('next_attempt_at', now)
      .order('next_attempt_at', { ascending: true })
      .limit(limit);
    
    if (tenantId) {
      selectQuery = selectQuery.eq('tenant_id', tenantId);
    }
    
    const { data: dueNotifications, error: selectError } = await selectQuery;

    if (selectError) {
      console.error('[RunNotifications] Error selecting due notifications:', selectError);
      throw selectError;
    }

    if (!dueNotifications || dueNotifications.length === 0) {
      console.log('[RunNotifications] No due notifications found');
      return new Response(
        JSON.stringify({ success: true, stats, message: 'No due notifications' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[RunNotifications] Found ${dueNotifications.length} due notifications`);

    // Step 2: Claim notifications (update to 'sending')
    const notificationIds = dueNotifications.map(n => n.id);
    
    const { error: claimError } = await supabase
      .from('notifications')
      .update({ 
        status: 'sending', 
        last_attempt_at: now 
      })
      .in('id', notificationIds)
      .in('status', ['scheduled', 'retrying']); // Double-check status to avoid race conditions

    if (claimError) {
      console.error('[RunNotifications] Error claiming notifications:', claimError);
      throw claimError;
    }

    stats.claimed_count = notificationIds.length;
    console.log(`[RunNotifications] Claimed ${stats.claimed_count} notifications`);

    // Step 3: Process each notification
    for (const notification of dueNotifications as Notification[]) {
      const attemptNo = notification.attempt_count + 1;
      console.log(`[RunNotifications] Processing notification ${notification.id}, channel=${notification.channel}, attempt ${attemptNo}/${notification.max_attempts}`);

      // Create attempt record
      const { data: attemptData, error: attemptInsertError } = await supabase
        .from('notification_attempts')
        .insert({
          tenant_id: notification.tenant_id,
          notification_id: notification.id,
          attempt_no: attemptNo,
          status: 'pending',
          started_at: now
        })
        .select('id')
        .single();

      if (attemptInsertError) {
        console.error(`[RunNotifications] Error creating attempt for ${notification.id}:`, attemptInsertError);
        continue;
      }

      const attemptId = attemptData.id;
      const payload = notification.payload as Record<string, unknown> | null;
      
      // Extract content from payload
      const emailSubject = payload?.email_subject as string || 'Notificação';
      const emailBody = payload?.email_body as string || '';
      const whatsappMessage = payload?.whatsapp_message as string || '';
      const orderId = payload?.order_id as string | null;
      const customerId = payload?.customer_id as string | null;
      const checkoutSessionId = payload?.checkout_session_id as string | null;
      const ruleType = payload?.rule_type as string || 'unknown';
      const attachments = payload?.attachments || null;

      let sendResult: { success: boolean; error?: string; response?: Record<string, unknown>; messageId?: string };

      // Route to appropriate sender based on channel
      if (notification.channel === 'email') {
        // Get email config for tenant
        const emailConfig = await getEmailConfig(supabase, notification.tenant_id);
        
        if (!resend) {
          sendResult = {
            success: false,
            error: 'RESEND_API_KEY não configurada. Configure a API key nas variáveis de ambiente.'
          };
        } else if (!emailConfig) {
          sendResult = {
            success: false,
            error: 'Provedor de email não configurado para este tenant. Configure em Integrações → Outros → Email.'
          };
        } else if (emailConfig.verification_status !== 'verified') {
          sendResult = {
            success: false,
            error: 'Domínio de email não verificado. Verifique o domínio antes de enviar emails.'
          };
        } else if (!emailConfig.from_email || !emailConfig.from_name) {
          sendResult = {
            success: false,
            error: 'Configuração de email incompleta. Preencha nome e email do remetente.'
          };
        } else if (emailConfig.sending_domain) {
          // Validate from_email belongs to verified domain
          const emailDomain = emailConfig.from_email.split('@')[1]?.toLowerCase();
          if (emailDomain !== emailConfig.sending_domain.toLowerCase()) {
            sendResult = {
              success: false,
              error: `Email do remetente (${emailConfig.from_email}) não pertence ao domínio verificado (${emailConfig.sending_domain}).`
            };
          } else if (!notification.recipient || !notification.recipient.includes('@')) {
            sendResult = {
              success: false,
              error: `Email do destinatário inválido: "${notification.recipient}"`
            };
          } else {
            // Send real email
            sendResult = await sendEmail(resend, emailConfig, notification.recipient, emailSubject, emailBody);
          }
        } else if (!notification.recipient || !notification.recipient.includes('@')) {
          sendResult = {
            success: false,
            error: `Email do destinatário inválido: "${notification.recipient}"`
          };
        } else {
          // Send real email
          sendResult = await sendEmail(resend, emailConfig, notification.recipient, emailSubject, emailBody);
        }
      } else if (notification.channel === 'whatsapp') {
        // WhatsApp - mock for now
        sendResult = sendWhatsApp(notification.recipient, whatsappMessage);
      } else {
        sendResult = {
          success: false,
          error: `Canal não suportado: ${notification.channel}`
        };
      }

      const finishedAt = new Date().toISOString();
      const contentPreview = notification.channel === 'whatsapp' 
        ? whatsappMessage.substring(0, 200)
        : `${emailSubject}: ${emailBody.substring(0, 150)}`;

      if (sendResult.success) {
        // Success path
        console.log(`[RunNotifications] Notification ${notification.id} sent successfully`);
        
        // Update attempt
        await supabase
          .from('notification_attempts')
          .update({
            status: 'success',
            finished_at: finishedAt,
            provider_response: sendResult.response || { message_id: sendResult.messageId }
          })
          .eq('id', attemptId);

        // Update notification
        await supabase
          .from('notifications')
          .update({
            status: 'sent',
            sent_at: finishedAt,
            attempt_count: attemptNo,
            last_error: null
          })
          .eq('id', notification.id);

        // Upsert notification_logs for audit trail
        await supabase
          .from('notification_logs')
          .upsert({
            tenant_id: notification.tenant_id,
            notification_id: notification.id,
            rule_id: notification.rule_id,
            rule_type: ruleType,
            channel: notification.channel,
            order_id: orderId,
            customer_id: customerId,
            checkout_session_id: checkoutSessionId,
            recipient: notification.recipient,
            status: 'sent',
            scheduled_for: notification.scheduled_for,
            sent_at: finishedAt,
            content_preview: contentPreview?.substring(0, 500),
            attachments: attachments,
            attempt_count: attemptNo,
            error_message: null
          }, { onConflict: 'notification_id' });

        stats.processed_success++;

      } else {
        // Error path
        console.log(`[RunNotifications] Notification ${notification.id} failed: ${sendResult.error}`);
        
        // Update attempt
        await supabase
          .from('notification_attempts')
          .update({
            status: 'error',
            finished_at: finishedAt,
            error_code: 'SEND_FAILED',
            error_message: sendResult.error,
            provider_response: sendResult.response || null
          })
          .eq('id', attemptId);

        stats.processed_error++;

        // Check if max attempts reached
        if (attemptNo >= notification.max_attempts) {
          // Final failure
          console.log(`[RunNotifications] Notification ${notification.id} reached max attempts, marking as failed`);
          
          await supabase
            .from('notifications')
            .update({
              status: 'failed',
              attempt_count: attemptNo,
              last_error: sendResult.error
            })
            .eq('id', notification.id);

          // Upsert notification_logs with failure
          await supabase
            .from('notification_logs')
            .upsert({
              tenant_id: notification.tenant_id,
              notification_id: notification.id,
              rule_id: notification.rule_id,
              rule_type: ruleType,
              channel: notification.channel,
              order_id: orderId,
              customer_id: customerId,
              checkout_session_id: checkoutSessionId,
              recipient: notification.recipient,
              status: 'failed',
              scheduled_for: notification.scheduled_for,
              sent_at: null,
              content_preview: contentPreview?.substring(0, 500),
              attachments: attachments,
              attempt_count: attemptNo,
              error_message: sendResult.error
            }, { onConflict: 'notification_id' });

          stats.failed_final++;
        } else {
          // Schedule retry with backoff
          const backoffSeconds = calculateBackoffSeconds(attemptNo);
          const nextAttempt = new Date(Date.now() + backoffSeconds * 1000).toISOString();
          
          console.log(`[RunNotifications] Scheduling retry for ${notification.id} in ${backoffSeconds}s`);
          
          await supabase
            .from('notifications')
            .update({
              status: 'retrying',
              attempt_count: attemptNo,
              last_error: sendResult.error,
              next_attempt_at: nextAttempt
            })
            .eq('id', notification.id);

          // Upsert notification_logs with retrying status
          await supabase
            .from('notification_logs')
            .upsert({
              tenant_id: notification.tenant_id,
              notification_id: notification.id,
              rule_id: notification.rule_id,
              rule_type: ruleType,
              channel: notification.channel,
              order_id: orderId,
              customer_id: customerId,
              checkout_session_id: checkoutSessionId,
              recipient: notification.recipient,
              status: 'retrying',
              scheduled_for: notification.scheduled_for,
              sent_at: null,
              content_preview: contentPreview?.substring(0, 500),
              attachments: attachments,
              attempt_count: attemptNo,
              error_message: sendResult.error
            }, { onConflict: 'notification_id' });

          stats.scheduled_retries++;
        }
      }
    }

    console.log('[RunNotifications] Completed. Stats:', stats);

    return new Response(
      JSON.stringify({ success: true, stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[RunNotifications] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
