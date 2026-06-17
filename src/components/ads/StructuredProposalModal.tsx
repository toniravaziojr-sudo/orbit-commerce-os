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
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  AlertTriangle,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  ImageIcon,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  Send,
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
  classifyPendingFieldH2,
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

type StepId = "overview" | "campaign" | "adsets" | "ads" | "publish";

const WIZARD_STEPS: { id: StepId; label: string; icon: typeof Eye }[] = [
  { id: "overview", label: "Visão geral", icon: Eye },
  { id: "campaign", label: "Campanha", icon: Megaphone },
  { id: "adsets", label: "Conjuntos", icon: Layers },
  { id: "ads", label: "Anúncios", icon: ImageIcon },
  { id: "publish", label: "Publicar", icon: Send },
];

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
  /** Callback para acionar fluxo de ajuste externo (texto livre) quando não há editor estruturado. */
  onAdjustRequest?: () => void;
}

/* ---------------------------------------------------------------------------
   Tradutores PT-BR (sem chamadas externas)
   --------------------------------------------------------------------------- */

const DICT: Record<string, Record<string, string>> = {
  objective: {
    sales: "Vendas",
    OUTCOME_SALES: "Vendas",
    conversions: "Conversões",
    traffic: "Tráfego",
    OUTCOME_TRAFFIC: "Tráfego",
    awareness: "Reconhecimento de marca",
    OUTCOME_AWARENESS: "Reconhecimento de marca",
    engagement: "Engajamento",
    OUTCOME_ENGAGEMENT: "Engajamento",
    leads: "Geração de leads",
    OUTCOME_LEADS: "Geração de leads",
    video_views: "Visualizações de vídeo",
    messages: "Mensagens",
    app_promotion: "Promoção de aplicativo",
    OUTCOME_APP_PROMOTION: "Promoção de aplicativo",
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
    tof: "Topo do funil / Público frio",
    mof: "Meio do funil / Público morno",
    bof: "Fundo do funil / Público quente",
    top: "Topo do funil (descoberta)",
    middle: "Meio do funil (consideração)",
    bottom: "Fundo do funil (conversão)",
    prospecting: "Prospecção",
    retargeting: "Remarketing",
    test: "Teste de criativos",
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
    OFFSITE_CONVERSIONS: "Conversões no site",
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
    advantage_plus: "Posicionamento automático (Advantage+)",
    advantage_plus_placements: "Posicionamento automático (Advantage+)",
    automatic: "Posicionamento automático (Advantage+)",
  },
};

function tr(group: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const key = String(value);
  return DICT[group]?.[key] ?? DICT[group]?.[key.toUpperCase()] ?? DICT[group]?.[key.toLowerCase()] ?? key;
}

