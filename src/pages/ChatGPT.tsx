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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  // Auto-scroll to bottom
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

  // Helper to render mode indicator
  const renderModeIndicator = (message: ChatGPTMessage) => {
    const mode = message.metadata?.mode as ChatMode | undefined;
    if (!mode || mode === "chat") return null;
    
    const indicator = MODE_INDICATORS[mode];
    const Icon = indicator.icon;
    
    return (
      <div className={cn("flex items-center gap-1 text-xs mb-1", indicator.className)}>
        <Icon className="h-3 w-3" />
        <span>{indicator.label}</span>
      </div>
    );
  };

  // Helper to render message attachments
  const renderAttachments = (message: ChatGPTMessage) => {
    const attachments = message.metadata?.attachments as ChatGPTAttachment[] | undefined;
    if (!attachments || attachments.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {attachments.map((att, idx) => {
          if (att.mimeType.startsWith("image/")) {
            return (
              <a 
                key={idx} 
                href={att.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <img
                  src={att.url}
                  alt={att.filename}
                  className="max-h-48 max-w-full rounded-lg border object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            );
          }
          
          if (att.mimeType.startsWith("audio/")) {
            return (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <audio controls className="h-8 max-w-[200px]">
                  <source src={att.url} type={att.mimeType} />
                </audio>
              </div>
            );
          }

          // Other files
          return (
            <a
              key={idx}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs truncate max-w-[150px]">{att.filename}</span>
            </a>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-[calc(100vh-64px)] flex gap-3 animate-fade-in -mt-2">
      {/* Sidebar - Conversations (Compacta) */}
      <div className="w-64 flex-shrink-0 flex flex-col bg-card border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium">Conversas</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNewConversation}
            disabled={isCreating}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setCurrentConversationId(conv.id)}
                className={cn(
                  "w-full text-left rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  currentConversationId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3.5 w-3.5 flex-shrink-0" />
                  <p className="truncate text-xs font-medium">{conv.title || "Nova conversa"}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                  {new Date(conv.updated_at).toLocaleDateString("pt-BR")}
                </p>
              </button>
            ))}
            {conversations.length === 0 && !isLoadingConversations && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhuma conversa
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area (Maximizado) */}
      <div className="flex-1 flex flex-col bg-card border rounded-lg overflow-hidden min-w-0">
        {currentConversationId ? (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-4xl mx-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" && "flex-row-reverse"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-emerald-500/10 text-emerald-500"
                      )}
                    >
                      {message.role === "user" ? (
                        <span className="text-xs font-medium">
                          {user?.email?.charAt(0).toUpperCase() || "U"}
                        </span>
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div
                      className={cn(
                        "flex-1 rounded-xl px-3 py-2.5 max-w-[85%]",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground ml-auto"
                          : "bg-muted/60"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <>
                          {renderModeIndicator(message)}
                          <div className="prose prose-sm dark:prose-invert max-w-none 
                            prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-bold 
                            prose-h2:text-sm prose-h3:text-xs
                            prose-p:my-2 prose-p:leading-relaxed prose-p:text-sm
                            prose-ul:my-2 prose-ul:list-disc prose-ul:pl-4 prose-ul:space-y-1
                            prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-4 prose-ol:space-y-1
                            prose-li:my-1 prose-li:leading-relaxed prose-li:text-sm
                            prose-strong:font-semibold prose-strong:text-foreground
                            prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80
                            [&_hr]:my-3 [&_hr]:border-border
                            [&>*:first-child]:mt-0
                          ">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ""}</ReactMarkdown>
                          </div>
                        </>
                      ) : (
                        <>
                          {message.content && !message.content.startsWith("[") && (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          )}
                          {renderAttachments(message)}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 rounded-xl bg-muted/60 px-3 py-2.5 max-w-[85%]">
                      <div className="prose prose-sm dark:prose-invert max-w-none 
                        prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-bold 
                        prose-h2:text-sm prose-h3:text-xs
                        prose-p:my-2 prose-p:leading-relaxed prose-p:text-sm
                        prose-ul:my-2 prose-ul:list-disc prose-ul:pl-4 prose-ul:space-y-1
                        prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-4 prose-ol:space-y-1
                        prose-li:my-1 prose-li:leading-relaxed prose-li:text-sm
                        prose-strong:font-semibold prose-strong:text-foreground
                        prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:text-primary/80
                        [&_hr]:my-3 [&_hr]:border-border
                        [&>*:first-child]:mt-0
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                      </div>
                      <span className="inline-block h-3 w-0.5 animate-pulse bg-primary ml-0.5" />
                    </div>
                  </div>
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 rounded-xl bg-muted/60 px-3 py-2.5 max-w-[85%]">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Pensando...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <ChatGPTChatInput
              onSend={handleSend}
              isStreaming={isStreaming}
              onCancel={cancelStreaming}
            />
          </>
        ) : (
          /* Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Sparkles className="h-7 w-7 text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold mb-1.5">Como posso ajudar?</h3>
            <p className="text-sm text-muted-foreground mb-3 max-w-md">
              Use para pesquisas, tirar dúvidas, gerar conteúdo e muito mais.
            </p>
            <Button size="sm" onClick={handleNewConversation} disabled={isCreating}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nova conversa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
