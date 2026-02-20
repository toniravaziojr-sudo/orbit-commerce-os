import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Initial: extract memories + summarize conversations
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`[ai-memory-manager][${VERSION}] Request received`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, tenant_id, user_id, ai_agent, conversation_id, messages } = await req.json();

    if (!action || !tenant_id) {
      return jsonResponse({ success: false, error: "action and tenant_id required" });
    }

    switch (action) {
      case "extract_memories":
        return await extractMemories(supabase, tenant_id, user_id, ai_agent, conversation_id, messages);
      case "summarize_conversation":
        return await summarizeConversation(supabase, tenant_id, user_id, ai_agent, conversation_id, messages);
      case "save_memory":
        return await saveMemory(supabase, tenant_id, user_id, ai_agent, await req.json());
      case "delete_memory":
        return await deleteMemory(supabase, tenant_id, await req.json());
      default:
        return jsonResponse({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    console.error(`[ai-memory-manager][${VERSION}] Error:`, error);
    return jsonResponse({ success: false, error: error.message || "Internal error" });
  }
});

// ============ EXTRACT MEMORIES ============

async function extractMemories(
  supabase: any,
  tenantId: string,
  userId: string,
  aiAgent: string,
  conversationId: string,
  messages: any[]
) {
  if (!messages || messages.length < 3) {
    return jsonResponse({ success: true, memories: [], reason: "conversation_too_short" });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return jsonResponse({ success: false, error: "LOVABLE_API_KEY not configured" });
  }

  // Build conversation transcript
  const transcript = messages
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${typeof m.content === "string" ? m.content : "[conteúdo multimídia]"}`)
    .join("\n")
    .substring(0, 6000); // Limit to avoid token issues

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Você é um extrator de memórias. Analise a conversa abaixo e extraia FATOS IMPORTANTES que devem ser memorizados pela IA para conversas futuras.

RETORNE UM JSON VÁLIDO com este formato (sem markdown, sem \`\`\`):
{
  "memories": [
    {
      "category": "business_fact|preference|decision|product_insight|persona",
      "content": "Fato conciso em 1-2 frases",
      "importance": 1-10,
      "scope": "tenant|user"
    }
  ]
}

REGRAS:
- Extraia SOMENTE fatos novos e relevantes (não trivialidades)
- Máximo 5 memórias por conversa
- "tenant" = fato sobre o negócio; "user" = preferência pessoal
- Se não houver nada relevante para memorizar, retorne {"memories": []}
- Priorize informações sobre: nicho, público-alvo, produtos, estratégia, preferências operacionais`,
        },
        {
          role: "user",
          content: `Conversa para análise:\n\n${transcript}`,
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[ai-memory-manager][${VERSION}] AI error:`, errText);
    return jsonResponse({ success: false, error: "AI extraction failed" });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  let extracted;
  try {
    // Clean up potential markdown wrapping
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    extracted = JSON.parse(cleaned);
  } catch {
    console.error(`[ai-memory-manager][${VERSION}] Failed to parse AI response:`, content);
    return jsonResponse({ success: true, memories: [], reason: "parse_error" });
  }

  const memories = extracted.memories || [];
  if (memories.length === 0) {
    return jsonResponse({ success: true, memories: [], reason: "nothing_relevant" });
  }

  // Save memories to DB
  const inserts = memories.map((m: any) => ({
    tenant_id: tenantId,
    user_id: m.scope === "user" ? userId : null,
    ai_agent: aiAgent,
    category: m.category || "general",
    content: m.content,
    importance: Math.min(Math.max(m.importance || 5, 1), 10),
    source_conversation_id: conversationId || null,
  }));

  const { error } = await supabase.from("ai_memories").insert(inserts);
  if (error) {
    console.error(`[ai-memory-manager][${VERSION}] Insert error:`, error);
    return jsonResponse({ success: false, error: error.message });
  }

  console.log(`[ai-memory-manager][${VERSION}] Extracted ${memories.length} memories for tenant ${tenantId}`);
  return jsonResponse({ success: true, memories_saved: memories.length });
}

// ============ SUMMARIZE CONVERSATION ============

async function summarizeConversation(
  supabase: any,
  tenantId: string,
  userId: string,
  aiAgent: string,
  conversationId: string,
  messages: any[]
) {
  if (!messages || messages.length < 3) {
    return jsonResponse({ success: true, reason: "conversation_too_short" });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return jsonResponse({ success: false, error: "LOVABLE_API_KEY not configured" });
  }

  const transcript = messages
    .filter((m: any) => m.role === "user" || m.role === "assistant")
    .map((m: any) => `${m.role === "user" ? "Usuário" : "Assistente"}: ${typeof m.content === "string" ? m.content : "[conteúdo multimídia]"}`)
    .join("\n")
    .substring(0, 6000);

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        {
          role: "system",
          content: `Resuma esta conversa em um JSON (sem markdown, sem \`\`\`):
{
  "summary": "Resumo conciso de 2-3 frases sobre o que foi discutido e decidido",
  "key_topics": ["tópico1", "tópico2"],
  "key_decisions": [{"decision": "descrição", "outcome": "resultado"}]
}`,
        },
        {
          role: "user",
          content: transcript,
        },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[ai-memory-manager][${VERSION}] Summarize error:`, errText);
    return jsonResponse({ success: false, error: "Summarization failed" });
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  let parsed;
  try {
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    console.error(`[ai-memory-manager][${VERSION}] Failed to parse summary:`, content);
    return jsonResponse({ success: true, reason: "parse_error" });
  }

  const { error } = await supabase.from("ai_conversation_summaries").insert({
    tenant_id: tenantId,
    user_id: userId,
    ai_agent: aiAgent,
    conversation_id: conversationId,
    summary: parsed.summary || "Conversa sem resumo",
    key_topics: parsed.key_topics || [],
    key_decisions: parsed.key_decisions || [],
    message_count: messages.length,
  });

  if (error) {
    console.error(`[ai-memory-manager][${VERSION}] Summary insert error:`, error);
    return jsonResponse({ success: false, error: error.message });
  }

  console.log(`[ai-memory-manager][${VERSION}] Conversation summarized for ${aiAgent}`);
  return jsonResponse({ success: true, summary_saved: true });
}

// ============ SAVE / DELETE MEMORY ============

async function saveMemory(supabase: any, tenantId: string, userId: string, aiAgent: string, body: any) {
  const { category, content, importance, scope } = body;
  const { error } = await supabase.from("ai_memories").insert({
    tenant_id: tenantId,
    user_id: scope === "user" ? userId : null,
    ai_agent: aiAgent || "all",
    category: category || "general",
    content,
    importance: importance || 5,
  });
  if (error) return jsonResponse({ success: false, error: error.message });
  return jsonResponse({ success: true });
}

async function deleteMemory(supabase: any, tenantId: string, body: any) {
  const { memory_id } = body;
  const { error } = await supabase
    .from("ai_memories")
    .delete()
    .eq("id", memory_id)
    .eq("tenant_id", tenantId);
  if (error) return jsonResponse({ success: false, error: error.message });
  return jsonResponse({ success: true });
}

// ============ HELPERS ============

function jsonResponse(data: any) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
