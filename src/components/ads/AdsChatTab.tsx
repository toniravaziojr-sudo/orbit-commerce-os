// =============================================
// ADS CHAT TAB
// Chat interface for the AI Traffic Manager
// =============================================

import { useEffect, useRef, useState } from "react";
import { Bot, Plus, Send, Square, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdsChat } from "@/hooks/useAdsChat";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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
    <div className="grid gap-4 lg:grid-cols-4 h-[calc(100vh-380px)] min-h-[400px]">
      {/* Sidebar */}
      <Card className="lg:col-span-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-3 pt-3">
          <CardTitle className="text-xs font-medium">Conversas</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleNewConversation}
            disabled={isCreating}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-2 pb-2">
            <div className="space-y-1">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setCurrentConversationId(conv.id)}
                  className={`w-full text-left rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                    currentConversationId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p className="truncate font-medium">{conv.title || "Nova conversa"}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {new Date(conv.updated_at).toLocaleDateString("pt-BR")}
                  </p>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Nenhuma conversa
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Area */}
      <Card className="lg:col-span-3 flex flex-col">
        <CardHeader className="border-b pb-2 pt-2 px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xs font-medium">{scopeLabel}</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                Converse com a IA sobre suas campanhas
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          {currentConversationId ? (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Streaming message */}
                  {isStreaming && streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted">
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <ReactMarkdown>{streamingContent}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {isStreaming && !streamingContent && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          Pensando...
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte sobre suas campanhas..."
                    className="min-h-[40px] max-h-[120px] resize-none text-sm"
                    disabled={isStreaming}
                  />
                  {isStreaming ? (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={cancelStreaming}
                      className="shrink-0"
                    >
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="shrink-0"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-sm font-semibold mb-1">
                {scope === "account" ? "Chat da Conta" : "Chat Global"}
              </h3>
              <p className="text-xs text-muted-foreground mb-3 max-w-sm">
                Converse com a IA sobre estratégias, peça relatórios, sugira campanhas ou solicite auditorias.
              </p>
              <Button size="sm" onClick={handleNewConversation} disabled={isCreating}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Nova conversa
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
