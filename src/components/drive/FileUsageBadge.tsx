import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FileUsage } from "@/hooks/useFileUsageDetection";
import { Link2 } from "lucide-react";

interface FileUsageBadgeProps {
  usages: FileUsage[];
  className?: string;
}

export function FileUsageBadge({ usages, className }: FileUsageBadgeProps) {
  if (usages.length === 0) return null;

  const summary = usages.length === 1
    ? usages[0].label
    : `${usages.length} usos`;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="default" className={`gap-1 ${className || ''}`}>
            <Link2 className="h-3 w-3" />
            Em uso: {summary}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium text-xs mb-1">Onde está em uso:</p>
          <ul className="text-xs space-y-0.5">
            {usages.map((u, i) => (
              <li key={i}>
                • {u.label}{u.detail ? ` — ${u.detail}` : ''}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
