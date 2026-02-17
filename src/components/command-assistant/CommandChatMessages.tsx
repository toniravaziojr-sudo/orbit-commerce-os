import { useEffect, useRef } from "react";
import { Loader2, Bot, User, Wrench } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CommandMessage, ProposedAction } from "@/hooks/useCommandAssistant";
import { ChatMessageBubble, ChatTypingIndicator } from "@/components/chat";
import { CheckCircle2, XCircle } from "lucide-react";

interface CommandChatMessagesProps {
  messages: CommandMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  onExecuteAction: (action: ProposedAction) => void;
}

export function CommandChatMessages({
  messages,
  isLoading,
  isStreaming,
  streamingContent,
  onExecuteAction,
}: CommandChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="space-y-4 max-w-3xl mx-auto">
        {messages.map((message) => {
          const proposedActions = message.metadata?.proposed_actions || [];
          const toolResult = message.metadata?.tool_result;
          const attachments = message.metadata?.attachments as { url: string; filename: string; mimeType: string }[] | undefined;

          return (
            <ChatMessageBubble
              key={message.id}
              role={message.role as "user" | "assistant" | "tool"}
              content={message.content}
              avatarIcon={message.role === "user" ? "user" : message.role === "tool" ? "tool" : "bot"}
              attachments={attachments}
              timestamp={message.created_at ? new Date(message.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : undefined}
              actions={
                <>
                  {/* Tool result */}
                  {message.role === "tool" && toolResult && (
                    <div className="px-1">
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
                    <div className="space-y-2">
                      {proposedActions.map((action: ProposedAction) => (
                        <div
                          key={action.id}
                          className="rounded-xl border border-border/60 bg-card p-3"
                        >
                          <p className="mb-2 text-xs font-medium">{action.description}</p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="h-7 text-xs rounded-lg"
                              onClick={() => onExecuteAction(action)}
                            >
                              Confirmar
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg">
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
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="rounded-2xl rounded-tl-md bg-muted/60 border border-border/40 px-4 py-3">
              <ChatTypingIndicator />
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
