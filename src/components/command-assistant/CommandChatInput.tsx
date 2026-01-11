import { useState, useRef, KeyboardEvent } from "react";
import { Send, Paperclip, Mic, StopCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CommandChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  onCancel: () => void;
}

export function CommandChatInput({ onSend, isStreaming, onCancel }: CommandChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming) return;
    
    onSend(trimmed);
    setMessage("");
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className="border-t border-border p-4">
      <div className="flex items-end gap-2">
        <TooltipProvider>
          {/* Attachment button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0" disabled>
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Anexar arquivo (em breve)</p>
            </TooltipContent>
          </Tooltip>

          {/* Audio button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="flex-shrink-0" disabled>
                <Mic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Gravar áudio (em breve)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Message input */}
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Digite sua mensagem... (Enter para enviar)"
            className={cn(
              "min-h-[40px] max-h-[200px] resize-none",
              "bg-muted/50 border-transparent focus:border-border"
            )}
            rows={1}
            disabled={isStreaming}
          />
        </div>

        {/* Send/Cancel button */}
        {isStreaming ? (
          <Button
            variant="destructive"
            size="icon"
            className="flex-shrink-0"
            onClick={onCancel}
          >
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="flex-shrink-0"
            onClick={handleSend}
            disabled={!message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="mt-2 text-center text-xs text-muted-foreground">
        O assistente pode executar ações como criar categorias, cupons e tarefas
      </p>
    </div>
  );
}
