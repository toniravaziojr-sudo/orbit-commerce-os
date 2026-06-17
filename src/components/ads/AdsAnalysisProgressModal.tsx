// =============================================================================
// AdsAnalysisProgressModal — Onda E (feedback visual)
// Popup de progresso enquanto a análise estratégica do Gestor de Tráfego IA
// está em execução. Inspirado no SendingInvoiceModal do módulo fiscal.
//
// Como a análise leva de 1 a 5 minutos e roda em segundo plano, a barra de
// progresso é simulada com base no tempo decorrido (cresce suavemente até 95%
// e completa 100% quando a execução termina).
// =============================================================================
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  /** ISO string do início da análise (do banco). Se ausente, usa o momento de abertura. */
  startedAt?: string | null;
  /** Escopo da análise (apenas para texto). */
  scope?: "account" | "global";
  /** Quantidade de contas (apenas para texto, escopo global). */
  accountsCount?: number;
  /** Permite o usuário fechar e manter a análise rodando em segundo plano. */
  onClose: () => void;
}

/** Duração esperada (em segundos) — usada apenas para a barra simulada. */
const EXPECTED_SECONDS = 180; // 3 min como ponto médio entre 1–5 min

export function AdsAnalysisProgressModal({
  open,
  startedAt,
  scope = "account",
  accountsCount,
  onClose,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [fallbackStart] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const startMs = startedAt ? new Date(startedAt).getTime() : fallbackStart;
  const elapsedSec = Math.max(0, Math.floor((now - startMs) / 1000));
  const mm = Math.floor(elapsedSec / 60);
  const ss = elapsedSec % 60;
  const elapsedLabel = `${mm > 0 ? `${mm} min ` : ""}${ss.toString().padStart(2, "0")}s`;

  // Progresso simulado: cresce suavemente até 95% no tempo esperado.
  const simulated = Math.min(95, Math.round((elapsedSec / EXPECTED_SECONDS) * 95));
  const pct = Math.max(5, simulated);

  const isGlobal = scope === "global";
  const title = isGlobal
    ? "Rodando análise estratégica global"
    : "Rodando análise estratégica";
  const description = isGlobal
    ? `A IA está estudando ${accountsCount ? `${accountsCount} conta(s) Meta` : "todas as contas Meta"}. Cada conta leva de 1 a 5 minutos e roda em sequência.`
    : "A IA está estudando a conta agora. Isso costuma levar de 1 a 5 minutos.";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center gap-4 py-2">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
            <Loader2 className="absolute inset-0 m-auto h-14 w-14 animate-spin text-primary/40" />
          </div>

          <div className="space-y-1">
            <DialogTitle className="text-lg">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>

          <div className="w-full space-y-2">
            <Progress value={pct} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Em execução há {elapsedLabel}</span>
              <span>{pct}%</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Você pode fechar esta janela e continuar usando o sistema — o resultado
            vai aparecer na fila <strong>Aguardando Ação</strong> quando terminar.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Continuar em segundo plano
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
