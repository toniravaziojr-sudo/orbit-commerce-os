import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, Sparkles, Image, Calendar as CalendarIcon, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useMediaCampaigns, useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { CalendarItemDialog } from "./CalendarItemDialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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
  video: "🎬",
  carousel: "📸",
  story: "📱",
  reel: "🎞️",
  text: "📝",
};

export function CampaignCalendar() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { currentTenant } = useAuth();
  const { campaigns, updateCampaign } = useMediaCampaigns();
  const { items, isLoading } = useMediaCalendarItems(campaignId);
  
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
  const [isGenerating, setIsGenerating] = useState(false);

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
    
    if (dayItems.length === 1) {
      setSelectedItem(dayItems[0]);
      setSelectedDate(null);
    } else if (dayItems.length === 0) {
      setSelectedItem(null);
      setSelectedDate(date);
    } else {
      setSelectedItem(dayItems[0]);
      setSelectedDate(null);
    }
    setDialogOpen(true);
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
        // Refresh will happen via react-query invalidation
      } else {
        toast.error(data?.error || "Erro ao gerar sugestões");
      }
    } catch (err) {
      console.error("Error generating suggestions:", err);
      toast.error("Erro ao gerar sugestões");
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
    
    try {
      for (const item of suggestedItems) {
        await supabase
          .from("media_calendar_items")
          .update({ status: "approved" })
          .eq("id", item.id);
      }
      toast.success(`${suggestedItems.length} itens aprovados!`);
    } catch (err) {
      toast.error("Erro ao aprovar itens");
    }
  };

  const handleGenerateAssets = async () => {
    toast.info("Geração de assets será implementada em breve. Os itens aprovados serão processados quando a integração estiver disponível.");
  };

  const handleScheduleAll = async () => {
    if (!items) return;
    const approvedItems = items.filter(i => i.status === "approved" || i.status === "asset_review");
    if (approvedItems.length === 0) {
      toast.info("Nenhum item aprovado para agendar");
      return;
    }
    
    try {
      for (const item of approvedItems) {
        await supabase
          .from("media_calendar_items")
          .update({ status: "scheduled" })
          .eq("id", item.id);
      }
      toast.success(`${approvedItems.length} itens agendados!`);
      toast.info("A publicação real será feita quando as integrações com redes sociais estiverem conectadas.");
    } catch (err) {
      toast.error("Erro ao agendar itens");
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
  const hasApproved = stats.approved > 0;

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
              {isGenerating ? "Gerando..." : "Gerar Sugestões com IA"}
            </Button>

            {hasSuggestions && (
              <>
                <Button 
                  variant="outline"
                  onClick={handleApproveAll}
                  className="gap-2"
                >
                  <Check className="h-4 w-4" />
                  Aprovar Todos ({stats.suggested})
                </Button>

                <Button 
                  variant="outline"
                  onClick={handleGenerateAssets}
                  disabled={stats.approved === 0}
                  className="gap-2"
                >
                  <Image className="h-4 w-4" />
                  Gerar Criativos
                </Button>

                <Button 
                  variant="outline"
                  onClick={handleScheduleAll}
                  disabled={stats.approved === 0}
                  className="gap-2"
                >
                  <CalendarIcon className="h-4 w-4" />
                  Agendar Publicações
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

                return (
                  <div
                    key={dateKey}
                    onClick={() => isClickable && handleDayClick(date, dayItems)}
                    className={cn(
                      "min-h-[100px] p-1 rounded-md border transition-colors",
                      inPeriod && activeDay 
                        ? "bg-background border-border cursor-pointer hover:border-primary/50" 
                        : "bg-muted/30 border-transparent",
                      !activeDay && inPeriod && "bg-muted/10"
                    )}
                  >
                    <div className={cn(
                      "text-xs font-medium p-1",
                      !inPeriod && "text-muted-foreground/50",
                      !activeDay && "text-muted-foreground/30"
                    )}>
                      {format(date, "d")}
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

      <CalendarItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={selectedItem}
        date={selectedDate}
        campaignId={campaignId!}
      />
    </div>
  );
}
