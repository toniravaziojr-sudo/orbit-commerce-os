import { useState } from "react";
import { AlertTriangle, Bell, Eye, EyeOff, MessageCircle, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAdsAIWarnings, type AdsAIWarning } from "@/hooks/useAdsAIWarnings";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const severityStyles: Record<AdsAIWarning["severity"], { label: string; className: string }> = {
  informativo: { label: "Informativo", className: "bg-sky-500/10 text-sky-600 border-sky-500/20" },
  atencao: { label: "Atenção", className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  urgente: { label: "Urgente", className: "bg-red-500/10 text-red-600 border-red-500/20" },
};

function TrendIcon({ trend }: { trend: string | null }) {
  if (!trend) return null;
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function WarningCard({ w, onMarkSeen, onDismiss }: { w: AdsAIWarning; onMarkSeen: (id: string) => void; onDismiss: (id: string) => void }) {
  const sev = severityStyles[w.severity];
  return (
    <Card className={w.status === "open" ? "border-l-4 border-l-primary" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={sev.className}>{sev.label}</Badge>
              {w.channel && <Badge variant="secondary" className="text-xs uppercase">{w.channel}</Badge>}
              {w.ad_account_id && <span className="text-xs text-muted-foreground">Conta {w.ad_account_id}</span>}
              <TrendIcon trend={w.trend} />
              {w.status === "converted" && (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Virou proposta</Badge>
              )}
            </div>
            <CardTitle className="text-base">{w.title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{w.description}</p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Detectado {formatDistanceToNow(new Date(w.first_signal_at), { addSuffix: true, locale: ptBR })}
            {w.signal_count > 1 && ` · ${w.signal_count} sinais`}
          </span>
          <div className="flex items-center gap-2">
            {w.status === "open" && (
              <Button size="sm" variant="ghost" onClick={() => onMarkSeen(w.id)}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Marcar como visto
              </Button>
            )}
            {w.status !== "dismissed" && w.status !== "converted" && (
              <Button size="sm" variant="ghost" onClick={() => onDismiss(w.id)}>
                <EyeOff className="h-3.5 w-3.5 mr-1" /> Dispensar
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdsWarningsTab() {
  const { warnings, isLoading, markSeen, dismiss } = useAdsAIWarnings();
  const [filter, setFilter] = useState<"active" | "all">("active");

  const visible = filter === "active"
    ? warnings.filter((w) => w.status === "open" || w.status === "seen")
    : warnings;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Avisos da IA
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            A IA observa as suas contas continuamente. Quando detecta algo relevante sem ter ainda uma ação concreta para sugerir, ela registra aqui como um aviso. Quando vira ação concreta, o aviso é marcado como "virou proposta" e aparece em Aguardando Ação da conta.
          </p>
        </CardHeader>
      </Card>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "active" | "all")}>
        <TabsList>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="all">Histórico completo</TabsTrigger>
        </TabsList>
        <TabsContent value={filter} className="mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando avisos...</p>
          ) : visible.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-2">
                <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium">Nenhum aviso por enquanto</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Assim que a IA identificar sinais relevantes nas suas contas (queda de ROI, fadiga de criativo, frequência alta), eles aparecem aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-3 pr-2">
                {visible.map((w) => (
                  <WarningCard key={w.id} w={w} onMarkSeen={markSeen} onDismiss={dismiss} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
