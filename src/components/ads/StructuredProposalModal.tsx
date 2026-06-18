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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProposalOverwrite } from "@/hooks/useProposalOverwrite";
import { useSystemUpload } from "@/hooks/useSystemUpload";
import { useMediaMonthFolder } from "@/hooks/useMediaMonthFolder";
import { DriveFilePicker } from "@/components/ui/DriveFilePicker";
import { Pencil, Save, Upload, FolderOpen, Trash2 } from "lucide-react";

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
import { AdCreativeAIPanel, AdImageAIControls, RegenCopyButton } from "./AdCreativeAIPanel";
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
  if (isStrategyStage) return "A gerar nesta etapa";
  switch (status) {
    case "pending_strategy_approval":
      return "A gerar com IA ou enviar do PC/Drive";
    case "generating":
      return "Gerando…";
    case "ready":
      return "Pronto";
    default:
      return "A gerar com IA ou enviar do PC/Drive";
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
  const { overwrite: overwriteActionData } = useProposalOverwrite(action);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFocus, setEditorFocus] = useState<GateIssue["node_type"] | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [adsetIdx, setAdsetIdx] = useState(0);
  const [adIdx, setAdIdx] = useState(0);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const isCampaignProposal0 = action.action_type === "campaign_proposal";
  const editableCampaign = isCampaignProposal0;


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

  const queryClient = useQueryClient();

  // Onda H.5 — Publicação direta na Meta a partir do assistente.
  // Mantém a proposta na fila até o publish concluir com sucesso.
  // Encadeia: aprovar estrutura -> publicar campanha.
  const publishToMeta = useMutation({
    mutationFn: async () => {
      // 1. Aprovação estrutural (idempotente — se já aprovada, segue).
      const { data: approveData, error: approveErr } = await supabase.functions.invoke(
        "ads-autopilot-execute-approved",
        { body: { tenant_id: action.tenant_id, action_id: action.id } },
      );
      if (approveErr) throw approveErr;
      if (approveData && (approveData as any).success === false) {
        throw new Error((approveData as any).error_pt || (approveData as any).error || "Falha ao aprovar a proposta.");
      }
      // 2. Publicação real na Meta.
      const { data: pubData, error: pubErr } = await supabase.functions.invoke(
        "ads-autopilot-publish-proposal",
        { body: { tenant_id: action.tenant_id, action_id: action.id } },
      );
      if (pubErr) throw pubErr;
      if (!(pubData as any)?.success) {
        throw new Error((pubData as any)?.error_pt || (pubData as any)?.error || "Falha ao publicar campanha na Meta.");
      }
      return pubData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
      queryClient.invalidateQueries({ queryKey: ["ads-autopilot-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      toast.success("Campanha publicada na Meta!");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Não foi possível publicar a campanha. Tente novamente.");
    },
  });

  const isApproving = approveStrategy.isPending || approvingId === action.id || publishToMeta.isPending;
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
    if (isCampaignProposal) {
      // Onda H.5 — Publicar na Meta substitui a aprovação. Proposta só sai da fila após publish OK.
      publishToMeta.mutate();
      return;
    }
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
                    editable={editableCampaign}
                    onPatch={(patch) =>
                      overwriteActionData((curr) => ({
                        ...curr,
                        campaign: { ...(curr.campaign || {}), ...patch },
                      }))
                    }
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
                      editable={editableCampaign}
                      onPatch={(patch) =>
                        overwriteActionData((curr) => {
                          const adsets = Array.isArray(curr.adsets) ? [...curr.adsets] : [];
                          adsets[adsetIdx] = { ...(adsets[adsetIdx] || {}), ...patch };
                          return { ...curr, adsets };
                        })
                      }
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
                      tenantId={action.tenant_id}
                      actionId={action.id}
                      adIndex={adIdx}
                      onAfterAIChange={() => queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] })}
                      blockers={allBlockers.filter(
                        (b) => (b.node_type === "ad" || b.node_type === "creative") && b.node_id === String(adIdx),
                      )}
                      editable={editableCampaign}
                      onPatch={(patch) =>
                        overwriteActionData((curr) => {
                          const arr = Array.isArray(curr.ads) ? [...curr.ads] : [];
                          arr[adIdx] = { ...(arr[adIdx] || {}), ...patch };
                          return { ...curr, ads: arr };
                        })
                      }
                    />
                  </div>
                )}

                {!overviewOnly && WIZARD_STEPS[stepIdx].id === "publish" && (
                  <PublishStepSummary
                    campaign={structure.campaign}
                    adSets={adSets}
                    ads={ads}
                    channel={action.channel}
                    onPublish={isCampaignProposal ? confirmApprove : handleApprove}
                    isPublishing={isApproving}
                    publishBlocked={approveBlocked}
                    publishBlockedReason={approveBlockedReason}
                  />
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
            {isCampaignProposal && !approveBlocked && stepIdx < WIZARD_STEPS.length - 1 && (
              <div className="flex items-start gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                <span>
                  Revise cada etapa. A campanha só vai ao ar quando você clicar em <strong>Publicar na Meta</strong> na última etapa — esta ação substitui a aprovação.
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

            <div className="flex items-center gap-2 w-full">
              {isCampaignProposal ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmCancelOpen(true)}
                    disabled={!!rejectingId || isApproving}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9"
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
                    className="h-9"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ajustar proposta
                  </Button>
                  <span className="text-[11px] text-muted-foreground hidden md:inline-block max-w-[220px] leading-tight">
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
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-9"
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
                    className="h-9"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ajustar proposta
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={isApproving || !!rejectingId || approveBlocked}
                    title={approveBlockedReason || undefined}
                    className="h-9"
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

      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Cancelar esta campanha?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              A proposta será removida da fila de aprovação e nada será publicado na Meta.
              Esta ação não pode ser desfeita — para retomar, será necessário gerar uma nova proposta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmCancelOpen(false);
                onReject(action.id);
                toast.success("Campanha cancelada", {
                  description: "A proposta foi removida da fila.",
                });
              }}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar campanha
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
                title="A gerar na etapa Anúncios"
                icon={<Sparkles className="h-3.5 w-3.5 text-muted-foreground" />}
              >
                <p className="text-[11px] text-muted-foreground">
                  {h4Future.length} item(ns) do anúncio final (textos, criativo, link de destino e identificadores)
                  serão gerados ou enviados na etapa <strong>Anúncios</strong>, com IA ou upload do seu PC/Drive.
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

function CampaignSection({
  campaign,
  channel,
  identity,
  editable = false,
  onPatch,
}: {
  campaign: CampaignNode;
  channel: string;
  identity?: any;
  editable?: boolean;
  onPatch?: (patch: Record<string, any>) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(campaign.name || "");
  const [draftBudget, setDraftBudget] = useState(
    campaign.daily_budget_cents != null ? (campaign.daily_budget_cents / 100).toFixed(2) : "",
  );
  const [draftStatus, setDraftStatus] = useState(campaign.planned_status || "PAUSED");
  const [saving, setSaving] = useState(false);

  const budgetMode = campaign.budget_mode || null;
  const budgetModeLabel = budgetMode === "CBO"
    ? "Orçamento na campanha (CBO)"
    : budgetMode === "ABO"
      ? "Orçamento nos conjuntos (ABO)"
      : null;
  const budgetLabel = budgetMode === "ABO" ? "Total planejado (soma dos conjuntos)" : "Orçamento diário";

  const startEdit = () => {
    setDraftName(campaign.name || "");
    setDraftBudget(campaign.daily_budget_cents != null ? (campaign.daily_budget_cents / 100).toFixed(2) : "");
    setDraftStatus(campaign.planned_status || "PAUSED");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!onPatch) return;
    const patch: Record<string, any> = {};
    if (draftName.trim() && draftName.trim() !== (campaign.name || "")) patch.name = draftName.trim();
    if (draftStatus && draftStatus !== campaign.planned_status) patch.planned_status = draftStatus;
    if (budgetMode !== "ABO") {
      const b = Number(String(draftBudget).replace(",", "."));
      if (Number.isFinite(b) && b > 0) {
        const cents = Math.round(b * 100);
        if (cents !== campaign.daily_budget_cents) patch.daily_budget_cents = cents;
      }
    }
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onPatch(patch);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <Block
        title="Configurações da campanha"
        icon={<Megaphone className="h-3.5 w-3.5 text-primary" />}
      >
        {editable && !editing && (
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={startEdit} className="h-7 text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Editar
            </Button>
          </div>
        )}
        {editable && editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground">Nome da campanha</Label>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="h-8 text-sm" />
            </div>
            {budgetMode !== "ABO" && (
              <div>
                <Label className="text-[11px] text-muted-foreground">Orçamento diário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={draftBudget}
                  onChange={(e) => setDraftBudget(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            )}
            <div>
              <Label className="text-[11px] text-muted-foreground">Status inicial</Label>
              <Select value={draftStatus} onValueChange={setDraftStatus}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAUSED">Pausada</SelectItem>
                  <SelectItem value="ACTIVE">Ativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <DetailGrid>
            <Detail label="Nome" value={campaign.name} />
            <Detail label="Objetivo" value={tr("objective", campaign.objective)} />
            <Detail label="Canal" value={tr("platform", campaign.platform || channel)} />
            <Detail label="Modo de compra" value={tr("buying_type", campaign.buying_type)} />
            <Detail label="Tipo de orçamento" value={budgetModeLabel || tr("budget_type", campaign.budget_type)} />
            <Detail label={budgetLabel} value={budgetMode === "ABO" && !campaign.daily_budget_cents ? "Definido nos conjuntos" : formatBudgetBRL(campaign.daily_budget_cents)} />
            <Detail label="Status inicial" value={tr("planned_status", campaign.planned_status)} />
          </DetailGrid>
        )}
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

function AdSetSection({
  adSet,
  blockers,
  editable = false,
  onPatch,
}: {
  adSet: AdSetNode | null;
  blockers: GateIssue[];
  editable?: boolean;
  onPatch?: (patch: Record<string, any>) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(adSet?.name || "");
  const [draftAge, setDraftAge] = useState(adSet?.age_range || "");
  const [draftGender, setDraftGender] = useState(adSet?.gender || "all");
  const [draftLocation, setDraftLocation] = useState(adSet?.location || "");
  const [draftBudget, setDraftBudget] = useState(
    adSet?.daily_budget_cents != null ? (adSet.daily_budget_cents / 100).toFixed(2) : "",
  );
  const [saving, setSaving] = useState(false);

  if (!adSet) return <p className="text-sm text-muted-foreground">Conjunto não encontrado.</p>;
  const placements = adSet.placements.map((p) => tr("placement", p) || p);
  const pendingFields = new Set(blockers.map((b) => b.field));
  const isPending = (field: string) => pendingFields.has(field);

  const startEdit = () => {
    setDraftName(adSet.name || "");
    setDraftAge(adSet.age_range || "");
    setDraftGender(adSet.gender || "all");
    setDraftLocation(adSet.location || "");
    setDraftBudget(adSet.daily_budget_cents != null ? (adSet.daily_budget_cents / 100).toFixed(2) : "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!onPatch) return;
    const patch: Record<string, any> = {};
    if (draftName.trim() && draftName.trim() !== (adSet.name || "")) patch.name = draftName.trim();
    if (draftAge.trim() !== (adSet.age_range || "")) patch.age_range = draftAge.trim() || null;
    if (draftGender !== (adSet.gender || "all")) patch.gender = draftGender;
    if (draftLocation.trim() !== (adSet.location || "")) patch.location = draftLocation.trim() || null;
    const b = Number(String(draftBudget).replace(",", "."));
    if (Number.isFinite(b) && b > 0) {
      const cents = Math.round(b * 100);
      if (cents !== adSet.daily_budget_cents) patch.daily_budget_cents = cents;
    }
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onPatch(patch);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="space-y-4">
      <Block title={adSet.name || "Conjunto"} icon={<Layers className="h-3.5 w-3.5 text-primary" />}>
        {editable && !editing && (
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={startEdit} className="h-7 text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Editar
            </Button>
          </div>
        )}
        {editable && editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground">Nome do conjunto</Label>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Faixa etária (ex.: 25-55)</Label>
              <Input value={draftAge} onChange={(e) => setDraftAge(e.target.value)} placeholder="25-55" className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Gênero</Label>
              <Select value={draftGender} onValueChange={setDraftGender}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[11px] text-muted-foreground">Região / localização</Label>
              <Input value={draftLocation} onChange={(e) => setDraftLocation(e.target.value)} placeholder="Brasil, São Paulo, ..." className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Orçamento diário (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={draftBudget}
                onChange={(e) => setDraftBudget(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
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
        )}
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

function CreativeMediaColumn({
  ad,
  onPatch,
  tenantId,
  actionId,
  adIndex,
  onAfterAIChange,
}: {
  ad: AdNode;
  onPatch?: (patch: Record<string, any>) => void | Promise<void>;
  tenantId?: string;
  actionId?: string;
  adIndex?: number;
  onAfterAIChange?: () => void;
}) {
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const todayIso = useMemo(() => new Date().toISOString(), []);
  const folderId = useMediaMonthFolder(todayIso);
  const { upload, isUploading } = useSystemUpload({
    source: "ads_creative",
    subPath: "ads",
    folderId: folderId || undefined,
  });
  let inputEl: HTMLInputElement | null = null;

  const applyCreative = async (url: string, sourceLabel: "manual_upload" | "manual_drive") => {
    if (!onPatch) return;
    await onPatch({
      creative_final_url: url,
      creative_status: "ready",
      creative_source: sourceLabel,
    });
    toast.success("Criativo anexado ao anúncio.");
  };

  const handleFile = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (PNG, JPG ou WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Limite de 10 MB.");
      return;
    }
    const res = await upload(file);
    if (res?.publicUrl) await applyCreative(res.publicUrl, "manual_upload");
  };

  const handleRemove = async () => {
    if (!onPatch) return;
    setRemoving(true);
    await onPatch({
      creative_final_url: null,
      creative_status: "pending_strategy_approval",
      creative_source: null,
    });
    setRemoving(false);
  };

  const hasCreative = !!ad.creative_final_url;
  const previewUrl = ad.creative_final_url || ad.reference_image_url || null;
  const isReference = !hasCreative && !!ad.reference_image_url;

  return (
    <div className="flex flex-col gap-2 w-full sm:w-[180px] shrink-0">
      <div className="relative">
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="block group"
            title="Abrir em tamanho real"
          >
            <img
              src={previewUrl}
              alt={hasCreative ? "Criativo do anúncio" : "Referência do produto"}
              className={`w-full aspect-square object-cover rounded-md border border-border/40 ${isReference ? "opacity-70" : ""} group-hover:opacity-90 transition-opacity`}
            />
            {isReference && (
              <span className="absolute top-1 left-1 text-[9px] uppercase tracking-wide bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-muted-foreground border border-border/40">
                referência
              </span>
            )}
          </a>
        ) : (
          <div className="w-full aspect-square rounded-md border border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center text-center px-2">
            <ImageIcon className="h-6 w-6 text-muted-foreground/60 mb-1" />
            <p className="text-[10px] text-muted-foreground leading-tight">Sem criativo ainda</p>
          </div>
        )}
      </div>

      {isReference && (
        <p className="text-[10px] text-muted-foreground leading-snug">
          Apenas foto do produto — gere ou anexe o criativo final.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        {tenantId && actionId && typeof adIndex === "number" && (
          <AdImageAIControls
            tenantId={tenantId}
            actionId={actionId}
            adIndex={adIndex}
            hasImage={hasCreative}
            onChanged={() => onAfterAIChange?.()}
          />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputEl?.click()}
          disabled={isUploading}
          className="h-8 text-xs justify-start"
        >
          {isUploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
          {hasCreative ? "Substituir do PC" : "Enviar do PC"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDrivePickerOpen(true)}
          disabled={isUploading}
          className="h-8 text-xs justify-start"
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
          {hasCreative ? "Trocar pelo Drive" : "Escolher no Drive"}
        </Button>
        {hasCreative && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={removing || isUploading}
            className="h-8 text-xs justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover
          </Button>
        )}
        <p className="text-[10px] text-muted-foreground/80 leading-snug">
          PNG, JPG ou WEBP — até 10 MB. Arquivos do PC vão para a pasta mensal do Drive.
        </p>
      </div>

      <input
        ref={(el) => { inputEl = el; }}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <DriveFilePicker
        open={drivePickerOpen}
        onOpenChange={setDrivePickerOpen}
        onSelect={(url) => { setDrivePickerOpen(false); applyCreative(url, "manual_drive"); }}
        accept="image"
        title="Escolher imagem do Meu Drive"
      />
    </div>
  );
}


function AdSection({
  ad,
  isStrategyStage,
  isCampaignProposal,
  campaign,
  blockers,
  editable = false,
  onPatch,
  tenantId,
  actionId,
  adIndex,
  onAfterAIChange,
}: {
  ad: AdNode | null;
  isStrategyStage: boolean;
  isCampaignProposal?: boolean;
  campaign?: CampaignNode;
  blockers: GateIssue[];
  editable?: boolean;
  onPatch?: (patch: Record<string, any>) => void | Promise<void>;
  tenantId?: string;
  actionId?: string;
  adIndex?: number;
  onAfterAIChange?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(ad?.name || "");
  const [draftHeadline, setDraftHeadline] = useState(ad?.headline || "");
  const [draftPrimary, setDraftPrimary] = useState(ad?.primary_text || "");
  const [draftDesc, setDraftDesc] = useState(ad?.description || "");
  const [draftCta, setDraftCta] = useState(ad?.cta || "");
  const [draftDest, setDraftDest] = useState(ad?.destination_url || "");
  const [saving, setSaving] = useState(false);

  if (!ad) return <p className="text-sm text-muted-foreground">Anúncio não encontrado.</p>;
  const pending = new Set(blockers.map((b) => b.field));
  const isP = (suffix: string) => Array.from(pending).some((f) => f.endsWith(suffix));

  // Quando o lojista editar, copy deixa de ser "fase futura" — passa a ser conteúdo real.
  const hasManualCopy = !!(ad.headline || ad.primary_text || ad.description);
  const copyAsFuturePhase = (isStrategyStage || !!isCampaignProposal) && !hasManualCopy;
  const isTesting = String(campaign?.internal_strategy_tag || "").toLowerCase() === "testing";
  const formatIsTestVariable = (ad.format_phase === "h4_future") || (isTesting && !ad.creative_format);

  const ctaValue = ad.cta ? tr("cta", ad.cta) : null;
  const ctaOriginNote = ad.cta && ad.cta_source === "objective_default"
    ? "Padrão do objetivo Vendas"
    : ad.cta && (ad.cta_source as any) === "manual_override"
      ? "Definido pelo lojista"
      : null;

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
  const formatDisplayValue = ad.format_label || (ad.creative_format ? tr("creative_format", ad.creative_format) : null);
  const formatOriginNote = ad.format_source_label_pt || null;

  const startEdit = () => {
    setDraftName(ad.name || "");
    setDraftHeadline(ad.headline || "");
    setDraftPrimary(ad.primary_text || "");
    setDraftDesc(ad.description || "");
    setDraftCta(ad.cta || "");
    setDraftDest(ad.destination_url || "");
    setEditing(true);
  };

  const handleSave = async () => {
    if (!onPatch) return;
    const patch: Record<string, any> = {};
    const norm = (s: string) => s.trim();
    if (norm(draftName) !== (ad.name || "")) patch.name = norm(draftName) || null;
    if (norm(draftHeadline) !== (ad.headline || "")) patch.headline = norm(draftHeadline) || null;
    if (norm(draftPrimary) !== (ad.primary_text || "")) patch.primary_text = norm(draftPrimary) || null;
    if (norm(draftDesc) !== (ad.description || "")) patch.description = norm(draftDesc) || null;
    if (draftCta !== (ad.cta || "")) {
      patch.cta = draftCta || null;
      patch.cta_source = draftCta ? "manual_override" : null;
    }
    if (norm(draftDest) !== (ad.destination_url || "")) {
      patch.destination_url = norm(draftDest) || null;
      patch.destination_source = norm(draftDest) ? "ad_override" : null;
      if (norm(draftDest)) patch.destination_pending_reason = null;
    }
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onPatch(patch);
    setSaving(false);
    setEditing(false);
  };

  const CTA_OPTIONS: { value: string; label: string }[] = [
    { value: "SHOP_NOW", label: "Comprar agora" },
    { value: "LEARN_MORE", label: "Saiba mais" },
    { value: "BUY_NOW", label: "Compre agora" },
    { value: "ORDER_NOW", label: "Peça já" },
    { value: "SIGN_UP", label: "Cadastre-se" },
    { value: "SUBSCRIBE", label: "Inscreva-se" },
    { value: "GET_OFFER", label: "Ver oferta" },
    { value: "CONTACT_US", label: "Fale conosco" },
    { value: "BOOK_NOW", label: "Reservar" },
    { value: "DOWNLOAD", label: "Baixar" },
    { value: "APPLY_NOW", label: "Inscreva-se já" },
  ];

  return (
    <div className="space-y-4">
      {/* Bloco 1: ANÚNCIO (entrega) */}
      <Block title={ad.name || "Anúncio"} icon={<ImageIcon className="h-3.5 w-3.5 text-primary" />}>
        {editable && !editing && (
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" onClick={startEdit} className="h-7 text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Editar textos do anúncio
            </Button>
          </div>
        )}
        {editable && editing ? (
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground">Nome do anúncio</Label>
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Título</Label>
              <Input
                value={draftHeadline}
                onChange={(e) => setDraftHeadline(e.target.value)}
                maxLength={40}
                placeholder="Até 40 caracteres"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{draftHeadline.length}/40</p>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Texto principal</Label>
              <Textarea
                value={draftPrimary}
                onChange={(e) => setDraftPrimary(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Mensagem principal que aparece no anúncio"
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{draftPrimary.length}/500</p>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">Descrição (opcional)</Label>
              <Input
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                maxLength={30}
                placeholder="Até 30 caracteres"
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{draftDesc.length}/30</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground">Botão de ação</Label>
                <Select value={draftCta || "__none__"} onValueChange={(v) => setDraftCta(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem botão (padrão do objetivo)</SelectItem>
                    {CTA_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Link de destino</Label>
                <Input
                  type="url"
                  value={draftDest}
                  onChange={(e) => setDraftDest(e.target.value)}
                  placeholder="https://..."
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <DetailGrid>
            <Detail label="Nome do anúncio" value={ad.name} />
            <Detail label="Conjunto vinculado" value={ad.ad_set_ref} />
            <Detail label="Status do criativo" value={translateCreativeStatus(ad.creative_status, copyAsFuturePhase)} />
          </DetailGrid>
        )}
      </Block>

      {/* Painel de IA de textos — fica ACIMA do bloco de criativo para que
          o botão "Gerar tudo novamente" e os feedbacks por campo apareçam
          antes das copies. */}
      {editable && isCampaignProposal && tenantId && actionId && typeof adIndex === "number" && (
        <AdCreativeAIPanel
          tenantId={tenantId}
          actionId={actionId}
          adIndex={adIndex}
          productNameHint={ad.product_name || ""}
          currentHeadline={ad.headline || ""}
          currentPrimary={ad.primary_text || ""}
          currentDescription={ad.description || ""}
          onChanged={() => { onAfterAIChange?.(); }}
        />
      )}

      {/* Bloco 2: CRIATIVO (conteúdo do anúncio) */}
      <Block
        title="Criativo do anúncio"
        icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
        actions={
          editable && isCampaignProposal && tenantId && actionId && typeof adIndex === "number" && (ad.headline || ad.primary_text || ad.description) ? (
            <RegenCopyButton
              tenantId={tenantId}
              actionId={actionId}
              adIndex={adIndex}
              productNameHint={ad.product_name || ""}
              onChanged={() => { onAfterAIChange?.(); }}
            />
          ) : null
        }
      >
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


      {editable ? (
        <AttachCreativeBlock
          ad={ad}
          onPatch={onPatch}
          tenantId={tenantId}
          actionId={actionId}
          adIndex={adIndex}
          onAfterAIChange={onAfterAIChange}
        />
      ) : (
        (ad.reference_image_url || ad.creative_final_url || ad.creative_prompt) && (
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
        )
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

function PublishStepSummary({
  campaign,
  adSets,
  ads,
  channel,
  onPublish,
  isPublishing,
  publishBlocked,
  publishBlockedReason,
}: {
  campaign: CampaignNode;
  adSets: AdSetNode[];
  ads: AdNode[];
  channel: string;
  onPublish: () => void;
  isPublishing: boolean;
  publishBlocked: boolean;
  publishBlockedReason: string | null;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Bloqueio: todo anúncio precisa ter criativo final.
  const adsWithoutCreative = ads
    .map((a, i) => ({ idx: i, name: a.name || `Anúncio ${i + 1}`, hasCreative: !!a.creative_final_url }))
    .filter((a) => !a.hasCreative);
  const creativesMissing = adsWithoutCreative.length > 0;

  // Resumos numéricos amigáveis.
  const campaignBudget = campaign.daily_budget_cents
    ? formatBudgetBRL(campaign.daily_budget_cents)
    : null;
  const totalAdsetBudgetCents = adSets.reduce(
    (sum, s) => sum + (s.daily_budget_cents || 0),
    0,
  );
  const adsetBudgetLabel = totalAdsetBudgetCents > 0 ? formatBudgetBRL(totalAdsetBudgetCents) : null;
  const channelLabel = channel === "meta" ? "Meta (Facebook/Instagram)" : channel === "google_ads" ? "Google Ads" : channel;

  const publishDisabled = publishBlocked || creativesMissing || isPublishing;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <Send className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Última etapa — revisar e publicar</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Ao publicar, a campanha é enviada para o {channelLabel} e fica <strong>ativa</strong>.
              A publicação é a aprovação final. Depois disso, ajustes só pelo painel da plataforma
              ou pelo chat com a IA.
            </p>
          </div>
        </div>
      </div>

      <Block title="Resumo da campanha" icon={<Megaphone className="h-3.5 w-3.5 text-muted-foreground" />}>
        <DetailGrid>
          <Detail label="Nome" value={campaign.name} fullWidth />
          <Detail label="Plataforma" value={channelLabel} />
          <Detail label="Objetivo" value={campaign.objective} />
          {campaignBudget && <Detail label="Orçamento diário (campanha)" value={campaignBudget} />}
          {!campaignBudget && adsetBudgetLabel && (
            <Detail label="Orçamento diário (somatório dos conjuntos)" value={adsetBudgetLabel} />
          )}
          <Detail label="Conjuntos" value={`${adSets.length}`} />
          <Detail label="Anúncios" value={`${ads.length}`} />
        </DetailGrid>
      </Block>

      <Block title="Conjuntos" icon={<Layers className="h-3.5 w-3.5 text-muted-foreground" />}>
        <ul className="space-y-1.5">
          {adSets.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{s.name || `Conjunto ${i + 1}`}</span>
              {s.daily_budget_cents ? (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {formatBudgetBRL(s.daily_budget_cents)}/dia
                </Badge>
              ) : null}
            </li>
          ))}
          {adSets.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum conjunto definido.</li>
          )}
        </ul>
      </Block>

      <Block title="Anúncios" icon={<ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />}>
        <ul className="space-y-2">
          {ads.map((a, i) => {
            const hasCreative = !!a.creative_final_url;
            return (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-2.5 py-2",
                  hasCreative ? "border-border/40 bg-card/40" : "border-amber-500/40 bg-amber-500/5",
                )}
              >
                {hasCreative ? (
                  <img
                    src={a.creative_final_url!}
                    alt={a.name || `Anúncio ${i + 1}`}
                    className="h-12 w-12 object-cover rounded border border-border/40 shrink-0"
                  />
                ) : (
                  <div className="h-12 w-12 rounded border border-dashed border-amber-500/40 bg-amber-500/10 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name || `Anúncio ${i + 1}`}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.headline || a.primary_text || "Sem copy definida"}
                  </p>
                </div>
                {hasCreative ? (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                    Criativo pronto
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/40 text-amber-800 dark:text-amber-200">
                    Falta criativo
                  </Badge>
                )}
              </li>
            );
          })}
          {ads.length === 0 && (
            <li className="text-xs text-muted-foreground">Nenhum anúncio definido.</li>
          )}
        </ul>
      </Block>

      {creativesMissing && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">
              {adsWithoutCreative.length === 1
                ? "Um anúncio ainda está sem criativo."
                : `${adsWithoutCreative.length} anúncios ainda estão sem criativo.`}
            </p>
            <p className="mt-0.5 leading-relaxed">
              Volte para a etapa <strong>Anúncios</strong> e adicione o criativo
              ({adsWithoutCreative.map((a) => a.name).join(", ")}) antes de publicar.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col items-stretch gap-2 pt-1">
        <Button
          size="lg"
          onClick={() => setConfirmOpen(true)}
          disabled={publishDisabled}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isPublishing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Publicar na Meta
            </>
          )}
        </Button>
        {publishBlockedReason && !creativesMissing && (
          <p className="text-[11px] text-muted-foreground text-center">{publishBlockedReason}</p>
        )}
        {!publishBlocked && !creativesMissing && (
          <p className="text-[11px] text-muted-foreground text-center">
            Ao publicar, a campanha entra ativa imediatamente. Esta ação substitui a aprovação.
          </p>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar campanha no {channelLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha será criada e entrará <strong>ativa</strong>. A publicação é a aprovação
              final — depois disso, ajustes só pelo painel da plataforma ou pelo chat com a IA.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onPublish();
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              Publicar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function Block({ title, icon, children, actions }: { title: string; icon: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          {icon}
          {title}
        </h3>
        {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
      </div>
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
            A gerar nesta etapa (botão de IA abaixo)
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
