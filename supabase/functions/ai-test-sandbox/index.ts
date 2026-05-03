// ============================================================
// ai-test-sandbox — Wrapper para testar a IA de Atendimento
//
// REGRA OBRIGATÓRIA (mem://constraints/ai-test-sandbox-mirror-only):
//   Esta função NÃO duplica a pipeline da IA. Ela apenas:
//     1. Cria/garante uma conversa marcada como sandbox em metadata.
//     2. Insere a mensagem do usuário (também marcada como sandbox).
//     3. Invoca a função `ai-support-chat` ORIGINAL (mesma pipeline,
//        mesmos prompts, mesmas tools, mesma config do tenant).
//     4. Devolve a resposta da IA pro front.
//     5. Quando o front sinaliza encerramento, apaga conversa+mensagens.
//
//   QUALQUER mudança na IA de atendimento se reflete aqui automaticamente.
//   É PROIBIDO copiar lógica da `ai-support-chat` pra cá.
//
// Isolamento: conversation.metadata.is_sandbox=true e channel_type='chat'.
//   Filtros de métricas/funil/aprendizado devem ignorar is_sandbox=true.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-agent-mode, x-agent-key",
};

// Tenant fixo "Respeite o Homem" — único tenant autorizado para Agent Mode.
// Agent Mode permite que o backend (com SERVICE_ROLE_KEY) rode roteiros de teste
// automatizados sem JWT de usuário. Qualquer outro tenant é rejeitado com 403.
const AGENT_MODE_ALLOWED_TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";

interface SendBody {
  action: "send";
  tenant_id: string;
  conversation_id?: string | null;
  message: string;
  // B.3: permite simular o canal real ('whatsapp') no sandbox.
  // Default 'chat' mantém retrocompat. Aceita apenas 'chat' | 'whatsapp'.
  simulated_channel?: "chat" | "whatsapp";
}

interface CleanupBody {
  action: "cleanup";
  conversation_id: string;
}

// [Reg #2.13 — Fase C] Burst que valida o pipeline do Turn Orchestrator
// (webhook→buffer→processor→ai-support-chat). Não chama ai-support-chat direto.
interface BurstBody {
  action: "burst";
  tenant_id: string;
  conversation_id?: string | null;
  messages: string[];          // 2..10 mensagens
  gap_ms?: number;             // intervalo entre cada inbound (default 250ms)
  simulated_channel?: "chat" | "whatsapp"; // default 'whatsapp' (objetivo da Fase C)
  wait_for_bot_ms?: number;    // tempo máx esperando resposta após dispatch (default 30000ms)
}

