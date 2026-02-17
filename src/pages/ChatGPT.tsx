// =============================================
// CHATGPT MODULE
// AI-powered chat interface for research and queries
// Separate from Command Assistant - has its own history
// =============================================

import { useState, useRef, useEffect } from "react";
import { Plus, Sparkles, Loader2, MessageSquare, Mic, FileText, Brain, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useChatGPT, ChatGPTMessage, ChatMode } from "@/hooks/useChatGPT";
import { useAuth } from "@/hooks/useAuth";
import { ChatGPTChatInput, ChatGPTAttachment } from "@/components/chatgpt";
import { ChatMessageBubble, ChatTypingIndicator, ChatEmptyState, ChatConversationList } from "@/components/chat";

const MODE_INDICATORS = {
  chat: { icon: MessageSquare, label: "Chat", className: "text-blue-500" },
  thinking: { icon: Brain, label: "Thinking", className: "text-purple-500" },
  search: { icon: Search, label: "Busca", className: "text-green-500" },
} as const;

export default function ChatGPT() {
  const { user } = useAuth();
  const {
    conversations,
    messages,
    currentConversationId,
    isLoadingConversations,
    isLoadingMessages,
    isStreaming,
    streamingContent,
    setCurrentConversationId,
    createConversation,
    sendMessage,
    cancelStreaming,
  } = useChatGPT();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleNewConversation = async () => {
    setIsCreating(true);
    try {
      await createConversation("Nova conversa");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSend = async (message: string, attachments?: ChatGPTAttachment[], mode?: ChatMode) => {
    await sendMessage(message, attachments, mode);
  };

  const renderModeIndicator = (message: ChatGPTMessage) => {
    const mode = message.metadata?.mode as ChatMode | undefined;
    if (!mode || mode === "chat") return undefined;
    
    const indicator = MODE_INDICATORS[mode];
    const Icon = indicator.icon;
    
    return (
      <div className={cn("flex items-center gap-1 text-[11px] font-medium", indicator.className)}>
        <Icon className="h-3 w-3" />
        <span>{indicator.label}</span>
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-64px)] flex gap-3 animate-fade-in -mt-2">
      {/* Sidebar */}
      <div className="w-60 flex-shrink-0 bg-card border rounded-xl overflow-hidden flex flex-col">
        <ChatConversationList
          conversations={conversations}
          currentId={currentConversationId}
          onSelect={setCurrentConversationId}
          onNew={handleNewConversation}
          isCreating={isCreating}
          isLoading={isLoadingConversations}
          className="flex-1"
        />
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col bg-card border rounded-xl overflow-hidden min-w-0">
        {currentConversationId ? (
          <>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((message) => {
                  const attachments = message.metadata?.attachments as ChatGPTAttachment[] | undefined;
                  
                  return (
                    <ChatMessageBubble
                      key={message.id}
                      role={message.role as "user" | "assistant"}
                      content={
                        message.role === "user" && message.content?.startsWith("[")
                          ? null
                          : message.content
                      }
                      avatarIcon={message.role === "user" ? "user" : "sparkles"}
                      avatarLabel={message.role === "user" ? user?.email?.charAt(0).toUpperCase() || "U" : undefined}
                      avatarClassName={message.role !== "user" ? "bg-emerald-500/10 text-emerald-500" : undefined}
                      attachments={attachments}
                      modeIndicator={message.role === "assistant" ? renderModeIndicator(message) : undefined}
                      timestamp={message.created_at ? new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined}
                    />
                  );
                })}

                {isStreaming && streamingContent && (
                  <ChatMessageBubble
                    role="assistant"
                    content={streamingContent}
                    avatarIcon="sparkles"
                    avatarClassName="bg-emerald-500/10 text-emerald-500"
                  />
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div className="rounded-2xl rounded-tl-md bg-muted/60 border border-border/40 px-4 py-3">
                      <ChatTypingIndicator />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <ChatGPTChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              onCancel={cancelStreaming}
            />
          </>
        ) : (
          <ChatEmptyState
            icon={<Sparkles className="h-7 w-7 text-emerald-500" />}
            title="Como posso ajudar?"
            description="Use para pesquisas, tirar dúvidas, gerar conteúdo e muito mais."
            onNewConversation={handleNewConversation}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  );
}
