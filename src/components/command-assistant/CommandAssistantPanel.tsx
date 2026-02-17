import { useEffect, useRef } from "react";
import { X, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommandAssistant, CommandConversation } from "@/hooks/useCommandAssistant";
import { useCommandAssistantContext } from "./CommandAssistantContext";
import { CommandChatMessages } from "./CommandChatMessages";
import { CommandChatInput } from "./CommandChatInput";
import { ChatConversationList, ChatEmptyState } from "@/components/chat";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export function CommandAssistantPanel() {
  const { isOpen, closeAssistant } = useCommandAssistantContext();
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
    deleteConversation,
    sendMessage,
    executeAction,
    cancelStreaming,
  } = useCommandAssistant();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closeAssistant();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeAssistant]);

  const handleNewConversation = async () => {
    await createConversation("Nova conversa");
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={closeAssistant}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-card border-l border-border shadow-2xl",
          "sm:w-[480px] md:w-[560px]",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/15">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Auxiliar de Comando</h2>
              <p className="text-[10px] text-muted-foreground/70">Seu assistente inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleNewConversation} title="Nova conversa">
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={closeAssistant}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="hidden w-48 flex-shrink-0 border-r md:flex flex-col">
            <ChatConversationList
              conversations={conversations}
              currentId={currentConversationId}
              onSelect={setCurrentConversationId}
              onNew={handleNewConversation}
              onDelete={deleteConversation}
              isLoading={isLoadingConversations}
              className="flex-1"
            />
          </div>

          {/* Chat */}
          <div className="flex flex-1 flex-col">
            {currentConversationId ? (
              <>
                <CommandChatMessages
                  messages={messages}
                  isLoading={isLoadingMessages}
                  isStreaming={isStreaming}
                  streamingContent={streamingContent}
                  onExecuteAction={executeAction}
                />
                <div className="border-t p-3">
                  <CommandChatInput
                    onSend={sendMessage}
                    isStreaming={isStreaming}
                    onCancel={cancelStreaming}
                  />
                </div>
              </>
            ) : (
              <ChatEmptyState
                icon={<Bot className="h-7 w-7 text-primary" />}
                title="Auxiliar de Comando"
                description="Posso ajudar você a criar categorias, cupons, gerar relatórios e muito mais. Comece uma conversa!"
                onNewConversation={handleNewConversation}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
