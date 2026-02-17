// =============================================
// EMBEDDED COMMAND ASSISTANT
// Full chat interface for embedding in a page/tab
// =============================================

import { useEffect, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { useCommandAssistant } from "@/hooks/useCommandAssistant";
import { ChatEmptyState, ChatConversationList } from "@/components/chat";
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
  
  const [isCreating, setIsCreating] = useState(false);
  
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
    <div className="grid gap-3 lg:grid-cols-4 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Conversations Sidebar */}
      <div className="lg:col-span-1 bg-card border rounded-xl overflow-hidden flex flex-col">
        <ChatConversationList
          conversations={conversations || []}
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
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold">Auxiliar de Comando</p>
            <p className="text-[10px] text-muted-foreground/70">Seu assistente para operações da loja</p>
          </div>
        </div>

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
            <div className="border-t p-3">
              <CommandChatInput
                onSend={handleSend}
                isStreaming={isStreaming}
                onCancel={cancelStreaming}
              />
            </div>
          </>
        ) : (
          <ChatEmptyState
            icon={<Bot className="h-7 w-7 text-primary" />}
            title="Auxiliar de Comando"
            description="Eu posso te ajudar a gerenciar pedidos, produtos, clientes e muito mais. Comece uma nova conversa ou selecione uma existente."
            onNewConversation={handleNewConversation}
            isCreating={isCreating}
          />
        )}
      </div>
    </div>
  );
}
