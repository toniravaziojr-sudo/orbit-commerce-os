import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, Sparkles, Image, Check, Loader2, Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useMediaCampaigns, useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { CalendarItemDialog } from "./CalendarItemDialog";
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

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  suggested: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  generating_asset: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  asset_review: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  scheduled: "bg-primary/10 text-primary",
  publishing: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  published: "bg-green-600 text-white",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground line-through",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  suggested: "Sugerido",
  review: "Revisão",
  approved: "Aprovado",
  generating_asset: "Gerando",
  asset_review: "Revisar Asset",
  scheduled: "Agendado",
  publishing: "Publicando",
  published: "Publicado",
  failed: "Falha",
  skipped: "Ignorado",
};

const contentTypeIcons: Record<string, string> = {
  image: "🖼️",
  carousel: "📸",
  story: "📱",
  text: "📝",
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
  const [selectedItem, setSelectedItem] = useState<MediaCalendarItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dayListOpen, setDayListOpen] = useState(false);
  const [dayListDate, setDayListDate] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

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
    if (!items) return { total: 0, suggested: 0, approved: 0, withAsset: 0 };
    return {
      total: items.length,
      suggested: items.filter(i => i.status === "suggested").length,
      approved: items.filter(i => ["approved", "asset_review", "scheduled", "published"].includes(i.status)).length,
      withAsset: items.filter(i => i.asset_url).length,
    };
  }, [items]);

  const isInCampaignPeriod = (date: Date) => {
    if (!campaignInterval) return false;
    return isWithinInterval(date, campaignInterval);
  };

  const isActiveDay = (date: Date) => {
    if (!campaign?.days_of_week) return true;
    return campaign.days_of_week.includes(date.getDay());
  };

  const handleDayClick = (date: Date, dayItems: MediaCalendarItem[]) => {
    if (!isInCampaignPeriod(date) || !isActiveDay(date)) return;
    
    // Se tem mais de 1 item, abre lista de posts do dia
    if (dayItems.length > 1) {
      setDayListDate(date);
      setDayListOpen(true);
    } else if (dayItems.length === 1) {
      // Se tem 1 item, edita direto
      setSelectedItem(dayItems[0]);
      setSelectedDate(null);
      setDialogOpen(true);
    } else {
      // Se não tem item, cria novo
      setSelectedItem(null);
      setSelectedDate(date);
      setDialogOpen(true);
    }
  };

  const handleAddItem = (date: Date) => {
    setSelectedItem(null);
    setSelectedDate(date);
    setDialogOpen(true);
  };

  const handleEditItem = (item: MediaCalendarItem) => {
    setSelectedItem(item);
    setSelectedDate(null);
    setDialogOpen(true);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem.mutateAsync(id);
  };

  const handleGenerateSuggestions = async () => {
    if (!currentTenant || !campaignId) return;
    
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("media-generate-suggestions", {
        body: { campaign_id: campaignId, tenant_id: currentTenant.id },
      });

      if (error) throw error;
      
      if (data?.success) {
        toast.success(data.message || "Sugestões geradas com sucesso!");
        await refetchItems();
        queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
        queryClient.invalidateQueries({ queryKey: ["media-campaigns", currentTenant?.id] });
      } else {
        toast.error(data?.error || "Erro ao gerar sugestões");
      }
    } catch (err) {
      console.error("Error generating suggestions:", err);
      toast.error("Erro ao gerar sugestões. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveAll = async () => {
    if (!items) return;
    const suggestedItems = items.filter(i => i.status === "suggested" || i.status === "review");
    if (suggestedItems.length === 0) {
      toast.info("Nenhum item para aprovar");
      return;
    }
    
    setIsApproving(true);
    try {
      for (const item of suggestedItems) {
        await supabase
          .from("media_calendar_items")
          .update({ status: "approved" })
          .eq("id", item.id);
      }
      toast.success(`${suggestedItems.length} itens aprovados!`);
      await refetchItems();
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
    } catch (err) {
      toast.error("Erro ao aprovar itens");
    } finally {
      setIsApproving(false);
    }
  };

  const handleGenerateAssets = async () => {
    toast.info("Geração de criativos com IA será implementada em breve.");
  };

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
    
    const approvedItems = items.filter(i => i.status === "approved" || i.status === "asset_review");
    if (approvedItems.length === 0) {
      toast.info("Nenhum item aprovado para agendar");
      return;
    }
    
    setIsScheduling(true);
    let successCount = 0;
    let errorCount = 0;
    
    try {
      for (const item of approvedItems) {
        const { data, error } = await supabase.functions.invoke("late-schedule-post", {
          body: { 
            calendar_item_id: item.id,
            tenant_id: currentTenant.id,
          },
        });

        if (error || !data?.success) {
          console.error("Error scheduling item:", item.id, error || data?.error);
          errorCount++;
        } else {
          successCount++;
        }
      }
      
      if (successCount > 0) {
        toast.success(`${successCount} item(s) agendado(s) com sucesso!`);
      }
      if (errorCount > 0) {
        toast.error(`${errorCount} item(s) falharam ao agendar`);
      }
      
      await refetchItems();
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items", campaignId] });
    } catch (err) {
      console.error("Error scheduling items:", err);
      toast.error("Erro ao agendar itens");
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={campaign.name}
        description={campaign.prompt}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/media")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </div>
        }
      />

      {/* Action Buttons */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Button 
              onClick={handleGenerateSuggestions}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? "Gerando..." : "Gerar Copy com IA"}
            </Button>

            {hasSuggestions && (
              <>
                <Button 
                  variant="outline"
                  onClick={handleApproveAll}
                  disabled={isApproving || stats.suggested === 0}
                  className="gap-2"
                >
                  {isApproving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {isApproving ? "Aprovando..." : `Aprovar Todos (${stats.suggested})`}
                </Button>

                <Button 
                  variant="outline"
                  onClick={handleGenerateAssets}
                  disabled={stats.approved === 0}
                  className="gap-2"
                >
                  <Image className="h-4 w-4" />
                  Gerar Criativos com IA
                </Button>

                <Button 
                  variant={lateConnected ? "outline" : "secondary"}
                  onClick={handleScheduleAll}
                  disabled={stats.approved === 0 || isScheduling}
                  className="gap-2"
                >
                  {isScheduling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : lateConnected ? (
                    <Send className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {isScheduling ? "Agendando..." : lateConnected ? "Agendar Publicações" : "Conectar Canais"}
                </Button>
              </>
            )}

            <div className="ml-auto flex gap-4 text-sm text-muted-foreground">
              <span>{stats.total} itens</span>
              <span>{stats.approved} aprovados</span>
              <span>{stats.withAsset} com asset</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Channel Connection Alert */}
      {!lateLoading && !lateConnected && hasSuggestions && stats.approved > 0 && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-amber-800 dark:text-amber-200">
              Para publicar nas redes sociais, conecte suas contas de Facebook e Instagram.
            </span>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate("/integrations")}
              className="ml-4"
            >
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
                  const activeDay = isActiveDay(date);
                  const isClickable = inPeriod && activeDay;
                  const holiday = getHolidayForDate(date);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => isClickable && handleDayClick(date, dayItems)}
                      className={cn(
                        "min-h-[100px] p-1 rounded-md border transition-colors relative",
                        inPeriod && activeDay 
                          ? "bg-background border-border cursor-pointer hover:border-primary/50" 
                          : "bg-muted/30 border-transparent",
                        !activeDay && inPeriod && "bg-muted/10",
                        holiday && inPeriod && "ring-1 ring-amber-400/50"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-medium p-1 flex items-center gap-1",
                        !inPeriod && "text-muted-foreground/50",
                        !activeDay && "text-muted-foreground/30"
                      )}>
                        {format(date, "d")}
                        {holiday && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">{holiday.emoji}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{holiday.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{holiday.type}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                        {dayItems.slice(0, 2).map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1",
                              statusColors[item.status]
                            )}
                          >
                            <span>{contentTypeIcons[item.content_type]}</span>
                            <span className="truncate">{item.title || "Sem título"}</span>
                            {item.asset_url && <span className="ml-auto">📎</span>}
                          </div>
                        ))}
                        {dayItems.length > 2 && (
                          <div className="text-xs text-muted-foreground px-1">
                            +{dayItems.length - 2} mais
                          </div>
                        )}
                        {dayItems.length === 0 && isClickable && (
                          <div className="text-xs text-muted-foreground/50 px-1 flex items-center gap-1">
                            <Plus className="h-3 w-3" />
                            Adicionar
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <div className="text-xs text-muted-foreground">Legenda:</div>
        {Object.entries(statusLabels).slice(0, 8).map(([status, label]) => (
          <Badge key={status} className={cn("text-xs", statusColors[status])}>
            {label}
          </Badge>
        ))}
      </div>

      {/* Dialog para editar/criar item individual */}
      <CalendarItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={selectedItem}
        date={selectedDate}
        campaignId={campaignId!}
        selectedChannels={(campaign?.metadata as any)?.selected_channels || []}
      />

      {/* Dialog para listar posts de um dia (múltiplas postagens) */}
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
