// =============================================================================
// StructuredProposalModal — Visualização completa de proposta da IA
//
// Modal grande com árvore lateral (desktop) / lista empilhada (mobile),
// representando a hierarquia real de mídia paga:
//
//   Visão Geral · Campanha · Conjunto(s) · Anúncio(s) · Validações · Histórico
//
// Rodapé fixo: Recusar · Ajustar · Aprovar estratégia e gerar criativos.
//
// REGRAS (anti-processamento):
//  - Abrir o modal: 0 chamada de IA.
//  - Navegar entre nós: 0 chamada de IA.
//  - Abrir editor: 0 chamada de IA.
//  - Recusar: 0 chamada de IA.
// =============================================================================

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  Eye,
  ImageIcon,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { isTwoStepAction, getTwoStepStage, useAdsPendingActions } from "@/hooks/useAdsPendingActions";
import { useProductCommercialFit } from "@/hooks/useProductCommercialFit";
import { fitLevelLabel } from "../../../supabase/functions/_shared/ads-autopilot/productFunnelFitGate";
import {
  formatBudgetBRL,
  normalizeCampaignStructure,
  type AdNode,
  type AdSetNode,
  type CampaignNode,
} from "@/lib/ads/normalizeCampaignStructure";
import { ProposalStructuredEditor } from "./ProposalStructuredEditor";
import { formatDateTimeBR } from "@/lib/date-format";

type NodeId =
  | "overview"
  | "campaign"
  | `adset:${number}`
  | `ad:${number}`
  | "validations"
  | "history";

interface Props {
  action: PendingAction;
  childActions?: PendingAction[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void; // abre o diálogo de recusa do parent
  approvingId?: string | null;
  rejectingId?: string | null;
}

export function StructuredProposalModal({
  action,
  childActions,
  open,
  onOpenChange,
  onApprove,
  onReject,
  approvingId,
  rejectingId,
}: Props) {
  const data = action.action_data || {};
  const isTwoStep = isTwoStepAction(action);
  const twoStepStage = getTwoStepStage(action);
  const isStrategyStage = isTwoStep && twoStepStage === "strategy";

  const { approveStrategy } = useAdsPendingActions();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selected, setSelected] = useState<NodeId>("overview");

  // Estrutura canônica (legacy ou novo)
  const structure = useMemo(
    () =>
      normalizeCampaignStructure(data, {
        actionType: action.action_type,
        flowVersion: (data as any)?.flow_version,
      }),
    [data, action.action_type],
  );

  // Merge ad_sets vindos do payload da campanha + ad_sets vindos como ações filhas
  const adSetsFromChildren: AdSetNode[] = (childActions || [])
    .filter((c) => c.action_type === "create_adset")
    .map((c, i) => {
      const cs = normalizeCampaignStructure(c.action_data || {}, { actionType: "create_adset" });
      const fallback = cs.ad_sets[0];
      return {
        ...(fallback || ({} as AdSetNode)),
        id: c.id,
        name: fallback?.name || `Conjunto ${i + 1}`,
      };
    });
  const adSets: AdSetNode[] =
    structure.ad_sets.length > 0 ? structure.ad_sets : adSetsFromChildren;
  const ads: AdNode[] = structure.ads;

  // Fit Gate (somente para Etapa 1 do two_step)
  const productId = (data as any)?.product_id || (data as any)?.preview?.product_id || null;
  const funnel = (data as any)?.funnel_stage || (data as any)?.preview?.funnel_stage || null;
  const { data: fitData } = useProductCommercialFit(
    isStrategyStage ? productId : null,
    isStrategyStage ? funnel : null,
    isStrategyStage ? action.tenant_id : null,
  );
  const fitBadge = fitData ? fitLevelLabel(fitData.fit.fit_level) : null;
  const approveBlockedByFit = !!fitData?.fit.soft_block;

  // Aprovação
  const isApproving = approveStrategy.isPending || approvingId === action.id;
  const handleApprove = () => {
    if (isStrategyStage) {
      approveStrategy.mutate(action.id);
    } else {
      onApprove(action.id);
    }
  };

