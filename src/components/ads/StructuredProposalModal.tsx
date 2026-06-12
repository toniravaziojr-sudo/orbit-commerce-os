// =============================================================================
// StructuredProposalModal — Visualização completa de proposta da IA
//
// Apenas 4 abas: Visão Geral · Campanha · Conjunto(s) · Anúncio(s).
// Rodapé fixo: Recusar · Ajustar · Aprovar estratégia e gerar criativos.
//
// REGRAS (anti-processamento):
//  - Abrir / navegar / ajustar / recusar: 0 chamada de IA.
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
  ChevronRight,
  Eye,
  ImageIcon,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  Sparkles,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { isTwoStepAction, getTwoStepStage, useAdsPendingActions } from "@/hooks/useAdsPendingActions";
import { useProductCommercialFit } from "@/hooks/useProductCommercialFit";
import { usePlatformCapability } from "@/hooks/usePlatformCapability";
import { fitLevelLabel } from "../../../supabase/functions/_shared/ads-autopilot/productFunnelFitGate";
import {
  formatBudgetBRL,
  normalizeCampaignStructure,
  type AdNode,
  type AdSetNode,
  type CampaignNode,
} from "@/lib/ads/normalizeCampaignStructure";
import { runStructureCompletenessGate } from "@/lib/ads/gates/structureCompleteness";
import { runPlatformCompatibilityGate } from "@/lib/ads/gates/platformCompatibility";
import { runUtmGate } from "@/lib/ads/gates/utm";
import type { GateIssue } from "@/lib/ads/gates/types";
import { ProposalStructuredEditor } from "./ProposalStructuredEditor";
import { StrategicPlanContent } from "./StrategicPlanContent";
import { formatDateTimeBR } from "@/lib/date-format";

type NodeId =
  | "overview"
  | "campaign"
  | `adset:${number}`
  | `ad:${number}`;

