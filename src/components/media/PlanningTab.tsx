import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Image, Check, Loader2, MousePointer2, Trash2, LayoutGrid, FileText, PenTool, AlertCircle, ArrowRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MediaCalendarItem, MediaCampaign } from "@/hooks/useMediaCampaigns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getHolidayForDate } from "@/lib/brazilian-holidays";
import { useNavigate } from "react-router-dom";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectionDiagnostics, getDiagnostics } from "@/components/media/SelectionDiagnostics";

interface PlanningTabProps {
  campaignId: string;
  campaign: MediaCampaign;
  items: MediaCalendarItem[] | undefined;
  isLoading: boolean;
  itemsByDate: Map<string, MediaCalendarItem[]>;
  refetchItems: () => Promise<any>;
  onEditItem: (item: MediaCalendarItem) => void;
  onAddItem: (date: Date) => void;
  onDeleteItem: (id: string) => void;
  onDuplicateItem: (item: MediaCalendarItem) => void;
  onOpenDayList: (date: Date) => void;
  onReplaceScheduled: (item: MediaCalendarItem) => void;
  onGoToApproval: () => void;
  metaConnected: boolean;
  metaLoading: boolean;
}

// WorkflowStepper (moved from CampaignCalendar)
interface StepConfig {
  number: number;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  isActive: boolean;
  isCurrent?: boolean;
  isLoading: boolean;
  isAI?: boolean;
  count?: number;
  className?: string;
  tooltip?: string | null;
}

