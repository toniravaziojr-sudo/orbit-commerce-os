import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, Sparkles, Image, Check, Loader2, Send, AlertCircle, MousePointer2, Instagram, Facebook, Newspaper, Trash2, LayoutGrid, FileText, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useMediaCampaigns, useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { PublicationDialog } from "./PublicationDialog";
import { ApprovalDialog } from "./ApprovalDialog";
import { DayPostsList } from "./DayPostsList";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getHolidayForDate } from "@/lib/brazilian-holidays";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// Status colors
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  published: "bg-green-600 text-white",
  failed: "bg-destructive/10 text-destructive",
  suggested: "bg-muted text-muted-foreground",
  review: "bg-muted text-muted-foreground",
  generating_asset: "bg-muted text-muted-foreground",
  asset_review: "bg-muted text-muted-foreground",
  publishing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  skipped: "bg-muted text-muted-foreground line-through",
};

// ========== STEPPER COMPONENT ==========
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
  variant?: "default" | "outline" | "destructive";
  className?: string;
}

function WorkflowStepper({ steps }: { steps: StepConfig[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, index) => {
        const showConnector = index < steps.length - 1;
        const isCurrent = step.isCurrent || false;
        const isAIStep = step.isAI || false;
        return (
          <div key={step.number} className="flex items-center gap-1 shrink-0">
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
            {showConnector && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CampaignCalendar() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const { campaigns } = useMediaCampaigns();
  const { items, isLoading, refetch: refetchItems, deleteItem, createItem } = useMediaCalendarItems(campaignId);
  const { isConnected: metaConnected, isLoading: metaLoading } = useMetaConnection();
  
  const campaign = campaigns?.find((c) => c.id === campaignId);
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (campaign?.start_date) return startOfMonth(parseISO(campaign.start_date));
    return startOfMonth(new Date());
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MediaCalendarItem | null>(null);
  const [dayListOpen, setDayListOpen] = useState(false);
  const [dayListDate, setDayListDate] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(true);
  const [isGeneratingCopys, setIsGeneratingCopys] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ total: number; completed: number } | null>(null);
  const [strategyPromptOpen, setStrategyPromptOpen] = useState(false);
  const [strategyPrompt, setStrategyPrompt] = useState("");

  // ========== MEMOS ==========
  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  }, [currentMonth]);

  const campaignInterval = useMemo(() => {
    if (!campaign) return null;
    return { start: parseISO(campaign.start_date), end: parseISO(campaign.end_date) };
  }, [campaign]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, MediaCalendarItem[]>();
    items?.forEach((item) => {
      const key = item.scheduled_date;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [items]);

  const stats = useMemo(() => {
    if (!items) return { total: 0, draft: 0, needsCopy: 0, needsCreative: 0, readyToApprove: 0, approved: 0, scheduled: 0 };
    const isBlog = campaign?.target_channel === "blog";
    return {
      total: items.length,
      draft: items.filter(i => ["draft", "suggested", "review"].includes(i.status)).length,
      // Items that have a title but NO copy — these need copywriting
      needsCopy: items.filter(i => 
        ["draft", "suggested", "review"].includes(i.status) && 
        i.title && 
        (!i.copy || i.copy.trim() === "")
      ).length,
      // Items that have copy filled but no asset (for non-text types) — these need creatives
      needsCreative: items.filter(i => 
        ["draft", "suggested", "review"].includes(i.status) && 
        i.copy && i.copy.trim() !== "" && 
        !i.asset_url && 
        i.content_type !== "text"
      ).length,
      // Items ready for approval: have copy, and for social also need asset or be text type
      readyToApprove: items.filter(i => 
        ["draft", "suggested", "review"].includes(i.status) && 
        i.title &&
        (i.copy && i.copy.trim() !== "") &&
        (isBlog || i.content_type === "text" || i.asset_url)
      ).length,
      approved: items.filter(i => i.status === "approved").length,
      scheduled: items.filter(i => ["scheduled", "published"].includes(i.status)).length,
    };
  }, [items, campaign?.target_channel]);

  const isInCampaignPeriod = (date: Date) => campaignInterval ? isWithinInterval(date, campaignInterval) : false;

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
    if (dayItems.length > 0) { setDayListDate(date); setDayListOpen(true); }
    else { setSelectedDate(date); setEditItem(null); setDialogOpen(true); }
  };

  const handleAddItem = (date: Date) => { setSelectedDate(date); setEditItem(null); setDialogOpen(true); };
  const handleEditItem = (item: MediaCalendarItem) => { setSelectedDate(parseISO(item.scheduled_date)); setEditItem(item); setDialogOpen(true); };
  const handleDeleteItem = async (id: string) => { await deleteItem.mutateAsync(id); };
  
  const handleDuplicateItem = async (item: MediaCalendarItem) => {
    if (!currentTenant) return;
    try {
      await createItem.mutateAsync({
        tenant_id: currentTenant.id, campaign_id: item.campaign_id,
        scheduled_date: item.scheduled_date, scheduled_time: item.scheduled_time,
        content_type: item.content_type, title: item.title ? `${item.title} (cópia)` : null,
        copy: item.copy, cta: item.cta, hashtags: item.hashtags,
        generation_prompt: item.generation_prompt, reference_urls: item.reference_urls,
        asset_url: null, asset_thumbnail_url: null, asset_metadata: {},
        status: "draft", target_channel: item.target_channel,
        blog_post_id: null, published_blog_at: null,
        target_platforms: item.target_platforms, published_at: null,
        publish_results: {}, version: 1, edited_by: null, edited_at: null, metadata: {},
      });
      toast.success("Publicação duplicada!");
    } catch { toast.error("Erro ao duplicar"); }
  };

  // Step 1: Open strategy prompt dialog
  const handleOpenStrategyPrompt = () => {
    if (!currentTenant || !campaignId) return;
    if (selectedDays.size === 0) {
      toast.info("Selecione os dias no calendário antes de gerar");
      setIsSelectMode(true);
      return;
    }
    setStrategyPromptOpen(true);
  };

  // Step 1b: Generate Strategy (after prompt confirmation)
  const handleGenerateStrategy = async () => {
    if (!currentTenant || !campaignId) return;
    setStrategyPromptOpen(false);
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("media-generate-suggestions", {
        body: { 
          campaign_id: campaignId, 
          tenant_id: currentTenant.id, 
          target_dates: Array.from(selectedDays),
          prompt: strategyPrompt || undefined,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message || "Estratégia gerada!");
        setSelectedDays(new Set()); setIsSelectMode(false);
        setStrategyPrompt("");
        await refetchItems();
      } else toast.error(data?.error || "Erro ao gerar estratégia");
    } catch { toast.error("Erro ao gerar estratégia"); }
    finally { setIsGenerating(false); }
  };

  // Step 2: Generate Copys
  const handleGenerateCopys = async () => {
    if (!currentTenant || !campaignId) return;
    setIsGeneratingCopys(true);
    try {
      const { data, error } = await supabase.functions.invoke("media-generate-copys", {
        body: { campaign_id: campaignId, tenant_id: currentTenant.id },
      });
      if (error) throw error;
      if (data?.success) { toast.success(data.message || "Copys geradas!"); await refetchItems(); }
      else toast.error(data?.error || "Erro ao gerar copys");
    } catch { toast.error("Erro ao gerar copys"); }
    finally { setIsGeneratingCopys(false); }
  };

  // Step 3: Generate Creatives
  const handleGenerateCreatives = async () => {
    if (!items || !currentTenant) return;
    const eligible = items.filter(i => 
      ["draft", "suggested", "review"].includes(i.status) && i.copy && !i.asset_url && i.content_type !== "text"
    );
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
        if (!error && data?.success) {
          successCount++;
          if (data.generation_id) generationIds.push(data.generation_id);
        }
      }
      
      if (successCount === 0) {
        toast.error("Falha ao iniciar geração");
        setIsGeneratingAssets(false); setGenerationProgress(null);
        return;
      }
      
      toast.info(`Gerando ${successCount} criativo(s)... Aguarde.`);
      
      // Poll for completion
      const pollInterval = setInterval(async () => {
        if (generationIds.length > 0) {
          const { data: gens } = await supabase
            .from("media_asset_generations").select("id, status").in("id", generationIds);
          
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
      
      setTimeout(() => {
        clearInterval(pollInterval);
        setGenerationProgress(null); setIsGeneratingAssets(false);
        refetchItems();
      }, 5 * 60 * 1000);
      
    } catch { toast.error("Erro ao gerar criativos"); setIsGeneratingAssets(false); setGenerationProgress(null); }
  };

  // Step 4: Approve — open visual dialog
  const readyToApproveItems = useMemo(() => {
    if (!items) return [];
    const isBlog = campaign?.target_channel === "blog";
    return items.filter(i => 
      ["draft", "suggested", "review"].includes(i.status) && i.copy && (isBlog || i.asset_url)
    );
  }, [items, campaign?.target_channel]);

  const handleApproveCampaign = () => {
    if (readyToApproveItems.length === 0) { toast.info("Nenhum item pronto para aprovar."); return; }
    setApprovalDialogOpen(true);
  };

  const handleApproveSelected = async (selectedIds: string[]) => {
    setIsApproving(true);
    try {
      for (const id of selectedIds) {
        await supabase.from("media_calendar_items").update({ status: "approved" }).eq("id", id);
      }
      toast.success(`${selectedIds.length} item(ns) aprovado(s)!`);
      await refetchItems();
    } catch { toast.error("Erro ao aprovar"); }
    finally { setIsApproving(false); }
  };

  // Step 5: Publish
  const handlePublish = async () => {
    if (!items || !currentTenant) return;
    const isBlog = campaign?.target_channel === "blog";
    
    if (isBlog) {
      // Blog publish flow
      const approved = items.filter(i => i.status === "approved" && !i.blog_post_id);
      if (approved.length === 0) { toast.info("Nenhum item aprovado para agendar."); return; }
      setIsScheduling(true);
      let scheduled = 0, published = 0, failedCount = 0;
      try {
        for (const item of approved) {
          const scheduleAt = item.scheduled_date ? `${item.scheduled_date}T${item.scheduled_time || "10:00:00"}` : null;
          const { data, error } = await supabase.functions.invoke("media-publish-blog", {
            body: { calendar_item_id: item.id, publish_now: false, schedule_at: scheduleAt },
          });
          if (error || !data?.success) failedCount++;
          else if (data.published) published++;
          else if (data.scheduled) scheduled++;
        }
        if (scheduled > 0) toast.success(`${scheduled} post(s) agendado(s)!`);
        if (published > 0) toast.success(`${published} post(s) publicado(s)!`);
        if (failedCount > 0) toast.error(`${failedCount} post(s) falharam`);
        await refetchItems();
      } catch { toast.error("Erro ao agendar"); }
      finally { setIsScheduling(false); }
    } else {
      // Social publish flow
      if (!metaConnected) {
        toast.error("Conecte suas redes sociais primeiro", {
          action: { label: "Conectar", onClick: () => navigate("/integrations") },
        });
        return;
      }
      const approved = items.filter(i => i.status === "approved");
      if (approved.length === 0) { toast.info("Nenhum item aprovado."); return; }
      setIsScheduling(true);
      try {
        const { data, error } = await supabase.functions.invoke("meta-publish-post", {
          body: { calendar_item_ids: approved.map(i => i.id), tenant_id: currentTenant.id },
        });
        if (error) toast.error("Erro ao publicar");
        else if (data?.success) {
          const parts = [];
          if (data.published > 0) parts.push(`${data.published} publicado(s)`);
          if (data.scheduled > 0) parts.push(`${data.scheduled} agendado(s)`);
          if (parts.length > 0) toast.success(parts.join(", ") + "!");
          if (data.failed > 0) toast.error(`${data.failed} falharam`);
        } else toast.error(data?.error || "Erro");
        await refetchItems();
      } catch { toast.error("Erro ao publicar"); }
      finally { setIsScheduling(false); }
    }
  };

  // ========== STEPPER CONFIG ==========
  const isBlog = campaign?.target_channel === "blog";
  const hasSuggestions = items && items.length > 0;

  // Determine current step based on campaign state
  const getCurrentStep = (): number => {
    if (isSelectMode) return 1;
    if (!hasSuggestions && selectedDays.size === 0) return 1;
    if (selectedDays.size > 0 && !hasSuggestions) return 1;
    if (isGenerating) return 2;
    if (hasSuggestions && stats.needsCopy > 0) return 3;
    if (!isBlog && hasSuggestions && stats.needsCreative > 0) return 4;
    if (hasSuggestions && stats.readyToApprove > 0) return isBlog ? 4 : 5;
    if (hasSuggestions && stats.approved > 0) return isBlog ? 5 : 6;
    return 1;
  };
  const currentStep = getCurrentStep();

  const workflowSteps: StepConfig[] = [
    {
      number: 1, label: isSelectMode ? `Selecionando (${selectedDays.size})` : "Selecionar Dias",
      icon: <MousePointer2 className="h-3.5 w-3.5" />,
      action: () => setIsSelectMode(!isSelectMode),
      isActive: true, isLoading: false,
      isCurrent: currentStep === 1,
    },
    // AI steps hidden for video recording
    {
      number: 2,
      label: isApproving ? "Aprovando..." : "Aprovar",
      icon: <Check className="h-3.5 w-3.5" />,
      action: handleApproveCampaign,
      isActive: hasSuggestions === true && stats.readyToApprove > 0,
      isLoading: isApproving,
      count: stats.readyToApprove,
      isCurrent: currentStep === (isBlog ? 4 : 5),
      className: stats.readyToApprove > 0 && currentStep !== (isBlog ? 4 : 5) ? "bg-green-600 hover:bg-green-700 text-white" : "",
    },
    {
      number: 3,
      label: isScheduling ? "Finalizando..." : "Finalizar Campanha",
      icon: <Send className="h-3.5 w-3.5" />,
      action: handlePublish,
      isActive: hasSuggestions === true && stats.approved > 0,
      isLoading: isScheduling,
      count: stats.approved,
      isCurrent: currentStep === (isBlog ? 5 : 6),
    },
  ];

  // ========== RENDER ==========
  if (!campaign) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Campanha não encontrada</p></div>;
  }

  const weekDayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const dayListItems = dayListDate ? itemsByDate.get(format(dayListDate, "yyyy-MM-dd")) || [] : [];
  const currentDateItems = selectedDate ? itemsByDate.get(format(selectedDate, "yyyy-MM-dd")) || [] : [];

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

  // Get status summary for a day's items
  const getStatusSummary = (dayItems: MediaCalendarItem[]) => {
    const summary = { published: 0, scheduled: 0, approved: 0, failed: 0, draft: 0 };
    dayItems.forEach(item => {
      if (item.status === "published") summary.published++;
      else if (item.status === "scheduled" || item.status === "publishing") summary.scheduled++;
      else if (item.status === "approved") summary.approved++;
      else if (item.status === "failed") summary.failed++;
      else summary.draft++;
    });
    return summary;
  };

  // Get dominant status color for day cell border
  const getDayStatusBorder = (dayItems: MediaCalendarItem[]) => {
    if (dayItems.length === 0) return "";
    const s = getStatusSummary(dayItems);
    if (s.failed > 0) return "border-red-500 dark:border-red-600";
    if (s.published > 0 && s.published === dayItems.length) return "border-green-500 dark:border-green-600";
    if (s.scheduled > 0) return "border-blue-500 dark:border-blue-600";
    if (s.published > 0) return "border-green-500 dark:border-green-600";
    if (s.approved > 0) return "border-amber-500 dark:border-amber-600";
    return "border-muted-foreground/30";
  };

  // Get background for day cell based on status
  const getDayStatusBg = (dayItems: MediaCalendarItem[]) => {
    if (dayItems.length === 0) return "";
    const s = getStatusSummary(dayItems);
    if (s.failed > 0) return "bg-red-50 dark:bg-red-950/20";
    if (s.published > 0 && s.published === dayItems.length) return "bg-green-50 dark:bg-green-950/30";
    if (s.scheduled > 0) return "bg-blue-50 dark:bg-blue-950/20";
    if (s.published > 0) return "bg-green-50 dark:bg-green-950/30";
    if (s.approved > 0) return "bg-amber-50 dark:bg-amber-950/20";
    return "bg-muted/50";
  };

  // Status dot color
  const getItemStatusDot = (status: string) => {
    switch (status) {
      case "published": return "bg-green-500";
      case "scheduled": case "publishing": return "bg-blue-500";
      case "approved": return "bg-amber-500";
      case "failed": return "bg-red-500";
      default: return "bg-muted-foreground/40";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={campaign.name}
        description={campaign.prompt}
        actions={
          <Button variant="outline" onClick={() => navigate(campaign?.target_channel === "blog" ? "/blog/campaigns" : "/media")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      {/* Workflow Stepper */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {isSelectMode ? "Modo Seleção — clique nos dias" : "Calendário Editorial"}
            </h3>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="font-medium">{stats.total} itens</span>
              <span>{stats.approved} aprovados</span>
              <span>{stats.scheduled} publicados</span>
            </div>
          </div>
          
          <WorkflowStepper steps={workflowSteps} />

          {/* Selection info */}
          {isSelectMode && selectedDays.size === 0 && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <MousePointer2 className="h-3.5 w-3.5" />
              Clique nos dias do calendário abaixo para selecionar as datas de publicação
            </p>
          )}

          {/* Selection tools */}
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
                    if (!confirm(`Excluir ${ids.length} publicação(ões)?`)) return;
                    try {
                      for (const id of ids) await deleteItem.mutateAsync(id);
                      toast.success(`${ids.length} excluída(s)`);
                      setSelectedDays(new Set()); setIsSelectMode(false);
                    } catch { toast.error("Erro ao excluir"); }
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir ({totalInSelection})
                  </Button>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connection Alert */}
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
                  <div key={`empty-${i}`} className="min-h-[100px] bg-muted/30 rounded-md" />
                ))}
                
                {days.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const dayItems = itemsByDate.get(dateKey) || [];
                  const inPeriod = isInCampaignPeriod(date);
                  const holiday = getHolidayForDate(date);
                  const isSelected = selectedDays.has(dateKey);
                  const hasContent = dayItems.length > 0;
                  const counts = getPublicationCounts(dayItems);
                  const statusBorder = getDayStatusBorder(dayItems);
                  const statusBg = getDayStatusBg(dayItems);
                  const statusSummary = hasContent ? getStatusSummary(dayItems) : null;

                  return (
                    <div
                      key={dateKey}
                      onClick={() => inPeriod && handleDayClick(date, dayItems)}
                      className={cn(
                        "min-h-[100px] p-1 rounded-md border-2 transition-all relative",
                        inPeriod ? "cursor-pointer hover:shadow-md" : "bg-muted/30 border-transparent",
                        isSelected && "bg-primary/20 border-primary border-dashed",
                        hasContent && inPeriod && !isSelected && statusBorder,
                        hasContent && inPeriod && !isSelected && statusBg,
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
                          {/* Channel type badges */}
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

                          {/* Status dots row */}
                          {statusSummary && (
                            <div className="flex items-center gap-1 px-1 flex-wrap">
                              {statusSummary.published > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0.5">
                                      <div className="w-2 h-2 rounded-full bg-green-500" />
                                      <span className="text-[9px] font-medium text-green-700 dark:text-green-400">{statusSummary.published}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p>{statusSummary.published} publicado(s)</p></TooltipContent>
                                </Tooltip>
                              )}
                              {statusSummary.scheduled > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0.5">
                                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                                      <span className="text-[9px] font-medium text-blue-700 dark:text-blue-400">{statusSummary.scheduled}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p>{statusSummary.scheduled} agendado(s)</p></TooltipContent>
                                </Tooltip>
                              )}
                              {statusSummary.approved > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0.5">
                                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                                      <span className="text-[9px] font-medium text-amber-700 dark:text-amber-400">{statusSummary.approved}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p>{statusSummary.approved} aprovado(s)</p></TooltipContent>
                                </Tooltip>
                              )}
                              {statusSummary.failed > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0.5">
                                      <div className="w-2 h-2 rounded-full bg-red-500" />
                                      <span className="text-[9px] font-medium text-red-700 dark:text-red-400">{statusSummary.failed}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p>{statusSummary.failed} com erro(s)</p></TooltipContent>
                                </Tooltip>
                              )}
                              {statusSummary.draft > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-0.5">
                                      <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                      <span className="text-[9px] font-medium text-muted-foreground">{statusSummary.draft}</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent><p>{statusSummary.draft} rascunho(s)</p></TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {!hasContent && inPeriod && !isSelected && (
                        <div className="text-xs text-muted-foreground/50 px-1 flex items-center gap-1 mt-2">
                          <Plus className="h-3 w-3" />
                          {isSelectMode ? "Selecionar" : "Adicionar"}
                        </div>
                      )}
                      {!hasContent && isSelected && (
                        <div className="text-xs text-primary/70 px-1 flex items-center gap-1 mt-2">
                          <Check className="h-3 w-3" />Selecionado
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-xs text-muted-foreground font-medium">Legenda:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">Rascunho</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-xs text-muted-foreground">Aprovado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-xs text-muted-foreground">Agendado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">Publicado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-xs text-muted-foreground">Com Erro</span>
        </div>
      </div>

      {/* Dialogs */}
      <PublicationDialog
        open={dialogOpen} onOpenChange={setDialogOpen}
        date={selectedDate} campaignId={campaignId!}
        existingItems={currentDateItems} editItem={editItem}
        campaignStartDate={campaign?.start_date}
        campaignType={campaign?.target_channel === "blog" ? "blog" : campaign?.target_channel === "youtube" ? "youtube" : "social"}
        onBackToList={() => { if (selectedDate) { setDayListDate(selectedDate); setDayListOpen(true); } }}
      />

      {dayListDate && (
        <DayPostsList
          open={dayListOpen} onOpenChange={setDayListOpen}
          date={dayListDate} items={dayListItems}
          onEditItem={handleEditItem} onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem} onDuplicateItem={handleDuplicateItem}
        />
      )}

      <ApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        items={readyToApproveItems}
        onApprove={handleApproveSelected}
        isApproving={isApproving}
      />

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
                placeholder="Ex: Campanha de Natal com foco em presentes masculinos, tom premium, destacar produtos X e Y, CTA para WhatsApp..."
                className="min-h-[120px] mt-1.5"
                value={strategyPrompt}
                onChange={(e) => setStrategyPrompt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                A IA vai usar as informações da sua loja (produtos, categorias, promoções) automaticamente. Aqui você define o direcionamento específico.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setStrategyPromptOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateStrategy} disabled={isGenerating}>
              {isGenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" />Gerar Estratégia</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