  const approveLabel = isStrategyStage
    ? approveBlockedByFit
      ? "Ajuste necessário antes de aprovar"
      : "Aprovar estratégia e gerar criativos"
    : "Aprovar";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" />
              {structure.campaign.name || "Proposta de Campanha"}
              {isStrategyStage && (
                <Badge variant="outline" className="text-[10px] ml-1">
                  Etapa 1 — estratégia
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {formatDateTimeBR(new Date(action.created_at))}
              {action.confidence && (
                <>
                  {" · Confiança: "}
                  {action.confidence === "high" ? "Alta" : action.confidence === "medium" ? "Média" : "Baixa"}
                </>
              )}
              {fitBadge && <> · Adequação: {fitBadge.label}</>}
            </DialogDescription>
          </DialogHeader>

          {/* Corpo: árvore lateral + conteúdo */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {/* Árvore lateral (desktop) / lista empilhada compacta (mobile) */}
            <aside className="md:w-60 md:shrink-0 md:border-r border-border/40 bg-muted/20 md:overflow-y-auto">
              <nav className="p-2 md:p-3 flex md:block gap-1 md:gap-0.5 overflow-x-auto md:overflow-visible">
                <TreeItem
                  icon={<Eye className="h-3.5 w-3.5" />}
                  label="Visão Geral"
                  active={selected === "overview"}
                  onClick={() => setSelected("overview")}
                />
                <TreeItem
                  icon={<Megaphone className="h-3.5 w-3.5" />}
                  label="Campanha"
                  active={selected === "campaign"}
                  onClick={() => setSelected("campaign")}
                />
                <TreeGroupLabel label={`Conjuntos (${adSets.length})`} />
                {adSets.length === 0 ? (
                  <TreeEmpty label="Nenhum conjunto" />
                ) : (
                  adSets.map((a, i) => (
                    <TreeItem
                      key={`adset-${i}`}
                      indent
                      icon={<Layers className="h-3.5 w-3.5" />}
                      label={a.name || `Conjunto ${i + 1}`}
                      active={selected === `adset:${i}`}
                      onClick={() => setSelected(`adset:${i}`)}
                    />
                  ))
                )}
                <TreeGroupLabel label={`Anúncios (${ads.length})`} />
                {ads.length === 0 ? (
                  <TreeEmpty label="Nenhum anúncio" />
                ) : (
                  ads.map((ad, i) => (
                    <TreeItem
                      key={`ad-${i}`}
                      indent
                      icon={<ImageIcon className="h-3.5 w-3.5" />}
                      label={ad.name || `Anúncio ${i + 1}`}
                      active={selected === `ad:${i}`}
                      onClick={() => setSelected(`ad:${i}`)}
                    />
                  ))
                )}
                <TreeItem
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                  label="Validações"
                  active={selected === "validations"}
                  onClick={() => setSelected("validations")}
                />
                <TreeItem
                  icon={<Bot className="h-3.5 w-3.5" />}
                  label="Histórico"
                  active={selected === "history"}
                  onClick={() => setSelected("history")}
                />
              </nav>
            </aside>

            {/* Conteúdo do nó selecionado */}
            <ScrollArea className="flex-1 min-h-0">
              <div className="px-5 py-4">
                {selected === "overview" && (
                  <OverviewSection
                    action={action}
                    campaign={structure.campaign}
                    adSetsCount={adSets.length}
                    adsCount={ads.length}
                    isStrategyStage={isStrategyStage}
                    fitMessage={fitData?.fit.user_message || null}
                    approveBlockedByFit={approveBlockedByFit}
                  />
                )}
                {selected === "campaign" && <CampaignSection campaign={structure.campaign} channel={action.channel} />}
                {selected.startsWith("adset:") && (
                  <AdSetSection adSet={adSets[Number(selected.split(":")[1])] || null} />
                )}
                {selected.startsWith("ad:") && (
                  <AdSection
                    ad={ads[Number(selected.split(":")[1])] || null}
                    isStrategyStage={isStrategyStage}
                  />
                )}
                {selected === "validations" && (
                  <ValidationsSection
                    fitMessage={fitData?.fit.user_message || null}
                    fitLabel={fitBadge?.label || null}
                    suggestedActions={fitData?.fit.suggested_actions || []}
                    approveBlockedByFit={approveBlockedByFit}
                  />
                )}
                {selected === "history" && <HistorySection action={action} />}

                {/* Detalhes técnicos (recolhido) — disponível em qualquer nó */}
                <details className="mt-6 rounded-md border border-border/30">
                  <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                    Detalhes técnicos
                  </summary>
                  <div className="px-3 pb-3 pt-1 text-[11px] text-muted-foreground space-y-1 font-mono break-all">
                    <div>action_type: {action.action_type}</div>
                    <div>flow_version: {(data as any)?.flow_version || "—"}</div>
                    <div>structure_source: {structure.source}</div>
                    {productId && <div>product_id: {productId}</div>}
                    {fitData?.fit.reason_codes && (
                      <div>fit_reason_codes: {fitData.fit.reason_codes.join(", ")}</div>
                    )}
                  </div>
                </details>
              </div>
            </ScrollArea>
          </div>

          {/* Rodapé fixo: ações */}
          <div className="border-t border-border/30 px-5 py-3 flex items-center gap-2 shrink-0 bg-background">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReject(action.id)}
              disabled={!!rejectingId || isApproving}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-3.5 w-3.5" />
              Recusar proposta
            </Button>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditorOpen(true)}
              disabled={isApproving || !!rejectingId}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ajustar proposta
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isApproving || !!rejectingId || approveBlockedByFit}
              title={approveBlockedByFit ? fitData?.fit.user_message || "Bloqueado pelo gate" : undefined}
            >
              {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {approveLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor estruturado (mesmo da Frente 4.3) */}
      {isStrategyStage && (
        <ProposalStructuredEditor action={action} open={editorOpen} onOpenChange={setEditorOpen} />
      )}
    </>
  );
}

