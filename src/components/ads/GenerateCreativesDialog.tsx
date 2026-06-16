// =============================================================================
// GenerateCreativesDialog — Onda H.4.1
// Confirmação final antes de iniciar processamento de IA.
// =============================================================================

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles, Loader2 } from "lucide-react";
import type { CreativeReadinessCostEstimate } from "@/hooks/useCreativeReadiness";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cost: CreativeReadinessCostEstimate | undefined;
  isProcessing: boolean;
  onConfirm: () => void;
}

export function GenerateCreativesDialog({ open, onOpenChange, cost, isProcessing, onConfirm }: Props) {
  const totalJobs = cost?.total_jobs ?? 0;
  const totalCredits = cost?.total_credits ?? null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            Gerar {totalJobs} criativo{totalJobs > 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="pl-[46px] space-y-3 text-sm">
              <p>
                Vamos gerar <strong>{totalJobs}</strong> imagem{totalJobs > 1 ? "ns" : ""} para esta campanha
                usando a identidade visual, a promessa e os benefícios cadastrados.
              </p>
              <div className="rounded-md bg-muted p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">Custo estimado</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {totalCredits !== null ? `${totalCredits} créditos` : "—"}
                  </span>
                </div>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                <li><strong>Isso iniciará processamento de IA</strong> e consumirá créditos.</li>
                <li><strong>Nada será enviado ao Meta agora.</strong> Você revisará as imagens antes de publicar.</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isProcessing}
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
          >
            {isProcessing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Iniciando…</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Gerar criativos</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
