// =============================================================================
// AdsAIGlobalAnalysisButton — Onda E (correção: escopo global mínimo)
// Dispara a análise estratégica em escopo global (todas as contas Meta com IA
// ativada). Google/TikTok são ignorados nesta etapa com aviso amigável.
// =============================================================================
import { useState } from "react";
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

interface Props {
  /** Quantidade de contas Meta com IA ativada no tenant. Apenas informativo. */
  metaAccountsCount: number;
  hasOtherChannels?: boolean;
}

export function AdsAIGlobalAnalysisButton({ metaAccountsCount, hasOtherChannels }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
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
    }
  };

  const summary = latestRun?.diagnosis_summary;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Globe className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Análise inicial global</span>
            {hasRunning && (
              <Badge variant="secondary" className="text-[10px]">
                <Clock className="h-3 w-3 mr-1" /> Em andamento
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {metaAccountsCount} conta(s) Meta com IA
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Roda a análise inicial em todas as contas Meta com IA ativada. Cria propostas
            por conta na fila Aguardando Ação. Não publica campanha. Não gera criativo final.
            {hasOtherChannels && " Google Ads e TikTok Ads ainda não estão operacionais e serão ignorados."}
          </p>
          {latestRun?.finished_at && latestRun.status === "completed" && (
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
          {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (
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
            <AlertDialogTitle>Rodar análise inicial global?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação roda a análise inicial para todas as contas Meta com IA ativada
              ({metaAccountsCount} conta(s)). Cada conta consome uma chamada de IA estratégica
              e gera propostas na fila Aguardando Ação. Nenhuma campanha será publicada e nenhum
              criativo final será gerado automaticamente.
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
