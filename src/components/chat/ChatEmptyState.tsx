// =============================================
// SHARED CHAT EMPTY STATE — Modern v2
// Clean, centered welcome with subtle animation
// =============================================

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onNewConversation: () => void;
  isCreating?: boolean;
  buttonLabel?: string;
  className?: string;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

export function ChatEmptyState({
  icon,
  title,
  description,
  onNewConversation,
  isCreating,
  buttonLabel = "Nova conversa",
  className,
  suggestions,
  onSuggestionClick,
}: ChatEmptyStateProps) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center p-8 text-center", className)}>
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/10">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-md">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick?.(s)}
              className="px-3 py-1.5 text-xs rounded-full border border-border/60 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <Button onClick={onNewConversation} disabled={isCreating} className="rounded-full px-6 h-10">
        <Plus className="h-4 w-4 mr-2" />
        {buttonLabel}
      </Button>
    </div>
  );
}
