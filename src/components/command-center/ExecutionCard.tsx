// =============================================
// EXECUTION CARD — Stats grid card for the Executions Queue
// Shows colored counters + action buttons. Returns null if no pendencies.
// =============================================

import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ExecutionStat } from "@/hooks/useExecutionCounts";

interface ExecutionAction {
  label: string;
  navigateTo: string;
  icon?: LucideIcon;
}

interface ExecutionCardProps {
  title: string;
  icon: LucideIcon;
  stats: ExecutionStat[];
  actions?: ExecutionAction[];
}

const colorMap = {
  warning: "text-orange-600 dark:text-orange-400",
  destructive: "text-destructive",
  info: "text-blue-600 dark:text-blue-400",
  default: "text-muted-foreground",
};

export function ExecutionCard({ title, icon: Icon, stats, actions }: ExecutionCardProps) {
  if (stats.length === 0) return null;

  // Auto-generate actions from stats if none provided
  const effectiveActions = actions || stats.slice(0, 3).map(s => ({
    label: s.label,
    navigateTo: s.navigateTo,
  }));

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats grid */}
        <div className={`grid gap-3 ${stats.length <= 2 ? "grid-cols-2" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
          {stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.navigateTo}
              className="p-3 bg-muted rounded-lg text-center hover:bg-muted/80 transition-colors group"
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

        {/* Action buttons */}
        {effectiveActions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {effectiveActions.map((action) => {
              const ActionIcon = 'icon' in action ? (action as ExecutionAction).icon : undefined;
              return (
                <Button key={action.label} variant="outline" size="sm" asChild className="flex-1 min-w-[120px]">
                  <Link to={action.navigateTo}>
                    {ActionIcon && <ActionIcon className="h-4 w-4 mr-1" />}
                    {action.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
