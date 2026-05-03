import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Info, ListChecks } from "lucide-react";
import { useAiContextChecklist, type ChecklistSeverity } from "@/hooks/useAiContextChecklist";
import { useNavigate } from "react-router-dom";

const severityStyle: Record<ChecklistSeverity, { label: string; variant: "destructive" | "default" | "secondary"; Icon: typeof AlertTriangle }> = {
  critico: { label: "Crítico", variant: "destructive", Icon: AlertTriangle },
  recomendado: { label: "Recomendado", variant: "default", Icon: Info },
  informativo: { label: "Informativo", variant: "secondary", Icon: Info },
};

export function AIContextChecklistCard() {
  const { items, counts, isLoading } = useAiContextChecklist();
  const navigate = useNavigate();

  const handleCta = (cta?: { kind: "anchor" | "route"; target: string }) => {
    if (!cta) return;
    if (cta.kind === "anchor") {
      const el = document.querySelector(cta.target);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      navigate(cta.target);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Diagnóstico do contexto da IA
          </CardTitle>
          <Badge variant="secondary">
            {counts.resolved}/{counts.total} prontos
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Quanto mais informações você preencher, melhor a IA atende e vende. Nada aqui bloqueia o uso da IA.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {items.map((item) => {
          const sev = severityStyle[item.severity];
          const Icon = item.resolved ? CheckCircle2 : sev.Icon;
          return (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex items-start gap-3 min-w-0">
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
                  className="shrink-0"
                >
                  {item.cta.label}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
