// =============================================
// SHARED CHAT TYPING INDICATOR
// Animated dots indicator for streaming state
// =============================================

import { cn } from "@/lib/utils";

interface ChatTypingIndicatorProps {
  label?: string;
  className?: string;
}

export function ChatTypingIndicator({ label = "Pensando", className }: ChatTypingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.3s]" />
        <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.15s]" />
        <div className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
      </div>
      <span className="text-xs">{label}...</span>
    </div>
  );
}
