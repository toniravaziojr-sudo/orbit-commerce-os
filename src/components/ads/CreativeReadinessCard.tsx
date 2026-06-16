// =============================================================================
// CreativeReadinessCard — Onda H.4.1
// Mostra o que falta (3 primeiros + "Ver todos") ou o botão "Gerar criativos".
// Reage ao veredito server-side do motor de prontidão.
// =============================================================================

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, AlertCircle, Loader2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useCreativeReadiness, type CreativeReadinessIssue } from "@/hooks/useCreativeReadiness";
import { GenerateCreativesDialog } from "./GenerateCreativesDialog";

interface Props {
  actionId: string;
  campaignName: string;
}

const VISIBLE_BLOCKERS = 3;

export function CreativeReadinessCard({ actionId, campaignName }: Props) {
  const {
    readiness, isReady, blockers, cost, productResolved,
    isLoading, enqueue, isEnqueuing,
  } = useCreativeReadiness(actionId);
  const [showAll, setShowAll] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading || !readiness) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Verificando o que falta para gerar os criativos…</span>
        </CardContent>
      </Card>
    );
  }

  if (isReady) {
    const totalCredits = cost?.total_credits ?? null;
    const totalJobs = cost?.total_jobs ?? 0;
    return (
      <>
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold mb-0.5">Tudo pronto para gerar os criativos</p>
              <p className="text-xs text-muted-foreground">
                {totalJobs} imagem{totalJobs > 1 ? "ns" : ""} · Custo estimado:{" "}
                <strong>{totalCredits !== null ? `${totalCredits} créditos` : "—"}</strong>
              </p>
            </div>
            <Button
              size="sm"
              disabled={isEnqueuing}
              onClick={() => setConfirmOpen(true)}
            >
              <Sparkles className="h-4 w-4 mr-1.5" /> Gerar criativos
            </Button>
          </CardContent>
        </Card>
        <GenerateCreativesDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          cost={cost}
          isProcessing={isEnqueuing}
          onConfirm={() => { enqueue(); setConfirmOpen(false); }}
        />
      </>
    );
  }

  // BLOCKED
  const visible = showAll ? blockers : blockers.slice(0, VISIBLE_BLOCKERS);
  const hidden = blockers.length - VISIBLE_BLOCKERS;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-md bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-0.5">
              Falta preencher {blockers.length} ite{blockers.length > 1 ? "ns" : "m"} para gerar criativos
            </p>
            <p className="text-xs text-muted-foreground">
              {campaignName} · Complete os pontos abaixo para liberar a geração.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] bg-background">{blockers.length}</Badge>
        </div>

        {!productResolved && (
          <Alert className="mb-3 bg-background">
            <AlertDescription className="text-xs">
              O produto desta campanha não foi identificado automaticamente. Abra a proposta e vincule o produto.
            </AlertDescription>
          </Alert>
        )}

        <ul className="space-y-2">
          {visible.map((b, i) => (
            <BlockerRow key={`${b.field}-${i}`} blocker={b} />
          ))}
        </ul>

        {hidden > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Mostrar menos</>
            ) : (
              <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Ver todos ({hidden} a mais)</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function BlockerRow({ blocker }: { blocker: CreativeReadinessIssue }) {
  return (
    <li className="flex items-start gap-2 rounded-md bg-background/60 p-2.5 border border-border/40">
      <div className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium">{blocker.label_pt}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{blocker.reason_pt}</p>
        <p className="text-[10px] text-muted-foreground/80 mt-1 italic">Onde resolver: {blocker.where_to_fix}</p>
      </div>
    </li>
  );
}
