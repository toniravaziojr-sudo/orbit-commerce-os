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
