// =============================================
// CHATGPT MODULE
// AI-powered chat interface for research and queries
// Separate from Command Assistant - has its own history
// =============================================

import { useState, useRef, useEffect } from "react";
import { Send, Plus, Sparkles, Loader2, StopCircle, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useChatGPT } from "@/hooks/useChatGPT";
import { useAuth } from "@/hooks/useAuth";
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

  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;
    const messageText = inputValue.trim();
    setInputValue("");
    await sendMessage(messageText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                <div className="border-t p-4 flex-shrink-0">
                  <div className="max-w-3xl mx-auto">
                    <div className="relative flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm">
                      <Textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte alguma coisa..."
                        className="min-h-[44px] max-h-[200px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-2"
                        rows={1}
                        disabled={isStreaming}
                      />
                      {isStreaming ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={cancelStreaming}
                          className="h-9 w-9 flex-shrink-0"
                        >
                          <StopCircle className="h-5 w-5" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          onClick={handleSend}
                          disabled={!inputValue.trim()}
                          className="h-9 w-9 flex-shrink-0 rounded-full"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      ChatGPT pode cometer erros. Verifique informações importantes.
                    </p>
                  </div>
                </div>
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