interface Props {
  action: PendingAction;
  childActions?: PendingAction[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onAdjust?: (id: string, suggestion: string) => void;
  approvingId?: string | null;
  rejectingId?: string | null;
  /**
   * Quando true, renderiza apenas Visão Geral (sem sidebar/Campanha/Conjuntos/Anúncios).
   * Usado para Plano Estratégico e ações sem hierarquia de campanha.
   */
  overviewOnly?: boolean;
  /** Título customizado do modal (ex.: "Plano Estratégico"). */
  titleOverride?: string;
  /** Rótulo customizado do botão aprovar (ex.: "Aprovar plano"). */
  approveLabelOverride?: string;
}

/* ---------------------------------------------------------------------------
   Tradutores PT-BR (sem chamadas externas)
   --------------------------------------------------------------------------- */

const DICT: Record<string, Record<string, string>> = {
  objective: {
    sales: "Vendas",
    conversions: "Conversões",
    traffic: "Tráfego",
    awareness: "Reconhecimento de marca",
    engagement: "Engajamento",
    leads: "Geração de leads",
    video_views: "Visualizações de vídeo",
    messages: "Mensagens",
    app_promotion: "Promoção de aplicativo",
  },
  budget_type: { daily: "Diário", lifetime: "Total da campanha" },
  planned_status: { PAUSED: "Pausada", ACTIVE: "Ativa", ARCHIVED: "Arquivada" },
  platform: {
    meta: "Meta (Facebook e Instagram)",
    facebook: "Facebook",
    instagram: "Instagram",
    google: "Google",
    google_ads: "Google Ads",
    tiktok: "TikTok",
  },
  cta: {
    SHOP_NOW: "Comprar agora",
    LEARN_MORE: "Saiba mais",
    SIGN_UP: "Cadastre-se",
    GET_OFFER: "Pegar oferta",
    SEND_MESSAGE: "Enviar mensagem",
    CONTACT_US: "Fale conosco",
    DOWNLOAD: "Baixar",
    SUBSCRIBE: "Inscrever-se",
    APPLY_NOW: "Inscreva-se agora",
    GET_QUOTE: "Solicitar orçamento",
    ORDER_NOW: "Pedir agora",
    BOOK_NOW: "Reservar agora",
    BOOK_TRAVEL: "Reservar viagem",
    DONATE_NOW: "Doar agora",
    WATCH_MORE: "Assistir mais",
    SEE_MENU: "Ver cardápio",
    REQUEST_TIME: "Agendar horário",
  },
  buying_type: { AUCTION: "Leilão", RESERVED: "Reserva" },
  funnel: {
    tof: "Topo do funil (descoberta)",
    mof: "Meio do funil (consideração)",
    bof: "Fundo do funil (conversão)",
    top: "Topo do funil (descoberta)",
    middle: "Meio do funil (consideração)",
    bottom: "Fundo do funil (conversão)",
    prospecting: "Prospecção",
    retargeting: "Remarketing",
  },
  audience_type: {
    cold: "Público frio",
    warm: "Público morno",
    hot: "Público quente",
    lookalike: "Públicos semelhantes",
    custom: "Público personalizado",
    interest: "Por interesses",
    broad: "Público amplo",
    retargeting: "Remarketing",
  },
  optimization_goal: {
    OFFSITE_CONVERSIONS: "Conversões",
    LINK_CLICKS: "Cliques no link",
    IMPRESSIONS: "Impressões",
    REACH: "Alcance",
    LANDING_PAGE_VIEWS: "Visualizações da página",
    VALUE: "Valor de compra",
    THRUPLAY: "Reproduções completas",
    POST_ENGAGEMENT: "Engajamento",
    LEAD_GENERATION: "Geração de leads",
  },
  conversion_event: {
    PURCHASE: "Compra",
    ADD_TO_CART: "Adicionar ao carrinho",
    INITIATE_CHECKOUT: "Iniciar checkout",
    LEAD: "Lead",
    COMPLETE_REGISTRATION: "Cadastro concluído",
    VIEW_CONTENT: "Visualização de conteúdo",
    ADD_PAYMENT_INFO: "Adicionar forma de pagamento",
  },
  placement: {
    facebook_feed: "Feed do Facebook",
    instagram_feed: "Feed do Instagram",
    instagram_stories: "Stories do Instagram",
    instagram_reels: "Reels do Instagram",
    facebook_stories: "Stories do Facebook",
    facebook_reels: "Reels do Facebook",
    messenger: "Messenger",
    audience_network: "Audience Network",
    marketplace: "Marketplace",
  },
};

function tr(group: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const key = String(value);
  return DICT[group]?.[key] ?? DICT[group]?.[key.toUpperCase()] ?? DICT[group]?.[key.toLowerCase()] ?? key;
}

function translateCreativeStatus(status: AdNode["creative_status"], isStrategyStage: boolean): string {
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

/* --------------------------------------------------------------------------- */

export function StructuredProposalModal({
  action,
  childActions,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onAdjust,
  approvingId,
  rejectingId,
  overviewOnly = false,
  titleOverride,
  approveLabelOverride,
}: Props) {
  const data = action.action_data || {};
  const isTwoStep = isTwoStepAction(action);
  const twoStepStage = getTwoStepStage(action);
  const isStrategyStage = isTwoStep && twoStepStage === "strategy";
  const isStrategicPlan = action.action_type === "strategic_plan";

  const { approveStrategy } = useAdsPendingActions();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFocus, setEditorFocus] = useState<GateIssue["node_type"] | null>(null);
  const [selected, setSelected] = useState<NodeId>("overview");

  const structure = useMemo(
    () =>
      normalizeCampaignStructure(data, {
        actionType: action.action_type,
        flowVersion: (data as any)?.flow_version,
      }),
    [data, action.action_type],
  );

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

  const productId = (data as any)?.product_id || (data as any)?.preview?.product_id || null;
  const funnel = (data as any)?.funnel_stage || (data as any)?.preview?.funnel_stage || null;
  const { data: fitData } = useProductCommercialFit(
    isStrategyStage ? productId : null,
    isStrategyStage ? funnel : null,
    isStrategyStage ? action.tenant_id : null,
  );
  const fitBadge = fitData ? fitLevelLabel(fitData.fit.fit_level) : null;
  const approveBlockedByFit = !!fitData?.fit.soft_block;

  // ---------- Gates: completude estrutural + compatibilidade da plataforma ----------
  const platformKey = (structure.campaign.platform || action.channel || "meta").toLowerCase();
  const { data: capability } = usePlatformCapability(isStrategyStage ? platformKey : null);

  const completeness = useMemo(
    () => (isStrategyStage ? runStructureCompletenessGate(structure) : { passed: true, blockers: [], warnings: [], summary: null }),
    [isStrategyStage, structure],
  );
  const compatibility = useMemo(
    () => (isStrategyStage ? runPlatformCompatibilityGate(structure, capability ?? null) : { passed: true, blockers: [], warnings: [], summary: null }),
    [isStrategyStage, structure, capability],
  );
  const utmGate = useMemo(
    () => (isStrategyStage ? runUtmGate(structure) : { passed: true, blockers: [], warnings: [], summary: null }),
    [isStrategyStage, structure],
  );

  const allBlockers: GateIssue[] = [...completeness.blockers, ...compatibility.blockers, ...utmGate.blockers];
  const allWarnings: GateIssue[] = [...completeness.warnings, ...compatibility.warnings, ...utmGate.warnings];
  const approveBlockedByGates = isStrategyStage && allBlockers.length > 0;
  const approveBlocked = approveBlockedByFit || approveBlockedByGates;

  const isApproving = approveStrategy.isPending || approvingId === action.id;
  const handleApprove = () => {
    if (approveBlocked) return;
    if (isStrategyStage) approveStrategy.mutate(action.id);
    else onApprove(action.id);
  };

  const approveLabel = approveLabelOverride ?? (isStrategyStage
    ? approveBlocked
      ? "Ajuste necessário antes de aprovar"
      : "Aprovar estratégia e gerar criativos"
    : "Aprovar");

  const approveBlockedReason = approveBlockedByFit
    ? fitData?.fit.user_message || "Bloqueado por adequação produto × público."
    : approveBlockedByGates
      ? completeness.summary || compatibility.summary || "Há bloqueios pendentes nas validações."
      : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-primary" />
              {titleOverride ?? (structure.campaign.name || "Proposta")}
              {isStrategyStage && !overviewOnly && (
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
              {fitBadge && !overviewOnly && <> · Adequação: {fitBadge.label}</>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
            {!overviewOnly && (
              <aside className="md:w-60 md:shrink-0 md:border-r border-border/40 bg-muted/20 md:overflow-y-auto">
                <nav className="p-2 md:p-3 flex md:block gap-1 md:gap-0.5 overflow-x-auto md:overflow-visible">
                  <TreeItem icon={<Eye className="h-3.5 w-3.5" />} label="Visão Geral"
                    active={selected === "overview"} onClick={() => setSelected("overview")} />
                  <TreeItem icon={<Megaphone className="h-3.5 w-3.5" />} label="Campanha"
                    active={selected === "campaign"} onClick={() => setSelected("campaign")} />
                  <TreeGroupLabel label={`Conjuntos (${adSets.length})`} />
                  {adSets.length === 0 ? (
                    <TreeEmpty label="Nenhum conjunto" />
                  ) : (
                    adSets.map((a, i) => (
                      <TreeItem key={`adset-${i}`} indent icon={<Layers className="h-3.5 w-3.5" />}
                        label={a.name || `Conjunto ${i + 1}`}
                        active={selected === `adset:${i}`}
                        onClick={() => setSelected(`adset:${i}`)} />
                    ))
                  )}
                  <TreeGroupLabel label={`Anúncios (${ads.length})`} />
                  {ads.length === 0 ? (
                    <TreeEmpty label="Nenhum anúncio" />
                  ) : (
                    ads.map((ad, i) => (
                      <TreeItem key={`ad-${i}`} indent icon={<ImageIcon className="h-3.5 w-3.5" />}
                        label={ad.name || `Anúncio ${i + 1}`}
                        active={selected === `ad:${i}`}
                        onClick={() => setSelected(`ad:${i}`)} />
                    ))
                  )}
                </nav>
              </aside>
            )}

            <ScrollArea className="flex-1 min-h-0">
              <div className="px-5 py-4">
                {(overviewOnly || selected === "overview") && (
                  <OverviewSection
                    action={action}
                    campaign={structure.campaign}
                    adSets={adSets}
                    adsCount={ads.length}
                    isStrategyStage={isStrategyStage}
                    isStrategicPlan={isStrategicPlan}
                    overviewOnly={overviewOnly}
                    fitMessage={overviewOnly ? null : (fitData?.fit.user_message || null)}
                    fitLabel={overviewOnly ? null : (fitBadge?.label || null)}
                    approveBlockedByFit={overviewOnly ? false : approveBlockedByFit}
                    blockers={overviewOnly ? [] : allBlockers}
                    warnings={overviewOnly ? [] : allWarnings}
                  />
                )}
                {!overviewOnly && selected === "campaign" && <CampaignSection campaign={structure.campaign} channel={action.channel} />}
                {!overviewOnly && selected.startsWith("adset:") && (
                  <AdSetSection
                    adSet={adSets[Number(selected.split(":")[1])] || null}
                    blockers={allBlockers.filter(
                      (b) => b.node_type === "ad_set" && b.node_id === selected.split(":")[1],
                    )}
                  />
                )}
                {!overviewOnly && selected.startsWith("ad:") && (
                  <AdSection
                    ad={ads[Number(selected.split(":")[1])] || null}
                    isStrategyStage={isStrategyStage}
                    blockers={allBlockers.filter(
                      (b) => (b.node_type === "ad" || b.node_type === "creative") && b.node_id === selected.split(":")[1],
                    )}
                  />
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="border-t border-border/30 px-5 py-3 flex flex-col gap-2 shrink-0 bg-background">
            {approveBlockedReason && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{approveBlockedReason}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
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
                onClick={() => {
                  setEditorFocus(approveBlockedByGates && allBlockers[0]?.node_type ? allBlockers[0].node_type : null);
                  setEditorOpen(true);
                }}
                disabled={isApproving || !!rejectingId}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Ajustar proposta
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isApproving || !!rejectingId || approveBlocked}
                title={approveBlockedReason || undefined}
              >
                {isApproving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {approveLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {isStrategyStage && (
        <ProposalStructuredEditor action={action} open={editorOpen} onOpenChange={setEditorOpen} initialFocus={editorFocus} />
      )}
    </>
  );
}

/* ===========================================================================
   Seções
   =========================================================================== */

function OverviewSection({
  action,
  campaign,
  adSets,
  adsCount,
  isStrategyStage,
  isStrategicPlan,
  overviewOnly,
  fitMessage,
  fitLabel,
  approveBlockedByFit,
  blockers,
  warnings,
}: {
  action: PendingAction;
  campaign: CampaignNode;
  adSets: AdSetNode[];
  adsCount: number;
  isStrategyStage: boolean;
  isStrategicPlan: boolean;
  overviewOnly: boolean;
  fitMessage: string | null;
  fitLabel: string | null;
  approveBlockedByFit: boolean;
  blockers: GateIssue[];
  warnings: GateIssue[];
}) {
  const reasoning = action.reasoning || campaign.rationale || null;
  const data = (action.action_data || {}) as Record<string, any>;
  const diagnosis = data.diagnosis || null;
  const expectedImpact = action.expected_impact || data.expected_impact || null;
  const limitations: string[] = Array.isArray(data.limitations) ? data.limitations : [];
  const nextActions: any[] = Array.isArray(data.next_actions) ? data.next_actions : (Array.isArray(data.actions) ? data.actions : []);

  return (
    <div className="space-y-4">
      {isStrategyStage && !isStrategicPlan && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Nenhum criativo final foi gerado ainda. A geração acontece apenas após aprovar a estratégia.
          Aprovar gera os criativos — <strong>ainda não publica a campanha</strong>.
        </div>
      )}

      {isStrategicPlan ? (
        <StrategicPlanContent
          diagnosis={diagnosis}
          plannedActions={(data as any).planned_actions ?? nextActions}
          expectedResults={(data as any).expected_results ?? (typeof expectedImpact === "string" ? expectedImpact : null)}
          riskAssessment={(data as any).risk_assessment ?? null}
          timeline={(data as any).timeline ?? null}
          reasoning={reasoning}
          budgetAllocation={(data as any).budget_allocation ?? null}
        />
      ) : (
        <>
          <Block title="Por que a IA recomendou esta proposta" icon={<Bot className="h-3.5 w-3.5 text-primary" />}>
            {reasoning ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{reasoning}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem racional registrado.</p>
            )}
          </Block>

          {expectedImpact && (
            <Block title="Impacto esperado" icon={<Target className="h-3.5 w-3.5 text-emerald-600" />}>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{expectedImpact}</p>
            </Block>
          )}
        </>
      )}

      {!overviewOnly && (
        <Block title="Resumo da estrutura" icon={<Layers className="h-3.5 w-3.5 text-primary" />}>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Metric label="Campanha" value={campaign.name || "—"} />
            <Metric label="Conjuntos de anúncios" value={String(adSets.length)} />
            <Metric label="Anúncios" value={String(adsCount)} />
          </div>
        </Block>
      )}

      {(blockers.length > 0 || warnings.length > 0) && (
        <Block
          title={blockers.length > 0 ? `Validações — ${blockers.length} bloqueio(s) pendente(s)` : "Validações"}
          icon={blockers.length > 0
            ? <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            : <Target className="h-3.5 w-3.5 text-emerald-600" />}
        >
          {blockers.length > 0 && (
            <div className="space-y-1.5">
              {blockers.map((b, i) => (
                <div key={`b-${i}`} className="flex items-start gap-2 text-xs">
                  <Badge variant="destructive" className="text-[10px] shrink-0">{b.node}</Badge>
                  <span className="text-rose-700 dark:text-rose-300">{b.message}</span>
                </div>
              ))}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {warnings.map((w, i) => (
                <div key={`w-${i}`} className="flex items-start gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px] shrink-0">{w.node}</Badge>
                  <span className="text-muted-foreground">{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </Block>
      )}

      {fitMessage && (
        <Block
          title="Adequação produto × público"
          icon={approveBlockedByFit
            ? <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            : <Target className="h-3.5 w-3.5 text-emerald-600" />}
        >
          {fitLabel && <p className="text-sm font-medium mb-1">{fitLabel}</p>}
          <p className="text-sm text-muted-foreground leading-relaxed">{fitMessage}</p>
        </Block>
      )}
    </div>
  );
}

function CampaignSection({ campaign, channel }: { campaign: CampaignNode; channel: string }) {
  // Onda D: link/CTA/tracking pertencem APENAS a Anúncio/Criativo.
  // Bloco "Resumo herdado dos anúncios" removido da Campanha por completo.
  return (
    <div className="space-y-4">
      <Block title="Configurações da campanha" icon={<Megaphone className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Nome" value={campaign.name} />
          <Detail label="Objetivo" value={tr("objective", campaign.objective)} />
          <Detail label="Canal" value={tr("platform", campaign.platform || channel)} />
          <Detail label="Modo de compra" value={tr("buying_type", campaign.buying_type)} />
          <Detail label="Tipo de orçamento" value={tr("budget_type", campaign.budget_type)} />
          <Detail label="Orçamento diário" value={formatBudgetBRL(campaign.daily_budget_cents)} />
          <Detail label="Status inicial" value={tr("planned_status", campaign.planned_status)} />
        </DetailGrid>
      </Block>
      {campaign.rationale && (
        <Block title="Por que esta configuração" icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{campaign.rationale}</p>
        </Block>
      )}
    </div>
  );
}

function AdSetSection({ adSet, blockers }: { adSet: AdSetNode | null; blockers: GateIssue[] }) {
  if (!adSet) return <p className="text-sm text-muted-foreground">Conjunto não encontrado.</p>;
  const placements = adSet.placements.map((p) => tr("placement", p) || p);
  const pendingFields = new Set(blockers.map((b) => b.field));
  const isPending = (field: string) => pendingFields.has(field);
  return (
    <div className="space-y-4">
      <Block title={adSet.name || "Conjunto"} icon={<Layers className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Etapa do funil" value={tr("funnel", adSet.funnel_stage)} />
          <Detail label="Tipo de público" value={tr("audience_type", adSet.audience_type)} pendingField={isPending("adset.0.audience_type")} />
          <Detail label="Idade" value={adSet.age_range} pendingField={isPending(`adset.${blockers[0]?.node_id ?? 0}.age_range`) || (!adSet.age_range && blockers.some(b => b.field.endsWith(".age_range")))} />
          <Detail label="Gênero" value={adSet.gender} pendingField={!adSet.gender && blockers.some(b => b.field.endsWith(".gender"))} />
          <Detail label="Região" value={adSet.location} pendingField={!adSet.location && blockers.some(b => b.field.endsWith(".location"))} />
          <Detail label="Meta de otimização" value={tr("optimization_goal", adSet.optimization_goal)} pendingField={!adSet.optimization_goal && blockers.some(b => b.field.endsWith(".optimization_goal"))} />
          <Detail label="Evento de conversão" value={tr("conversion_event", adSet.conversion_event)} pendingField={(!adSet.conversion_event || adSet.conversion_event === "requires_user_input") && blockers.some(b => b.field.endsWith(".conversion_event"))} />
          <Detail label="Posicionamentos" value={placements.length ? placements.join(", ") : null} pendingField={placements.length === 0 && blockers.some(b => b.field.endsWith(".placements"))} />
          <Detail label="Orçamento" value={formatBudgetBRL(adSet.daily_budget_cents)} />
          {adSet.targeting_summary && <Detail label="Resumo de segmentação" value={adSet.targeting_summary} fullWidth />}
          {adSet.schedule && (adSet.schedule.start || adSet.schedule.end) && (
            <Detail
              label="Período de veiculação"
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
        <Block title="Por que este conjunto" icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{adSet.rationale}</p>
        </Block>
      )}
    </div>
  );
}

function AdSection({ ad, isStrategyStage, blockers }: { ad: AdNode | null; isStrategyStage: boolean; blockers: GateIssue[] }) {
  if (!ad) return <p className="text-sm text-muted-foreground">Anúncio não encontrado.</p>;
  const pending = new Set(blockers.map((b) => b.field));
  const isP = (suffix: string) => Array.from(pending).some((f) => f.endsWith(suffix));
  return (
    <div className="space-y-4">
      {/* Bloco 1: ANÚNCIO (entrega) */}
      <Block title={ad.name || "Anúncio"} icon={<ImageIcon className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Nome do anúncio" value={ad.name} />
          <Detail label="Conjunto vinculado" value={ad.ad_set_ref} />
          <Detail label="Status do criativo" value={translateCreativeStatus(ad.creative_status, isStrategyStage)} />
        </DetailGrid>
      </Block>

      {/* Bloco 2: CRIATIVO (conteúdo do anúncio) */}
      <Block title="Criativo do anúncio" icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Produto/oferta" value={ad.product_name} />
          <Detail label="Formato" value={ad.creative_format} pendingField={!ad.creative_format && isP(".creative_format")} />
          <Detail label="Título" value={ad.headline} fullWidth pendingField={!ad.headline && isP(".headline")} />
          <Detail label="Texto principal" value={ad.primary_text} fullWidth pendingField={!ad.primary_text && isP(".primary_text")} />
          <Detail label="Descrição" value={ad.description} fullWidth />
          <Detail label="Botão de ação" value={tr("cta", ad.cta)} pendingField={!ad.cta && isP(".cta")} />
          {ad.alternative_formats.length > 0 && (
            <Detail label="Formatos alternativos" value={ad.alternative_formats.join(", ")} />
          )}
          <Detail label="Link de destino" value={ad.destination_url} fullWidth pendingField={!ad.destination_url && isP(".destination_url")} />
          {ad.tracking_params && <Detail label="Parâmetros de rastreamento" value={ad.tracking_params} fullWidth />}
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
        <Block title="Por que este anúncio" icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />}>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{ad.rationale}</p>
        </Block>
      )}
    </div>
  );
}

/* ===========================================================================
   Átomos visuais
   =========================================================================== */

function TreeItem({
  icon, label, active, onClick, indent,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; indent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 md:w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors",
        indent && "md:pl-6",
        active ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
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
  return <p className="hidden md:block text-[10px] text-muted-foreground/60 italic px-3 py-1">{label}</p>;
}

function Block({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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
  label, value, fullWidth, pendingField,
}: { label: string; value: string | number | null | undefined; fullWidth?: boolean; pendingField?: boolean }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn(fullWidth && "sm:col-span-2")}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      {empty && pendingField ? (
        <p className="text-sm">
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-1.5 py-0.5 text-[11px] font-medium">
            Pendente · Obrigatório
          </span>
        </p>
      ) : (
        <p className="text-sm break-words">{empty ? "—" : String(value)}</p>
      )}
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
