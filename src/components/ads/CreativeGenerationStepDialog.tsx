// =============================================
// CREATIVE GENERATION STEP DIALOG — Frente 4, Etapa 2
// =============================================
// Aberto após o usuário clicar "Aprovar e gerar criativos".
// Acompanha o creative_job, exibe os criativos prontos e o resumo final
// da campanha, com botões: Aprovar campanha final | Ajustar | Reprovar.
// =============================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, X, MessageSquare, Sparkles, ImageIcon, AlertTriangle } from "lucide-react";
import { getFunnelLabel, getCustomerExclusionLine } from "@/lib/ads/audienceLabels";
import {
  useAdsPendingActions,
  type PendingAction,
  isTwoStepAction,
} from "@/hooks/useAdsPendingActions";

export interface CreativeGenerationStepDialogProps {
  action: PendingAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreativeGenerationStepDialog({ action, open, onOpenChange }: CreativeGenerationStepDialogProps) {
  const { approveAction, rejectAction, finalizeCreative } = useAdsPendingActions();
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const data = (action?.action_data || {}) as Record<string, any>;
  const brief = data.creative_brief || {};
  const jobId = data.creative_generation?.job_id;

  // Polla o creative_job enquanto status = creative_pending
  const jobQuery = useQuery({
    queryKey: ["creative-job", jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data: job } = await supabase
        .from("creative_jobs")
        .select("id, status, output_urls, error_message")
        .eq("id", jobId)
        .maybeSingle();
      return job;
    },
    enabled: open && !!jobId && action?.status === "creative_pending",
    refetchInterval: 4000,
  });

  // Quando job termina, finaliza a action (status → final_pending_approval)
  useEffect(() => {
    const job = jobQuery.data;
    if (!job || !action) return;
    if (action.status !== "creative_pending") return;
    const done = job.status === "succeeded" || (job.output_urls && (job.output_urls as any[]).length > 0);
    if (done && !finalizeCreative.isPending) {
      finalizeCreative.mutate(action.id);
    }
  }, [jobQuery.data?.status, action?.status]);

  if (!action) return null;

  const isTwoStep = isTwoStepAction(action);
  if (!isTwoStep) return null;

  const isGenerating = action.status === "creative_pending";
  const isAwaitingFinal = action.status === "final_pending_approval";
  const creativeUrls: string[] = Array.isArray(data.creative_urls) ? data.creative_urls : [];
  const exclusionInfo = getCustomerExclusionLine(data, data.preview || {});

  const handleApproveFinal = () => {
    approveAction.mutate(action.id);
    onOpenChange(false);
  };

  const handleReject = () => {
    if (!rejectReason.trim()) return;
    rejectAction.mutate({ actionId: action.id, reason: rejectReason });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {isGenerating ? "Gerando criativos…" : "Aprovação final da campanha"}
          </DialogTitle>
          <DialogDescription>
            {isGenerating
              ? "Os criativos estão sendo gerados a partir do prompt aprovado. Isso consome créditos."
              : "Revise os criativos e o resumo da campanha antes de publicar."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading state */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Aguarde — geração em andamento. Esta janela atualiza automaticamente.
              </p>
              {jobQuery.data?.error_message && (
                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {jobQuery.data.error_message}
                </Badge>
              )}
            </div>
          )}

          {/* Galeria de criativos */}
          {isAwaitingFinal && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Criativos gerados
              </h4>
              {creativeUrls.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {creativeUrls.slice(0, 6).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Criativo ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-md border border-border/40"
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum criativo retornado.</p>
              )}
            </div>
          )}

          {/* Resumo da campanha */}
          <div className="rounded-md border border-border/40 bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{getFunnelLabel(brief.funnel_stage || data.funnel_stage).label}</Badge>
              {data.campaign_name && <Badge variant="outline">{data.campaign_name}</Badge>}
              {brief.format && <Badge variant="outline">Formato: {brief.format}</Badge>}
            </div>
            {data.headline && <p><strong>Título:</strong> {data.headline}</p>}
            {data.primary_text && <p><strong>Copy:</strong> {data.primary_text}</p>}
            {data.cta && <p><strong>CTA:</strong> {data.cta}</p>}
            {(data.daily_budget_cents || data.budget_cents) && (
              <p><strong>Orçamento:</strong> R$ {((data.daily_budget_cents || data.budget_cents) / 100).toFixed(2)} /dia</p>
            )}
            {(data.destination_url || data.link_url) && (
              <p className="truncate"><strong>Destino:</strong> {data.destination_url || data.link_url}</p>
            )}
            {exclusionInfo && (
              <p className={exclusionInfo.applied ? "text-emerald-700" : "text-amber-700"}>
                {exclusionInfo.label}
              </p>
            )}
            {brief.prompt && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Prompt usado</summary>
                <p className="whitespace-pre-wrap mt-1">{brief.prompt}</p>
              </details>
            )}
          </div>

          {/* Reject form */}
          {rejectMode && (
            <Textarea
              placeholder="Motivo da reprovação…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          {!rejectMode ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setRejectMode(true)}
                disabled={isGenerating}
              >
                <X className="h-3.5 w-3.5" /> Reprovar
              </Button>
              <Button
                onClick={handleApproveFinal}
                disabled={isGenerating || approveAction.isPending}
              >
                {approveAction.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Aprovar campanha final
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setRejectMode(false); setRejectReason(""); }}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectAction.isPending}
              >
                Confirmar reprovação
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
