// ============================================================
// AISandboxChat — Chat de teste da IA de Atendimento
//
// Regra (mem://constraints/ai-test-sandbox-mirror-only):
//   Este chat é apenas uma janela de teste. A IA executada aqui é
//   EXATAMENTE a IA de Atendimento em produção (mesma pipeline,
//   prompts, tools e configurações do tenant). Não há lógica de IA
//   neste arquivo — apenas UI + invocação da edge `ai-test-sandbox`.
//
// Comportamento:
//   - Estado da conversa vive em memória (React state).
//   - Ao desmontar (fechar aba/sair da página), dispara cleanup da
//     conversa sandbox no banco.
//   - Botão "Reiniciar" também faz cleanup e começa do zero.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { Bot, RefreshCw, Send, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessageBubble, ChatTypingIndicator } from "@/components/chat";
import { toast } from "sonner";

interface SandboxMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export function AISandboxChat() {
  const { currentTenant } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SandboxMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Cleanup ao desmontar (trocar de aba, sair da página, fechar app)
  const conversationIdRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;

  useEffect(() => {
    return () => {
      const cid = conversationIdRef.current;
      if (cid) {
        // Fire-and-forget: o usuário já saiu da tela
        supabase.functions
          .invoke("ai-test-sandbox", { body: { action: "cleanup", conversation_id: cid } })
          .catch(() => {});
      }
    };
  }, []);

  // Cleanup também quando a aba do navegador fecha
  useEffect(() => {
    const handler = () => {
      const cid = conversationIdRef.current;
      if (!cid) return;
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-test-sandbox`;
        const blob = new Blob(
          [JSON.stringify({ action: "cleanup", conversation_id: cid })],
          { type: "application/json" }
        );
        navigator.sendBeacon(url, blob);
      } catch {}
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || !currentTenant?.id || sending) return;

    const userMsg: SandboxMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-test-sandbox", {
        body: {
          action: "send",
          tenant_id: currentTenant.id,
          conversation_id: conversationId,
          message: text,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao processar");

      if (data.conversation_id && data.conversation_id !== conversationId) {
        setConversationId(data.conversation_id);
      }

      const replies = Array.isArray(data.replies) ? data.replies : [];
      const knownIds = new Set(messages.map((m) => m.id));
      const newReplies: SandboxMessage[] = replies
        .filter((r: any) => !knownIds.has(r.id))
        .map((r: any) => ({
          id: r.id,
          role: "assistant" as const,
          content: r.content || "",
          createdAt: r.created_at,
        }));

      // Acumula só as mensagens novas para evitar duplicação no resync
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = newReplies.filter((r) => !seen.has(r.id));
        return [...prev, ...fresh];
      });
    } catch (e: any) {
      console.error("[AISandboxChat] send error", e);
      toast.error("Não foi possível obter resposta da IA");
    } finally {
      setSending(false);
    }
  }

  async function handleReset() {
    if (conversationId) {
      try {
        await supabase.functions.invoke("ai-test-sandbox", {
          body: { action: "cleanup", conversation_id: conversationId },
        });
      } catch {}
    }
    setConversationId(null);
    setMessages([]);
    setInput("");
    toast.success("Chat reiniciado");
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full p-4 gap-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">IA de Atendimento — Chat de teste</h2>
            <p className="text-xs text-muted-foreground">
              Conversa real com a sua IA, isolada do atendimento. Fechou a aba, resetou.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={sending}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Reiniciar
        </Button>
      </div>

      {/* Aviso */}
      <Alert className="py-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        <AlertDescription className="text-xs">
          A IA aqui é exatamente a mesma de produção. Tools de leitura (catálogo, políticas) usam
          dados reais. Tools de envio externo (WhatsApp, criar pedido) ficam suprimidas.
        </AlertDescription>
      </Alert>

      {/* Área de mensagens */}
      <div className="flex-1 min-h-0 rounded-lg border bg-card">
        <ScrollArea className="h-full" viewportRef={scrollRef as any}>
          <div className="p-4 space-y-4">
            {messages.length === 0 && !sending && (
              <ChatEmptyState
                icon={<Bot className="h-6 w-6" />}
                title="Comece a conversar"
                description="Mande uma mensagem como se fosse um cliente. A IA vai responder com a mesma lógica que usa em produção."
              />
            )}
            {messages.map((m) => (
              <ChatMessageBubble
                key={m.id}
                role={m.role}
                content={m.content}
                avatarIcon={m.role === "assistant" ? "sparkles" : "user"}
              />
            ))}
            {sending && (
              <div className="pl-10">
                <ChatTypingIndicator label="IA pensando" />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <Input
          placeholder="Digite uma mensagem como cliente..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sending}
          autoFocus
        />
        <Button type="submit" disabled={!input.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
