import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "v2.0.0"; // Etapa 3+4: Auxiliar integration, allowlist, template awareness

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

// ── ALLOWLIST: ações que a Agenda pode delegar ao Auxiliar ──
const AUXILIAR_ALLOWLIST: Record<string, { tool_name: string; needs_confirmation: boolean }> = {
  order_status:       { tool_name: "searchOrders",       needs_confirmation: false },
  update_price:       { tool_name: "bulkUpdateProductsPrice", needs_confirmation: true },
  publish_product:    { tool_name: "bulkActivateProducts",    needs_confirmation: true },
  create_discount:    { tool_name: "createDiscount",          needs_confirmation: true },
  // Campaigns not yet wired — placeholder for future
};

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
      const result = await handleConfirmation(supabase, supabaseUrl, supabaseServiceKey, tenant_id, from_phone, isConfirmation, logId, correlationId, traceId);
      if (result.handled) {
        await sendAgendaReply(supabaseUrl, supabaseServiceKey, tenant_id, from_phone, result.reply);
        return new Response(
          JSON.stringify({ success: true, action: isConfirmation ? "confirmed" : "rejected" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // ── CALL AI (Gemini 2.5 Flash via Lovable gateway) ──
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
        await freezeAction(supabase, logId, "create_task", aiResult.task_data, aiResult.reply);
        finalStatus = "awaiting_confirmation";
      } else {
        const taskResult = await executeCreateTask(supabase, tenant_id, aiResult.task_data, traceId);
        if (taskResult.success) {
          actionTaken = "create_task";
          finalStatus = "executed";
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
        await freezeAction(supabase, logId, "complete_task", { task_id: aiResult.target_task_id }, aiResult.reply);
        finalStatus = "awaiting_confirmation";
      } else {
        await supabase.from("agenda_tasks").update({ status: "completed" }).eq("id", aiResult.target_task_id).eq("tenant_id", tenant_id);
        await supabase.from("agenda_reminders").update({ status: "skipped", last_error: "task_completed" }).eq("task_id", aiResult.target_task_id).eq("status", "pending");
        finalStatus = "executed";
      }
    } else if (aiResult.intent === "cancel_task" && aiResult.target_task_id) {
      await freezeAction(supabase, logId, "cancel_task", { task_id: aiResult.target_task_id }, aiResult.reply);
      finalStatus = "awaiting_confirmation";
    } else if (aiResult.intent === "cancel_all") {
      await freezeAction(supabase, logId, "cancel_all", {}, aiResult.reply);
      finalStatus = "awaiting_confirmation";

    // ── ETAPA 3: DELEGATE TO AUXILIAR DE COMANDO ──
    } else if (aiResult.intent === "delegate_to_assistant" && aiResult.delegate_action) {
      const allowlistEntry = AUXILIAR_ALLOWLIST[aiResult.delegate_action];
      if (!allowlistEntry) {
        reply = "⚠️ Desculpe, essa ação não está disponível pela Agenda. Faça diretamente no painel.";
        finalStatus = "executed";
        actionTaken = "delegate_blocked";
      } else if (allowlistEntry.needs_confirmation) {
        await freezeAction(supabase, logId, "delegate_to_assistant", {
          delegate_action: aiResult.delegate_action,
          tool_name: allowlistEntry.tool_name,
          tool_args: aiResult.delegate_args || {},
        }, aiResult.reply);
        finalStatus = "awaiting_confirmation";
      } else {
        // Execute directly (read-only actions like order lookup)
        const delegateResult = await delegateToAuxiliar(
          supabaseUrl, supabaseServiceKey, supabase, tenant_id,
          allowlistEntry.tool_name, aiResult.delegate_args || {},
          correlationId, traceId,
        );
        if (delegateResult.success) {
          reply = `${aiResult.reply}\n\n${delegateResult.summary}`;
          finalStatus = "executed";
          actionTaken = `delegate:${aiResult.delegate_action}`;
        } else {
          reply = `❌ Não consegui executar: ${delegateResult.error}`;
          finalStatus = "failed";
        }
      }

    } else if (aiResult.intent === "disambiguate") {
      finalStatus = "interpreted";
      actionTaken = "disambiguate";
    } else {
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
      action_result: aiResult.task_data || aiResult.delegate_args || null,
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
// FREEZE ACTION (for confirmation flow)
// ============================================

async function freezeAction(
  supabase: any,
  logId: string | undefined,
  action: string,
  params: Record<string, unknown>,
  description: string,
) {
  const pendingAction: PendingAction = {
    action,
    params,
    description,
    created_at: new Date().toISOString(),
  };
  await updateLog(supabase, logId, {
    status: "awaiting_confirmation",
    intent: action,
    pending_action: pendingAction,
  });
}

// ============================================
// CONFIRMATION HANDLER
// ============================================

async function handleConfirmation(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  tenantId: string,
  fromPhone: string,
  isConfirm: boolean,
  currentLogId: string | undefined,
  correlationId: string,
  traceId: string,
): Promise<{ handled: boolean; reply: string }> {
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
    // Check for expired ones
    const { data: expiredCommands } = await supabase
      .from("agenda_command_log")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("from_phone", fromPhone)
      .eq("status", "awaiting_confirmation")
      .lt("created_at", fiveMinAgo)
      .limit(5);

    if (expiredCommands && expiredCommands.length > 0) {
      // Auto-expire them
      for (const exp of expiredCommands) {
        await supabase.from("agenda_command_log").update({ status: "expired" }).eq("id", exp.id);
      }
      return { handled: true, reply: "⏰ A confirmação expirou (limite de 5 minutos). Envie o comando novamente se desejar." };
    }

    return { handled: false, reply: "" };
  }

  if (pendingCommands.length > 1) {
    const list = pendingCommands.map((c: any, i: number) => `${i + 1}. ${(c.pending_action as PendingAction)?.description || c.intent}`).join("\n");
    return {
      handled: true,
      reply: `Você tem ${pendingCommands.length} ações pendentes de confirmação:\n\n${list}\n\nPor favor, especifique qual deseja confirmar.`,
    };
  }

  const pending = pendingCommands[0];
  const action = pending.pending_action as PendingAction;

  if (isConfirm) {
    let reply = "";
    try {
      if (action.action === "create_task") {
        const result = await executeCreateTask(supabase, tenantId, action.params, traceId);
        reply = result.success
          ? `✅ Lembrete criado com sucesso!\n\n*${action.params.title}*\n📅 ${action.params.due_at}`
          : `❌ Erro ao criar: ${result.error}`;
      } else if (action.action === "complete_task") {
        await supabase.from("agenda_tasks").update({ status: "completed" }).eq("id", action.params.task_id).eq("tenant_id", tenantId);
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
      } else if (action.action === "delegate_to_assistant") {
        // Execute the frozen delegation
        const delegateResult = await delegateToAuxiliar(
          supabaseUrl, supabaseServiceKey, supabase, tenantId,
          action.params.tool_name as string,
          (action.params.tool_args as Record<string, unknown>) || {},
          correlationId, traceId,
        );
        reply = delegateResult.success
          ? `✅ Ação executada!\n\n${delegateResult.summary}`
          : `❌ Erro: ${delegateResult.error}`;
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
    await supabase.from("agenda_command_log").update({ status: "rejected" }).eq("id", pending.id);
    if (currentLogId) {
      await supabase.from("agenda_command_log").update({ status: "executed", intent: "rejection", action_taken: `rejected:${action.action}` }).eq("id", currentLogId);
    }
    return { handled: true, reply: "❌ Ação cancelada. O que mais posso fazer por você?" };
  }
}

// ============================================
// DELEGATE TO AUXILIAR DE COMANDO (Etapa 3)
// ============================================

async function delegateToAuxiliar(
  supabaseUrl: string,
  supabaseServiceKey: string,
  supabase: any,
  tenantId: string,
  toolName: string,
  toolArgs: Record<string, unknown>,
  correlationId: string,
  traceId: string,
): Promise<{ success: boolean; summary: string; error?: string }> {
  console.log(`[agenda-process-command][${traceId}] Delegating to Auxiliar: ${toolName}`, JSON.stringify(toolArgs).slice(0, 200));

  // Get the first owner/admin user for the tenant
  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .in("user_type", ["owner", "admin"])
    .limit(1)
    .single();

  if (!tenantUser) {
    return { success: false, summary: "", error: "Nenhum administrador encontrado para o tenant" };
  }

  // Create a synthetic conversation_id for the delegation (for audit trail)
  const syntheticConvId = `agenda-delegate-${correlationId}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(`${supabaseUrl}/functions/v1/command-assistant-execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        conversation_id: syntheticConvId,
        tenant_id: tenantId,
        tool_name: toolName,
        tool_args: toolArgs,
        _internal_user_id: tenantUser.user_id,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const result = await response.json();
    console.log(`[agenda-process-command][${traceId}] Auxiliar response (${response.status}):`, JSON.stringify(result).slice(0, 300));

    if (result.error) {
      return { success: false, summary: "", error: result.error };
    }

    // Extract a human-readable summary from the tool result
    const summary = formatAuxiliarResult(toolName, result);
    return { success: true, summary };

  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, summary: "", error: "Timeout (30s) ao consultar o Auxiliar" };
    }
    console.error(`[agenda-process-command][${traceId}] Auxiliar delegation error:`, err);
    return { success: false, summary: "", error: String(err) };
  }
}

function formatAuxiliarResult(toolName: string, result: Record<string, unknown>): string {
  // For order searches, format nicely
  if (toolName === "searchOrders" && result.result) {
    const orders = (result.result as Record<string, unknown>)?.orders;
    if (Array.isArray(orders) && orders.length > 0) {
      return orders.slice(0, 5).map((o: Record<string, unknown>) =>
        `📦 Pedido #${o.order_number || o.id} — ${o.status} — R$ ${((o.total_cents as number) / 100).toFixed(2)}`
      ).join("\n");
    }
    return "Nenhum pedido encontrado.";
  }

  // Generic fallback
  if (result.message) return String(result.message);
  if (result.result) return `Resultado: ${JSON.stringify(result.result).slice(0, 300)}`;
  return "Ação executada com sucesso.";
}

// ============================================
// AI CALL (Lovable AI Gateway — Gemini 2.5 Flash)
// ============================================

interface AIResult {
  intent: string;
  reply: string;
  needs_confirmation: boolean;
  task_data?: Record<string, unknown>;
  target_task_id?: string;
  // Etapa 3: delegation
  delegate_action?: string;
  delegate_args?: Record<string, unknown>;
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
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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

    console.log(`[agenda-process-command][${traceId}] AI raw:`, content.substring(0, 400));

    const parsed: AIResult = JSON.parse(content);
    return { success: true, data: parsed };
  } catch (err) {
    console.error(`[agenda-process-command][${traceId}] AI call error:`, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// SYSTEM PROMPT (v2 — with delegation capabilities)
// ============================================

function buildSystemPrompt(
  currentTime: string,
  pendingTasks: Array<{ id: string; title: string; description: string | null; due_at: string; status: string; is_recurring: boolean | null }>,
): string {
  const taskList = pendingTasks.length > 0
    ? pendingTasks.map(t => {
        const due = new Date(t.due_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
        return `- [${t.id}] "${t.title}" — vence ${due}${t.is_recurring ? " (recorrente)" : ""}`;
      }).join("\n")
    : "(nenhuma tarefa pendente)";

  return `Você é a **Agenda**, assistente de IA pessoal do administrador da loja. Você gerencia tarefas e lembretes via WhatsApp, e pode também executar algumas ações no sistema da loja.

## Data/hora atual
${currentTime} (Horário de Brasília)

## Tarefas pendentes do admin
${taskList}

## Suas capacidades

### Gestão de Agenda
1. **Criar tarefa/lembrete**: interpretar data, hora, recorrência e offsets de lembrete
2. **Listar tarefas**: mostrar as pendentes de forma organizada
3. **Concluir tarefa**: marcar como concluída (requer correspondência única de título)
4. **Cancelar tarefa**: marcar como cancelada (SEMPRE pedir confirmação)
5. **Cancelar todas**: cancelar todas as pendentes (SEMPRE pedir confirmação)

### Ações no Sistema (delegadas ao Auxiliar de Comando)
6. **Consultar pedido**: buscar status de pedidos por número ou termo
7. **Alterar preço**: alterar preço de produto(s)
8. **Publicar/despublicar produto**: ativar ou desativar produtos
9. **Criar cupom de desconto**: criar novo cupom

Ações de escrita no sistema SEMPRE pedem confirmação antes de executar.

### Conversa
10. **Conversar**: responder perguntas gerais sobre a agenda ou a loja

## Regras OBRIGATÓRIAS
- Timezone: America/Sao_Paulo. Todas as datas/horas são neste fuso.
- "amanhã" = dia seguinte, "segunda" = próxima segunda-feira, etc.
- Se houver ambiguidade na data/hora, PERGUNTE ao admin.
- Se um comando encontrar MÚLTIPLAS correspondências, NÃO execute — liste as opções e peça para especificar.
- Cancelamento de tarefa individual e em massa SEMPRE pedem confirmação.
- Criação de tarefa simples pode ser executada diretamente; com recorrência pede confirmação.
- Responda SEMPRE em português brasileiro, de forma concisa e amigável.
- Use emojis moderadamente (📅 🔔 ✅ ❌ ⏰ 📦).

## Formato de resposta (JSON obrigatório)
Responda SEMPRE com um JSON válido com esta estrutura:
{
  "intent": "create_task" | "list_tasks" | "complete_task" | "cancel_task" | "cancel_all" | "delegate_to_assistant" | "disambiguate" | "chat",
  "reply": "Mensagem que será enviada ao admin via WhatsApp",
  "needs_confirmation": true/false,
  "task_data": {  // apenas para create_task
    "title": "string",
    "description": "string ou null",
    "due_at": "ISO 8601 string em UTC",
    "is_recurring": false,
    "recurrence": null,
    "reminder_offsets": [60]
  },
  "target_task_id": "uuid completo",  // para complete_task e cancel_task
  "delegate_action": "order_status" | "update_price" | "publish_product" | "create_discount",  // para delegate_to_assistant
  "delegate_args": {}  // argumentos para a ação delegada (ex: {"query": "pedido 123"})
}

## Exemplos de delegação
- "qual o status do pedido 1234?" → intent: "delegate_to_assistant", delegate_action: "order_status", delegate_args: {"query": "1234"}
- "altera o preço do produto X para R$ 50" → intent: "delegate_to_assistant", delegate_action: "update_price", needs_confirmation: true
- "cria um cupom de 10% chamado PROMO10" → intent: "delegate_to_assistant", delegate_action: "create_discount", needs_confirmation: true

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
  supabase: any,
  tenantId: string,
  taskData: Record<string, unknown>,
  traceId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
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
  supabase: any,
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
