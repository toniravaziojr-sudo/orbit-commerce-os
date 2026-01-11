import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommandAssistantContext } from "./CommandAssistantContext";
import { cn } from "@/lib/utils";

interface CommandAssistantTriggerProps {
  variant?: "button" | "input";
  className?: string;
}

export function CommandAssistantTrigger({
  variant = "input",
  className,
}: CommandAssistantTriggerProps) {
  const { openAssistant } = useCommandAssistantContext();

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={openAssistant}
        className={cn("gap-2", className)}
      >
        <Sparkles className="h-4 w-4" />
        Auxiliar
      </Button>
    );
  }

  return (
    <button
      onClick={openAssistant}
      className={cn(
        "relative flex h-10 w-80 items-center gap-2 rounded-md border border-transparent bg-muted/50 px-3 text-sm text-muted-foreground transition-colors",
        "hover:border-border hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
    >
      <Sparkles className="h-4 w-4 text-primary" />
      <span>Auxiliar de Comando...</span>
      <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-block">
        ⌘K
      </kbd>
    </button>
  );
}
