/**
 * Triggers async memory extraction + conversation summarization
 * Called after significant conversations end (3+ messages)
 */
import { supabase } from "@/integrations/supabase/client";

export async function triggerMemoryExtraction(params: {
  tenant_id: string;
  user_id: string;
  ai_agent: string;
  conversation_id: string;
  messages: { role: string; content: string | null }[];
}) {
  const { tenant_id, user_id, ai_agent, conversation_id, messages } = params;

  // Only trigger if conversation has 3+ messages
  if (!messages || messages.length < 3) return;

  // Fire-and-forget: don't block the UI
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    const baseUrl = import.meta.env.VITE_SUPABASE_URL;

    // Extract memories
    fetch(`${baseUrl}/functions/v1/ai-memory-manager`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "extract_memories",
        tenant_id,
        user_id,
        ai_agent,
        conversation_id,
        messages: messages.map(m => ({ role: m.role, content: m.content || "" })),
      }),
    }).catch(e => console.warn("[memory] extraction error:", e));

    // Summarize conversation
    fetch(`${baseUrl}/functions/v1/ai-memory-manager`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "summarize_conversation",
        tenant_id,
        user_id,
        ai_agent,
        conversation_id,
        messages: messages.map(m => ({ role: m.role, content: m.content || "" })),
      }),
    }).catch(e => console.warn("[memory] summarization error:", e));
  } catch (e) {
    console.warn("[memory] trigger error:", e);
  }
}