/* ===========================================================================
   Subseções
   =========================================================================== */

function OverviewSection({
  action,
  campaign,
  adSetsCount,
  adsCount,
  isStrategyStage,
  fitMessage,
  approveBlockedByFit,
}: {
  action: PendingAction;
  campaign: CampaignNode;
  adSetsCount: number;
  adsCount: number;
  isStrategyStage: boolean;
  fitMessage: string | null;
  approveBlockedByFit: boolean;
}) {
  return (
    <div className="space-y-4">
      {isStrategyStage && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Nenhum criativo final foi gerado ainda. A geração acontece apenas após aprovar a estratégia.
          Aprovar gera os criativos — <strong>ainda não publica a campanha</strong>.
        </div>
      )}

      {action.reasoning && (
        <Block title="Resumo da recomendação" icon={<Bot className="h-3.5 w-3.5 text-primary" />}>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {action.reasoning}
          </p>
        </Block>
      )}

      <Block title="Estrutura da proposta" icon={<Layers className="h-3.5 w-3.5 text-primary" />}>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <Metric label="Campanha" value={campaign.name || "—"} />
          <Metric label="Conjuntos" value={String(adSetsCount)} />
          <Metric label="Anúncios" value={String(adsCount)} />
        </div>
      </Block>

      {fitMessage && (
        <Block
          title="Adequação produto × público"
          icon={
            approveBlockedByFit ? (
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            ) : (
              <Target className="h-3.5 w-3.5 text-emerald-600" />
            )
          }
        >
          <p className="text-sm text-muted-foreground leading-relaxed">{fitMessage}</p>
        </Block>
      )}
    </div>
  );
}

