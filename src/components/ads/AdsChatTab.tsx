// =============================================
// ADS CHAT TAB
// Chat interface for the AI Traffic Manager
// =============================================

import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Square } from "lucide-react";
import { useAdsChat } from "@/hooks/useAdsChat";
import { toast } from "sonner";
import { ChatMessageBubble, ChatTypingIndicator, ChatEmptyState, ChatConversationList } from "@/components/chat";
import { cn } from "@/lib/utils";

interface AdsChatTabProps {
  scope: "global" | "account";
  adAccountId?: string;
  channel?: string;
}

export function AdsChatTab({ scope, adAccountId, channel }: AdsChatTabProps) {
  const {
    conversations,
    currentConversationId,
    setCurrentConversationId,
    messages,
    messagesLoading,
    isStreaming,
    streamingContent,
    sendMessage,
    cancelStreaming,
    createConversation,
  } = useAdsChat({ scope, adAccountId, channel });

  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const msg = input;
    setInput("");
    try {
      await sendMessage(msg);
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagem");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = async () => {
    setIsCreating(true);
    try {
      await createConversation();
    } finally {
      setIsCreating(false);
    }
  };

  const scopeLabel = scope === "account"
    ? `Chat IA — ${adAccountId}`
    : "Chat IA — Global";

  return (
    <div className="grid gap-3 lg:grid-cols-4 h-[calc(100vh-380px)] min-h-[400px]">
      {/* Sidebar */}
      <div className="lg:col-span-1 bg-card border rounded-xl overflow-hidden flex flex-col">
        <ChatConversationList
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={setCurrentConversationId}
          onNew={handleNewConversation}
          isCreating={isCreating}
          className="flex-1"
        />
      </div>

      {/* Chat Area */}
      <div className="lg:col-span-3 bg-card border rounded-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold">{scopeLabel}</p>
            <p className="text-[10px] text-muted-foreground">Converse com a IA sobre suas campanhas</p>
          </div>
        </div>

        {currentConversationId ? (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <ChatMessageBubble
                    key={msg.id}
                    role={msg.role as "user" | "assistant"}
                    content={msg.content}
                    avatarIcon={msg.role === "user" ? "user" : "bot"}
                    avatarClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  />
                ))}

                {/* Streaming */}
                {isStreaming && streamingContent && (
                  <ChatMessageBubble
                    role="assistant"
                    content={streamingContent}
                    avatarClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  />
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                      <Bot className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md bg-muted/60 border border-border/40 px-4 py-3">
                      <ChatTypingIndicator label="Analisando" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3">
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <div className="flex-1 relative">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte sobre suas campanhas..."
                    className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border/60 bg-muted/30 text-[13px] pr-3 focus:bg-background transition-colors"
                    disabled={isStreaming}
                  />
                </div>
                {isStreaming ? (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={cancelStreaming}
                    className="shrink-0 rounded-xl h-[44px] w-[44px]"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="shrink-0 rounded-xl h-[44px] w-[44px]"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </>
        ) : (
          <ChatEmptyState
            icon={<MessageCircle className="h-7 w-7 text-primary" />}
            title={scope === "account" ? "Chat da Conta" : "Chat Global de Tráfego"}
            description="Converse com a IA sobre estratégias, peça relatórios, sugira campanhas ou solicite auditorias completas."
            onNewConversation={handleNewConversation}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  );
}
