import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

interface RunnerStats {
  claimed_count: number;
  processed_success: number;
  processed_error: number;
  scheduled_retries: number;
  failed_final: number;
  unstuck_count: number;
}

// Mock sender - simulates sending notifications
function mockSend(channel: string, recipient: string, templateKey: string | null, payload: Record<string, unknown> | null): { success: boolean; error?: string; response: Record<string, unknown> } {
  console.log(`[MockSender] Channel: ${channel}, Recipient: ${recipient}, Template: ${templateKey}`);
  
  // Validate recipient based on channel
  if (channel === 'whatsapp') {
    // WhatsApp: recipient should be a valid phone number (at least 10 digits)
    const cleanPhone = (recipient || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      return {
        success: false,
        error: `Invalid WhatsApp recipient: "${recipient}" (requires at least 10 digits)`,
        response: { mock: true, channel, to: recipient, template: templateKey, validated: false }
      };
    }
  } else if (channel === 'email') {
    // Email: recipient should contain @
    if (!recipient || !recipient.includes('@')) {
      return {
        success: false,
        error: `Invalid email recipient: "${recipient}" (missing @)`,
        response: { mock: true, channel, to: recipient, template: templateKey, validated: false }
      };
    }
  }
  
  // Simulate successful send
  return {
    success: true,
    response: {
      mock: true,
      channel,
      to: recipient,
      template: templateKey,
      payload_keys: payload ? Object.keys(payload) : [],
      sent_at: new Date().toISOString(),
      message_id: `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`
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

    console.log(`[RunNotifications] Starting with limit=${limit}, tenant_id=${tenantId || 'all'}`);

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
      console.log(`[RunNotifications] Processing notification ${notification.id}, attempt ${attemptNo}/${notification.max_attempts}`);

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

      // Execute mock sender
      const sendResult = mockSend(
        notification.channel,
        notification.recipient,
        notification.template_key,
        notification.payload as Record<string, unknown> | null
      );

      const finishedAt = new Date().toISOString();

      // Extract payload data for logging
      const payload = notification.payload as Record<string, unknown> | null;
      const orderId = payload?.order_id as string | null;
      const customerId = payload?.customer_id as string | null;
      const checkoutSessionId = payload?.checkout_session_id as string | null;
      const ruleType = payload?.rule_type as string || 'unknown';
      const contentPreview = payload?.whatsapp_message as string || payload?.email_subject as string || null;
      const attachments = payload?.attachments || null;

      if (sendResult.success) {
        // Success path
        console.log(`[RunNotifications] Notification ${notification.id} sent successfully`);
        
        // Update attempt
        await supabase
          .from('notification_attempts')
          .update({
            status: 'success',
            finished_at: finishedAt,
            provider_response: sendResult.response
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
            provider_response: sendResult.response
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
