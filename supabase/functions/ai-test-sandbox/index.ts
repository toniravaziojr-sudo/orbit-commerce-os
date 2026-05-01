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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendBody {
  action: "send";
  tenant_id: string;
  conversation_id?: string | null;
  message: string;
}

interface CleanupBody {
  action: "cleanup";
  conversation_id: string;
}

type Body = SendBody | CleanupBody;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Body;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // -------- Validar usuário autenticado e tenant --------
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) {
      return json({ success: false, error: "unauthenticated" }, 200);
    }
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return json({ success: false, error: "unauthenticated" }, 200);
    }
    const userId = userData.user.id;

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
      const allowed = await userHasTenantAccess(supabase, userId, conv.tenant_id);
      if (!allowed) return json({ success: false, error: "forbidden" }, 200);

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

    // Valida acesso do usuário ao tenant.
    const allowed = await userHasTenantAccess(supabase, userId, tenant_id);
    if (!allowed) return json({ success: false, error: "forbidden" }, 200);

    // -------- Cria conversa sandbox se não existir --------
    if (!conversation_id) {
      const fakePhone = `sandbox_${userId.slice(0, 8)}_${Date.now()}`;
      const { data: created, error: createErr } = await supabase
        .from("conversations")
        .insert({
          tenant_id,
          channel_type: "chat",
          customer_name: "Cliente de teste",
          customer_phone: fakePhone,
          status: "bot",
          metadata: {
            is_sandbox: true,
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
    .from("tenant_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[ai-test-sandbox] tenant access check error", error);
    return false;
  }
  return !!data;
}
