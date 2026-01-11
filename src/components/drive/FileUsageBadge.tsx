import { Badge } from "@/components/ui/badge";
import { FileUsage } from "@/hooks/useFileUsageDetection";

interface FileUsageBadgeProps {
  usages: FileUsage[];
  className?: string;
}

export function FileUsageBadge({ usages, className }: FileUsageBadgeProps) {
  if (usages.length === 0) return null;

  const labels = usages.map((u) => u.label).join(', ');

  return (
    <Badge variant="default" className={className}>
      Em uso: {labels}
    </Badge>
  );
}