function WorkflowStepper({ steps }: { steps: StepConfig[] }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const showConnector = index < steps.length - 1;
          const isCurrent = step.isCurrent || false;
          const hasTooltip = !step.isActive && step.tooltip;

          const button = (
            <Button
              variant={isCurrent ? "default" : "outline"}
              size="sm"
              onClick={step.action}
              disabled={!step.isActive || step.isLoading}
              className={cn(
                "gap-1.5 h-9 text-xs font-medium transition-all relative",
                isCurrent && "shadow-sm",
                !step.isActive && "opacity-50",
                step.className,
              )}
            >
              <span className={cn(
                "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                isCurrent ? "bg-background/20 text-inherit" : "bg-muted text-muted-foreground"
              )}>
                {step.isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : step.number}
              </span>
              {step.icon}
              {step.label}
              {step.count !== undefined && step.count > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                  {step.count}
                </Badge>
              )}
            </Button>
          );

          return (
            <div key={step.number} className="flex items-center gap-1 shrink-0">
              {hasTooltip ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{button}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                    {step.tooltip}
                  </TooltipContent>
                </Tooltip>
              ) : (
                button
              )}
              {showConnector && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export function PlanningTab({
  campaignId, campaign, items, isLoading, itemsByDate, refetchItems,
  onEditItem, onAddItem, onDeleteItem, onDuplicateItem, onOpenDayList, onReplaceScheduled,
  onGoToApproval, metaConnected, metaLoading,
}: PlanningTabProps) {
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (campaign?.start_date) return startOfMonth(parseISO(campaign.start_date));
    return startOfMonth(new Date());
  });
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingCopys, setIsGeneratingCopys] = useState(false);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ total: number; completed: number } | null>(null);
  const [strategyPromptOpen, setStrategyPromptOpen] = useState(false);
  const [strategyPrompt, setStrategyPrompt] = useState("");

  const isBlog = campaign?.target_channel === "blog";
  const hasSuggestions = items && items.length > 0;

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);

  const campaignInterval = useMemo(() => {
    if (!campaign) return null;
    return { start: parseISO(campaign.start_date), end: parseISO(campaign.end_date) };
  }, [campaign]);

  const isInCampaignPeriod = (date: Date) => campaignInterval ? isWithinInterval(date, campaignInterval) : false;

  // Only show construction items in planning
  const planningItems = useMemo(() => {
    return items?.filter(i => ["draft", "suggested", "review", "generating_asset", "asset_review", "approved"].includes(i.status)) || [];
  }, [items]);

  const stats = useMemo(() => {
    if (!items) return { total: 0, needsCopy: 0, needsCreative: 0, readyToApprove: 0, approved: 0 };
    return {
      total: items.length,
      needsCopy: items.filter(i =>
        ["draft", "suggested", "review"].includes(i.status) && i.title && (!i.copy || i.copy.trim() === "")
      ).length,
      needsCreative: items.filter(i =>
        ["draft", "suggested", "review"].includes(i.status) && i.copy && i.copy.trim() !== "" && !i.asset_url && i.content_type !== "text"
      ).length,
      readyToApprove: items.filter(i =>
        ["draft", "suggested", "review"].includes(i.status) && i.title && (i.copy && i.copy.trim() !== "") && (isBlog || i.content_type === "text" || i.asset_url)
      ).length,
      approved: items.filter(i => i.status === "approved").length,
    };
  }, [items, isBlog]);

  // Planning-only items by date
  const planningItemsByDate = useMemo(() => {
    const map = new Map<string, MediaCalendarItem[]>();
    planningItems.forEach((item) => {
      const key = item.scheduled_date;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [planningItems]);

  // ========== HANDLERS ==========
  const toggleDaySelection = (dateKey: string) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      next.has(dateKey) ? next.delete(dateKey) : next.add(dateKey);
      return next;
    });
  };

  const handleDayClick = (date: Date, dayItems: MediaCalendarItem[]) => {
    if (!isInCampaignPeriod(date)) return;
    const dateKey = format(date, "yyyy-MM-dd");
    if (isSelectMode) { toggleDaySelection(dateKey); return; }
    if (dayItems.length > 0) { onOpenDayList(date); }
    else { onAddItem(date); }
  };

  // Helper: get items from selected days
  const getSelectedItems = (): MediaCalendarItem[] => {
    const result: MediaCalendarItem[] = [];
    selectedDays.forEach(dk => {
      (planningItemsByDate.get(dk) || []).forEach(i => result.push(i));
    });
    return result;
  };

  const handleOpenStrategyPrompt = async () => {
    if (!currentTenant || !campaignId) return;
    if (selectedDays.size === 0) {
      toast.info("Selecione os dias no calendário antes de gerar");
      setIsSelectMode(true);
      return;
    }
    // Check if selected days already have items with strategy (title)
    const selectedItems = getSelectedItems();
    const hasExistingStrategy = selectedItems.some(i => i.title && i.title.trim() !== "");
    if (hasExistingStrategy) {
      const confirmed = await confirm({
        title: "Regenerar estratégia?",
        description: "Os dias selecionados já possuem publicações com estratégia definida. Regenerar vai substituir as publicações existentes nesses dias, incluindo copys e criativos já gerados. Deseja continuar?",
        confirmLabel: "Sim, regenerar",
        cancelLabel: "Cancelar",
        variant: "destructive",
      });
      if (!confirmed) return;
    }
    setStrategyPromptOpen(true);
  };

  const handleGenerateStrategy = async () => {
    if (!currentTenant || !campaignId) return;
    setStrategyPromptOpen(false);
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("media-generate-suggestions", {
        body: { campaign_id: campaignId, tenant_id: currentTenant.id, target_dates: Array.from(selectedDays), prompt: strategyPrompt || undefined },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message || "Estratégia gerada!");
        setSelectedDays(new Set()); setIsSelectMode(false); setStrategyPrompt("");
        await refetchItems();
      } else toast.error(data?.error || "Erro ao gerar estratégia");
    } catch { toast.error("Erro ao gerar estratégia"); }
    finally { setIsGenerating(false); }
  };

  const handleGenerateCopys = async () => {
    if (!currentTenant || !campaignId) return;

    // Must have selected days
    if (selectedDays.size === 0) {
      toast.info("Selecione os dias no calendário antes de gerar copys");
      setIsSelectMode(true);
      return;
    }

    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      toast.info("Nenhuma publicação nos dias selecionados. Gere a estratégia primeiro.");
      return;
    }

    // Flow validation: items need strategy (title) before copy
    const withoutStrategy = selectedItems.filter(i => !i.title || i.title.trim() === "");
    if (withoutStrategy.length === selectedItems.length) {
      toast.warning("Todas as publicações selecionadas estão sem estratégia. Gere a estratégia primeiro (passo 2) para ter melhores resultados.");
      return;
    }
    if (withoutStrategy.length > 0) {
      toast.warning(`${withoutStrategy.length} publicação(ões) sem estratégia serão ignoradas. Gere a estratégia primeiro para incluí-las.`);
    }

    // Check for regeneration: items that already have copy
    const withExistingCopy = selectedItems.filter(i => i.copy && i.copy.trim() !== "");
    if (withExistingCopy.length > 0) {
      const confirmed = await confirm({
        title: "Regenerar copys?",
        description: `${withExistingCopy.length} publicação(ões) já possuem copy. Regenerar vai substituir as copys existentes. Se quiser manter os criativos alinhados, será necessário regenerá-los depois.`,
        confirmLabel: "Sim, regenerar copys",
        cancelLabel: "Cancelar",
      });
      if (!confirmed) return;
    }

    setIsGeneratingCopys(true);
    try {
      const targetDates = Array.from(selectedDays);
      const { data, error } = await supabase.functions.invoke("media-generate-copys", {
        body: { campaign_id: campaignId, tenant_id: currentTenant.id, target_dates: targetDates },
      });
      if (error) throw error;
      if (data?.success) { toast.success(data.message || "Copys geradas!"); await refetchItems(); }
      else toast.error(data?.error || "Erro ao gerar copys");
    } catch { toast.error("Erro ao gerar copys"); }
    finally { setIsGeneratingCopys(false); }
  };

  const handleGenerateCreatives = async () => {
    if (!currentTenant) return;

    // Must have selected days
    if (selectedDays.size === 0) {
      toast.info("Selecione os dias no calendário antes de gerar criativos");
      setIsSelectMode(true);
      return;
    }

    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      toast.info("Nenhuma publicação nos dias selecionados. Gere a estratégia primeiro.");
      return;
    }

    // Flow validation: items need copy before creative
    const withoutCopy = selectedItems.filter(i => !i.copy || i.copy.trim() === "");
    const textOnly = selectedItems.filter(i => i.content_type === "text");
    const eligibleForCreative = selectedItems.filter(i => i.content_type !== "text");

    if (eligibleForCreative.length === 0) {
      toast.info("Nenhuma publicação elegível para criativo nos dias selecionados (apenas itens de texto).");
      return;
    }

    const missingCopyForCreative = eligibleForCreative.filter(i => !i.copy || i.copy.trim() === "");
    if (missingCopyForCreative.length === eligibleForCreative.length) {
      toast.warning("Todas as publicações selecionadas estão sem copy. Gere as copys primeiro (passo 3) para ter criativos de melhor qualidade.");
      return;
    }
    if (missingCopyForCreative.length > 0) {
      toast.warning(`${missingCopyForCreative.length} publicação(ões) sem copy serão ignoradas. Gere as copys primeiro para incluí-las.`);
    }

    // Check for regeneration: items that already have creative
    const withExistingCreative = eligibleForCreative.filter(i => i.asset_url);
    if (withExistingCreative.length > 0) {
      const confirmed = await confirm({
        title: "Regenerar criativos?",
        description: `${withExistingCreative.length} publicação(ões) já possuem criativo. Regenerar vai substituir os criativos existentes.`,
        confirmLabel: "Sim, regenerar criativos",
        cancelLabel: "Cancelar",
      });
      if (!confirmed) return;
    }

    // Filter eligible items (has copy, not text-only, in selected days)
    const eligible = eligibleForCreative.filter(i => i.copy && i.copy.trim() !== "");
    if (eligible.length === 0) { toast.info("Nenhum item elegível para gerar criativo."); return; }

    setIsGeneratingAssets(true);
    setGenerationProgress({ total: eligible.length, completed: 0 });
    let successCount = 0;
    const generationIds: string[] = [];
    try {
      for (const item of eligible) {
        const { data, error } = await supabase.functions.invoke("media-generate-image", {
          body: { calendar_item_id: item.id, variant_count: 1, use_packshot: false },
        });
        if (!error && data?.success) { successCount++; if (data.generation_id) generationIds.push(data.generation_id); }
      }
      if (successCount === 0) { toast.error("Falha ao iniciar geração"); setIsGeneratingAssets(false); setGenerationProgress(null); return; }
      toast.info(`Gerando ${successCount} criativo(s)... Aguarde.`);
      const pollInterval = setInterval(async () => {
        if (generationIds.length > 0) {
          const { data: gens } = await supabase.from("media_asset_generations").select("id, status").in("id", generationIds);
          const pending = gens?.filter(g => g.status === "queued" || g.status === "generating").length || 0;
          const failed = gens?.filter(g => g.status === "failed").length || 0;
          const succeeded = gens?.filter(g => g.status === "succeeded").length || 0;
          setGenerationProgress({ total: eligible.length, completed: succeeded + failed });
          if (pending === 0) {
            clearInterval(pollInterval);
            setGenerationProgress(null); setIsGeneratingAssets(false);
            if (succeeded > 0) toast.success(`${succeeded} criativo(s) gerado(s)!`);
            if (failed > 0) toast.error(`${failed} criativo(s) falharam`);
            await refetchItems();
          }
        }
      }, 3000);
      setTimeout(() => { clearInterval(pollInterval); setGenerationProgress(null); setIsGeneratingAssets(false); refetchItems(); }, 5 * 60 * 1000);
    } catch { toast.error("Erro ao gerar criativos"); setIsGeneratingAssets(false); setGenerationProgress(null); }
  };

  // Stepper config
  const getCurrentStep = (): number => {
    if (isSelectMode && selectedDays.size === 0) return 1;
    if (selectedDays.size > 0) {
      if (isGenerating) return 2;
      if (isGeneratingCopys) return 3;
      if (isGeneratingAssets) return 4;
      return 1; // selection active
    }
    if (!hasSuggestions) return 1;
    if (hasSuggestions && stats.needsCopy > 0) return 3;
    if (!isBlog && hasSuggestions && stats.needsCreative > 0) return 4;
    return 1;
  };
  const currentStep = getCurrentStep();

  const buttonsActive = selectedDays.size > 0;

  // Selection diagnostics for tooltips
  const selectionDiag = useMemo(() => {
    if (selectedDays.size === 0) return null;
    return getDiagnostics(selectedDays, planningItemsByDate, isBlog);
  }, [selectedDays, planningItemsByDate, isBlog]);

  const copyTooltip = !buttonsActive ? "Selecione dias primeiro" : selectionDiag?.copyBlockReason || null;
  const creativeTooltip = !buttonsActive ? "Selecione dias primeiro" : selectionDiag?.creativeBlockReason || null;

  // Steps are active if days selected AND have eligible items
  const copysActive = buttonsActive && (selectionDiag?.canGenerateCopys ?? false);
  const creativesActive = buttonsActive && (selectionDiag?.canGenerateCreatives ?? false);

  const workflowSteps: StepConfig[] = [
    { number: 1, label: isSelectMode ? "Sair da Seleção" : "Selecionar Dias", icon: <MousePointer2 className="h-3.5 w-3.5" />, action: () => { if (isSelectMode) { setIsSelectMode(false); setSelectedDays(new Set()); } else { setIsSelectMode(true); } }, isActive: true, isLoading: false, isCurrent: currentStep === 1 },
    { number: 2, label: isGenerating ? "Gerando..." : "Estratégia IA", icon: <Sparkles className="h-3.5 w-3.5" />, action: handleOpenStrategyPrompt, isActive: buttonsActive, isLoading: isGenerating, isAI: true, isCurrent: currentStep === 2, tooltip: !buttonsActive ? "Selecione dias primeiro" : null },
    { number: 3, label: isGeneratingCopys ? "Gerando..." : "Copys IA", icon: <PenTool className="h-3.5 w-3.5" />, action: handleGenerateCopys, isActive: copysActive, isLoading: isGeneratingCopys, isAI: true, count: stats.needsCopy > 0 ? stats.needsCopy : undefined, isCurrent: currentStep === 3, tooltip: copyTooltip },
    ...(!isBlog ? [{
      number: 4, label: isGeneratingAssets ? "Gerando..." : "Criativos IA", icon: <Image className="h-3.5 w-3.5" />, action: handleGenerateCreatives, isActive: creativesActive, isLoading: isGeneratingAssets, isAI: true, count: stats.needsCreative > 0 ? stats.needsCreative : undefined, isCurrent: currentStep === 4, tooltip: creativeTooltip,
    } as StepConfig] : []),
  ];

  const weekDayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const getPublicationCounts = (dayItems: MediaCalendarItem[]) => {
    const counts = { feed_instagram: 0, feed_facebook: 0, story_instagram: 0, story_facebook: 0, blog: 0 };
    dayItems.forEach(item => {
      const platforms = item.target_platforms || [];
      const ct = item.content_type as string;
      const isBlogItem = ct === "text" || ct === "blog" || platforms.includes("blog");
      if (isBlogItem) { counts.blog++; }
      else {
        platforms.forEach(p => {
          if (p === "feed_instagram" || (p === "instagram" && ct !== "story")) counts.feed_instagram++;
          if (p === "feed_facebook" || (p === "facebook" && ct !== "story")) counts.feed_facebook++;
          if (p === "story_instagram" || (p === "instagram" && ct === "story")) counts.story_instagram++;
          if (p === "story_facebook" || (p === "facebook" && ct === "story")) counts.story_facebook++;
        });
      }
    });
    return counts;
  };

  return (
    <div className="space-y-4">
      {/* Workflow Stepper */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {isSelectMode ? "Modo Seleção — clique nos dias" : "Etapas de Construção"}
            </h3>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="font-medium">{stats.total} itens</span>
              <span>{stats.readyToApprove} prontos</span>
            </div>
          </div>
          <WorkflowStepper steps={workflowSteps} />

          {isSelectMode && selectedDays.size === 0 && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <MousePointer2 className="h-3.5 w-3.5" />
              Clique nos dias do calendário abaixo para selecionar as datas de publicação
            </p>
          )}

          {!isSelectMode && !hasSuggestions && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Clique nos dias para criar publicações manualmente ou use <strong className="mx-0.5">Selecionar Dias</strong> para gerar com IA
            </p>
          )}

          {isSelectMode && selectedDays.size > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
              <Button variant="ghost" size="sm" onClick={() => { setSelectedDays(new Set()); setIsSelectMode(false); }}>
                Limpar seleção
              </Button>
              {(() => {
                let totalInSelection = 0;
                selectedDays.forEach(dk => { totalInSelection += (itemsByDate.get(dk) || []).length; });
                if (totalInSelection === 0) return null;
                return (
                  <Button variant="destructive" size="sm" className="gap-1" onClick={async () => {
                    const ids: string[] = [];
                    selectedDays.forEach(dk => (itemsByDate.get(dk) || []).forEach(i => ids.push(i.id)));
                    const confirmed = await confirm({
                      title: "Excluir publicações selecionadas",
                      description: `Tem certeza que deseja excluir ${ids.length} publicação(ões)? Esta ação não pode ser desfeita.`,
                      confirmLabel: `Excluir ${ids.length}`,
                      cancelLabel: "Cancelar",
                      variant: "destructive",
                    });
                    if (!confirmed) return;
                    try {
                      for (const id of ids) await onDeleteItem(id);
                      toast.success(`${ids.length} excluída(s)`);
                      setSelectedDays(new Set()); setIsSelectMode(false);
                    } catch { toast.error("Erro ao excluir"); }
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir ({totalInSelection})
                  </Button>
                );
              })()}
              <SelectionDiagnostics
                selectedDays={selectedDays}
                planningItemsByDate={planningItemsByDate}
                isBlog={isBlog}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cross-tab shortcut: items ready for approval */}
      {stats.readyToApprove > 0 && (
        <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20 cursor-pointer" onClick={onGoToApproval}>
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-green-800 dark:text-green-200">
              {stats.readyToApprove} item(ns) pronto(s) para aprovação
            </span>
            <Button size="sm" variant="outline" className="ml-4 gap-1">
              Ir para Aprovação <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Meta connection alert */}
      {!metaLoading && !metaConnected && hasSuggestions && !isBlog && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-200">Para publicar nas redes sociais, conecte suas contas.</span>
            <Button size="sm" variant="outline" onClick={() => navigate("/integrations")} className="ml-4">Conectar</Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </CardTitle>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <TooltipProvider>
              <div className="grid grid-cols-7 gap-1">
                {weekDayHeaders.map((day) => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
                ))}
                {Array.from({ length: days[0].getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[90px] bg-muted/30 rounded-md" />
                ))}
                {days.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const dayItems = planningItemsByDate.get(dateKey) || [];
                  const allDayItems = itemsByDate.get(dateKey) || [];
                  const inPeriod = isInCampaignPeriod(date);
                  const holiday = getHolidayForDate(date);
                  const isSelected = selectedDays.has(dateKey);
                  const hasContent = dayItems.length > 0;
                  const counts = getPublicationCounts(dayItems);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => inPeriod && handleDayClick(date, allDayItems)}
                      className={cn(
                        "min-h-[90px] p-1 rounded-md border-2 transition-all relative",
                        inPeriod ? "cursor-pointer hover:shadow-md" : "bg-muted/30 border-transparent",
                        isSelected && "bg-primary/20 border-primary border-dashed",
                        hasContent && inPeriod && !isSelected && "border-muted-foreground/30 bg-muted/50",
                        !isSelected && !hasContent && inPeriod && "bg-background border-border",
                        holiday && inPeriod && "ring-2 ring-red-400/50",
                        isSelectMode && inPeriod && "cursor-cell"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-medium p-1 flex items-center gap-1",
                        !inPeriod && "text-muted-foreground/50",
                        (isSelected || hasContent) && "text-primary font-semibold"
                      )}>
                        {format(date, "d")}
                        {isSelected && !hasContent && <Check className="h-3 w-3 text-primary" />}
                        {holiday && (
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help">{holiday.emoji}</span></TooltipTrigger>
                            <TooltipContent><p className="font-medium">{holiday.name}</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      {hasContent && (
                        <div className="space-y-1 mt-0.5">
                          <div className="flex items-center gap-1.5 px-1">
                            {(counts.feed_instagram > 0 || counts.feed_facebook > 0) && (
                              <div className="relative">
                                <div className={cn(
                                  "w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold",
                                  counts.feed_instagram > 0 && counts.feed_facebook > 0
                                    ? "bg-gradient-to-r from-orange-500 to-blue-500"
                                    : counts.feed_instagram > 0 ? "bg-orange-500" : "bg-blue-500"
                                )}>
                                  <LayoutGrid className="w-3 h-3" />
                                </div>
                                <span className="absolute -top-1 -right-1 bg-foreground text-background text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                  {counts.feed_instagram + counts.feed_facebook}
                                </span>
                              </div>
                            )}
                            {(counts.story_instagram > 0 || counts.story_facebook > 0) && (
                              <div className="relative">
                                <div className={cn(
                                  "w-5 h-5 rounded flex items-center justify-center text-white text-[10px] font-bold",
                                  counts.story_instagram > 0 && counts.story_facebook > 0
                                    ? "bg-gradient-to-r from-orange-500 to-blue-500"
                                    : counts.story_instagram > 0 ? "bg-orange-500" : "bg-blue-500"
                                )}>S</div>
                                <span className="absolute -top-1 -right-1 bg-foreground text-background text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                  {counts.story_instagram + counts.story_facebook}
                                </span>
                              </div>
                            )}
                            {counts.blog > 0 && (
                              <div className="relative">
                                <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center text-white">
                                  <FileText className="w-3 h-3" />
                                </div>
                                <span className="absolute -top-1 -right-1 bg-foreground text-background text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                  {counts.blog}
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Attention dots — priority: amber (no copy) > purple (no creative) > green (complete) */}
                          <div className="flex items-center gap-1 px-1">
                            {(() => {
                              const missingCopy = dayItems.some(i => !i.copy || i.copy.trim() === "");
                              const missingCreative = dayItems.some(i => i.copy && i.copy.trim() !== "" && !i.asset_url && i.content_type !== "text");
                              const allComplete = !missingCopy && !missingCreative;
                              return (
                                <>
                                  {missingCopy && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent><p>Item(ns) sem copy</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                  {missingCreative && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent><p>Item(ns) sem criativo</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                  {allComplete && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                      </TooltipTrigger>
                                      <TooltipContent><p>Tudo preenchido</p></TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                      {!hasContent && inPeriod && !isSelected && (
                        <div className="text-xs text-muted-foreground/50 px-1 flex items-center gap-1 mt-2">
                          <Plus className="h-3 w-3" />
                          {isSelectMode ? "Selecionar" : "Adicionar"}
                        </div>
                      )}
                      {isSelectMode && isSelected && (
                        <div className="absolute top-1 right-1">
                          <Badge variant="default" className="text-[9px] px-1 py-0 h-4 bg-primary">✓</Badge>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      {/* Generation progress */}
      {generationProgress && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Gerando criativos: {generationProgress.completed}/{generationProgress.total}
        </div>
      )}

      {/* Strategy Prompt Dialog */}
      <Dialog open={strategyPromptOpen} onOpenChange={setStrategyPromptOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Direcionamento da Estratégia
            </DialogTitle>
            <DialogDescription>
              Descreva o direcionamento para a IA gerar a estratégia de conteúdo dos {selectedDays.size} dia(s) selecionado(s). Este campo é opcional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="strategy-prompt">Direcionamento (opcional)</Label>
              <Textarea
                id="strategy-prompt"
                placeholder="Ex: Campanha de Natal com foco em presentes masculinos, tom premium..."
                className="min-h-[120px] mt-1.5"
                value={strategyPrompt}
                onChange={(e) => setStrategyPrompt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setStrategyPromptOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateStrategy} disabled={isGenerating}>
              {isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar Estratégia</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ConfirmDialog}
    </div>
  );
}
