import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface ProcessCommandInput {
  tenant_id: string;
  from_phone: string;
  message_content: string;
  external_message_id: string;
  message_type: string;
}

interface PendingAction {
  action: string;
  params: Record<string, unknown>;
  description: string;
  created_at: string;
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[agenda-process-command][${traceId}] ${VERSION} Request received`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const input: ProcessCommandInput = await req.json();
    const { tenant_id, from_phone, message_content, external_message_id, message_type } = input;

    if (!tenant_id || !from_phone || !message_content || !external_message_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agenda-process-command][${traceId}] tenant=${tenant_id.slice(0, 8)} phone=${from_phone} msg="${message_content.slice(0, 80)}"`);

    // ── DEDUPLICATION ──
    const { data: existing } = await supabase
      .from("agenda_command_log")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("external_message_id", external_message_id)
      .maybeSingle();

    if (existing) {
      console.log(`[agenda-process-command][${traceId}] Duplicate message, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "duplicate" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LOG: RECEIVED ──
    const correlationId = crypto.randomUUID();
    const { data: logEntry, error: logError } = await supabase
      .from("agenda_command_log")
      .insert({
        tenant_id,
        direction: "inbound",
        external_message_id,
        from_phone,
        content: message_content,
        status: "received",
        correlation_id: correlationId,
      })
      .select("id")
      .single();

    if (logError) {
      console.error(`[agenda-process-command][${traceId}] Failed to log:`, logError);
    }
    const logId = logEntry?.id;

    // ── CHECK FOR PENDING CONFIRMATION ("Sim") ──
    const normalizedContent = message_content.trim().toLowerCase();
    const isConfirmation = ["sim", "s", "confirma", "confirmar", "ok", "yes"].includes(normalizedContent);
    const isRejection = ["não", "nao", "n", "cancelar", "cancela", "no"].includes(normalizedContent);

    if (isConfirmation || isRejection) {
      const result = await handleConfirmation(supabase, tenant_id, from_phone, isConfirmation, logId, traceId);
      if (result.handled) {
        // Send response via WhatsApp
        await sendAgendaReply(supabaseUrl, supabaseServiceKey, tenant_id, from_phone, result.reply);
        return new Response(
          JSON.stringify({ success: true, action: isConfirmation ? "confirmed" : "rejected" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // If no pending action found, fall through to IA interpretation
    }

    // ── CHAT HISTORY (last 10 messages for context) ──
    const { data: chatHistory } = await supabase
      .from("agenda_chat_history")
      .select("role, content, intent, action_result")
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const reversedHistory = (chatHistory || []).reverse();

    // ── FETCH CURRENT TASKS (for context) ──
    const { data: pendingTasks } = await supabase
      .from("agenda_tasks")
      .select("id, title, description, due_at, status, is_recurring")
      .eq("tenant_id", tenant_id)
      .eq("status", "pending")
      .order("due_at", { ascending: true })
      .limit(20);

    // ── SAVE USER MESSAGE TO CHAT HISTORY ──
    await supabase.from("agenda_chat_history").insert({
      tenant_id,
      role: "user",
      content: message_content,
      correlation_id: correlationId,
    });

    // ── CALL AI (Gemini 2.5 Flash via Lovable proxy) ──
    const now = new Date();
    const brTime = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    const systemPrompt = buildSystemPrompt(brTime, pendingTasks || []);
    const aiMessages = buildAIMessages(systemPrompt, reversedHistory, message_content);

    console.log(`[agenda-process-command][${traceId}] Calling AI with ${aiMessages.length} messages`);

    const aiResponse = await callAI(aiMessages, traceId);

    if (!aiResponse.success) {
      console.error(`[agenda-process-command][${traceId}] AI failed:`, aiResponse.error);
      const errorReply = "Desculpe, estou com dificuldade para processar sua mensagem agora. Tente novamente em instantes. 🙏";
      await sendAgendaReply(supabaseUrl, supabaseServiceKey, tenant_id, from_phone, errorReply);
      await updateLog(supabase, logId, { status: "failed", error_message: aiResponse.error });
      return new Response(
        JSON.stringify({ success: false, error: "ai_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = aiResponse.data!;
    console.log(`[agenda-process-command][${traceId}] AI result: intent=${aiResult.intent}, needs_confirm=${aiResult.needs_confirmation}`);

    // ── EXECUTE BASED ON INTENT ──
    let reply = aiResult.reply;
    let actionTaken = aiResult.intent;
    let finalStatus = "interpreted";

    if (aiResult.intent === "create_task" && aiResult.task_data) {
      if (aiResult.needs_confirmation) {
        // Freeze action for confirmation
        const pendingAction: PendingAction = {
          action: "create_task",
          params: aiResult.task_data,
          description: aiResult.reply,
          created_at: new Date().toISOString(),
        };
        await updateLog(supabase, logId, {
          status: "awaiting_confirmation",
          intent: "create_task",
          pending_action: pendingAction,
        });
        finalStatus = "awaiting_confirmation";
      } else {
        // Execute directly
        const taskResult = await executeCreateTask(supabase, tenant_id, aiResult.task_data, traceId);
        if (taskResult.success) {
          actionTaken = "create_task";
          finalStatus = "executed";
          reply = aiResult.reply;
        } else {
          reply = `Desculpe, não consegui criar o lembrete: ${taskResult.error}. Tente novamente.`;
          finalStatus = "failed";
        }
      }
    } else if (aiResult.intent === "list_tasks") {
      finalStatus = "executed";
      actionTaken = "list_tasks";
    } else if (aiResult.intent === "complete_task" && aiResult.target_task_id) {
      if (aiResult.needs_confirmation) {
        const pendingAction: PendingAction = {
          action: "complete_task",
          params: { task_id: aiResult.target_task_id },
          description: aiResult.reply,
          created_at: new Date().toISOString(),
        };
        await updateLog(supabase, logId, {
          status: "awaiting_confirmation",
          intent: "complete_task",
          pending_action: pendingAction,
        });
        finalStatus = "awaiting_confirmation";
      } else {
        await supabase.from("agenda_tasks").update({ status: "completed" }).eq("id", aiResult.target_task_id).eq("tenant_id", tenant_id);
        finalStatus = "executed";
      }
    } else if (aiResult.intent === "cancel_task" && aiResult.target_task_id) {
      const pendingAction: PendingAction = {
        action: "cancel_task",
        params: { task_id: aiResult.target_task_id },
        description: aiResult.reply,
        created_at: new Date().toISOString(),
      };
      await updateLog(supabase, logId, {
        status: "awaiting_confirmation",
        intent: "cancel_task",
        pending_action: pendingAction,
      });
      finalStatus = "awaiting_confirmation";
    } else if (aiResult.intent === "cancel_all") {
      const pendingAction: PendingAction = {
        action: "cancel_all",
        params: {},
        description: aiResult.reply,
        created_at: new Date().toISOString(),
      };
      await updateLog(supabase, logId, {
        status: "awaiting_confirmation",
        intent: "cancel_all",
        pending_action: pendingAction,
      });
      finalStatus = "awaiting_confirmation";
    } else if (aiResult.intent === "disambiguate") {
      finalStatus = "interpreted";
      actionTaken = "disambiguate";
    } else {
      // chat, greeting, unknown — just reply
      finalStatus = "executed";
      actionTaken = aiResult.intent || "chat";
    }

    // ── UPDATE LOG ──
    if (finalStatus !== "awaiting_confirmation") {
      await updateLog(supabase, logId, {
        status: finalStatus,
        intent: actionTaken,
        action_taken: actionTaken,
      });
    }

    // ── SAVE ASSISTANT REPLY TO CHAT HISTORY ──
    await supabase.from("agenda_chat_history").insert({
      tenant_id,
      role: "assistant",
      content: reply,
      intent: aiResult.intent,
      action_result: aiResult.task_data || null,
      correlation_id: correlationId,
    });

    // ── SEND REPLY VIA WHATSAPP ──
    await sendAgendaReply(supabaseUrl, supabaseServiceKey, tenant_id, from_phone, reply);

    return new Response(
      JSON.stringify({ success: true, intent: aiResult.intent, status: finalStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[agenda-process-command][${traceId}] Error:`, error);
    return errorResponse(error, corsHeaders, { module: "agenda-process-command", action: "process" });
  }
});

