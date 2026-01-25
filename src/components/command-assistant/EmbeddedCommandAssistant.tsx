// =============================================
// EMBEDDED COMMAND ASSISTANT
// Full chat interface for embedding in a page/tab
// =============================================

import { useEffect, useRef, useState } from "react";
import { Bot, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCommandAssistant } from "@/hooks/useCommandAssistant";
import { CommandChatMessages } from "./CommandChatMessages";
import { CommandChatInput } from "./CommandChatInput";

export function EmbeddedCommandAssistant() {
  const {
    conversations,
    currentConversationId,
    messages,
    isLoadingMessages,
    isStreaming,
    streamingContent,
    createConversation,
    setCurrentConversationId,
    sendMessage,
    cancelStreaming,
    executeAction,
  } = useCommandAssistant();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent]);
  
  const handleNewConversation = async () => {
    setIsCreating(true);
    try {
      await createConversation("Nova conversa");
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleSend = async (
    message: string, 
    attachments?: { url: string; filename: string; mimeType: string }[]
  ) => {
    await sendMessage(message, attachments);
  };
  
  return (
    <div className="grid gap-6 lg:grid-cols-4 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Conversations Sidebar */}
      <Card className="lg:col-span-1 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
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
              {conversations?.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setCurrentConversationId(conv.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    currentConversationId === conv.id
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <p className="truncate font-medium">{conv.title || "Nova conversa"}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(conv.updated_at).toLocaleDateString('pt-BR')}
                  </p>
                </button>
              ))}
              {(!conversations || conversations.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma conversa ainda
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Chat Area */}
      <Card className="lg:col-span-3 flex flex-col">
        <CardHeader className="border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">Auxiliar de Comando</CardTitle>
              <p className="text-xs text-muted-foreground">
                Seu assistente para operações da loja
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          {currentConversationId ? (
            <>
              <div className="flex-1 overflow-hidden">
                <CommandChatMessages
                  messages={messages || []}
                  isLoading={isLoadingMessages}
                  isStreaming={isStreaming}
                  streamingContent={streamingContent}
                  onExecuteAction={executeAction}
                />
              </div>
              <div className="border-t p-4">
                <CommandChatInput
                  onSend={handleSend}
                  isStreaming={isStreaming}
                  onCancel={cancelStreaming}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Bem-vindo ao Auxiliar de Comando
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                Eu posso te ajudar a gerenciar pedidos, produtos, clientes e muito mais.
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
  );
}
