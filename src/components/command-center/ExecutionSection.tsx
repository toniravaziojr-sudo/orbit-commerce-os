// =============================================
// EXECUTION SECTION — Reusable section for the Executions Queue
// Shows a module category with count badge, items list, and navigation
// =============================================

import { LucideIcon, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ExecutionItem {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  variant: "warning" | "info" | "destructive" | "default";
  navigateTo: string;
  actionLabel?: string;
}

interface ExecutionSectionProps {
  title: string;
  icon: LucideIcon;
  items: ExecutionItem[];
  emptyMessage?: string;
}

const variantColors = {
  warning: "text-warning bg-warning/10",
  info: "text-info bg-info/10",
  destructive: "text-destructive bg-destructive/10",
  default: "text-muted-foreground bg-muted",
};

export function ExecutionSection({ title, icon: SectionIcon, items, emptyMessage }: ExecutionSectionProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(items.length > 0);
  const count = items.length;

  return (
    <Card className={count === 0 ? "opacity-60" : ""}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <SectionIcon className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {count > 0 && (
              <Badge variant="destructive" className="text-xs">
                {count}
              </Badge>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {emptyMessage || "Nenhuma pendência"}
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-4 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(item.navigateTo)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${variantColors[item.variant]}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1 text-primary flex-shrink-0">
                      {item.actionLabel || "Ir para ação"}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