function CampaignSection({ campaign, channel }: { campaign: CampaignNode; channel: string }) {
  return (
    <div className="space-y-4">
      <Block title="Configurações da campanha" icon={<Megaphone className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Nome" value={campaign.name} />
          <Detail label="Objetivo" value={campaign.objective} />
          <Detail label="Canal/Plataforma" value={campaign.platform || channel} />
          <Detail label="Tipo de orçamento" value={campaign.budget_type} />
          <Detail label="Orçamento diário" value={formatBudgetBRL(campaign.daily_budget_cents)} />
          <Detail label="Status planejado" value={campaign.planned_status} />
          <Detail label="Botão (CTA)" value={campaign.cta} />
          <Detail label="Tipo de compra" value={campaign.buying_type} />
          <Detail label="Link de destino" value={campaign.destination_url} fullWidth />
        </DetailGrid>
      </Block>
      {campaign.rationale && (
        <Block title="Racional da IA" icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{campaign.rationale}</p>
        </Block>
      )}
    </div>
  );
}

function AdSetSection({ adSet }: { adSet: AdSetNode | null }) {
  if (!adSet) return <p className="text-sm text-muted-foreground">Conjunto não encontrado.</p>;
  return (
    <div className="space-y-4">
      <Block title={adSet.name || "Conjunto"} icon={<Layers className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Funil" value={adSet.funnel_stage} />
          <Detail label="Tipo de público" value={adSet.audience_type} />
          <Detail label="Idade" value={adSet.age_range} />
          <Detail label="Gênero" value={adSet.gender} />
          <Detail label="Região" value={adSet.location} />
          <Detail label="Otimização" value={adSet.optimization_goal} />
          <Detail label="Evento de conversão" value={adSet.conversion_event} />
          <Detail label="Posicionamentos" value={adSet.placements.length ? adSet.placements.join(", ") : null} />
          <Detail label="Orçamento" value={formatBudgetBRL(adSet.daily_budget_cents)} />
          {adSet.targeting_summary && <Detail label="Resumo de segmentação" value={adSet.targeting_summary} fullWidth />}
          {adSet.schedule && (adSet.schedule.start || adSet.schedule.end) && (
            <Detail
              label="Agendamento"
              value={`${adSet.schedule.start || "—"} até ${adSet.schedule.end || "—"}`}
              fullWidth
            />
          )}
        </DetailGrid>
      </Block>

      {(adSet.inclusions.length > 0 || adSet.exclusions.length > 0 || adSet.customer_exclusion_label) && (
        <Block title="Inclusões e exclusões" icon={<Users className="h-3.5 w-3.5 text-primary" />}>
          {adSet.inclusions.length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] text-muted-foreground mb-1">Inclusões</p>
              <div className="flex flex-wrap gap-1">
                {adSet.inclusions.map((i, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px]">{i}</Badge>
                ))}
              </div>
            </div>
          )}
          {adSet.exclusions.length > 0 && (
            <div className="mb-2">
              <p className="text-[11px] text-muted-foreground mb-1">Exclusões</p>
              <div className="flex flex-wrap gap-1">
                {adSet.exclusions.map((e, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] bg-amber-500/5 border-amber-500/30">{e}</Badge>
                ))}
              </div>
            </div>
          )}
          {adSet.customer_exclusion_label && (
            <p className="text-xs text-muted-foreground">{adSet.customer_exclusion_label}</p>
          )}
        </Block>
      )}

      {adSet.rationale && (
        <Block title="Racional da IA" icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{adSet.rationale}</p>
        </Block>
      )}
    </div>
  );
}

function AdSection({ ad, isStrategyStage }: { ad: AdNode | null; isStrategyStage: boolean }) {
  if (!ad) return <p className="text-sm text-muted-foreground">Anúncio não encontrado.</p>;
  return (
    <div className="space-y-4">
      <Block title={ad.name || "Anúncio"} icon={<ImageIcon className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Produto/oferta" value={ad.product_name} />
          <Detail label="Status do criativo" value={mapCreativeStatus(ad.creative_status, isStrategyStage)} />
          <Detail label="Headline" value={ad.headline} fullWidth />
          <Detail label="Texto principal" value={ad.primary_text} fullWidth />
          <Detail label="Descrição" value={ad.description} fullWidth />
          <Detail label="Botão (CTA)" value={ad.cta} />
          <Detail label="Formato" value={ad.creative_format} />
          {ad.alternative_formats.length > 0 && (
            <Detail label="Formatos alternativos" value={ad.alternative_formats.join(", ")} />
          )}
          <Detail label="Link de destino" value={ad.destination_url} fullWidth />
          {ad.offer_note && <Detail label="Observação de oferta" value={ad.offer_note} fullWidth />}
        </DetailGrid>
      </Block>

      {(ad.reference_image_url || ad.creative_final_url || ad.creative_prompt) && (
        <Block
          title={ad.creative_final_url ? "Conferência do criativo" : "Conferência do criativo (referência + prompt)"}
          icon={<ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}
        >
          <div className="space-y-3">
            {(ad.reference_image_url || ad.creative_final_url) && (
              <div className="flex items-start gap-3">
                <img
                  src={ad.creative_final_url || ad.reference_image_url || ""}
                  alt={ad.creative_final_url ? "Criativo" : "Referência do produto"}
                  className="h-32 w-32 object-cover rounded-md border border-border/40"
                />
                {!ad.creative_final_url && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Imagem usada apenas como referência do produto. Não é o criativo final.
                    {isStrategyStage && " A geração do criativo só acontece após aprovar a estratégia."}
                  </p>
                )}
              </div>
            )}
            {ad.creative_prompt && (
              <div className="rounded-md border border-border/40 bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[11px] font-medium text-foreground uppercase tracking-wide">Prompt do criativo</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ad.creative_prompt}</p>
              </div>
            )}
          </div>
        </Block>
      )}

      {ad.rationale && (
        <Block title="Racional da IA" icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ad.rationale}</p>
        </Block>
      )}
    </div>
  );
}

