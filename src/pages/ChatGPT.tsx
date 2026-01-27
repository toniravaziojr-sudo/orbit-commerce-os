// =============================================
// CHATGPT MODULE
// AI-powered chat interface for research and queries
// =============================================

import { useState, useRef, useEffect } from "react";
import { Send, Plus, Search, Sparkles, Loader2, StopCircle, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export default function ChatGPT() {
  const { currentTenant, user } = useAuth();
  const tenant = currentTenant;
  const queryClient = useQueryClient();
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery({
    queryKey: ["chatgpt-conversations", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("command_conversations")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Conversation[];
    },
    enabled: !!tenant?.id,
  });

  // Fetch messages for current conversation
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery({
    queryKey: ["chatgpt-messages", currentConversationId],
    queryFn: async () => {
      if (!currentConversationId) return [];
      const { data, error } = await supabase
        .from("command_messages")
        .select("*")
        .eq("conversation_id", currentConversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content || "",
        created_at: m.created_at,
      })) as ChatMessage[];
    },
    enabled: !!currentConversationId,
  });

  // Update local messages when fetched messages change
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingContent]);

  // Create new conversation
  const createConversationMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!tenant?.id || !user?.id) throw new Error("Missing tenant or user");
      const { data, error } = await supabase
        .from("command_conversations")
        .insert({ tenant_id: tenant.id, user_id: user.id, title })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chatgpt-conversations"] });
      setCurrentConversationId(data.id);
      setLocalMessages([]);
    },
  });

  const handleNewConversation = () => {
    createConversationMutation.mutate("Nova conversa");
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;
    
    const messageText = inputValue.trim();
    setInputValue("");
    
    // Create conversation if needed
    let conversationId = currentConversationId;
    if (!conversationId) {
      try {
        const newConv = await createConversationMutation.mutateAsync("Nova conversa");
        conversationId = newConv.id;
      } catch (error) {
        toast.error("Erro ao criar conversa");
        return;
      }
    }

    // Add user message optimistically
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMessage]);

    // Save user message to DB
    if (tenant?.id && user?.id) {
      await supabase.from("command_messages").insert({
        conversation_id: conversationId,
        tenant_id: tenant.id,
        user_id: user.id,
        role: "user",
        content: messageText,
      });
    }

    // Start streaming
    setIsStreaming(true);
    setStreamingContent("");
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatgpt-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...localMessages, userMessage].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            conversationId,
            tenantId: tenant?.id,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast.error("Limite de requisições excedido. Tente novamente em alguns minutos.");
        } else if (response.status === 402) {
          toast.error("Créditos insuficientes. Adicione mais créditos para continuar.");
        } else {
          toast.error("Erro ao processar sua mensagem");
        }
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let fullContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });
        
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamingContent(fullContent);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullContent,
        created_at: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent("");

      // Save assistant message to DB
      if (tenant?.id && user?.id) {
        await supabase.from("command_messages").insert({
          conversation_id: conversationId,
          tenant_id: tenant.id,
          user_id: user.id,
          role: "assistant",
          content: fullContent,
        });
        
        // Update conversation title if it's the first message
        if (localMessages.length === 0) {
          const title = messageText.slice(0, 50) + (messageText.length > 50 ? "..." : "");
          await supabase
            .from("command_conversations")
            .update({ title, updated_at: new Date().toISOString() })
            .eq("id", conversationId);
          queryClient.invalidateQueries({ queryKey: ["chatgpt-conversations"] });
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Chat error:", error);
        toast.error("Erro ao processar sua mensagem");
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
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
              disabled={createConversationMutation.isPending}
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
                    {localMessages.map((message) => (
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
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{message.content}</ReactMarkdown>
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
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{streamingContent}</ReactMarkdown>
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
                          onClick={handleCancel}
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
                <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                  <Sparkles className="h-10 w-10 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Como posso ajudar?</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Use o ChatGPT para pesquisas, tirar dúvidas, gerar conteúdo e muito mais.
                  Comece uma nova conversa ou selecione uma existente.
                </p>
                <Button onClick={handleNewConversation} size="lg" className="gap-2">
                  <Plus className="h-5 w-5" />
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
