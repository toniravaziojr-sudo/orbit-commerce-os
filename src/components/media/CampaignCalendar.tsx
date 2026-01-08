import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, Sparkles, Image, Check, Loader2, Send, AlertCircle, MousePointer2, Instagram, Facebook, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useMediaCampaigns, useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { PublicationDialog } from "./PublicationDialog";
import { DayPostsList } from "./DayPostsList";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { useLateConnection } from "@/hooks/useLateConnection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getHolidayForDate } from "@/lib/brazilian-holidays";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Status simplificados conforme solicitado
const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  published: "bg-green-600 text-white",
  failed: "bg-destructive/10 text-destructive",
  // Mapear status antigos para novos
  suggested: "bg-muted text-muted-foreground",
  review: "bg-muted text-muted-foreground",
  generating_asset: "bg-muted text-muted-foreground",
  asset_review: "bg-muted text-muted-foreground",
  publishing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  skipped: "bg-muted text-muted-foreground line-through",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  approved: "Aprovado",
  scheduled: "Agendado",
  published: "Publicado",
  failed: "Com Erros",
};

// Ícones de publicação por tipo e canal
const getPublicationIcon = (item: MediaCalendarItem) => {
  const platforms = item.target_platforms || [];
  const type = item.content_type;

  // Blog
  if (type === "text" || platforms.includes("blog")) {
    return { icon: Newspaper, color: "text-emerald-600", label: "Blog" };
  }

  // Story
  if (type === "story") {
    return { icon: () => <span className="font-bold text-orange-500 text-xs">S</span>, color: "text-orange-500", label: "Story" };
  }

  // Feed Instagram
  if (platforms.includes("instagram")) {
    return { icon: Instagram, color: "text-pink-600", label: "Instagram" };
  }

  // Feed Facebook
  if (platforms.includes("facebook")) {
    return { icon: Facebook, color: "text-blue-600", label: "Facebook" };
  }

  // Default
  return { icon: Image, color: "text-muted-foreground", label: "Post" };
};

