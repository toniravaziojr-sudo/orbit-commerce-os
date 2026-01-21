import { useState, useRef, useEffect, KeyboardEvent } from "react";
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Loader2,
  ChevronDown,
  MessageSquarePlus,
  History,
  CheckCircle2,
  XCircle,
  Wrench,
  StopCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCommandAssistant, CommandMessage, ProposedAction } from "@/hooks/useCommandAssistant";
import { cn } from "@/lib/utils";

export function CommandAssistantInline() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const {
    conversations,
    messages,
    currentConversationId,
    isLoadingMessages,
    isStreaming,
    streamingContent,
    setCurrentConversationId,
    createConversation,
    sendMessage,
    executeAction,
    cancelStreaming,
  } = useCommandAssistant();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard shortcut ⌘K
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSend = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;

    setInputValue("");
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleNewConversation = async () => {
    await createConversation("Nova conversa");
  };

  const handleSelectConversation = (convId: string) => {
    setCurrentConversationId(convId);
  };

  // Auto-resize textarea
  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  const hasMessages = messages.length > 0 || isStreaming;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "relative flex h-10 w-72 items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground transition-all",
          "hover:border-border hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          isOpen && "border-primary/50 bg-muted/50 ring-2 ring-primary/20"
        )}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="flex-1 text-left">Auxiliar de Comando...</span>
        <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/50" />
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
            <div className="w-[560px] rounded-lg border border-border/50 bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Auxiliar de Comando</h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* Conversations dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                        <History className="h-3.5 w-3.5" />
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={handleNewConversation}>
                        <MessageSquarePlus className="mr-2 h-4 w-4" />
                        Nova conversa
                      </DropdownMenuItem>
                      {conversations.length > 0 && (
                        <>
                          <div className="my-1 border-t border-border" />
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                            Conversas recentes
                          </div>
                          {conversations.slice(0, 5).map((conv) => (
                            <DropdownMenuItem
                              key={conv.id}
                              onClick={() => handleSelectConversation(conv.id)}
                              className={cn(
                                currentConversationId === conv.id && "bg-primary/10"
                              )}
                            >
                              <span className="truncate">{conv.title}</span>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex flex-col" style={{ height: hasMessages ? "480px" : "auto" }}>
                {hasMessages ? (
                  <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          onExecuteAction={executeAction}
                        />
                      ))}

                      {/* Streaming message */}
                      {isStreaming && streamingContent && (
                        <div className="flex gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 rounded-xl bg-muted/50 px-4 py-3">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {streamingContent}
                            </p>
                            <span className="inline-block h-4 w-0.5 animate-pulse bg-primary" />
                          </div>
                        </div>
                      )}

                      {isStreaming && !streamingContent && (
                        <div className="flex gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 rounded-xl bg-muted/50 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              <span className="text-sm text-muted-foreground">Pensando...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="px-4 py-8">
                    <div className="text-center space-y-3">
                      <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Auxiliar de Comando</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Posso ajudar você a criar categorias, cupons, atualizar produtos em massa, gerar relatórios e muito mais.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Area */}
                <div className="border-t border-border p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onInput={handleInput}
                      placeholder="Digite uma mensagem..."
                      className={cn(
                        "flex-1 resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm",
                        "placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20",
                        "min-h-[40px] max-h-[120px]"
                      )}
                      rows={1}
                      disabled={isStreaming}
                    />
                    
                    {isStreaming ? (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={cancelStreaming}
                      >
                        <StopCircle className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogPortal>
      </Dialog>
    </>
  );
}

function MessageBubble({
  message,
  onExecuteAction,
}: {
  message: CommandMessage;
  onExecuteAction: (action: ProposedAction) => void;
}) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const proposedActions = message.metadata?.proposed_actions || [];
  const toolResult = message.metadata?.tool_result;

  // Parse markdown-like content for better display
  const renderContent = (content: string) => {
    // Handle **bold** syntax
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary" : isTool ? "bg-accent" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : isTool ? (
          <CheckCircle2 className="h-4 w-4 text-primary" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      <div className={cn("flex max-w-[90%] flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground"
              : isTool
              ? "bg-accent border border-border"
              : "bg-muted/50"
          )}
        >
          {message.content && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {renderContent(message.content)}
            </p>
          )}

          {/* Tool result with report */}
          {isTool && toolResult && (
            <div className="mt-2">
              {toolResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Executado com sucesso</span>
                  </div>
                  {toolResult.data && (
                    <div className="mt-2 rounded-lg bg-background/50 p-3 text-xs space-y-1">
                      {toolResult.data.summary && (
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(toolResult.data.summary).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-muted-foreground capitalize">
                                {key.replace(/_/g, ' ')}:
                              </span>
                              <span className="font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">{toolResult.error || "Erro ao executar"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Proposed actions */}
        {proposedActions.length > 0 && (
          <div className="space-y-2 w-full">
            {proposedActions.map((action) => (
              <div
                key={action.id}
                className="rounded-xl border border-primary/20 bg-primary/5 p-3"
              >
                <p className="mb-3 text-sm font-medium">{action.description}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => onExecuteAction(action)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Confirmar
                  </Button>
                  <Button size="sm" variant="outline" className="h-8">
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Cancelar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
