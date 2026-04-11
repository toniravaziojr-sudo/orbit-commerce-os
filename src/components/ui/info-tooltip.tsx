import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getTooltip } from "@/config/ui-tooltips";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  /** Key from ui-tooltips.ts config */
  tooltipKey?: string;
  /** Direct text (overrides tooltipKey) */
  content?: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  /** Show a small "?" icon next to children */
  showIcon?: boolean;
  /** Additional className for the trigger wrapper */
  className?: string;
}

export function InfoTooltip({
  tooltipKey,
  content,
  children,
  side = "top",
  showIcon = false,
  className,
}: InfoTooltipProps) {
  const text = content || (tooltipKey ? getTooltip(tooltipKey) : undefined);

  // If no tooltip text found, just render children
  if (!text) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={1000}>
      <TooltipTrigger asChild>
        {showIcon ? (
          <span className={cn("inline-flex items-center gap-1", className)}>
            {children}
            <Info className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
          </span>
        ) : (
          <span className={className}>{children}</span>
        )}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[280px] text-xs font-normal"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