// ============================================
// CONFIRMATION HANDLER
// ============================================

async function handleConfirmation(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  fromPhone: string,
  isConfirm: boolean,
  currentLogId: string | undefined,
  traceId: string,
): Promise<{ handled: boolean; reply: string }> {
  // Find the latest pending confirmation for this tenant+phone within 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: pendingCommands } = await supabase
    .from("agenda_command_log")
    .select("id, pending_action, intent, created_at")
    .eq("tenant_id", tenantId)
    .eq("from_phone", fromPhone)
    .eq("status", "awaiting_confirmation")
    .gte("created_at", fiveMinAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!pendingCommands || pendingCommands.length === 0) {
    return { handled: false, reply: "" };
  }

  // If more than one pending, list them
  if (pendingCommands.length > 1) {
    const list = pendingCommands.map((c, i) => `${i + 1}. ${(c.pending_action as PendingAction)?.description || c.intent}`).join("\n");
    return {
      handled: true,
      reply: `Você tem ${pendingCommands.length} ações pendentes de confirmação:\n\n${list}\n\nPor favor, especifique qual deseja confirmar.`,
    };
  }

  const pending = pendingCommands[0];
  const action = pending.pending_action as PendingAction;

  if (isConfirm) {
    // Execute the frozen action
    let reply = "";
    try {
      if (action.action === "create_task") {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const result = await executeCreateTask(supabase, tenantId, action.params, traceId);
        reply = result.success
          ? `✅ Lembrete criado com sucesso!\n\n*${action.params.title}*\n📅 ${action.params.due_at}`
          : `❌ Erro ao criar: ${result.error}`;
      } else if (action.action === "complete_task") {
        await supabase.from("agenda_tasks").update({ status: "completed" }).eq("id", action.params.task_id).eq("tenant_id", tenantId);
        // Skip orphaned reminders
        await supabase.from("agenda_reminders").update({ status: "skipped", last_error: "task_completed" }).eq("task_id", action.params.task_id).eq("status", "pending");
        reply = "✅ Tarefa marcada como concluída!";
      } else if (action.action === "cancel_task") {
        await supabase.from("agenda_tasks").update({ status: "cancelled" }).eq("id", action.params.task_id).eq("tenant_id", tenantId);
        await supabase.from("agenda_reminders").update({ status: "skipped", last_error: "task_cancelled" }).eq("task_id", action.params.task_id).eq("status", "pending");
        reply = "✅ Tarefa cancelada.";
      } else if (action.action === "cancel_all") {
        const { data: cancelled } = await supabase.from("agenda_tasks").update({ status: "cancelled" }).eq("tenant_id", tenantId).eq("status", "pending").select("id");
        const count = cancelled?.length || 0;
        if (count > 0) {
          const ids = cancelled!.map(t => t.id);
          await supabase.from("agenda_reminders").update({ status: "skipped", last_error: "task_cancelled" }).in("task_id", ids).eq("status", "pending");
        }
        reply = `✅ ${count} tarefa(s) cancelada(s).`;
      } else {
        reply = "⚠️ Ação não reconhecida.";
      }

      await supabase.from("agenda_command_log").update({ status: "executed", action_taken: action.action }).eq("id", pending.id);
      if (currentLogId) {
        await supabase.from("agenda_command_log").update({ status: "executed", intent: "confirmation", action_taken: `confirmed:${action.action}` }).eq("id", currentLogId);
      }
    } catch (err) {
      reply = "❌ Erro ao executar a ação. Tente novamente.";
      console.error(`[agenda-process-command] Confirmation exec error:`, err);
      await supabase.from("agenda_command_log").update({ status: "failed", error_message: String(err) }).eq("id", pending.id);
    }

    return { handled: true, reply };
  } else {
    // Rejection
    await supabase.from("agenda_command_log").update({ status: "rejected" }).eq("id", pending.id);
    if (currentLogId) {
      await supabase.from("agenda_command_log").update({ status: "executed", intent: "rejection", action_taken: `rejected:${action.action}` }).eq("id", currentLogId);
    }
    return { handled: true, reply: "❌ Ação cancelada. O que mais posso fazer por você?" };
  }
}

