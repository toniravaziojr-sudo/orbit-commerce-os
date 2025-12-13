import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "primary" | "success" | "warning" | "destructive" | "info";
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
  className,
  ...props
}: StatCardProps) {
  const iconBgColors = {
    default: "bg-muted",
    primary: "bg-primary/10",
    success: "bg-success/10",
    warning: "bg-warning/10",
    destructive: "bg-destructive/10",
    info: "bg-info/10",
  };

  const iconColors = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    info: "text-info",
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-card-foreground">{value}</p>
        </div>
        {Icon && (
          <div
            className={cn(
              "rounded-lg p-2.5",
              iconBgColors[variant]
            )}
          >
            <Icon className={cn("h-5 w-5", iconColors[variant])} />
          </div>
        )}
      </div>
      {(description || trend) && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          {trend && (
            <span
              className={cn(
                "font-medium",
                trend.value >= 0 ? "text-success" : "text-destructive"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}%
            </span>
          )}
          {(description || trend?.label) && (
            <span className="text-muted-foreground">
              {description || trend?.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
