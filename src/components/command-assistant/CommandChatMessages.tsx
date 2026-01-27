import { useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle, Bot, User, Wrench, FileText, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CommandMessage, ProposedAction } from "@/hooks/useCommandAssistant";
import { cn } from "@/lib/utils";

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

  // Auto-scroll to bottom
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
      <div className="space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onExecuteAction={onExecuteAction}
          />
        ))}

        {/* Streaming message */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 rounded-lg bg-muted/50 p-3">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5">
                <ReactMarkdown>{streamingContent}</ReactMarkdown>
              </div>
              <span className="inline-block h-4 w-1 animate-pulse bg-primary" />
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Pensando...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
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
  const attachments = message.metadata?.attachments as { url: string; filename: string; mimeType: string }[] | undefined;

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary" : isTool ? "bg-amber-500/10" : "bg-primary/10"
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-primary-foreground" />
        ) : isTool ? (
          <Wrench className="h-4 w-4 text-amber-500" />
        ) : (
          <Bot className="h-4 w-4 text-primary" />
        )}
      </div>

      <div className={cn("flex max-w-[80%] flex-col gap-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-lg p-3",
            isUser
              ? "bg-primary text-primary-foreground"
              : isTool
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-muted/50"
          )}
        >
          {message.content && (
            isUser ? (
              <p className="whitespace-pre-wrap text-sm">{message.content}</p>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-4 prose-headings:mb-2 prose-headings:font-semibold prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )
          )}

          {/* User attachments */}
          {isUser && attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((att, idx) => {
                const isImage = att.mimeType?.startsWith("image/");
                return (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1 bg-primary-foreground/20 rounded text-xs hover:bg-primary-foreground/30 transition-colors"
                  >
                    {isImage ? (
                      <ImageIcon className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    <span className="max-w-[100px] truncate">{att.filename}</span>
                  </a>
                );
              })}
            </div>
          )}

          {/* Tool result */}
          {isTool && toolResult && (
            <div className="mt-2">
              {toolResult.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">{toolResult.message || "Ação executada com sucesso"}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-destructive">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">{toolResult.error || "Erro ao executar ação"}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Proposed actions */}
        {proposedActions.length > 0 && (
          <div className="space-y-2">
            {proposedActions.map((action) => (
              <div
                key={action.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <p className="mb-2 text-sm font-medium">{action.description}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onExecuteAction(action)}
                  >
                    Confirmar
                  </Button>
                  <Button size="sm" variant="outline">
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
