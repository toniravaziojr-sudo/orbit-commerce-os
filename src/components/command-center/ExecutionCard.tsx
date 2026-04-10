// =============================================
// EXECUTION CARD — Stats grid card for the Central de Execuções
// Shows colored counters as clickable links. Returns null if no pendencies.
// Cards are centered when there are few items.
// =============================================

import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap justify-center gap-3">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.navigateTo}
              className="p-3 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors group min-w-[140px] flex-1 max-w-[280px]"
            >
              <div className={`text-2xl font-bold ${colorMap[stat.color]}`}>
                {stat.count}
              </div>
              <div className="text-xs text-muted-foreground group-hover:text-foreground transition-colors line-clamp-2">
                {stat.label}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