export function CampaignCalendar() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const { campaigns } = useMediaCampaigns();
  const { items, isLoading, refetch: refetchItems, deleteItem } = useMediaCalendarItems(campaignId);
  const { isConnected: lateConnected, isLoading: lateLoading } = useLateConnection();
  
  const campaign = campaigns?.find((c) => c.id === campaignId);
  
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (campaign?.start_date) {
      return startOfMonth(parseISO(campaign.start_date));
    }
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
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: monthStart, end: monthEnd });
  }, [currentMonth]);

  const campaignInterval = useMemo(() => {
    if (!campaign) return null;
    return {
      start: parseISO(campaign.start_date),
      end: parseISO(campaign.end_date),
    };
  }, [campaign]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, MediaCalendarItem[]>();
    items?.forEach((item) => {
      const key = item.scheduled_date;
      const existing = map.get(key) || [];
      map.set(key, [...existing, item]);
    });
    return map;
  }, [items]);

  const stats = useMemo(() => {
    if (!items) return { total: 0, draft: 0, approved: 0, scheduled: 0 };
    return {
      total: items.length,
      draft: items.filter(i => ["draft", "suggested", "review"].includes(i.status)).length,
      approved: items.filter(i => i.status === "approved").length,
      scheduled: items.filter(i => ["scheduled", "published"].includes(i.status)).length,
    };
  }, [items]);

  const isInCampaignPeriod = (date: Date) => {
    if (!campaignInterval) return false;
    return isWithinInterval(date, campaignInterval);
  };

  const toggleDaySelection = (dateKey: string) => {
    setSelectedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  const handleDayClick = (date: Date, dayItems: MediaCalendarItem[]) => {
    if (!isInCampaignPeriod(date)) return;
    
    const dateKey = format(date, "yyyy-MM-dd");
    
    if (isSelectMode) {
      toggleDaySelection(dateKey);
      return;
    }
    
    // Se tem itens, abre lista para ver/editar
    if (dayItems.length > 0) {
      setDayListDate(date);
      setDayListOpen(true);
    } else {
      // Se não tem, abre dialog para criar
      setSelectedDate(date);
      setEditItem(null);
      setDialogOpen(true);
    }
  };

  const handleAddItem = (date: Date) => {
    setSelectedDate(date);
    setEditItem(null);
    setDialogOpen(true);
  };

  const handleEditItem = (item: MediaCalendarItem) => {
    const itemDate = parseISO(item.scheduled_date);
    setSelectedDate(itemDate);
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

  // Criar Estratégia IA
  const handleGenerateStrategy = async () => {
    if (!currentTenant || !campaignId) return;
    
    if (selectedDays.size === 0) {
      toast.info("Selecione os dias no calendário antes de gerar conteúdo");
      setIsSelectMode(true);
      return;
    }
    
    const targetDates = Array.from(selectedDays);
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("media-generate-suggestions", {
        body: { 
          campaign_id: campaignId, 
          tenant_id: currentTenant.id,
          target_dates: targetDates,
        },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success(data.message || "Estratégia gerada com sucesso!");
        setSelectedDays(new Set());
        setIsSelectMode(false);
        await refetchItems();
        queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
      } else {
        toast.error(data?.error || "Erro ao gerar estratégia");
      }
    } catch (err) {
      console.error("Error generating strategy:", err);
      toast.error("Erro ao gerar estratégia. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Gerar Criativos
  const handleGenerateCreatives = async () => {
    if (!items || !currentTenant) return;
    
    const eligibleItems = items.filter(i => 
      (i.status === "draft" || i.status === "approved") && !i.asset_url
    );
    
    if (eligibleItems.length === 0) {
      toast.info("Nenhum item sem criativo para gerar");
      return;
    }
    
    setIsGeneratingAssets(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const item of eligibleItems) {
        const { data, error } = await supabase.functions.invoke("media-generate-image", {
          body: { 
            calendar_item_id: item.id,
            variant_count: 1,
            use_packshot: false,
          },
        });

        if (error || !data?.success) {
          errorCount++;
        } else {
          successCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} criativo(s) sendo gerado(s)!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} item(ns) falharam`);
      }
      
      await refetchItems();
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
    } catch (err) {
      toast.error("Erro ao gerar criativos");
    } finally {
      setIsGeneratingAssets(false);
    }
  };

  // Agendar Publicações
  const handleScheduleAll = async () => {
    if (!items || !currentTenant) return;
    
    if (!lateConnected) {
      toast.error("Conecte suas redes sociais primeiro", {
        action: {
          label: "Conectar",
          onClick: () => navigate("/integrations"),
        },
      });
      return;
    }
    
    const approvedItems = items.filter(i => i.status === "approved" || i.status === "draft");
    if (approvedItems.length === 0) {
      toast.info("Nenhum item para agendar");
      return;
    }
    
    setIsScheduling(true);
    
    try {
      const itemIds = approvedItems.map(i => i.id);
      
      const { data, error } = await supabase.functions.invoke("late-schedule-post", {
        body: { 
          calendar_item_ids: itemIds,
          tenant_id: currentTenant.id,
        },
      });

      if (error) {
        toast.error("Erro ao agendar publicações");
      } else if (data?.success) {
        if (data.scheduled > 0) {
          toast.success(`${data.scheduled} publicação(ões) agendada(s)!`);
        }
        if (data.failed > 0) {
          toast.error(`${data.failed} item(ns) falharam`);
        }
      } else {
        toast.error(data?.error || "Erro ao agendar");
      }
      
      await refetchItems();
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
    } catch (err) {
      toast.error("Erro ao agendar");
    } finally {
      setIsScheduling(false);
    }
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Campanha não encontrada</p>
      </div>
    );
  }

  const weekDayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const hasSuggestions = items && items.length > 0;
  const dayListItems = dayListDate ? itemsByDate.get(format(dayListDate, "yyyy-MM-dd")) || [] : [];
  const currentDateItems = selectedDate ? itemsByDate.get(format(selectedDate, "yyyy-MM-dd")) || [] : [];

  // Função para agrupar e contar publicações por tipo/canal
  const getPublicationCounts = (dayItems: MediaCalendarItem[]) => {
    const counts = {
      instagram: 0,
      facebook: 0,
      story: 0,
      blog: 0,
    };

    dayItems.forEach(item => {
      const platforms = item.target_platforms || [];
      if (item.content_type === "story") {
        counts.story++;
      } else if (item.content_type === "text" || platforms.includes("blog")) {
        counts.blog++;
      } else {
        if (platforms.includes("instagram")) counts.instagram++;
        if (platforms.includes("facebook")) counts.facebook++;
      }
    });

    return counts;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={campaign.name}
        description={campaign.prompt}
        actions={
          <Button variant="outline" onClick={() => navigate("/media")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      {/* Action Buttons */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Selecionar Dias */}
            <Button 
              variant={isSelectMode ? "default" : "outline"}
              onClick={() => setIsSelectMode(!isSelectMode)}
              className="gap-2"
            >
              <MousePointer2 className="h-4 w-4" />
              {isSelectMode ? `Selecionando (${selectedDays.size})` : "Selecionar Cards"}
            </Button>

            {selectedDays.size > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setSelectedDays(new Set());
                  setIsSelectMode(false);
                }}
              >
                Limpar
              </Button>
            )}

            {/* Criar Estratégia IA */}
            <Button 
              onClick={handleGenerateStrategy}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? "Gerando..." : "Criar Estratégia IA"}
            </Button>

            {/* Gerar Criativos */}
            {hasSuggestions && (
              <>
                <Button 
                  variant="outline"
                  onClick={handleGenerateCreatives}
                  disabled={isGeneratingAssets}
                  className="gap-2"
                >
                  {isGeneratingAssets ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Image className="h-4 w-4" />
                  )}
                  Gerar Criativos
                </Button>

                {/* Agendar Publicações */}
                <Button 
                  variant={lateConnected ? "outline" : "secondary"}
                  onClick={handleScheduleAll}
                  disabled={isScheduling}
                  className="gap-2"
                >
                  {isScheduling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : lateConnected ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  Agendar Publicações
                </Button>
              </>
            )}

            <div className="ml-auto flex gap-4 text-sm text-muted-foreground">
              <span>{stats.total} itens</span>
              <span>{stats.approved} aprovados</span>
              <span>{stats.scheduled} agendados</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Connection Alert */}
      {!lateLoading && !lateConnected && hasSuggestions && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-200">
              Para publicar nas redes sociais, conecte suas contas.
            </span>
            <Button size="sm" variant="outline" onClick={() => navigate("/integrations")} className="ml-4">
              Conectar Canais
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
                  <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
                
                {Array.from({ length: days[0].getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[100px] bg-muted/30 rounded-md" />
                ))}
                
                {days.map((date) => {
                  const dateKey = format(date, "yyyy-MM-dd");
                  const dayItems = itemsByDate.get(dateKey) || [];
                  const inPeriod = isInCampaignPeriod(date);
                  const isClickable = inPeriod;
                  const holiday = getHolidayForDate(date);
                  const isSelected = selectedDays.has(dateKey);
                  const hasContent = dayItems.length > 0;
                  const counts = getPublicationCounts(dayItems);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => isClickable && handleDayClick(date, dayItems)}
                      className={cn(
                        "min-h-[100px] p-1 rounded-md border-2 transition-all relative",
                        inPeriod ? "cursor-pointer hover:shadow-md" : "bg-muted/30 border-transparent",
                        // Selecionado para IA
                        isSelected && "bg-primary/20 border-primary border-dashed",
                        // Com conteúdo
                        hasContent && inPeriod && !isSelected && "bg-primary/10 border-primary",
                        // Normal
                        !isSelected && !hasContent && inPeriod && "bg-background border-border",
                        // Feriado
                        holiday && inPeriod && "ring-2 ring-red-400/50",
                        // Select mode
                        isSelectMode && inPeriod && "cursor-cell"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-medium p-1 flex items-center gap-1",
                        !inPeriod && "text-muted-foreground/50",
                        (isSelected || hasContent) && "text-primary font-semibold"
                      )}>
                        {format(date, "d")}
                        {isSelected && !hasContent && (
                          <Check className="h-3 w-3 text-primary" />
                        )}
                        {holiday && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{holiday.emoji}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{holiday.name}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      
                      {/* Ícones de publicações */}
                      {hasContent && (
                        <div className="flex flex-wrap gap-1 mt-1 px-1">
                          {counts.instagram > 0 && (
                            <div className="flex items-center gap-0.5 bg-pink-100 dark:bg-pink-900/30 rounded px-1">
                              <Instagram className="h-3 w-3 text-pink-600" />
                              <span className="text-xs font-medium text-pink-700 dark:text-pink-300">{counts.instagram}</span>
                            </div>
                          )}
                          {counts.facebook > 0 && (
                            <div className="flex items-center gap-0.5 bg-blue-100 dark:bg-blue-900/30 rounded px-1">
                              <Facebook className="h-3 w-3 text-blue-600" />
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{counts.facebook}</span>
                            </div>
                          )}
                          {counts.story > 0 && (
                            <div className="flex items-center gap-0.5 bg-orange-100 dark:bg-orange-900/30 rounded px-1">
                              <span className="text-xs font-bold text-orange-600">S</span>
                              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">{counts.story}</span>
                            </div>
                          )}
                          {counts.blog > 0 && (
                            <div className="flex items-center gap-0.5 bg-emerald-100 dark:bg-emerald-900/30 rounded px-1">
                              <Newspaper className="h-3 w-3 text-emerald-600" />
                              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">{counts.blog}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Placeholder para dias vazios */}
                      {!hasContent && isClickable && !isSelected && (
                        <div className="text-xs text-muted-foreground/50 px-1 flex items-center gap-1 mt-2">
                          <Plus className="h-3 w-3" />
                          {isSelectMode ? "Selecionar" : "Adicionar"}
                        </div>
                      )}
                      {!hasContent && isSelected && (
                        <div className="text-xs text-primary/70 px-1 flex items-center gap-1 mt-2">
                          <Sparkles className="h-3 w-3" />
                          Para IA
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

      {/* Legenda simplificada */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground">Legenda:</span>
        {Object.entries(statusLabels).map(([status, label]) => (
          <Badge key={status} className={cn("text-xs", statusColors[status])}>
            {label}
          </Badge>
        ))}
      </div>

      {/* Dialog de criação/edição de publicação */}
      <PublicationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={selectedDate}
        campaignId={campaignId!}
        existingItems={currentDateItems}
        editItem={editItem}
      />

      {/* Dialog de lista de posts do dia */}
      {dayListDate && (
        <DayPostsList
          open={dayListOpen}
          onOpenChange={setDayListOpen}
          date={dayListDate}
          items={dayListItems}
          onEditItem={handleEditItem}
          onAddItem={handleAddItem}
          onDeleteItem={handleDeleteItem}
        />
      )}
    </div>
  );
}
