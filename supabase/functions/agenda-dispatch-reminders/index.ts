import { createClient } from 'npm:@supabase/supabase-js@2';
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "v2.0.0"; // Template fallback + atomic claim + improved recurrence

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TYPES
// ============================================

interface AgendaTask {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  due_at: string;
  status: string;
  is_recurring: boolean;
  recurrence: { type: string; interval: number; byweekday?: number[]; bymonthday?: number } | null;
  reminder_offsets: number[] | null;
  created_by: string;
}

interface WhatsAppConfig {
  id: string;
  tenant_id: string;
  provider?: string;
  phone_number: string | null;
  phone_number_id?: string | null;
  access_token?: string | null;
  is_enabled: boolean;
  connection_status: string;
}

// ============================================
// HELPERS
// ============================================

function formatDateBR(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', { 
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function calculateNextDueAt(currentDueAt: string, recurrence: { type: string; interval: number; byweekday?: number[]; bymonthday?: number }): Date {
  const date = new Date(currentDueAt);
  
  switch (recurrence.type) {
    case 'daily':
      date.setDate(date.getDate() + recurrence.interval);
      break;
    case 'weekly':
      date.setDate(date.getDate() + (7 * recurrence.interval));
      break;
    case 'monthly': {
      date.setMonth(date.getMonth() + recurrence.interval);
      // If bymonthday is specified, pin to that day
      if (recurrence.bymonthday) {
        const maxDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        date.setDate(Math.min(recurrence.bymonthday, maxDay));
      }
      break;
    }
  }
  
  // Safety: ensure the next date is always in the future
  const now = new Date();
  while (date <= now) {
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
  }
  
  return date;
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log(`[agenda-dispatch] ${VERSION} Starting reminder dispatch...`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── ATOMIC CLAIM: claim pending reminders in a single UPDATE ──
    // This prevents duplicate dispatch from concurrent cron executions
    const { data: claimedReminders, error: claimError } = await supabase
      .rpc('claim_pending_reminders', { batch_limit: 100 })
      .select('*');

    // Fallback if RPC doesn't exist yet — use standard query
    let pendingReminders = claimedReminders;
    if (claimError) {
      console.warn(`[agenda-dispatch] RPC claim_pending_reminders not available, using standard query:`, claimError.message);
      
      const { data: fetched, error: fetchError } = await supabase
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
      pendingReminders = fetched;
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('[agenda-dispatch] No pending reminders to dispatch');
      return new Response(
        JSON.stringify({ success: true, dispatched: 0, message: 'No pending reminders' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[agenda-dispatch] Found ${pendingReminders.length} reminders to dispatch`);

    // Group by tenant
    const remindersByTenant = new Map<string, typeof pendingReminders>();
    for (const reminder of pendingReminders) {
      const arr = remindersByTenant.get(reminder.tenant_id) || [];
      arr.push(reminder);
      remindersByTenant.set(reminder.tenant_id, arr);
    }

    let dispatched = 0;
    let failed = 0;
    const results: { reminder_id: string; status: string; error?: string }[] = [];

    for (const [tenantId, tenantReminders] of remindersByTenant) {
      console.log(`[agenda-dispatch] Processing ${tenantReminders.length} reminders for tenant ${tenantId.slice(0, 8)}`);

      // Get WhatsApp config
      const { data: waConfig } = await supabase
        .from('whatsapp_configs')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_enabled', true)
        .single();

      if (!waConfig || !waConfig.access_token || !waConfig.phone_number_id) {
        console.warn(`[agenda-dispatch] WhatsApp not configured for tenant ${tenantId.slice(0, 8)}`);
        for (const reminder of tenantReminders) {
          await supabase.from('agenda_reminders').update({ status: 'failed', last_error: 'whatsapp_not_configured' }).eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'whatsapp_not_configured' });
        }
        continue;
      }

      // Get authorized phones for this tenant (these are the admin numbers to send reminders to)
      const { data: authorizedPhones } = await supabase
        .from('agenda_authorized_phones')
        .select('phone')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (!authorizedPhones || authorizedPhones.length === 0) {
        console.warn(`[agenda-dispatch] No authorized phones for tenant ${tenantId.slice(0, 8)}`);
        for (const reminder of tenantReminders) {
          await supabase.from('agenda_reminders').update({ status: 'failed', last_error: 'no_authorized_phones' }).eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'no_authorized_phones' });
        }
        continue;
      }

      // Get tasks
      const taskIds = [...new Set((tenantReminders as any[]).map((r: any) => r.task_id))];
      const { data: tasks, error: tasksError } = await supabase
        .from('agenda_tasks')
        .select('*')
        .in('id', taskIds);

      if (tasksError) {
        for (const reminder of tenantReminders) {
          await supabase.from('agenda_reminders').update({ status: 'failed', last_error: 'task_fetch_error' }).eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'task_fetch_error' });
        }
        continue;
      }

      const tasksMap = new Map<string, AgendaTask>(tasks?.map(t => [t.id, t]) || []);

      // Check last inbound message time for 24h window detection
      const { data: lastInbound } = await supabase
        .from('agenda_command_log')
        .select('created_at')
        .eq('tenant_id', tenantId)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const lastInboundTime = lastInbound ? new Date(lastInbound.created_at).getTime() : 0;
      const isWithin24h = (Date.now() - lastInboundTime) < 24 * 60 * 60 * 1000;

      for (const reminder of tenantReminders) {
        const task = tasksMap.get(reminder.task_id);

        if (!task) {
          await supabase.from('agenda_reminders').update({ status: 'failed', last_error: 'task_not_found' }).eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'task_not_found' });
          continue;
        }

        if (task.status !== 'pending') {
          await supabase.from('agenda_reminders').update({ status: 'skipped', last_error: `task_${task.status}` }).eq('id', reminder.id);
          results.push({ reminder_id: reminder.id, status: 'skipped', error: `task_${task.status}` });
          continue;
        }

        // Send to all authorized phones
        let sendSuccess = false;
        for (const phoneRecord of authorizedPhones) {
          try {
            let sendResult: { success: boolean; error?: string };

            if (isWithin24h) {
              // Within 24h window — send free-form text
              const message = buildReminderMessage(task);
              sendResult = await sendViaMetaSend(supabaseUrl, supabaseServiceKey, tenantId, phoneRecord.phone, message);
            } else {
              // Outside 24h — must use template
              sendResult = await sendViaTemplate(supabaseUrl, supabaseServiceKey, tenantId, phoneRecord.phone, task);
            }

            if (sendResult.success) {
              sendSuccess = true;
            } else {
              console.warn(`[agenda-dispatch] Failed to send to ${phoneRecord.phone}: ${sendResult.error}`);
            }
          } catch (err) {
            console.error(`[agenda-dispatch] Send error:`, err);
          }
        }

        if (sendSuccess) {
          await supabase.from('agenda_reminders').update({
            status: 'dispatched',
            sent_at: new Date().toISOString(),
            last_error: null,
          }).eq('id', reminder.id);
          dispatched++;
          results.push({ reminder_id: reminder.id, status: 'dispatched' });
        } else {
          await supabase.from('agenda_reminders').update({
            status: 'failed',
            last_error: isWithin24h ? 'send_failed' : 'template_send_failed',
          }).eq('id', reminder.id);
          failed++;
          results.push({ reminder_id: reminder.id, status: 'failed', error: 'send_failed' });
        }
      }

      // ── HANDLE RECURRING TASKS ──
      for (const task of (tasks || [])) {
        if (!task.is_recurring || !task.recurrence) continue;
        if (task.status !== 'pending') continue;

        const dueAt = new Date(task.due_at);
        if (dueAt > new Date()) continue; // Not yet due

        // Check all reminders for this task are processed
        const taskReminders = (tenantReminders as any[]).filter((r: any) => r.task_id === task.id);
        const allProcessed = taskReminders.every((r: any) =>
          results.find(res => res.reminder_id === r.id)
        );

        if (allProcessed) {
          const nextDueAt = calculateNextDueAt(task.due_at, task.recurrence);
          console.log(`[agenda-dispatch] Recurring task ${task.id.slice(0, 8)}: next due ${nextDueAt.toISOString()}`);

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
            .select('id')
            .single();

          if (!newTaskError && newTask && task.reminder_offsets) {
            const reminderInserts = (task.reminder_offsets as number[]).map(offsetMinutes => ({
              tenant_id: task.tenant_id,
              task_id: newTask.id,
              channel: 'whatsapp',
              remind_at: new Date(nextDueAt.getTime() - offsetMinutes * 60 * 1000).toISOString(),
              status: 'pending',
            }));
            await supabase.from('agenda_reminders').insert(reminderInserts);
          }

          // Mark current as completed
          await supabase.from('agenda_tasks').update({ status: 'completed' }).eq('id', task.id);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[agenda-dispatch] Completed in ${duration}ms: ${dispatched} dispatched, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, dispatched, failed, total: pendingReminders.length, duration_ms: duration, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[agenda-dispatch] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================
// MESSAGE BUILDERS
// ============================================

function buildReminderMessage(task: AgendaTask): string {
  const dueDateFormatted = formatDateBR(task.due_at);
  let message = `🔔 *Lembrete*\n\n*${task.title}*\n📅 Vence em: ${dueDateFormatted}`;
  if (task.description) {
    message += `\n\n📝 ${task.description}`;
  }
  return message;
}

// ============================================
// SEND METHODS
// ============================================

async function sendViaMetaSend(
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  phone: string,
  message: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ tenant_id: tenantId, phone, message }),
    });
    const result = await response.json();
    return { success: result.success === true, error: result.error };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

async function sendViaTemplate(
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  phone: string,
  task: AgendaTask,
): Promise<{ success: boolean; error?: string }> {
  const dueDateFormatted = formatDateBR(task.due_at);
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        phone,
        template_name: 'agenda_lembrete',
        template_language: 'pt_BR',
        template_components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: task.title },
              { type: 'text', text: dueDateFormatted },
              { type: 'text', text: task.description || 'Sem descrição' },
            ],
          },
        ],
      }),
    });
    const result = await response.json();
    
    if (!result.success && result.error?.includes('template')) {
      console.warn(`[agenda-dispatch] Template not approved yet, marking as failed`);
      return { success: false, error: 'template_not_approved' };
    }
    
    return { success: result.success === true, error: result.error };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}
