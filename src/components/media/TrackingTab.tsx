import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, LayoutGrid, FileText, BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MediaCalendarItem, MediaCampaign } from "@/hooks/useMediaCampaigns";
import { getHolidayForDate } from "@/lib/brazilian-holidays";

interface TrackingTabProps {
  campaignId: string;
  campaign: MediaCampaign;
  items: MediaCalendarItem[] | undefined;
  isLoading: boolean;
  itemsByDate: Map<string, MediaCalendarItem[]>;
  onEditItem: (item: MediaCalendarItem) => void;
  onDuplicateItem: (item: MediaCalendarItem) => void;
  onOpenDayList: (date: Date) => void;
  onReplaceScheduled: (item: MediaCalendarItem) => void;
}

// Operational statuses to show in tracking
const TRACKING_STATUSES = ["scheduled", "publishing", "published", "failed", "partially_published", "partially_failed", "retry_pending", "superseded", "canceled"];

export function TrackingTab({
  campaignId, campaign, items, isLoading, itemsByDate,
  onEditItem, onDuplicateItem, onOpenDayList, onReplaceScheduled,
}: TrackingTabProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (campaign?.start_date) return startOfMonth(parseISO(campaign.start_date));
    return startOfMonth(new Date());
  });

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);

  const campaignInterval = useMemo(() => {
    if (!campaign) return null;
    return { start: parseISO(campaign.start_date), end: parseISO(campaign.end_date) };
  }, [campaign]);

  const isInCampaignPeriod = (date: Date) => campaignInterval ? isWithinInterval(date, campaignInterval) : false;

  // Only tracking items
  const trackingItemsByDate = useMemo(() => {
    const map = new Map<string, MediaCalendarItem[]>();
    items?.filter(i => TRACKING_STATUSES.includes(i.status)).forEach((item) => {
      const key = item.scheduled_date;
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [items]);

  // Summary stats
  const stats = useMemo(() => {
    if (!items) return { published: 0, scheduled: 0, failed: 0, partial: 0 };
    const tracking = items.filter(i => TRACKING_STATUSES.includes(i.status));
    return {
      published: tracking.filter(i => i.status === "published").length,
      scheduled: tracking.filter(i => ["scheduled", "publishing", "retry_pending"].includes(i.status)).length,
      failed: tracking.filter(i => i.status === "failed").length,
      partial: tracking.filter(i => ["partially_published", "partially_failed"].includes(i.status)).length,
    };
  }, [items]);

  const getStatusSummary = (dayItems: MediaCalendarItem[]) => {
    const summary = { published: 0, scheduled: 0, failed: 0, partial: 0 };
    dayItems.forEach(item => {
      if (item.status === "published") summary.published++;
      else if (["scheduled", "publishing", "retry_pending"].includes(item.status)) summary.scheduled++;
      else if (item.status === "failed") summary.failed++;
      else if (["partially_published", "partially_failed"].includes(item.status)) summary.partial++;
    });
    return summary;
  };

  const getDayBorderColor = (dayItems: MediaCalendarItem[]) => {
    if (dayItems.length === 0) return "";
    const s = getStatusSummary(dayItems);
    if (s.failed > 0) return "border-red-500 dark:border-red-600";
    if (s.partial > 0) return "border-amber-500 dark:border-amber-600";
    if (s.published > 0 && s.published === dayItems.length) return "border-green-500 dark:border-green-600";
    if (s.scheduled > 0) return "border-blue-500 dark:border-blue-600";
    if (s.published > 0) return "border-green-500 dark:border-green-600";
    return "border-muted-foreground/30";
  };

  const getDayBg = (dayItems: MediaCalendarItem[]) => {
    if (dayItems.length === 0) return "";
    const s = getStatusSummary(dayItems);
    if (s.failed > 0) return "bg-red-50 dark:bg-red-950/20";
    if (s.partial > 0) return "bg-amber-50 dark:bg-amber-950/20";
    if (s.published > 0 && s.published === dayItems.length) return "bg-green-50 dark:bg-green-950/30";
    if (s.scheduled > 0) return "bg-blue-50 dark:bg-blue-950/20";
    if (s.published > 0) return "bg-green-50 dark:bg-green-950/30";
    return "";
  };

  const weekDayHeaders = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const hasTrackingItems = stats.published + stats.scheduled + stats.failed + stats.partial > 0;

  return (
    <div className="space-y-4">
      {!hasTrackingItems && !isLoading ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhuma publicação no acompanhamento"
          description="Quando itens forem publicados ou agendados, você poderá acompanhar o status aqui."
        />
      ) : (
        <>
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Publicados", count: stats.published, color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30", dot: "bg-green-500" },
          { label: "Agendados", count: stats.scheduled, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", dot: "bg-blue-500" },
          { label: "Com Erro", count: stats.failed, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20", dot: "bg-red-500" },
          { label: "Parcial", count: stats.partial, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20", dot: "bg-amber-500" },
        ].map(stat => (
          <Card key={stat.label} className={cn("border-0", stat.bg)}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full", stat.dot)} />
              <div>
                <p className={cn("text-xl font-bold", stat.color)}>{stat.count}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar Grid - read only */}
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
                  const dayItems = trackingItemsByDate.get(dateKey) || [];
                  const inPeriod = isInCampaignPeriod(date);
                  const holiday = getHolidayForDate(date);
                  const hasContent = dayItems.length > 0;
                  const statusSummary = hasContent ? getStatusSummary(dayItems) : null;
                  const borderColor = getDayBorderColor(dayItems);
                  const bgColor = getDayBg(dayItems);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => inPeriod && hasContent && onOpenDayList(date)}
                      className={cn(
                        "min-h-[90px] p-1 rounded-md border-2 transition-all relative",
                        inPeriod && hasContent ? "cursor-pointer hover:shadow-md" : "",
                        inPeriod ? "" : "bg-muted/30 border-transparent",
                        hasContent && inPeriod && borderColor,
                        hasContent && inPeriod && bgColor,
                        !hasContent && inPeriod && "bg-background border-border",
                        holiday && inPeriod && "ring-2 ring-red-400/50"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-medium p-1 flex items-center gap-1",
                        !inPeriod && "text-muted-foreground/50",
                        hasContent && "font-semibold"
                      )}>
                        {format(date, "d")}
                        {holiday && (
                          <Tooltip>
                            <TooltipTrigger asChild><span className="cursor-help">{holiday.emoji}</span></TooltipTrigger>
                            <TooltipContent><p className="font-medium">{holiday.name}</p></TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      {statusSummary && (
                        <div className="flex items-center gap-1 px-1 flex-wrap mt-1">
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
                          {statusSummary.partial > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-0.5">
                                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                                  <span className="text-[9px] font-medium text-amber-700 dark:text-amber-400">{statusSummary.partial}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent><p>{statusSummary.partial} parcial(is)</p></TooltipContent>
                            </Tooltip>
                          )}
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
        {[
          { color: "bg-green-500", label: "Publicado" },
          { color: "bg-blue-500", label: "Agendado" },
          { color: "bg-amber-500", label: "Parcial" },
          { color: "bg-red-500", label: "Com Erro" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-full", l.color)} />
            <span className="text-xs text-muted-foreground">{l.label}</span>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}