function translateCreativeStatus(status: AdNode["creative_status"], isStrategyStage: boolean): string {
  if (isStrategyStage) return "Será gerado na próxima etapa";
  switch (status) {
    case "pending_strategy_approval":
      return "Será gerado na próxima etapa";
    case "generating":
      return "Gerando…";
    case "ready":
      return "Pronto";
    default:
      return "Será gerado na próxima etapa";
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
  onAdjustRequest,
}: Props) {
  const data = action.action_data || {};
  const isTwoStep = isTwoStepAction(action);
  const twoStepStage = getTwoStepStage(action);
  const isStrategyStage = isTwoStep && twoStepStage === "strategy";
  const isStrategicPlan = action.action_type === "strategic_plan";

  const { approveStrategy } = useAdsPendingActions();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFocus, setEditorFocus] = useState<GateIssue["node_type"] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [adsetIdx, setAdsetIdx] = useState(0);
  const [adIdx, setAdIdx] = useState(0);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);


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

  // Onda G (rev2) — Contrato fail-closed do Plano Estratégico.
  const planContract: any = (data as any)?.contract || null;
  const planIncomplete = isStrategicPlan && (
    action.status === "incomplete"
    || (data as any)?.approval_status === "incomplete"
    || (data as any)?.metadata?.validation_status !== "valid"
    || (data as any)?.metadata?.is_approvable !== true
  );
  const approveBlockedByContract = isStrategicPlan && (planIncomplete || (planContract && planContract.ok === false));
  const contractBlockerErrors: Array<{ code: string; message: string }> = approveBlockedByContract
    ? ((planContract?.errors as any[]) || []).filter((e: any) => e.severity === "blocker")
    : [];

  // Onda H.3 — Aprovação ESTRUTURAL da proposta de campanha.
  // Blockers = pending_fields com phase=h2_structural (+ defesa em profundidade).
  // pending_fields com phase=account_config NÃO bloqueiam: viram aviso e só serão
  // exigidos na revisão final / publicação (H.4.2 / H.5).
  const isCampaignProposal = action.action_type === "campaign_proposal";
  const cpData: any = isCampaignProposal ? (data as any) : {};
  const cpCampaign = cpData?.campaign || {};
  const cpAdsets = Array.isArray(cpData?.adsets) ? cpData.adsets : [];
  const cpPlannedCreatives = Array.isArray(cpData?.planned_creatives) ? cpData.planned_creatives : [];
  const cpPendingFields: any[] = Array.isArray(cpData?.pending_fields) ? cpData.pending_fields : [];

  const cpStructuralBlockers: string[] = [];
  const cpAccountConfigPending: Array<{ level: string; field: string; label_pt: string }> = [];
  if (isCampaignProposal) {
    // Defesa em profundidade — itens críticos sempre conferidos.
    if (!cpCampaign?.name) cpStructuralBlockers.push("Nome da campanha");
    if (!cpCampaign?.objective) cpStructuralBlockers.push("Objetivo");
    const budgetMode = String(cpCampaign?.budget_mode || "").toUpperCase();
    if (budgetMode !== "ABO" && !cpCampaign?.daily_budget_cents) {
      cpStructuralBlockers.push("Orçamento diário da campanha");
    }
    if (cpAdsets.length === 0) cpStructuralBlockers.push("Conjunto de anúncios");
    if (cpPlannedCreatives.length === 0) cpStructuralBlockers.push("Anúncio planejado vinculado a um conjunto");
    if (cpData?.contract_validation_status === "blocked") {
      cpStructuralBlockers.push(cpData?.unsupported_reason || "Proposta fora do escopo suportado");
    }
    // Pending fields classificados pelo contrato H.2.2/H.2.3.
    for (const pf of cpPendingFields) {
      const label = pf.label_pt || pf.field;
      const where = pf.level === "adset" ? `Conjunto ${typeof pf.index === "number" ? pf.index + 1 : ""}`.trim() :
                    pf.level === "ad"    ? `Anúncio ${typeof pf.index === "number" ? pf.index + 1 : ""}`.trim() :
                    pf.level === "campaign" ? "Campanha" :
                    pf.level === "identity" ? "Identidade" : "";
      const msg = where ? `${where} — ${label}` : label;
      if (pf.phase === "h2_structural") {
        if (!cpStructuralBlockers.includes(msg)) cpStructuralBlockers.push(msg);
      } else if (pf.phase === "account_config") {
        cpAccountConfigPending.push({ level: pf.level, field: pf.field, label_pt: label });
      } else if (pf.phase && pf.phase !== "h4_future") {
        // Fase desconhecida → bloquear por segurança.
        cpStructuralBlockers.push(`${msg} (classificação pendente)`);
      }
    }
  }
  const approveBlockedByCampaignProposalH3 = isCampaignProposal && cpStructuralBlockers.length > 0;
  const showH3AccountConfigNotice = isCampaignProposal && !approveBlockedByCampaignProposalH3 && cpAccountConfigPending.length > 0;

  // Onda H.3 — Trava H.2 removida: aprovação estrutural liberada.
  // (Mantido como `false` por documentação; o ramo de UI já não usa mais.)
  const H2_CAMPAIGN_PROPOSAL_APPROVAL_LOCKED = false;
  const approveBlockedByH2Lock = false;

  const approveBlocked = approveBlockedByFit || approveBlockedByGates || approveBlockedByContract || approveBlockedByCampaignProposalH3 || approveBlockedByH2Lock;

  const isApproving = approveStrategy.isPending || approvingId === action.id;
  const handleApprove = () => {
    if (approveBlocked) return;
    // Onda H.3 — Confirmação explícita antes de aprovar estrutura (sem IA, sem Meta, sem publicar).
    if (isCampaignProposal) {
      setConfirmApproveOpen(true);
      return;
    }
    if (isStrategyStage) approveStrategy.mutate(action.id);
    else onApprove(action.id);
  };
  const confirmApprove = () => {
    setConfirmApproveOpen(false);
    if (isStrategyStage) approveStrategy.mutate(action.id);
    else onApprove(action.id);
  };


  const approveLabel = approveLabelOverride ?? (
    isStrategyStage
      ? approveBlocked
        ? "Ajuste necessário antes de aprovar"
        : "Aprovar estratégia e gerar criativos"
      : approveBlockedByContract
        ? "Plano incompleto — não aprovável"
        : approveBlockedByCampaignProposalH3
          ? "Faltam dados estruturais"
          : isCampaignProposal
            ? "Aprovar proposta de campanha"
            : "Aprovar");

  const approveBlockedReason = approveBlockedByContract
    ? `Plano incompleto: ${contractBlockerErrors.length} pendência(s) obrigatória(s). Recuse e rode uma nova análise.`
    : approveBlockedByFit
      ? fitData?.fit.user_message || "Bloqueado por adequação produto × público."
      : approveBlockedByGates
        ? completeness.summary || compatibility.summary || "Há bloqueios pendentes nas validações."
        : approveBlockedByCampaignProposalH3
          ? `Faltam dados estruturais: ${cpStructuralBlockers.slice(0, 5).join(" • ")}${cpStructuralBlockers.length > 5 ? ` • +${cpStructuralBlockers.length - 5}` : ""}.`
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

          {/* Estepador (Fase 1) — substitui o menu lateral antigo */}
          {!overviewOnly && (
            <WizardStepper
              steps={WIZARD_STEPS}
              currentIdx={stepIdx}
              onSelect={setStepIdx}
            />
          )}

          <div className="flex-1 min-h-0 flex overflow-hidden">
            <ScrollArea className="flex-1 min-h-0 min-w-0 w-full [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full">
              <div className="px-5 py-4 min-w-0 w-full max-w-full break-words">
                {(overviewOnly || WIZARD_STEPS[stepIdx].id === "overview") && (
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

                {!overviewOnly && WIZARD_STEPS[stepIdx].id === "campaign" && (
                  <CampaignSection
                    campaign={structure.campaign}
                    channel={action.channel}
                    identity={(structure as any).identity}
                  />
                )}

                {!overviewOnly && WIZARD_STEPS[stepIdx].id === "adsets" && (
                  <div className="space-y-4">
                    {adSets.length > 1 && (
                      <ItemChips
                        label="Conjunto"
                        items={adSets.map((a, i) => a.name || `Conjunto ${i + 1}`)}
                        activeIdx={adsetIdx}
                        onSelect={setAdsetIdx}
                      />
                    )}
                    <AdSetSection
                      adSet={adSets[adsetIdx] || null}
                      blockers={allBlockers.filter(
                        (b) => b.node_type === "ad_set" && b.node_id === String(adsetIdx),
                      )}
                    />
                  </div>
                )}

                {!overviewOnly && WIZARD_STEPS[stepIdx].id === "ads" && (
                  <div className="space-y-4">
                    {ads.length > 1 && (
                      <ItemChips
                        label="Anúncio"
                        items={ads.map((a, i) => a.name || `Anúncio ${i + 1}`)}
                        activeIdx={adIdx}
                        onSelect={setAdIdx}
                      />
                    )}
                    <AdSection
                      ad={ads[adIdx] || null}
                      isStrategyStage={isStrategyStage}
                      isCampaignProposal={action.action_type === "campaign_proposal"}
                      campaign={structure.campaign}
                      blockers={allBlockers.filter(
                        (b) => (b.node_type === "ad" || b.node_type === "creative") && b.node_id === String(adIdx),
                      )}
                    />
                  </div>
                )}

                {!overviewOnly && WIZARD_STEPS[stepIdx].id === "publish" && (
                  <PublishStepPlaceholder />
                )}
              </div>
            </ScrollArea>
          </div>



          <div className="border-t border-border/30 px-5 py-3 flex flex-col gap-2 shrink-0 bg-background">
            {approveBlockedByContract && (
              <div className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Plano incompleto — precisa ser regenerado ou ajustado
                </div>
                <ul className="ml-5 list-disc space-y-0.5">
                  {contractBlockerErrors.slice(0, 8).map((e, i) => (
                    <li key={i}>{e.message}</li>
                  ))}
                  {contractBlockerErrors.length > 8 && (
                    <li>... e mais {contractBlockerErrors.length - 8} pendência(s).</li>
                  )}
                </ul>
              </div>
            )}
            {approveBlockedReason && !approveBlockedByContract && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{approveBlockedReason}</span>
              </div>
            )}
            {showH3AccountConfigNotice && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Existem {cpAccountConfigPending.length} pendência(s) de configuração da conta Meta
                  ({cpAccountConfigPending.slice(0, 3).map((p) => p.label_pt).join(", ")}
                  {cpAccountConfigPending.length > 3 ? "…" : ""}).
                  Elas <strong>não bloqueiam esta aprovação</strong>, mas bloquearão a revisão final/publicação.
                </span>
              </div>
            )}
            {isCampaignProposal && !approveBlocked && (
              <div className="flex items-start gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span>
                  Aprovar estrutura <strong>não gera criativos</strong> e <strong>não publica</strong>.
                  A geração de criativos será iniciada manualmente na próxima etapa.
                </span>
              </div>
            )}

            {/* Voltar / Avançar — navegação do passo a passo (Fase 1) */}
            {!overviewOnly && (
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  disabled={stepIdx === 0 || isApproving || !!rejectingId}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Voltar
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Etapa {stepIdx + 1} de {WIZARD_STEPS.length} — {WIZARD_STEPS[stepIdx].label}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))}
                  disabled={stepIdx >= WIZARD_STEPS.length - 1 || isApproving || !!rejectingId}
                >
                  Avançar
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {isCampaignProposal ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmCancelOpen(true)}
                    disabled={!!rejectingId || isApproving}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancelar campanha
                  </Button>
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (onAdjustRequest) onAdjustRequest();
                    }}
                    disabled={isApproving || !!rejectingId || !onAdjustRequest}
                    title={!onAdjustRequest ? "Ajuste via texto livre indisponível neste contexto" : undefined}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ajustar proposta
                  </Button>
                  <span className="text-[11px] text-muted-foreground ml-2">
                    A aprovação acontece ao publicar na última etapa.
                  </span>
                </>
              ) : (
                <>
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
                      if (isStrategyStage) {
                        setEditorFocus(approveBlockedByGates && allBlockers[0]?.node_type ? allBlockers[0].node_type : null);
                        setEditorOpen(true);
                      } else if (onAdjustRequest) {
                        onAdjustRequest();
                      }
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
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>


      {isStrategyStage && (
        <ProposalStructuredEditor action={action} open={editorOpen} onOpenChange={setEditorOpen} initialFocus={editorFocus} />
      )}

      <AlertDialog open={confirmApproveOpen} onOpenChange={setConfirmApproveOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Aprovar estrutura da campanha?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              Nenhum criativo será gerado e nada será publicado agora. A geração de criativos será iniciada manualmente na próxima etapa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApprove} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Aprovar estrutura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  // Onda H.2.1 — Contrato v1.1: aviso de "Não disponível nesta onda".
  const contractStatus: string | null = (data as any)?.contract_validation_status ?? null;
  const unsupportedReason: string | null = (data as any)?.unsupported_reason ?? null;
  const budgetModeBadge: string | null = (data as any)?.campaign?.budget_mode === "CBO"
    ? "CBO — Orçamento na campanha"
    : (data as any)?.campaign?.budget_mode === "ABO"
      ? "ABO — Orçamento nos conjuntos"
      : null;

  return (
    <div className="space-y-4">
      {contractStatus === "blocked" && unsupportedReason && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium mb-0.5">Não disponível nesta onda</p>
            <p>{unsupportedReason}</p>
          </div>
        </div>
      )}
      {isStrategyStage && !isStrategicPlan && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
          Nenhum criativo final foi gerado ainda. A geração acontece apenas após aprovar a estratégia.
          Aprovar gera os criativos — <strong>ainda não publica a campanha</strong>.
        </div>
      )}
      {budgetModeBadge && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{budgetModeBadge}</Badge>
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
          funnelBudgetState={(data as any).funnel_budget_state ?? null}
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

      {Array.isArray((action.action_data as any)?.meta_step_checklist) && (action.action_data as any).meta_step_checklist.length > 0 && (
        <Block
          title="Passo a passo Meta — o que já está preenchido"
          icon={<Layers className="h-3.5 w-3.5 text-primary" />}
        >
          <div className="space-y-2">
            {((action.action_data as any).meta_step_checklist as any[]).map((s, i) => {
              // H.2.2 — só conta como pendência H.2 o que pertence à fase estrutural.
              // Itens h4_future e account_config aparecem em blocos próprios abaixo.
              const h2Missing = typeof s.h2_missing_count === "number" ? s.h2_missing_count : s.missing_count;
              const ok = h2Missing === 0;
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{s.label_pt}</span>
                  <Badge variant={ok ? "outline" : "destructive"} className="text-[10px]">
                    {ok ? "Completo" : `${h2Missing} pendência(s)`}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Block>
      )}


      {Array.isArray((action.action_data as any)?.pending_fields) && (action.action_data as any).pending_fields.length > 0 && (() => {
        const all = ((action.action_data as any).pending_fields as any[]) || [];
        const h2Structure = all.filter((p) => classifyPendingFieldH2(p) === "h2_structure");
        const accountConfig = all.filter((p) => classifyPendingFieldH2(p) === "account_config");
        const h4Future = all.filter((p) => classifyPendingFieldH2(p) === "h4_future");
        const labelFor = (p: any) =>
          p.level === "identity" ? "Configuração da conta"
          : p.level === "campaign" ? "Campanha"
          : p.level === "adset" ? `Conjunto${typeof p.index === "number" ? ` ${p.index + 1}` : ""}`
          : `Anúncio${typeof p.index === "number" ? ` ${p.index + 1}` : ""}`;

        return (
          <>
            {h2Structure.length > 0 && (
              <Block
                title={`Pendências da revisão atual (${h2Structure.length})`}
                icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-600" />}
              >
                <ul className="space-y-1 text-xs">
                  {h2Structure.slice(0, 25).map((p, i) => (
                    <li key={`s-${i}`} className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0">{labelFor(p)}</Badge>
                      <span className="text-muted-foreground">{p.label_pt}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {accountConfig.length > 0 && (
              <Block
                title={`Pendente de configuração da conta Meta (${accountConfig.length})`}
                icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
              >
                <p className="text-[11px] text-muted-foreground mb-2">
                  Estes itens dependem de uma configuração-padrão da conta de anúncios. A IA não preenche
                  automaticamente — defina na aba de configuração da conta Meta para liberar a próxima etapa.
                </p>
                <ul className="space-y-1 text-xs">
                  {accountConfig.map((p, i) => (
                    <li key={`a-${i}`} className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 bg-amber-500/5 border-amber-500/30">
                        {labelFor(p)}
                      </Badge>
                      <span className="text-muted-foreground">{p.label_pt}</span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}

            {h4Future.length > 0 && (
              <Block
                title="Será gerado na próxima etapa"
                icon={<Sparkles className="h-3.5 w-3.5 text-muted-foreground" />}
              >
                <p className="text-[11px] text-muted-foreground">
                  {h4Future.length} item(ns) do anúncio final (textos, criativo, link de destino e identificadores)
                  serão gerados na etapa seguinte. Não bloqueiam a revisão da estratégia.
                </p>
              </Block>
            )}
          </>
        );
      })()}



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

function CampaignSection({ campaign, channel, identity }: { campaign: CampaignNode; channel: string; identity?: any }) {
  const budgetMode = campaign.budget_mode || null;
  const budgetModeLabel = budgetMode === "CBO"
    ? "Orçamento na campanha (CBO)"
    : budgetMode === "ABO"
      ? "Orçamento nos conjuntos (ABO)"
      : null;
  const budgetLabel = budgetMode === "ABO" ? "Total planejado (soma dos conjuntos)" : "Orçamento diário";
  return (
    <div className="space-y-4">
      <Block title="Configurações da campanha" icon={<Megaphone className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Nome" value={campaign.name} />
          <Detail label="Objetivo" value={tr("objective", campaign.objective)} />
          <Detail label="Canal" value={tr("platform", campaign.platform || channel)} />
          <Detail label="Modo de compra" value={tr("buying_type", campaign.buying_type)} />
          <Detail label="Tipo de orçamento" value={budgetModeLabel || tr("budget_type", campaign.budget_type)} />
          <Detail label={budgetLabel} value={budgetMode === "ABO" && !campaign.daily_budget_cents ? "Definido nos conjuntos" : formatBudgetBRL(campaign.daily_budget_cents)} />
          <Detail label="Status inicial" value={tr("planned_status", campaign.planned_status)} />
        </DetailGrid>
      </Block>
      {identity && (
        <Block title="Identidade e rastreamento da conta" icon={<Target className="h-3.5 w-3.5 text-primary" />}>
          {(() => {
            const FALLBACK = "Pendente de configuração da conta";
            const fb = (v: string | null | undefined) => (v && String(v).trim() !== "" ? v : FALLBACK);
            const utmStr = typeof identity.utm_base === "string"
              ? identity.utm_base
              : identity.utm_base && typeof identity.utm_base === "object"
                ? Object.entries(identity.utm_base).map(([k, v]) => `${k}=${v}`).join(" · ")
                : null;
            return (
              <DetailGrid>
                <Detail label="Página do Facebook" value={fb(identity.facebook_page_name || identity.facebook_page_id)} />
                <Detail label="Instagram vinculado" value={fb(identity.instagram_actor_name || identity.instagram_actor_id)} />
                <Detail label="Pixel" value={fb(identity.pixel_name || identity.pixel_id)} />
                <Detail label="API de Conversões" value={identity.conversions_api_active ? "Ativa" : "Não configurada na conta"} />
                <Detail label="Evento de conversão padrão" value={fb(tr("conversion_event", identity.conversion_event_default))} />
                <Detail label="Janela de atribuição" value={fb(identity.attribution_window)} />
                <Detail label="CTA padrão" value={fb(tr("cta", identity.cta_default))} />
                <Detail label="UTM base" value={fb(utmStr)} fullWidth />
              </DetailGrid>
            );
          })()}
        </Block>
      )}

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

function AdSection({
  ad,
  isStrategyStage,
  isCampaignProposal,
  campaign,
  blockers,
}: {
  ad: AdNode | null;
  isStrategyStage: boolean;
  isCampaignProposal?: boolean;
  campaign?: CampaignNode;
  blockers: GateIssue[];
}) {
  if (!ad) return <p className="text-sm text-muted-foreground">Anúncio não encontrado.</p>;
  const pending = new Set(blockers.map((b) => b.field));
  const isP = (suffix: string) => Array.from(pending).some((f) => f.endsWith(suffix));

  // H.2.3 — Em propostas H.2, copy final (título/texto/descrição) é SEMPRE H.4.
  const copyAsFuturePhase = isStrategyStage || !!isCampaignProposal;
  const isTesting = String(campaign?.internal_strategy_tag || "").toLowerCase() === "testing";
  const formatIsTestVariable = (ad.format_phase === "h4_future") || (isTesting && !ad.creative_format);

  // CTA: mostra o valor (humanizado por dicionário). Se derivado do objetivo,
  // anexa origem. Se ausente sem default, vira pendência clara.
  const ctaValue = ad.cta ? tr("cta", ad.cta) : null;
  const ctaOriginNote = ad.cta && ad.cta_source === "objective_default"
    ? "Padrão do objetivo Vendas"
    : null;

  // H.2.4 — Link de destino: pode vir do anúncio, landing pública, produto
  // ou ser derivado do domínio público verificado da loja. Se ausente,
  // mostra mensagem clara por motivo de pendência (sem inventar URL).
  const destValue = ad.destination_url || null;
  const destPendingReasonLabel =
    ad.destination_pending_reason === "store_public_domain_not_verified"
      ? "Pendente de domínio público verificado da loja"
      : ad.destination_pending_reason === "landing_invalid_or_internal"
      ? "Landing inválida ou interna — defina URL pública"
      : ad.destination_pending_reason === "no_product_or_offer_linked"
      ? "Sem produto, kit, oferta ou landing vinculados"
      : ad.destination_pending_reason === "product_offer_url_missing"
      ? "Pendente de URL do produto/oferta"
      : null;
  const destPlaceholder = !destValue ? destPendingReasonLabel : null;
  // H.2.4 — origem humanizada do link, para o usuário entender de onde veio.
  const destOriginNote = destValue
    ? (ad.destination_source === "ad_override" ? "Definido no próprio anúncio"
      : ad.destination_source === "landing" ? "Landing vinculada à campanha"
      : ad.destination_source === "product_offer" ? "URL pública do produto/oferta"
      : ad.destination_source === "domain_derived" ? "Derivado do domínio verificado da loja"
      : null)
    : null;
  const formatPlaceholder = formatIsTestVariable
    ? "Será definido na etapa de criativos como variável do teste"
    : (ad.format_source === "missing_catalog_config"
      ? "Pendente de configuração de catálogo na conta Meta"
      : null);
  // H.2.5 — valor humanizado do formato resolvido + origem.
  const formatDisplayValue = ad.format_label || (ad.creative_format ? tr("creative_format", ad.creative_format) : null);
  const formatOriginNote = ad.format_source_label_pt || null;

  return (
    <div className="space-y-4">
      {/* Bloco 1: ANÚNCIO (entrega) */}
      <Block title={ad.name || "Anúncio"} icon={<ImageIcon className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Nome do anúncio" value={ad.name} />
          <Detail label="Conjunto vinculado" value={ad.ad_set_ref} />
          <Detail label="Status do criativo" value={translateCreativeStatus(ad.creative_status, copyAsFuturePhase)} />
        </DetailGrid>
      </Block>

      {/* Bloco 2: CRIATIVO (conteúdo do anúncio) */}
      <Block title="Criativo do anúncio" icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}>
        <DetailGrid>
          <Detail label="Produto/oferta" value={ad.product_name} />
          <Detail
            label="Formato"
            value={formatDisplayValue}
            helperText={formatOriginNote}
            customPlaceholder={formatPlaceholder ?? (!formatDisplayValue ? "Pendente de definição do formato planejado" : undefined)}
          />
          {/* H.2.3 — copy final (título/texto/descrição) é sempre H.4 em proposta de campanha. */}
          <Detail label="Título" value={ad.headline} fullWidth futurePhase={copyAsFuturePhase} />
          <Detail label="Texto principal" value={ad.primary_text} fullWidth futurePhase={copyAsFuturePhase} />
          <Detail label="Descrição" value={ad.description} fullWidth futurePhase={copyAsFuturePhase} />
          <Detail
            label="Botão de ação"
            value={ctaValue}
            helperText={ctaOriginNote}
            customPlaceholder={!ctaValue ? "Pendente de CTA padrão" : undefined}
          />
          {ad.alternative_formats.length > 0 && (
            <Detail label="Formatos alternativos" value={ad.alternative_formats.join(", ")} />
          )}

          <Detail
            label="Link de destino"
            value={destValue}
            fullWidth
            customPlaceholder={destPlaceholder ?? (!destValue ? "Pendente de URL do produto/oferta" : undefined)}
          />
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

function WizardStepper({
  steps,
  currentIdx,
  onSelect,
}: {
  steps: { id: StepId; label: string; icon: typeof Eye }[];
  currentIdx: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="border-b border-border/40 bg-muted/20 px-3 py-2 overflow-x-auto shrink-0">
      <ol className="flex items-center gap-1 min-w-max">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          return (
            <li key={s.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold"
                    : isDone
                      ? "bg-primary/10 text-primary hover:bg-primary/15"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold",
                    isActive
                      ? "bg-primary-foreground/20"
                      : isDone
                        ? "bg-primary/20"
                        : "bg-muted/60",
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <Icon className="h-3.5 w-3.5" />
                <span className="whitespace-nowrap">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ItemChips({
  label,
  items,
  activeIdx,
  onSelect,
}: {
  label: string;
  items: string[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2.5 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mr-1">
        {label}:
      </span>
      {items.map((name, i) => {
        const isActive = i === activeIdx;
        return (
          <button
            key={`${label}-${i}`}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs transition-colors",
              isActive
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-background text-muted-foreground border border-border/40 hover:text-foreground",
            )}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

function PublishStepPlaceholder() {
  return (
    <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center">
      <Send className="h-6 w-6 mx-auto text-muted-foreground/60 mb-2" />
      <p className="text-sm font-medium mb-1">Etapa de publicação</p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
        Esta etapa será habilitada em breve. Aqui você terá o resumo final da campanha
        e o botão para publicar diretamente na plataforma escolhida. Por enquanto,
        a aprovação continua sendo feita pelo botão no rodapé.
      </p>
    </div>
  );
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
  label, value, fullWidth, pendingField, futurePhase, customPlaceholder, helperText,
}: {
  label: string;
  value: string | number | null | undefined;
  fullWidth?: boolean;
  pendingField?: boolean;
  futurePhase?: boolean;
  /** H.2.3 — texto exibido quando o valor está vazio, com origem/fase clara
   *  (ex.: "Pendente de URL do produto/oferta", "Pendente de CTA padrão",
   *  "Será definido na etapa de criativos como variável do teste"). */
  customPlaceholder?: string;
  /** H.2.3 — nota de origem ao lado do valor (ex.: "Padrão do objetivo Vendas"). */
  helperText?: string | null;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn(fullWidth && "sm:col-span-2")}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
      {empty && customPlaceholder ? (
        <p className="text-sm">
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/30 px-1.5 py-0.5 text-[11px] font-medium">
            {customPlaceholder}
          </span>
        </p>
      ) : empty && futurePhase ? (
        <p className="text-sm">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 text-muted-foreground border border-border/60 px-1.5 py-0.5 text-[11px] font-medium">
            Será gerado na próxima etapa
          </span>
        </p>
      ) : empty && pendingField ? (
        <p className="text-sm">
          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-1.5 py-0.5 text-[11px] font-medium">
            Pendente · Obrigatório
          </span>
        </p>
      ) : (
        <>
          <p className="text-sm break-words">{empty ? "—" : String(value)}</p>
          {helperText && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{helperText}</p>}
        </>
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
