// =============================================
// SHARED CHAT EMPTY STATE
// Welcome/empty state for chat interfaces
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
}

export function ChatEmptyState({
  icon,
  title,
  description,
  onNewConversation,
  isCreating,
  buttonLabel = "Nova conversa",
  className,
}: ChatEmptyStateProps) {
  return (
    <div className={cn("flex flex-1 flex-col items-center justify-center p-8 text-center", className)}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mb-5 max-w-sm text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>
      <Button onClick={onNewConversation} disabled={isCreating} className="rounded-full px-5">
        <Plus className="h-4 w-4 mr-2" />
        {buttonLabel}
      </Button>
    </div>
  );
}
