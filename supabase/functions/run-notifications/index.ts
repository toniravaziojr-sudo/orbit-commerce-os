import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.2.0"; // Fixed column names for whatsapp_messages
// ===========================================================

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

// Cache for email configs per tenant with TTL
interface CachedEmailConfig {
  config: EmailConfig | null;
  timestamp: number;
}
const emailConfigCache: Map<string, CachedEmailConfig> = new Map();
const EMAIL_CONFIG_CACHE_TTL = 60000; // 1 minute - auto-invalidates to pick up config changes
let systemEmailConfigCache: CachedEmailConfig | undefined = undefined;

// Get system email config as fallback (always available if configured)
async function getSystemEmailConfig(supabase: any): Promise<EmailConfig | null> {
  // Check cache with TTL
  if (systemEmailConfigCache && Date.now() - systemEmailConfigCache.timestamp < EMAIL_CONFIG_CACHE_TTL) {
    return systemEmailConfigCache.config;
  }

  const { data, error } = await supabase
    .from('system_email_config')
    .select('*')
    .single();

  if (error || !data) {
    console.log(`[RunNotifications] No system email config found`);
    systemEmailConfigCache = { config: null, timestamp: Date.now() };
    return null;
  }

  // Check if system email is verified
  if (data.verification_status !== 'verified') {
    console.log(`[RunNotifications] System email config exists but not verified: ${data.verification_status}`);
    systemEmailConfigCache = { config: null, timestamp: Date.now() };
    return null;
  }

  // Map system_email_config to EmailConfig interface
  const config: EmailConfig = {
    id: data.id,
    tenant_id: 'system',
    provider_type: data.provider_type || 'sendgrid',
    from_name: data.from_name,
    from_email: data.from_email,
    reply_to: data.reply_to,
    is_verified: true, // Already checked above
    sending_domain: data.sending_domain,
    verification_status: 'verified' // Already checked above
  };

  console.log(`[RunNotifications] System email config loaded: ${config.from_email} (verified)`);
  systemEmailConfigCache = { config, timestamp: Date.now() };
  return config;
}

// Get email config for tenant with automatic system fallback
// Priority: 1) Tenant verified config 2) System verified config
async function getEmailConfig(supabase: any, tenantId: string): Promise<EmailConfig | null> {
  // Check cache with TTL
  const cached = emailConfigCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < EMAIL_CONFIG_CACHE_TTL) {
    if (cached.config) {
      console.log(`[RunNotifications] Using cached email config for tenant ${tenantId}: ${cached.config.from_email}`);
    }
    return cached.config;
  }

  // First try tenant-specific config
  const { data: tenantConfig, error } = await supabase
    .from('email_provider_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  // Check if tenant config can be used:
  // - verification_status === 'verified' (provider fully verified)
  // - OR dns_all_ok === true AND from_email is set (DNS passed, can send)
  const canUseTenantConfig = !error && tenantConfig && (
    tenantConfig.verification_status === 'verified' ||
    (tenantConfig.dns_all_ok === true && tenantConfig.from_email && tenantConfig.from_name)
  );
  
  if (canUseTenantConfig) {
    const isFullyVerified = tenantConfig.verification_status === 'verified';
    console.log(`[RunNotifications] Using tenant email config: ${tenantConfig.from_email} (verified=${isFullyVerified}, dns_ok=${tenantConfig.dns_all_ok})`);
    emailConfigCache.set(tenantId, { config: tenantConfig, timestamp: Date.now() });
    return tenantConfig;
  }

  // Fallback to system email config (platform default)
  const reason = !error && tenantConfig 
    ? `config exists but not ready (verified=${tenantConfig.verification_status}, dns_ok=${tenantConfig.dns_all_ok}, from_email=${!!tenantConfig.from_email})`
    : 'no config found';
  console.log(`[RunNotifications] Tenant ${tenantId} ${reason}, using system fallback`);
  
  const systemConfig = await getSystemEmailConfig(supabase);
  
  if (systemConfig) {
    console.log(`[RunNotifications] Fallback to system email: ${systemConfig.from_email}`);
    // Cache the system config for this tenant to avoid repeated lookups
    emailConfigCache.set(tenantId, { config: systemConfig, timestamp: Date.now() });
    return systemConfig;
  }

  console.log(`[RunNotifications] ERROR: No email config available (tenant nor system) for ${tenantId}`);
  emailConfigCache.set(tenantId, { config: null, timestamp: Date.now() });
  return null;
}