type Body = SendBody | CleanupBody | BurstBody;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // -------- Detecta Agent Mode (backend automatizado) --------
    // Agent Mode: header x-agent-mode=true + tenant_id == Respeite o Homem.
    // Sem token extra: a trava é o tenant fixo + isolamento via is_sandbox=true.
    // Qualquer outro tenant retorna 403.
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    const agentModeHeader = (req.headers.get("x-agent-mode") || "").toLowerCase() === "true";

    // Determina tenant alvo da requisição
    const requestedTenant =
      body.action === "send" ? (body as SendBody).tenant_id :
      body.action === "burst" ? (body as BurstBody).tenant_id :
      null;
    const isAgentMode = agentModeHeader && (
      body.action === "cleanup" || requestedTenant === AGENT_MODE_ALLOWED_TENANT
    );

    let userId: string;
    if (isAgentMode) {
      if ((body.action === "send" || body.action === "burst") && requestedTenant !== AGENT_MODE_ALLOWED_TENANT) {
        return json({ success: false, error: "agent_mode_tenant_not_allowed" }, 200);
      }
      userId = "agent-mode";
    } else {
      if (!jwt) {
        return json({ success: false, error: "unauthenticated" }, 200);
      }
      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      if (userErr || !userData?.user) {
        return json({ success: false, error: "unauthenticated" }, 200);
      }
      userId = userData.user.id;
    }

    // ============== CLEANUP ==============
    if (body.action === "cleanup") {
      const conversationId = body.conversation_id;
      if (!conversationId) return json({ success: false, error: "missing conversation_id" }, 200);

      // Garante que é uma conversa sandbox antes de apagar.
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, tenant_id, metadata")
        .eq("id", conversationId)
        .maybeSingle();

      if (!conv) return json({ success: true, cleaned: false, reason: "not_found" }, 200);
      const meta = (conv.metadata as Record<string, unknown>) || {};
      if (meta.is_sandbox !== true) {
        return json({ success: false, error: "not a sandbox conversation" }, 200);
      }

      // Valida que o usuário tem acesso ao tenant da conversa.
      // Em Agent Mode, restringe ao tenant fixo permitido.
      if (isAgentMode) {
        if (conv.tenant_id !== AGENT_MODE_ALLOWED_TENANT) {
          return json({ success: false, error: "agent_mode_tenant_not_allowed" }, 200);
        }
      } else {
        const allowed = await userHasTenantAccess(supabase, userId, conv.tenant_id);
        if (!allowed) return json({ success: false, error: "forbidden" }, 200);
      }

      await supabase.from("messages").delete().eq("conversation_id", conversationId);
      await supabase.from("conversation_events").delete().eq("conversation_id", conversationId);
      await supabase.from("conversations").delete().eq("id", conversationId);

      return json({ success: true, cleaned: true }, 200);
    }

    // ============== BURST (Fase C — Turn Orchestrator pipeline) ==============
    if (body.action === "burst") {
      return await handleBurst({ supabase, supabaseUrl, serviceKey, body, isAgentMode, userId });
    }

    // ============== SEND ==============
    if (body.action !== "send") {
      return json({ success: false, error: "invalid action" }, 200);
    }
    const { tenant_id, message } = body;
    let { conversation_id } = body;

    if (!tenant_id || !message?.trim()) {
      return json({ success: false, error: "tenant_id and message required" }, 200);
    }

    // Valida acesso do usuário ao tenant (em Agent Mode já garantido pelo gate de tenant fixo).
    if (!isAgentMode) {
      const allowed = await userHasTenantAccess(supabase, userId, tenant_id);
      if (!allowed) return json({ success: false, error: "forbidden" }, 200);
    }

    // -------- Cria conversa sandbox se não existir --------
    const simulatedChannel: "chat" | "whatsapp" =
      (body as SendBody).simulated_channel === "whatsapp" ? "whatsapp" : "chat";
    if (!conversation_id) {
      const fakePhone = `sandbox_${userId.slice(0, 8)}_${Date.now()}`;
      const { data: created, error: createErr } = await supabase
        .from("conversations")
        .insert({
          tenant_id,
          channel_type: simulatedChannel,
          customer_name: "Cliente de teste",
          customer_phone: fakePhone,
          status: "bot",
          metadata: {
            is_sandbox: true,
            simulated_channel: simulatedChannel,
            sandbox_user_id: userId,
            sandbox_started_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (createErr || !created) {
        console.error("[ai-test-sandbox] create conversation failed", createErr);
        return json({ success: false, error: "failed to create sandbox conversation" }, 200);
      }
      conversation_id = created.id;
    } else {
      // Verifica que a conversa existe e é sandbox do mesmo tenant.
      const { data: conv } = await supabase
        .from("conversations")
        .select("id, tenant_id, metadata")
        .eq("id", conversation_id)
        .maybeSingle();
      if (!conv || conv.tenant_id !== tenant_id) {
        return json({ success: false, error: "conversation not found or wrong tenant" }, 200);
      }
      const meta = (conv.metadata as Record<string, unknown>) || {};
      if (meta.is_sandbox !== true) {
        return json({ success: false, error: "not a sandbox conversation" }, 200);
      }
    }

    // -------- Insere mensagem do usuário --------
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id,
      tenant_id,
      direction: "inbound",
      sender_type: "customer",
      sender_name: "Cliente de teste",
      content: message,
      content_type: "text",
      delivery_status: "delivered",
      metadata: { is_sandbox: true },
    });
    if (msgErr) {
      console.error("[ai-test-sandbox] insert message failed", msgErr);
      return json({ success: false, error: "failed to insert message" }, 200);
    }

    // -------- Invoca a IA ORIGINAL (mesma pipeline) --------
    const aiUrl = `${supabaseUrl}/functions/v1/ai-support-chat`;
    const aiRes = await fetch(aiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ conversation_id, tenant_id }),
    });
    const aiPayload = await aiRes.json().catch(() => ({}));

    // -------- Coleta a resposta gerada (última mensagem outbound) --------
    const { data: latestMessages } = await supabase
      .from("messages")
      .select("id, direction, sender_type, content, content_type, is_ai_generated, created_at, metadata")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(10);

    const replies = (latestMessages || [])
      .filter((m: any) => m.direction === "outbound")
      .reverse();

    return json(
      {
        success: true,
        conversation_id,
        simulated_channel: simulatedChannel,
        ai_result: aiPayload,
        replies,
      },
      200
    );
  } catch (err) {
    console.error("[ai-test-sandbox] unexpected error", err);
    return json({ success: false, error: String(err) }, 200);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function userHasTenantAccess(supabase: any, userId: string, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .limit(1);
  if (error) {
    console.warn("[ai-test-sandbox] tenant access check error", error);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

// ============================================================
// [Reg #2.13 — Fase C] handleBurst
// Valida o pipeline real do Turn Orchestrator sem chamar
// ai-support-chat direto. Replica o que o meta-whatsapp-webhook
// faz por mensagem: insert messages → classify completeness →
// enqueue_turn_message. Após a última msg, dispara
// turn-orchestrator-processor (source=webhook) e aguarda a
// resposta bot ou um estado terminal do buffer.
// ============================================================
async function handleBurst(params: {
  supabase: any;
  supabaseUrl: string;
  serviceKey: string;
  body: any;
  isAgentMode: boolean;
  userId: string;
}): Promise<Response> {
  const { supabase, supabaseUrl, serviceKey, body, isAgentMode, userId } = params;
  const tenant_id: string = body.tenant_id;
  const messages: string[] = Array.isArray(body.messages) ? body.messages : [];
  const gap_ms: number = Math.max(0, Math.min(2000, body.gap_ms ?? 250));
  const wait_for_bot_ms: number = Math.max(5000, Math.min(60000, body.wait_for_bot_ms ?? 30000));
  const simulatedChannel: "chat" | "whatsapp" =
    body.simulated_channel === "chat" ? "chat" : "whatsapp";

  if (!tenant_id || messages.length < 1) {
    return json({ success: false, error: "tenant_id and messages[] required" }, 200);
  }

  if (!isAgentMode) {
    const allowed = await userHasTenantAccess(supabase, userId, tenant_id);
    if (!allowed) return json({ success: false, error: "forbidden" }, 200);
  }

  // Carrega classifier dinamicamente (evita custo pra send)
  const { classifyTurnCompleteness } = await import(
    "../_shared/sales-pipeline/turn-completeness.ts"
  );

  // Cria conversa sandbox
  let conversation_id: string | null = body.conversation_id ?? null;
  if (!conversation_id) {
    const fakePhone = `sandbox_burst_${userId.slice(0, 8)}_${Date.now()}`;
    const { data: created, error: createErr } = await supabase
      .from("conversations")
      .insert({
        tenant_id,
        channel_type: simulatedChannel,
        customer_name: "Burst Sandbox",
        customer_phone: fakePhone,
        status: "bot",
        metadata: {
          is_sandbox: true,
          simulated_channel: simulatedChannel,
          burst: true,
          sandbox_user_id: userId,
        },
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return json({ success: false, error: "create_conv_failed", detail: createErr?.message }, 200);
    }
    conversation_id = created.id;
  }

  const messageIds: string[] = [];
  const enqueueResults: any[] = [];
  let lastLogicalTurnId: string | null = null;

  // Buffer acumulado para classifier (fiel ao webhook que reclassifica a cada burst)
  const buffered: any[] = [];

  for (let i = 0; i < messages.length; i++) {
    const text = messages[i];
    const { data: ins, error: insErr } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        tenant_id,
        direction: "inbound",
        sender_type: "customer",
        sender_name: "Burst Cliente",
        content: text,
        content_type: "text",
        delivery_status: "delivered",
        metadata: { is_sandbox: true, burst_index: i },
      })
      .select("id, created_at")
      .single();
    if (insErr || !ins) {
      return json({ success: false, error: "insert_msg_failed", detail: insErr?.message, step: i }, 200);
    }
    messageIds.push(ins.id);
    buffered.push({
      id: ins.id,
      text,
      media_type: null,
      media_caption: null,
      created_at: ins.created_at,
    });

    const classification = classifyTurnCompleteness(buffered, {});
    const { data: enq, error: enqErr } = await supabase.rpc("enqueue_turn_message", {
      p_tenant_id: tenant_id,
      p_conversation_id: conversation_id,
      p_message_id: ins.id,
      p_completeness: classification.completeness,
      p_debounce_ms: classification.debounceMs,
    });
    if (enqErr) {
      return json({ success: false, error: "enqueue_failed", detail: enqErr.message, step: i }, 200);
    }
    enqueueResults.push({
      step: i, text,
      completeness: classification.completeness,
      debounce_ms: classification.debounceMs,
      logical_turn_id: enq?.logical_turn_id,
      buffer_size: enq?.buffer_size,
      created: enq?.created,
    });
    lastLogicalTurnId = enq?.logical_turn_id ?? lastLogicalTurnId;

    if (i < messages.length - 1 && gap_ms > 0) {
      await new Promise((r) => setTimeout(r, gap_ms));
    }
  }

  // Dispara processor (source=webhook) — mesma lógica do meta-whatsapp-webhook
  let processorStatus = 0;
  let processorBody = "";
  try {
    const r = await fetch(`${supabaseUrl}/functions/v1/turn-orchestrator-processor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        tenant_id,
        conversation_id,
        logical_turn_id: lastLogicalTurnId,
        source: "webhook",
      }),
    });
    processorStatus = r.status;
    processorBody = (await r.text()).slice(0, 600);
  } catch (err) {
    return json({ success: false, error: "processor_dispatch_failed", detail: String(err) }, 200);
  }

  // Polling: espera bot message com logical_turn_id OU buffer terminal
  const startedAt = Date.now();
  let botMessage: any = null;
  let bufferFinal: any = null;
  while (Date.now() - startedAt < wait_for_bot_ms) {
    const { data: bm } = await supabase
      .from("messages")
      .select("id, content, delivery_status, created_at, metadata, external_message_id")
      .eq("conversation_id", conversation_id)
      .eq("sender_type", "bot")
      .filter("metadata->>logical_turn_id", "eq", lastLogicalTurnId!)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bm) { botMessage = bm; }

    const { data: buf } = await supabase
      .from("ai_turn_buffers")
      .select("status, attempts, failed_reason, snapshot_message_ids, claim_token, process_after, next_retry_at")
      .eq("conversation_id", conversation_id)
      .eq("logical_turn_id", lastLogicalTurnId!)
      .maybeSingle();
    if (buf) { bufferFinal = buf; }

    if (botMessage && bufferFinal && (bufferFinal.status === "processed" || bufferFinal.status === "send_failed" || bufferFinal.status === "dead" || bufferFinal.status === "aborted")) {
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Conta TODAS as bot messages do turno (deveria ser 1)
  const { data: allBot } = await supabase
    .from("messages")
    .select("id, delivery_status, created_at")
    .eq("conversation_id", conversation_id)
    .eq("sender_type", "bot")
    .filter("metadata->>logical_turn_id", "eq", lastLogicalTurnId!)
    .order("created_at", { ascending: true });

  return json({
    success: true,
    conversation_id,
    simulated_channel: simulatedChannel,
    logical_turn_id: lastLogicalTurnId,
    inbound_message_ids: messageIds,
    enqueue_results: enqueueResults,
    processor_status: processorStatus,
    processor_body: processorBody,
    buffer_final: bufferFinal,
    bot_message: botMessage,
    bot_messages_count: allBot?.length ?? 0,
    elapsed_ms: Date.now() - startedAt,
    summary: {
      buffers_created: enqueueResults.filter((r) => r.created).length,
      buffer_status: bufferFinal?.status,
      bot_count: allBot?.length ?? 0,
      duplicate_prevented: (allBot?.length ?? 0) <= 1,
    },
  }, 200);
}
