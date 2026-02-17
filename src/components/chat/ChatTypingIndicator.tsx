// =============================================
// SHARED CHAT TYPING INDICATOR — Modern v2
// Smooth pulse animation like modern AI chats
// =============================================

import { cn } from "@/lib/utils";

interface ChatTypingIndicatorProps {
  label?: string;
  className?: string;
}

export function ChatTypingIndicator({ label = "Pensando", className }: ChatTypingIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2.5 text-muted-foreground", className)}>
      <div className="flex items-center gap-[3px]">
        <span className="h-[5px] w-[5px] rounded-full bg-primary/50 animate-[pulse-dot_1.4s_ease-in-out_infinite]" />
        <span className="h-[5px] w-[5px] rounded-full bg-primary/50 animate-[pulse-dot_1.4s_ease-in-out_0.2s_infinite]" />
        <span className="h-[5px] w-[5px] rounded-full bg-primary/50 animate-[pulse-dot_1.4s_ease-in-out_0.4s_infinite]" />
      </div>
      <span className="text-xs font-medium">{label}...</span>
    </div>
  );
}