function ValidationsSection({
  fitMessage,
  fitLabel,
  suggestedActions,
  approveBlockedByFit,
}: {
  fitMessage: string | null;
  fitLabel: string | null;
  suggestedActions: string[];
  approveBlockedByFit: boolean;
}) {
  return (
    <div className="space-y-4">
      <Block title="Quality Gate" icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />}>
        <p className="text-sm text-muted-foreground">
          Aprovado — a proposta só chega aqui depois de passar pelas verificações de qualidade.
        </p>
      </Block>
      <Block
        title="Adequação produto × público"
        icon={
          approveBlockedByFit ? (
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
          ) : (
            <Target className="h-3.5 w-3.5 text-emerald-600" />
          )
        }
      >
        {fitLabel && <p className="text-sm font-medium mb-1">{fitLabel}</p>}
        {fitMessage ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{fitMessage}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Sem alertas.</p>
        )}
        {suggestedActions.length > 0 && (
          <ul className="mt-2 list-disc list-inside text-xs text-muted-foreground space-y-0.5">
            {suggestedActions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

function HistorySection({ action }: { action: PendingAction }) {
  const data = action.action_data || {};
  const version = (data as any)?.version || 1;
  const parentId = (data as any)?.parent_action_id || null;
  const supersededBy = (data as any)?.superseded_by_action_id || null;
  const draft = (data as any)?.draft_patch || null;
  const feedback = (data as any)?.user_feedback || (data as any)?.feedback_history || null;

  return (
    <div className="space-y-4">
      <Block title={`Versão atual: v${version}`} icon={<Bot className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Status" value={action.status} />
          <Detail label="Versão anterior" value={parentId} />
          <Detail label="Versão substituta" value={supersededBy} />
        </DetailGrid>
      </Block>
      {draft && (
        <Block title="Rascunho atual" icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-xs text-muted-foreground">
            Existe um rascunho salvo. Use "Ajustar proposta" para revisar e gerar uma nova versão.
          </p>
        </Block>
      )}
      {feedback && (
        <Block title="Feedback registrado" icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {typeof feedback === "string" ? feedback : JSON.stringify(feedback, null, 2)}
          </p>
        </Block>
      )}
    </div>
  );
}

/* ===========================================================================
   Átomos visuais
   =========================================================================== */

function TreeItem({
  icon,
  label,
  active,
  onClick,
  indent,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 md:w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
        indent && "md:pl-6",
        active
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      {active && <ChevronRight className="h-3 w-3 ml-auto hidden md:inline" />}
    </button>
  );
}

function TreeGroupLabel({ label }: { label: string }) {
  return (
    <p className="hidden md:block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-2.5 mt-3 mb-1">
      {label}
    </p>
  );
}

function TreeEmpty({ label }: { label: string }) {
  return (
    <p className="hidden md:block text-[10px] text-muted-foreground/60 italic px-3 py-1">{label}</p>
  );
}

function Block({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
        {icon}
        {title}
      </h3>
      <div className="rounded-md border border-border/40 bg-card/40 p-3">{children}</div>
    </section>
  );
}

function DetailGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">{children}</div>;
}

function Detail({
  label,
  value,
  fullWidth,
}: {
  label: string;
  value: string | number | null | undefined;
  fullWidth?: boolean;
}) {
  const display = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div className={cn(fullWidth && "sm:col-span-2")}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="text-sm break-words">{display}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 border border-border/30 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <p className="text-sm font-semibold truncate">{value}</p>
    </div>
  );
}

function mapCreativeStatus(status: AdNode["creative_status"], isStrategyStage: boolean): string {
  if (isStrategyStage) return "Aguardando aprovação da estratégia";
  switch (status) {
    case "pending_strategy_approval":
      return "Aguardando aprovação da estratégia";
    case "generating":
      return "Gerando…";
    case "ready":
      return "Pronto";
    default:
      return "Não informado";
  }
}
