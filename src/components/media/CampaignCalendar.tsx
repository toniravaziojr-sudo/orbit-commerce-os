import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ArrowLeft, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { useMediaCampaigns, useMediaCalendarItems, MediaCalendarItem } from "@/hooks/useMediaCampaigns";
import { CalendarItemDialog } from "./CalendarItemDialog";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  suggested: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  generating_asset: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  scheduled: "bg-primary/10 text-primary",
  publishing: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  published: "bg-green-600 text-white",
  failed: "bg-destructive/10 text-destructive",
  skipped: "bg-muted text-muted-foreground line-through",
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
  const { campaigns } = useMediaCampaigns();
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
      // Multiple items - show first one for now
      setSelectedItem(dayItems[0]);
      setSelectedDate(null);
    }
    setDialogOpen(true);
  };

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Campanha não encontrada</p>
      </div>
    );
  }

  const weekDayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={campaign.name}
        description={campaign.prompt}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/media")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button disabled className="gap-2">
              <Sparkles className="h-4 w-4" />
              Gerar Sugestões com IA
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Week day headers */}
              {weekDayHeaders.map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              
              {/* Empty cells for days before month start */}
              {Array.from({ length: days[0].getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] bg-muted/30 rounded-md" />
              ))}
              
              {/* Calendar days */}
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
                    
                    {/* Items for this day */}
                    <div className="space-y-1">
                      {dayItems.slice(0, 2).map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded truncate",
                            statusColors[item.status]
                          )}
                        >
                          <span className="mr-1">{contentTypeIcons[item.content_type]}</span>
                          {item.title || "Sem título"}
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
        {Object.entries(statusColors).slice(0, 6).map(([status, color]) => (
          <Badge key={status} className={cn("text-xs", color)}>
            {status.replace("_", " ")}
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
