// =============================================
// EXECUTION CARD — Compact stats card for Central de Execuções
// Auto-sizes based on number of stats. Returns null if no pendencies.
// =============================================

import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import type { ExecutionStat } from "@/hooks/useExecutionCounts";

interface ExecutionCardProps {
  title: string;
  icon: LucideIcon;
  stats: ExecutionStat[];
}

const colorMap = {
  warning: "text-orange-600 dark:text-orange-400",
  destructive: "text-destructive",
  info: "text-blue-600 dark:text-blue-400",
  default: "text-muted-foreground",
};

export function ExecutionCard({ title, icon: Icon, stats }: ExecutionCardProps) {
  if (stats.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.navigateTo}
              className="px-3 py-2 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors group min-w-[110px]"
            >
              <div className={`text-xl font-bold ${colorMap[stat.color]}`}>
                {stat.count}
              </div>
              <div className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                {stat.label}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
