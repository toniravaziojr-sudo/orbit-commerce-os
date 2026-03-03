import { useEffect, useRef } from "react";
import { Loader2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandMessage, ProposedAction } from "@/hooks/useCommandAssistant";
import { ChatMessageBubble, ChatTypingIndicator } from "@/components/chat";
import { CheckCircle2, XCircle } from "lucide-react";

interface CommandChatMessagesProps {
  messages: CommandMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  executingActionId?: string | null;
  onExecuteAction: (action: ProposedAction) => void;
}

export function CommandChatMessages({
  messages,
  isLoading,
  isStreaming,
  streamingContent,
  executingActionId,
  onExecuteAction,
}: CommandChatMessagesProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [messages, streamingContent]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
      <div className="space-y-5 w-full">
        {messages.map((message) => {
          const proposedActions = message.metadata?.proposed_actions || [];
          const toolResult = message.metadata?.tool_result;
          const isToolResult = message.metadata?.is_tool_result === true;
          const attachments = message.metadata?.attachments as { url: string; filename: string; mimeType: string }[] | undefined;

          // Determine avatar: action results show as tool, otherwise by role
          const avatarIcon = isToolResult ? "tool" : (message.role === "user" ? "user" : message.role === "tool" ? "tool" : "bot");
          // For action results saved as "user", treat display as "tool"
          const displayRole = isToolResult ? "tool" as const : (message.role as "user" | "assistant" | "tool");

          return (
            <ChatMessageBubble
              key={message.id}
              role={displayRole}
              content={isToolResult ? "" : message.content}
              avatarIcon={avatarIcon}
              attachments={attachments}
              timestamp={message.created_at ? new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined}
              actions={
                <>
                  {/* Tool result (from action execution) */}
                  {(isToolResult || (message.role === "tool" && toolResult)) && toolResult && (
                    <div className="px-1 mt-1">
                      {toolResult.success ? (
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span className="text-xs">{toolResult.message || "Ação executada com sucesso"}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="text-xs">{toolResult.error || "Erro ao executar ação"}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Proposed actions */}
                  {proposedActions.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {proposedActions.map((action: ProposedAction) => (
                        <div
                          key={action.id}
                          className="rounded-xl border border-border/50 bg-muted/30 p-3"
                        >
                          <p className="mb-2 text-xs font-medium">{action.description}</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs rounded-lg"
                              onClick={() => onExecuteAction(action)}
                              disabled={!!executingActionId}
                            >
                              {executingActionId === action.id ? (
                                <>
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  Executando...
                                </>
                              ) : (
                                "Confirmar"
                              )}
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs rounded-lg"
                              disabled={!!executingActionId}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              }
            />
          );
        })}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <ChatMessageBubble
            role="assistant"
            content={streamingContent}
          />
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="pt-1.5">
              <ChatTypingIndicator />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