// ============================================
// AI CALL (Lovable AI Proxy — Gemini 2.5 Flash)
// ============================================

interface AIResult {
  intent: string;
  reply: string;
  needs_confirmation: boolean;
  task_data?: Record<string, unknown>;
  target_task_id?: string;
}

async function callAI(
  messages: Array<{ role: string; content: string }>,
  traceId: string,
): Promise<{ success: boolean; data?: AIResult; error?: string }> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    return { success: false, error: "LOVABLE_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://ai-proxy.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[agenda-process-command][${traceId}] AI HTTP error ${response.status}:`, errText);
      return { success: false, error: `AI HTTP ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return { success: false, error: "Empty AI response" };
    }

    console.log(`[agenda-process-command][${traceId}] AI raw:`, content.substring(0, 300));

    const parsed: AIResult = JSON.parse(content);
    return { success: true, data: parsed };
  } catch (err) {
    console.error(`[agenda-process-command][${traceId}] AI call error:`, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SYSTEM PROMPT
// ============================================

function buildSystemPrompt(
  currentTime: string,
  pendingTasks: Array<{ id: string; title: string; description: string | null; due_at: string; status: string; is_recurring: boolean | null }>,
): string {
  const taskList = pendingTasks.length > 0
    ? pendingTasks.map(t => {
        const due = new Date(t.due_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        return `- [${t.id.slice(0, 8)}] "${t.title}" — vence ${due}${t.is_recurring ? " (recorrente)" : ""}`;
      }).join("\n")
    : "(nenhuma tarefa pendente)";

  return `Você é a **Agenda**, assistente de IA pessoal do administrador da loja. Você gerencia tarefas e lembretes via WhatsApp.

## Data/hora atual
${currentTime} (Horário de Brasília)

## Tarefas pendentes do admin
${taskList}

## Suas capacidades
1. **Criar tarefa/lembrete**: interpretar data, hora, recorrência e offsets de lembrete
2. **Listar tarefas**: mostrar as pendentes de forma organizada
3. **Concluir tarefa**: marcar como concluída (requer ID ou correspondência única de título)
4. **Cancelar tarefa**: marcar como cancelada (SEMPRE pedir confirmação)
5. **Cancelar todas**: cancelar todas as pendentes (SEMPRE pedir confirmação)
6. **Conversar**: responder perguntas gerais sobre a agenda

## Regras OBRIGATÓRIAS
- Timezone: America/Sao_Paulo. Todas as datas/horas são neste fuso.
- "amanhã" = dia seguinte, "segunda" = próxima segunda-feira, etc.
- Se houver ambiguidade na data/hora, PERGUNTE ao admin.
- Se um comando de ação (concluir, cancelar) encontrar MÚLTIPLAS tarefas com título similar, NÃO execute — liste as opções e peça para especificar.
- Cancelamento de tarefa individual e cancelamento em massa SEMPRE pedem confirmação.
- Criação de tarefa simples pode ser executada diretamente; criação com recorrência pede confirmação.
- Responda SEMPRE em português brasileiro, de forma concisa e amigável.
- Use emojis moderadamente (📅 🔔 ✅ ❌ ⏰).

## Formato de resposta (JSON obrigatório)
Responda SEMPRE com um JSON válido com esta estrutura:
{
  "intent": "create_task" | "list_tasks" | "complete_task" | "cancel_task" | "cancel_all" | "disambiguate" | "chat",
  "reply": "Mensagem que será enviada ao admin via WhatsApp",
  "needs_confirmation": true/false,
  "task_data": {  // apenas para create_task
    "title": "string",
    "description": "string ou null",
    "due_at": "ISO 8601 string em UTC",
    "is_recurring": false,
    "recurrence": null,  // ou { "type": "daily"|"weekly"|"monthly", "interval": 1 }
    "reminder_offsets": [60]  // array de minutos antes do vencimento
  },
  "target_task_id": "uuid"  // apenas para complete_task e cancel_task, usar o ID completo da lista
}

## Padrões de lembrete
- Se o admin não especificar: 1 lembrete de 1 hora antes (60 minutos)
- "me avise 2h antes" → reminder_offsets: [120]
- "me avise 1 dia antes e 1h antes" → reminder_offsets: [1440, 60]`;
}

function buildAIMessages(
  systemPrompt: string,
  chatHistory: Array<{ role: string; content: string | null; intent?: string | null; action_result?: unknown }>,
  currentMessage: string,
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of chatHistory) {
    if (msg.content) {
      messages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }
  }

  messages.push({ role: "user", content: currentMessage });

  return messages;
}

// ============================================
// TASK EXECUTION
// ============================================

async function executeCreateTask(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  taskData: Record<string, unknown>,
  traceId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // We need a created_by — use a system user placeholder or the first admin
    // For now, use the tenant_id as created_by marker (system-created)
    const { data: tenantMembers } = await supabase
      .from("tenant_users")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .limit(1);

    const createdBy = tenantMembers?.[0]?.user_id || tenantId;

    const { data: newTask, error: taskError } = await supabase
      .from("agenda_tasks")
      .insert({
        tenant_id: tenantId,
        created_by: createdBy,
        title: taskData.title as string,
        description: (taskData.description as string) || null,
        due_at: taskData.due_at as string,
        status: "pending",
        is_recurring: (taskData.is_recurring as boolean) || false,
        recurrence: taskData.recurrence || null,
        reminder_offsets: taskData.reminder_offsets || [60],
      })
      .select("id")
      .single();

    if (taskError) {
      console.error(`[agenda-process-command][${traceId}] Task creation error:`, taskError);
      return { success: false, error: taskError.message };
    }

    // Create reminders
    const offsets = (taskData.reminder_offsets as number[]) || [60];
    const dueAt = new Date(taskData.due_at as string);

    const reminderInserts = offsets.map(offsetMinutes => ({
      tenant_id: tenantId,
      task_id: newTask.id,
      channel: "whatsapp",
      remind_at: new Date(dueAt.getTime() - offsetMinutes * 60 * 1000).toISOString(),
      status: "pending",
    }));

    const { error: reminderError } = await supabase.from("agenda_reminders").insert(reminderInserts);
    if (reminderError) {
      console.error(`[agenda-process-command][${traceId}] Reminder creation error:`, reminderError);
    }

    console.log(`[agenda-process-command][${traceId}] Task created: ${newTask.id} with ${reminderInserts.length} reminders`);
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// HELPERS
// ============================================

async function updateLog(
  supabase: ReturnType<typeof createClient>,
  logId: string | undefined,
  updates: Record<string, unknown>,
) {
  if (!logId) return;
  await supabase.from("agenda_command_log").update(updates).eq("id", logId);
}

async function sendAgendaReply(
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  phone: string,
  message: string,
) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        tenant_id: tenantId,
        phone,
        message,
      }),
    });
    const result = await response.text();
    console.log(`[agenda-process-command] WhatsApp reply sent (${response.status}):`, result.substring(0, 200));
  } catch (err) {
    console.error(`[agenda-process-command] Failed to send WhatsApp reply:`, err);
  }
}