// Convert basic markdown to HTML for emails
function markdownToHtml(text: string): string {
  if (!text) return '';
  
  let result = text
    // Bold: **text** or *text*
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    // Links: [text](url)
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: #667eea; text-decoration: underline;">$1</a>');
  
  // Special handling for PIX links - render as a nice block with QR code
  const pixLinkRegex = /(https?:\/\/api\.pagar\.me\/[^\s]+qrcode[^\s]*)/gi;
  result = result.replace(pixLinkRegex, (match) => {
    return `
      <div style="margin: 20px 0; padding: 20px; background: linear-gradient(135deg, #00D9A6 0%, #00B894 100%); border-radius: 12px; text-align: center;">
        <p style="margin: 0 0 15px 0; font-size: 14px; font-weight: 600; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">PIX - Pagamento Instantâneo</p>
        <div style="background: #ffffff; border-radius: 8px; padding: 15px; display: inline-block;">
          <img src="${match}" alt="QR Code PIX" style="width: 180px; height: 180px; display: block;" />
        </div>
        <p style="margin: 15px 0 0 0; font-size: 13px; color: #ffffff;">Escaneie o QR Code acima com o app do seu banco</p>
        <a href="${match}" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #ffffff; color: #00B894; font-weight: 600; text-decoration: none; border-radius: 6px; font-size: 14px;">Abrir QR Code</a>
      </div>`;
  });
  
  // Line breaks (after PIX processing to avoid breaking the HTML)
  result = result.replace(/\n/g, '<br>');
  
  return result;
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

// Send email via SendGrid
async function sendEmail(
  sendgridApiKey: string,
  config: EmailConfig,
  recipient: string,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  try {
    const htmlContent = buildEmailHtml(subject, body, config.from_name);

    const payload: any = {
      personalizations: [{ to: [{ email: recipient }] }],
      from: { email: config.from_email, name: config.from_name },
      subject: subject,
      content: [{ type: "text/html", value: htmlContent }],
    };

    if (config.reply_to) {
      payload.reply_to = { email: config.reply_to };
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${sendgridApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[RunNotifications] SendGrid error:', response.status, errorText);
      return { success: false, error: `SendGrid error: ${response.status} - ${errorText}` };
    }

    const messageId = response.headers.get("X-Message-Id") || undefined;
    return { success: true, messageId };
  } catch (error: any) {
    console.error('[RunNotifications] Email send error:', error);
    return { success: false, error: error.message || 'Unknown error sending email' };
  }
}

// WhatsApp config cache per tenant
const whatsappConfigCache: Map<string, { config: WhatsAppConfig | null; timestamp: number }> = new Map();
const WHATSAPP_CACHE_TTL = 60000; // 1 minute

interface WhatsAppConfig {
  id: string;
  tenant_id: string;
  provider?: string; // 'zapi' | 'meta'
  instance_id: string;
  instance_token: string;
  client_token: string | null;
  connection_status: string;
  phone_number: string | null;
  // Meta-specific fields
  phone_number_id?: string;
  access_token?: string;
}

// Get WhatsApp config for tenant with caching
async function getWhatsAppConfig(supabase: any, tenantId: string): Promise<WhatsAppConfig | null> {
  const cached = whatsappConfigCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < WHATSAPP_CACHE_TTL) {
    return cached.config;
  }

  // Try to get connected config (prefer meta if both exist)
  const { data, error } = await supabase
    .from('whatsapp_configs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('connection_status', 'connected')
    .eq('is_enabled', true)
    .order('provider', { ascending: false }) // 'zapi' comes after 'meta'
    .limit(1)
    .single();

  if (error || !data) {
    console.log(`[RunNotifications] No WhatsApp config found for tenant ${tenantId}`);
    whatsappConfigCache.set(tenantId, { config: null, timestamp: Date.now() });
    return null;
  }

  whatsappConfigCache.set(tenantId, { config: data, timestamp: Date.now() });
  return data;
}

// Send WhatsApp - routes to Meta or Z-API based on provider
async function sendWhatsApp(
  supabase: any,
  tenantId: string,
  recipient: string,
  message: string
): Promise<{ success: boolean; error?: string; response?: Record<string, unknown>; messageId?: string }> {
  console.log(`[RunNotifications] WhatsApp: Sending to ${recipient} for tenant ${tenantId}`);
  
  // Validate phone number
  let cleanPhone = (recipient || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 10) {
    return {
      success: false,
      error: `Número de WhatsApp inválido: "${recipient}" (mínimo 10 dígitos)`,
      response: { channel: 'whatsapp', to: recipient, validated: false }
    };
  }

  // Add Brazil country code if not present
  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    cleanPhone = '55' + cleanPhone;
  }

  // Get WhatsApp config for tenant
  const config = await getWhatsAppConfig(supabase, tenantId);
  
  if (!config) {
    return {
      success: false,
      error: 'WhatsApp não configurado. Configure em Integrações → Outros → WhatsApp.',
      response: { channel: 'whatsapp', to: recipient }
    };
  }

  if (config.connection_status !== 'connected') {
    return {
      success: false,
      error: `WhatsApp não está conectado (status: ${config.connection_status}). Conecte em Integrações.`,
      response: { channel: 'whatsapp', to: recipient, status: config.connection_status }
    };
  }

  // Route based on provider
  if (config.provider === 'meta') {
    return await sendWhatsAppViaMeta(supabase, tenantId, cleanPhone, message, config);
  } else {
    return await sendWhatsAppViaZAPI(supabase, tenantId, cleanPhone, message, config);
  }
}

// Send WhatsApp via Meta Cloud API
async function sendWhatsAppViaMeta(
  supabase: any,
  tenantId: string,
  cleanPhone: string,
  message: string,
  config: WhatsAppConfig
): Promise<{ success: boolean; error?: string; response?: Record<string, unknown>; messageId?: string }> {
  console.log(`[RunNotifications] Sending via Meta WhatsApp to ${cleanPhone}`);

  if (!config.phone_number_id || !config.access_token) {
    return {
      success: false,
      error: 'Configuração Meta incompleta (phone_number_id ou access_token ausente).',
      response: { channel: 'whatsapp', to: cleanPhone, provider: 'meta' }
    };
  }

  try {
    // Get graph API version from platform credentials
    const { data: versionCred } = await supabase
      .from("platform_credentials")
      .select("credential_value")
      .eq("credential_key", "META_GRAPH_API_VERSION")
      .eq("is_active", true)
      .single();

    const graphApiVersion = versionCred?.credential_value || "v21.0";

    // Build message payload (text message within 24h window, or use template for notifications)
    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: { body: message },
    };

    const sendUrl = `https://graph.facebook.com/${graphApiVersion}/${config.phone_number_id}/messages`;
    
    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const sendResult = await sendResponse.json();

    if (sendResult.error) {
      console.error(`[RunNotifications] Meta WhatsApp error:`, sendResult.error);
      
      // Log failed message (use correct column names from schema)
      await supabase.from('whatsapp_messages').insert({
        tenant_id: tenantId,
        recipient_phone: cleanPhone,
        message_type: 'text',
        message_content: message.substring(0, 500),
        status: 'failed',
        error_message: sendResult.error.message,
      });

      return {
        success: false,
        error: sendResult.error.message || 'Erro ao enviar via Meta WhatsApp',
        response: sendResult
      };
    }

    const messageId = sendResult.messages?.[0]?.id;
    console.log(`[RunNotifications] Meta WhatsApp sent - ID: ${messageId}`);

    // Log successful message (use correct column names from schema)
    await supabase.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      recipient_phone: cleanPhone,
      message_type: 'text',
      message_content: message.substring(0, 500),
      status: 'sent',
      sent_at: new Date().toISOString(),
      provider_message_id: messageId,
    });

    return {
      success: true,
      messageId: messageId,
      response: {
        channel: 'whatsapp',
        provider: 'meta',
        to: cleanPhone,
        ...sendResult
      }
    };

  } catch (error: any) {
    console.error(`[RunNotifications] Meta WhatsApp exception:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar via Meta WhatsApp',
      response: { channel: 'whatsapp', provider: 'meta', to: cleanPhone }
    };
  }
}

// Send WhatsApp via Z-API (legacy)
async function sendWhatsAppViaZAPI(
  supabase: any,
  tenantId: string,
  cleanPhone: string,
  message: string,
  config: WhatsAppConfig
): Promise<{ success: boolean; error?: string; response?: Record<string, unknown>; messageId?: string }> {
  console.log(`[RunNotifications] Sending via Z-API to ${cleanPhone}`);

  if (!config.instance_id || !config.instance_token) {
    return {
      success: false,
      error: 'Credenciais do WhatsApp não configuradas (Instance ID/Token).',
      response: { channel: 'whatsapp', to: cleanPhone, provider: 'zapi' }
    };
  }

  if (!config.client_token) {
    return {
      success: false,
      error: 'Client Token Z-API não configurado. Configure em Plataforma → Integrações.',
      response: { channel: 'whatsapp', to: cleanPhone, provider: 'zapi' }
    };
  }

  // Z-API send text message
  const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
  
  try {
    const sendRes = await fetch(`${baseUrl}/send-text`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Client-Token': config.client_token
      },
      body: JSON.stringify({
        phone: cleanPhone,
        message: message
      })
    });

    const sendData = await sendRes.json();
    console.log(`[RunNotifications] WhatsApp Z-API response:`, sendData);

    if (!sendRes.ok || sendData.error) {
      const errorMsg = sendData.error || sendData.message || `Z-API error: ${sendRes.status}`;
      
      // Log failed message
      await supabase.from('whatsapp_messages').insert({
        tenant_id: tenantId,
        recipient_phone: cleanPhone,
        message_content: message.substring(0, 500),
        status: 'failed',
        error_message: errorMsg,
        provider_response: sendData,
      });

      return {
        success: false,
        error: errorMsg,
        response: sendData
      };
    }

    // Log successful message
    await supabase.from('whatsapp_messages').insert({
      tenant_id: tenantId,
      recipient_phone: cleanPhone,
      message_content: message.substring(0, 500),
      status: 'sent',
      provider_message_id: sendData.messageId || sendData.zapiMessageId,
      provider_response: sendData,
      sent_at: new Date().toISOString(),
    });

    return {
      success: true,
      messageId: sendData.messageId || sendData.zapiMessageId,
      response: {
        channel: 'whatsapp',
        provider: 'zapi',
        to: cleanPhone,
        from: config.phone_number,
        ...sendData
      }
    };

  } catch (error: any) {
    console.error(`[RunNotifications] WhatsApp Z-API error:`, error);
    return {
      success: false,
      error: error.message || 'Erro ao enviar WhatsApp',
      response: { channel: 'whatsapp', provider: 'zapi', to: cleanPhone }
    };
  }
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
    const sendgridApiKey = Deno.env.get('SENDGRID_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log(`[RunNotifications] Starting with limit=${limit}, tenant_id=${tenantId || 'all'}, sendgrid_configured=${!!sendgridApiKey}`);

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
        // Get email config for tenant (with automatic system fallback)
        const emailConfig = await getEmailConfig(supabase, notification.tenant_id);
        
        if (!sendgridApiKey) {
          sendResult = {
            success: false,
            error: 'SENDGRID_API_KEY não configurada. Configure a API key nas variáveis de ambiente.'
          };
        } else if (!emailConfig) {
          // This means neither tenant nor system has verified email config
          sendResult = {
            success: false,
            error: 'Nenhum remetente de email configurado. Configure o Email do Sistema (Plataforma) ou o email da loja em Integrações.'
          };
        } else if (!emailConfig.from_email || !emailConfig.from_name) {
          sendResult = {
            success: false,
            error: 'Configuração de email incompleta. Preencha nome e email do remetente.'
          };
        } else if (!notification.recipient || !notification.recipient.includes('@')) {
          sendResult = {
            success: false,
            error: `Email do destinatário inválido: "${notification.recipient}"`
          };
        } else {
          // Send real email - config is already verified (from tenant or system fallback)
          const fromUsed = emailConfig.from_email;
          const isSystemFallback = emailConfig.tenant_id === 'system';
          console.log(`[RunNotifications] Sending email to ${notification.recipient} from ${fromUsed} (system_fallback=${isSystemFallback})`);
          
          sendResult = await sendEmail(sendgridApiKey, emailConfig, notification.recipient, emailSubject, emailBody);
          
          if (sendResult.success) {
            // Add from_used to response for logging
            sendResult.response = { 
              ...sendResult.response, 
              from_used: fromUsed,
              is_system_fallback: isSystemFallback
            };
          }
        }
      } else if (notification.channel === 'whatsapp') {
        // WhatsApp via Z-API
        sendResult = await sendWhatsApp(supabase, notification.tenant_id, notification.recipient, whatsappMessage);
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
