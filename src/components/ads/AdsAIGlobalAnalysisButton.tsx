// =============================================================================
// AdsAIGlobalAnalysisButton — Onda E (correção: escopo global mínimo)
// Dispara a análise estratégica em escopo global (todas as contas Meta com IA
// ativada). Google/TikTok são ignorados nesta etapa com aviso amigável.
// =============================================================================
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Clock, AlertTriangle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { useAdsAIAnalysisRun } from "@/hooks/useAdsAIAnalysisRun";
import { AdsAnalysisProgressModal } from "./AdsAnalysisProgressModal";

interface Props {
  /** Quantidade de contas Meta com IA ativada no tenant. Apenas informativo. */
  metaAccountsCount: number;
  hasOtherChannels?: boolean;
}

export function AdsAIGlobalAnalysisButton({ metaAccountsCount, hasOtherChannels }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const { run, hasRunning, latestRun } = useAdsAIAnalysisRun({
    platform: "meta",
    scope: "global",
  });

  const disabled = metaAccountsCount === 0;

  const execute = async (force: boolean) => {
    const resp: any = await run.mutateAsync({
      scope: "global",
      trigger: "manual",
      force,
    });
    const payload = resp?.data || resp;
    if (payload?.skipped && payload?.reason === "recent_completed_requires_force") {
      setRecentOpen(true);
    } else if (!payload?.skipped) {
      setProgressOpen(true);
    }
  };

  useEffect(() => {
    if (progressOpen && !hasRunning && !run.isPending) {
      setProgressOpen(false);
    }
  }, [progressOpen, hasRunning, run.isPending]);

  const summary = latestRun?.diagnosis_summary;

  return (
    <div className={`rounded-lg border p-3 space-y-2 transition-colors ${hasRunning ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Análise estratégica global</span>
            {hasRunning && (
              <Badge variant="default" className="text-[10px] gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Analisando agora
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {metaAccountsCount} conta(s) Meta com IA
            </Badge>
          </div>
          {hasRunning ? (
            <p className="text-[11px] text-primary font-medium mt-1 leading-relaxed">
              A IA está estudando todas as contas agora. Cada conta leva de 1 a 5 minutos
              e roda em sequência. Você pode sair desta tela — o resultado vai aparecer
              na fila Aguardando Ação quando terminar.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
              Roda a análise estratégica em todas as contas Meta com IA ativada. Cria propostas
              por conta na fila Aguardando Ação. Não publica campanha. Não gera criativo final.
              {hasOtherChannels && " Google Ads e TikTok Ads ainda não estão operacionais e serão ignorados."}
            </p>
          )}
          {!hasRunning && latestRun?.finished_at && latestRun.status === "completed" && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Última análise global em {new Date(latestRun.finished_at).toLocaleString("pt-BR")}.
              {summary ? ` ${summary}` : ""}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={disabled || hasRunning || run.isPending}
        >
          {run.isPending || hasRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : (
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Rodar análise global
            </span>
          )}
        </Button>
      </div>


      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rodar análise estratégica global?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação roda a análise estratégica para todas as contas Meta com IA ativada
              ({metaAccountsCount} conta(s)). Cada conta consome uma chamada de IA estratégica
              e gera propostas na fila Aguardando Ação. Nenhuma campanha será publicada e nenhum
              criativo final será gerado automaticamente. A análise roda em segundo plano e
              cada conta costuma levar de 1 a 5 minutos.
              {hasOtherChannels && (
                <> Google Ads e TikTok Ads ainda não estão operacionais e serão ignorados.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => execute(false)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={recentOpen} onOpenChange={setRecentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Já existe uma análise global recente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Uma análise global foi concluída há menos de 24h. Tem certeza que quer rodar
              de novo? Isso consome novas chamadas de IA estratégica por conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => execute(true)}>Rodar novamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
