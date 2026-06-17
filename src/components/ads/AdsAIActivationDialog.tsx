// =============================================================================
// AdsAIActivationDialog — Onda E
// Diálogo de ativação da IA com escolha entre Modo Piloto e Modo Piloto Inicial,
// e botão de execução manual "Rodar análise estratégica agora".
// =============================================================================
import { useState, useEffect } from "react";
import { Loader2, Sparkles, Play, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useAdsAIAnalysisRun, type AnalysisScope } from "@/hooks/useAdsAIAnalysisRun";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado quando o usuário confirma a ativação (qualquer modo). */
  onConfirmActivate: () => Promise<void> | void;
  platform: string;
  adAccountId: string;
}

/**
 * Diálogo mostrado quando o usuário liga o switch da IA pela primeira vez (ou após desligar).
 * Duas opções:
 *  - Modo Piloto: ativa e segue o fluxo normal, sem chamar IA agora.
 *  - Modo Piloto Inicial: ativa e roda a análise estratégica.
 */
export function AdsAIActivationDialog({
  open,
  onOpenChange,
  onConfirmActivate,
  platform,
  adAccountId,
}: Props) {
  const [busy, setBusy] = useState<"none" | "pilot" | "initial">("none");
  const { run } = useAdsAIAnalysisRun({ platform, adAccountId, scope: "account" });

  const handlePilot = async () => {
    setBusy("pilot");
    try {
      await onConfirmActivate();
      onOpenChange(false);
    } finally {
      setBusy("none");
    }
  };

  const handleInitial = async () => {
    setBusy("initial");
    try {
      await onConfirmActivate();
      await run.mutateAsync({
        scope: "account",
        ad_account_id: adAccountId,
        trigger: "activation_initial",
      });
      onOpenChange(false);
    } finally {
      setBusy("none");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy || !v ? onOpenChange(v) : null}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Como você quer ativar a IA?
          </DialogTitle>
          <DialogDescription>
            Escolha o modo de ativação. Você pode rodar uma análise estratégica agora
            ou apenas ligar a IA para seguir o fluxo normal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handlePilot}
            disabled={busy !== "none"}
            className="w-full text-left rounded-lg border p-4 hover:bg-accent/30 transition-colors disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Play className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Modo Piloto</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ativa a IA com as configurações atuais. Ela seguirá o fluxo normal
                  de análise e propostas a partir de agora.
                </p>
              </div>
              {busy === "pilot" && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </button>

          <button
            type="button"
            onClick={handleInitial}
            disabled={busy !== "none"}
            className="w-full text-left rounded-lg border-2 border-primary/40 bg-primary/5 p-4 hover:bg-primary/10 transition-colors disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Modo Piloto Inicial</span>
                  <Badge variant="outline" className="text-[10px]">Recomendado</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ativa a IA e executa uma análise estratégica da conta, como se um gestor
                  de tráfego estivesse começando agora. Avalia configurações, orçamento,
                  ROI, diretrizes e campanhas atuais para propor uma estratégia inicial
                  na fila Aguardando Ação.
                </p>
              </div>
              {busy === "initial" && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy !== "none"}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ManualProps {
  platform: string;
  adAccountId: string;
  disabled?: boolean;
}

/**
 * Botão "Rodar análise estratégica agora" com confirmação e tratamento de
 * análises recentes/em andamento.
 */
export function AdsAIManualAnalysisButton({ platform, adAccountId, disabled }: ManualProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const { run, hasRunning, latestRun } = useAdsAIAnalysisRun({
    platform,
    adAccountId,
    scope: "account",
  });

  const handleClick = () => setConfirmOpen(true);

  const execute = async (force: boolean) => {
    const resp: any = await run.mutateAsync({
      scope: "account",
      ad_account_id: adAccountId,
      trigger: "manual",
      force,
    });
    const payload = resp?.data || resp;
    if (payload?.skipped && payload?.reason === "recent_completed_requires_force") {
      setRecentOpen(true);
    }
  };

  const isRunning = hasRunning;
  const runningRun = isRunning ? latestRun : null;

  return (
    <div className="space-y-2">
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${
          isRunning ? "border-primary/40 bg-primary/5" : "bg-card"
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Análise estratégica</span>
            {isRunning && (
              <Badge variant="default" className="text-[10px] gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analisando agora
              </Badge>
            )}
          </div>
          {isRunning ? (
            <div className="mt-1 space-y-0.5">
              <p className="text-[11px] text-primary font-medium">
                A IA está estudando a conta agora. Isso costuma levar de 1 a 5 minutos.
                Você pode sair desta tela — o resultado vai aparecer na fila Aguardando Ação
                quando terminar.
              </p>
              {runningRun?.started_at && (
                <ElapsedTime startedAt={runningRun.started_at} />
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1">
              Roda uma análise completa da conta e cria propostas na fila Aguardando Ação.
              Não publica campanha e não gera criativo final automaticamente.
            </p>
          )}
          {!isRunning && latestRun?.finished_at && latestRun.status === "completed" && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Última análise concluída em {new Date(latestRun.finished_at).toLocaleString("pt-BR")}.
            </p>
          )}
          {!isRunning && latestRun?.status === "failed" && (
            <p className="text-[10px] text-destructive mt-1">
              Última tentativa falhou. Você pode rodar novamente.
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleClick}
          disabled={disabled || isRunning || run.isPending}
        >
          {run.isPending || isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Rodar análise estratégica agora"
          )}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rodar análise estratégica agora?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação consome uma chamada de IA estratégica e cria propostas na fila
              Aguardando Ação. Nenhuma campanha será publicada e nenhum criativo final
              será gerado automaticamente. A análise roda em segundo plano e costuma
              levar de 1 a 5 minutos.
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
              Já existe uma análise recente
            </AlertDialogTitle>
            <AlertDialogDescription>
              Uma análise foi concluída há menos de 24h para esta conta. Tem certeza
              que quer rodar de novo? Isso consome outra chamada de IA estratégica.
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

/** Mostra o tempo decorrido desde o início da análise, atualizando a cada segundo. */
function ElapsedTime({ startedAt }: { startedAt: string }) {
  const [, force] = useState(0);
  // Re-render a cada 1s para atualizar o contador
  useState(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  });
  const startMs = new Date(startedAt).getTime();
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const mm = Math.floor(elapsedSec / 60);
  const ss = elapsedSec % 60;
  return (
    <p className="text-[10px] text-muted-foreground">
      Em execução há {mm > 0 ? `${mm} min ` : ""}{ss.toString().padStart(2, "0")}s.
    </p>
  );
}
