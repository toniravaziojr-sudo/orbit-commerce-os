import { useEffect, useRef } from "react";
import { X, MessageSquarePlus, Trash2, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCommandAssistant, CommandConversation } from "@/hooks/useCommandAssistant";
import { useCommandAssistantContext } from "./CommandAssistantContext";
import { CommandChatMessages } from "./CommandChatMessages";
import { CommandChatInput } from "./CommandChatInput";
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

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeAssistant();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeAssistant]);

  // Handle new conversation
  const handleNewConversation = async () => {
    await createConversation("Nova conversa");
  };

  // Handle select conversation
  const handleSelectConversation = (conv: CommandConversation) => {
    setCurrentConversationId(conv.id);
  };

  // Handle delete conversation
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    await deleteConversation(convId);
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
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-lg">🤖</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold">Auxiliar de Comando</h2>
              <p className="text-xs text-muted-foreground">Seu assistente inteligente</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleNewConversation} title="Nova conversa">
              <MessageSquarePlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={closeAssistant}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Conversations */}
          <div className="hidden w-48 flex-shrink-0 border-r border-border md:block">
            <div className="p-2">
              <p className="mb-2 px-2 text-xs font-medium text-muted-foreground">Conversas</p>
              <ScrollArea className="h-[calc(100vh-140px)]">
                <div className="space-y-1">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={cn(
                        "group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                        currentConversationId === conv.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className="truncate flex-1">{conv.title}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteConversation(e as any, conv.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  {conversations.length === 0 && !isLoadingConversations && (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Nenhuma conversa ainda.
                      <br />
                      Comece uma nova!
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Chat Area */}
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
                <CommandChatInput
                  onSend={sendMessage}
                  isStreaming={isStreaming}
                  onCancel={cancelStreaming}
                />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-3xl">🤖</span>
                </div>
                <h3 className="mb-2 text-lg font-semibold">Bem-vindo ao Auxiliar de Comando</h3>
                <p className="mb-4 max-w-sm text-sm text-muted-foreground">
                  Posso ajudar você a criar categorias, cupons, gerar relatórios e muito mais.
                  Comece uma conversa!
                </p>
                <Button onClick={handleNewConversation}>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  Nova conversa
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
