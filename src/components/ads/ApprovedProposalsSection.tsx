// =============================================================================
// ApprovedProposalsSection — Onda H.4.2
// Lista propostas aprovadas aguardando geração de criativos / revisão final / publicação.
// Renderizada acima da fila de aprovações pendentes.
// =============================================================================

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, Sparkles, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { useApprovedProposalsAwaitingPublish, type ApprovedProposalRow } from "@/hooks/useApprovedProposalsAwaitingPublish";
import { FinalReviewModal } from "./FinalReviewModal";
import { CreativeReadinessCard } from "./CreativeReadinessCard";

interface Props {
  channelFilter?: string;
}

const LIFECYCLE_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  structure_approved_awaiting_creatives: { label: "Estrutura aprovada — aguardando criativos", tone: "outline" },
  campaign_creatives_generating: { label: "Gerando criativos…", tone: "secondary" },
  campaign_creatives_ready: { label: "Pronto para publicar", tone: "default" },
  campaign_creatives_failed: { label: "Falha na geração", tone: "destructive" },
  campaign_implementation_failed: { label: "Falha na publicação", tone: "destructive" },
};

export function ApprovedProposalsSection({ channelFilter }: Props) {
  const { proposals, isLoading, publishProposal, isPublishing } = useApprovedProposalsAwaitingPublish(channelFilter);
  const [selected, setSelected] = useState<ApprovedProposalRow | null>(null);

  if (isLoading || proposals.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Propostas aprovadas em andamento</h3>
        <Badge variant="outline" className="text-[10px]">{proposals.length}</Badge>
      </div>

      {proposals.map((p) => {
        const lc = p.action_data?.lifecycle?.status as string;
        const meta = LIFECYCLE_LABEL[lc] || { label: lc || "Em andamento", tone: "outline" as const };
        const campaignName = p.action_data?.campaign?.name || "Campanha";
        const budget = p.action_data?.campaign?.daily_budget_cents || 0;
        const jobs = p.action_data?.lifecycle?.creative_jobs || [];
        const totalJobs = jobs.length;
        const isReady = lc === "campaign_creatives_ready";
        const isFailed = lc === "campaign_creatives_failed" || lc === "campaign_implementation_failed";
        const isGenerating = lc === "campaign_creatives_generating";
        const isStructureOnly = lc === "structure_approved_awaiting_creatives";
        const failureMsg = p.action_data?.lifecycle?.failure_message_pt;
        const pendingAccountCfg = Array.isArray(p.action_data?.lifecycle?.pending_account_config)
          ? p.action_data.lifecycle.pending_account_config
          : [];

        return (
          <div key={p.id} className="space-y-2">
            <Card className="border-border/60">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isGenerating ? <Loader2 className="h-5 w-5 text-primary animate-spin" /> :
                    isFailed ? <AlertTriangle className="h-5 w-5 text-destructive" /> :
                    isStructureOnly ? <Sparkles className="h-5 w-5 text-primary" /> :
                    <Rocket className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold truncate">{campaignName}</h4>
                    <Badge variant={meta.tone} className="text-[10px]">{meta.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>R$ {(budget / 100).toFixed(2)}/dia</span>
                    {!isStructureOnly && (
                      <>
                        <span>·</span>
                        <span>{totalJobs} criativo(s)</span>
                      </>
                    )}
                    {failureMsg && <><span>·</span><span className="text-destructive">{failureMsg}</span></>}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isReady && (
                    <Button size="sm" onClick={() => setSelected(p)} disabled={isPublishing}>
                      <Eye className="h-3.5 w-3.5 mr-1.5" /> Revisar e publicar
                    </Button>
                  )}
                  {isGenerating && (
                    <Button size="sm" variant="outline" disabled>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Aguardando criativos…
                    </Button>
                  )}
                  {isFailed && (
                    <Button size="sm" variant="outline" onClick={() => setSelected(p)}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Revisar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            {isStructureOnly && (
              <CreativeReadinessCard actionId={p.id} campaignName={campaignName} />
            )}
          </div>
        );
      })}

      {selected && (
        <FinalReviewModal
          proposal={selected}
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
          isPublishing={isPublishing}
          onPublish={() => {
            publishProposal(selected.id);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
