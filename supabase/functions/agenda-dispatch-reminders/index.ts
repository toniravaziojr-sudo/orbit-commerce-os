import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgendaReminder {
  id: string;
  tenant_id: string;
  task_id: string;
  channel: string;
  remind_at: string;
  status: string;
}

interface AgendaTask {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  due_at: string;
  status: string;
  is_recurring: boolean;
  recurrence: { type: string; interval: number } | null;
  reminder_offsets: number[] | null;
}

interface WhatsAppConfig {
  id: string;
  tenant_id: string;
  instance_id: string | null;
  instance_token: string | null;
  client_token: string | null;
  connection_status: string;
  phone_number: string | null;
  is_enabled: boolean;
}

// Helper to format date for Brazilian timezone
function formatDateBR(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Calculate next occurrence for recurring tasks
function calculateNextDueAt(currentDueAt: string, recurrence: { type: string; interval: number }): Date {
  const date = new Date(currentDueAt);
  
  switch (recurrence.type) {
    case 'daily':
      date.setDate(date.getDate() + recurrence.interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * recurrence.interval));
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + recurrence.interval);
      break;
  }
  
  return date;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[agenda-dispatch] Starting reminder dispatch...');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch pending reminders that are due
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('agenda_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('remind_at', new Date().toISOString())
      .order('remind_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('[agenda-dispatch] Error fetching reminders:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('[agenda-dispatch] No pending reminders to dispatch');
      return new Response(
        JSON.stringify({ success: true, dispatched: 0, message: 'No pending reminders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[agenda-dispatch] Found ${pendingReminders.length} reminders to dispatch`);

    // Group reminders by tenant for efficiency
    const remindersByTenant = new Map<string, AgendaReminder[]>();
    for (const reminder of pendingReminders) {
      const tenantReminders = remindersByTenant.get(reminder.tenant_id) || [];
      tenantReminders.push(reminder);
      remindersByTenant.set(reminder.tenant_id, tenantReminders);
    }

    let dispatched = 0;
    let failed = 0;
    const results: { reminder_id: string; status: string; error?: string }[] = [];

    // Process each tenant's reminders
    for (const [tenantId, tenantReminders] of remindersByTenant) {
      console.log(`[agenda-dispatch] Processing ${tenantReminders.length} reminders for tenant ${tenantId}`);

      // Fetch WhatsApp config for tenant
      const { data: waConfig, error: waError } = await supabase
        .from('whatsapp_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      const isWhatsAppConfigured = waConfig && 
        waConfig.is_enabled && 
        waConfig.instance_id && 
        waConfig.instance_token && 
        waConfig.client_token &&
        waConfig.connection_status === 'connected';

      // Get unique task IDs
      const taskIds = [...new Set(tenantReminders.map(r => r.task_id))];
      
      // Fetch tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('agenda_tasks')
        .select('*')
        .in('id', taskIds);

      if (tasksError) {
        console.error(`[agenda-dispatch] Error fetching tasks:`, tasksError);
        // Mark all reminders as failed
        for (const reminder of tenantReminders) {
          await supabase
            .from('agenda_reminders')
            .update({
              status: 'failed',
              last_error: 'task_fetch_error',
            })
            .eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'task_fetch_error' });
        }
        continue;
      }

      const tasksMap = new Map<string, AgendaTask>(tasks?.map(t => [t.id, t]) || []);

      // Process each reminder
      for (const reminder of tenantReminders) {
        const task = tasksMap.get(reminder.task_id);

        if (!task) {
          console.log(`[agenda-dispatch] Task not found for reminder ${reminder.id}`);
          await supabase
            .from('agenda_reminders')
            .update({
              status: 'failed',
              last_error: 'task_not_found',
            })
            .eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'task_not_found' });
          continue;
        }

        // If task is not pending, skip the reminder
        if (task.status !== 'pending') {
          console.log(`[agenda-dispatch] Task ${task.id} is ${task.status}, skipping reminder`);
          await supabase
            .from('agenda_reminders')
            .update({
              status: 'skipped',
              last_error: `task_${task.status}`,
            })
            .eq('id', reminder.id);
          results.push({ reminder_id: reminder.id, status: 'skipped', error: `task_${task.status}` });
          continue;
        }

        // Check WhatsApp configuration
        if (!isWhatsAppConfigured) {
          console.log(`[agenda-dispatch] WhatsApp not configured for tenant ${tenantId}`);
          await supabase
            .from('agenda_reminders')
            .update({
              status: 'failed',
              last_error: 'whatsapp_not_configured',
            })
            .eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'whatsapp_not_configured' });
          continue;
        }

        // Build message
        const message = buildReminderMessage(task);

        // Send via WhatsApp (using existing whatsapp-send function pattern)
        try {
          const sendResult = await sendWhatsAppMessage(waConfig as WhatsAppConfig, message);

          if (sendResult.success) {
            await supabase
              .from('agenda_reminders')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                last_error: null,
              })
              .eq('id', reminder.id);
            dispatched++;
            results.push({ reminder_id: reminder.id, status: 'sent' });
            console.log(`[agenda-dispatch] Reminder ${reminder.id} sent successfully`);
          } else {
            await supabase
              .from('agenda_reminders')
              .update({
                status: 'failed',
                last_error: sendResult.error || 'send_failed',
              })
              .eq('id', reminder.id);
            failed++;
            results.push({ reminder_id: reminder.id, status: 'failed', error: sendResult.error });
            console.log(`[agenda-dispatch] Reminder ${reminder.id} failed: ${sendResult.error}`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'unknown_error';
          await supabase
            .from('agenda_reminders')
            .update({
              status: 'failed',
              last_error: errorMsg,
            })
            .eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: errorMsg });
          console.error(`[agenda-dispatch] Reminder ${reminder.id} error:`, err);
        }
      }

      // Handle recurring tasks: create next occurrence if all reminders sent
      for (const task of (tasks || [])) {
        if (!task.is_recurring || !task.recurrence) continue;

        // Check if all reminders for this task are done (sent/failed/skipped)
        const taskReminders = tenantReminders.filter(r => r.task_id === task.id);
        const allDone = taskReminders.every(r => 
          results.find(res => res.reminder_id === r.id && res.status !== 'pending')
        );

        if (allDone && task.status === 'pending') {
          // Check if task is past due
          const dueAt = new Date(task.due_at);
          if (dueAt <= new Date()) {
            // Create next occurrence
            const nextDueAt = calculateNextDueAt(task.due_at, task.recurrence);
            
            console.log(`[agenda-dispatch] Creating next occurrence for recurring task ${task.id}, next due: ${nextDueAt.toISOString()}`);

            // Create new task for next occurrence
            const { data: newTask, error: newTaskError } = await supabase
              .from('agenda_tasks')
              .insert({
                tenant_id: task.tenant_id,
                created_by: task.created_by,
                title: task.title,
                description: task.description,
                due_at: nextDueAt.toISOString(),
                status: 'pending',
                is_recurring: true,
                recurrence: task.recurrence,
                reminder_offsets: task.reminder_offsets,
              })
              .select()
              .single();

            if (newTaskError) {
              console.error(`[agenda-dispatch] Error creating next occurrence:`, newTaskError);
            } else if (newTask && task.reminder_offsets) {
              // Create reminders for new task
              const reminderInserts = (task.reminder_offsets as number[]).map(offsetMinutes => {
                const remindAt = new Date(nextDueAt.getTime() - offsetMinutes * 60 * 1000);
                return {
                  tenant_id: task.tenant_id,
                  task_id: newTask.id,
                  channel: 'whatsapp',
                  remind_at: remindAt.toISOString(),
                  status: 'pending',
                };
              });

              await supabase.from('agenda_reminders').insert(reminderInserts);
              console.log(`[agenda-dispatch] Created ${reminderInserts.length} reminders for next occurrence`);
            }

            // Mark current task as completed (auto-complete recurring)
            await supabase
              .from('agenda_tasks')
              .update({ status: 'completed' })
              .eq('id', task.id);
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[agenda-dispatch] Completed in ${duration}ms: ${dispatched} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        dispatched,
        failed,
        total: pendingReminders.length,
        duration_ms: duration,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[agenda-dispatch] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'unknown' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildReminderMessage(task: AgendaTask): string {
  const dueDateFormatted = formatDateBR(task.due_at);
  
  let message = `🔔 *Lembrete*\n\n`;
  message += `*${task.title}*\n`;
  message += `📅 Vence em: ${dueDateFormatted}\n`;
  
  if (task.description) {
    message += `\n📝 ${task.description}`;
  }

  return message;
}

async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  message: string
): Promise<{ success: boolean; error?: string }> {
  
  if (!config.phone_number) {
    return { success: false, error: 'no_phone_number_configured' };
  }

  // Format phone number
  let cleanPhone = config.phone_number.replace(/\D/g, '');
  if (cleanPhone.length === 11 || cleanPhone.length === 10) {
    cleanPhone = '55' + cleanPhone;
  }

  // Z-API send
  const baseUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.instance_token}`;
  
  const response = await fetch(`${baseUrl}/send-text`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': config.client_token!,
    },
    body: JSON.stringify({
      phone: cleanPhone,
      message: message,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    return { success: false, error: data.error || data.message || `HTTP ${response.status}` };
  }

  return { success: true };
}
