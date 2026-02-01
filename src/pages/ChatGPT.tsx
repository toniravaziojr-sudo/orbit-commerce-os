// =============================================
// CHATGPT MODULE
// AI-powered chat interface for research and queries
// Separate from Command Assistant - has its own history
// =============================================

import { useState, useRef, useEffect } from "react";
import { Plus, Sparkles, Loader2, MessageSquare, Mic, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useChatGPT, ChatGPTMessage } from "@/hooks/useChatGPT";
import { useAuth } from "@/hooks/useAuth";
import { ChatGPTChatInput, ChatGPTAttachment } from "@/components/chatgpt";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

  const handleSend = async (message: string, attachments?: ChatGPTAttachment[]) => {
    await sendMessage(message, attachments);
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
    <div className="h-[calc(100vh-120px)] flex flex-col animate-fade-in">
      <PageHeader
        title="ChatGPT"
        description="Assistente de IA para pesquisas, consultas e muito mais"
      />

      <div className="flex-1 grid gap-4 lg:grid-cols-[280px_1fr] mt-6 min-h-0">
        {/* Sidebar - Conversations */}
        <Card className="flex flex-col overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-3 flex-shrink-0">
            <CardTitle className="text-sm font-medium">Conversas</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleNewConversation}
              disabled={isCreating}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-3 pb-3">
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setCurrentConversationId(conv.id)}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2 text-sm transition-colors",
                      currentConversationId === conv.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 flex-shrink-0" />
                      <p className="truncate font-medium">{conv.title || "Nova conversa"}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(conv.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  </button>
                ))}
                {conversations.length === 0 && !isLoadingConversations && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma conversa ainda
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            {currentConversationId ? (
              <>
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4 max-w-3xl mx-auto">
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
                            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-emerald-500/10 text-emerald-500"
                          )}
                        >
                          {message.role === "user" ? (
                            <span className="text-sm font-medium">
                              {user?.email?.charAt(0).toUpperCase() || "U"}
                            </span>
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "flex-1 rounded-2xl px-4 py-3 max-w-[80%]",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground ml-auto"
                              : "bg-muted"
                          )}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-ul:list-disc prose-ul:pl-4 prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-4 prose-li:my-1 prose-strong:font-semibold prose-strong:text-foreground [&_br]:block [&_br]:my-1">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ""}</ReactMarkdown>
                            </div>
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
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="flex-1 rounded-2xl bg-muted px-4 py-3 max-w-[80%]">
                          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-ul:list-disc prose-ul:pl-4 prose-ol:my-2 prose-ol:list-decimal prose-ol:pl-4 prose-li:my-1 prose-strong:font-semibold prose-strong:text-foreground [&_br]:block [&_br]:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingContent}</ReactMarkdown>
                          </div>
                          <span className="inline-block h-4 w-0.5 animate-pulse bg-primary ml-0.5" />
                        </div>
                      </div>
                    )}

                    {isStreaming && !streamingContent && (
                      <div className="flex gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="flex-1 rounded-2xl bg-muted px-4 py-3 max-w-[80%]">
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
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Como posso ajudar?</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Use o ChatGPT para pesquisas, tirar dúvidas, gerar conteúdo e muito mais. 
                  Comece uma nova conversa ou selecione uma existente.
                </p>
                <Button onClick={handleNewConversation} disabled={isCreating}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova conversa
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
