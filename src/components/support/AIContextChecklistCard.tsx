import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Info, ListChecks, ChevronDown, ChevronUp } from "lucide-react";
import { useAiContextChecklist, type ChecklistSeverity } from "@/hooks/useAiContextChecklist";
import { useNavigate } from "react-router-dom";

const severityStyle: Record<ChecklistSeverity, { label: string; variant: "destructive" | "default" | "secondary"; Icon: typeof AlertTriangle }> = {
  critico: { label: "Crítico", variant: "destructive", Icon: AlertTriangle },
  recomendado: { label: "Recomendado", variant: "default", Icon: Info },
  informativo: { label: "Informativo", variant: "secondary", Icon: Info },
};

interface Props {
  /** Optional callback invoked when an anchor CTA needs the parent to switch tabs first. */
  onNavigateAnchor?: (target: string) => void;
}

export function AIContextChecklistCard({ onNavigateAnchor }: Props) {
  const { items, counts, isLoading } = useAiContextChecklist();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const pending = items.filter((i) => !i.resolved).length;
  const hasCriticos = items.some((i) => i.severity === "critico" && !i.resolved);

  const handleCta = (cta?: { kind: "anchor" | "route"; target: string }) => {
    if (!cta) return;
    if (cta.kind === "anchor") {
      if (onNavigateAnchor) onNavigateAnchor(cta.target);
      // Let parent switch tab first, then scroll
      setTimeout(() => {
        const el = document.querySelector(cta.target);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } else {
      navigate(cta.target);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ListChecks className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Diagnóstico do contexto da IA</span>
            <Badge
              variant={hasCriticos ? "destructive" : "secondary"}
              className="text-[10px]"
            >
              {isLoading ? "…" : `${counts.resolved}/${counts.total} prontos`}
            </Badge>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 h-7 text-xs"
          >
            {open ? (
              <>
                Ocultar <ChevronUp className="h-3 w-3 ml-1" />
              </>
            ) : (
              <>
                {pending > 0 ? `Ver ${pending} pendência${pending > 1 ? "s" : ""}` : "Ver detalhes"}
                <ChevronDown className="h-3 w-3 ml-1" />
              </>
            )}
          </Button>
        </div>

        {open && (
          <div className="space-y-2 mt-3 pt-3 border-t">
            {items.map((item) => {
              const sev = severityStyle[item.severity];
              const Icon = item.resolved ? CheckCircle2 : sev.Icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-md border p-2.5"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${
                        item.resolved ? "text-green-600" : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{item.label}</span>
                        {!item.resolved && (
                          <Badge variant={sev.variant} className="text-[10px]">
                            {sev.label}
                          </Badge>
                        )}
                        {item.resolved && (
                          <Badge variant="outline" className="text-[10px] border-green-600/40 text-green-700">
                            Pronto
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.why}</p>
                    </div>
                  </div>
                  {!item.resolved && item.cta && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCta(item.cta)}
                      className="shrink-0 h-7 text-xs"
                    >
                      {item.cta.label}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
