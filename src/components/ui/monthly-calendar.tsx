// =============================================
// MONTHLY CALENDAR — Base component for all monthly grid calendars
// Centralises: month navigation, grid layout, week headers, empty cells, holidays, loading
// Each consumer provides its own cell content via render prop
// =============================================

import { useState, useMemo, ReactNode } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths, 
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getHolidayForDate, type BrazilianHoliday } from "@/lib/brazilian-holidays";

import { isTodayBR, formatMonthYearBR } from "@/lib/date-format";

export type Holiday = BrazilianHoliday;

export interface DayCellInfo {
  date: Date;
  dateKey: string;
  isToday: boolean;
  holiday: Holiday | null;
}

export interface MonthlyCalendarProps {
  /** Initial month to display. Defaults to current month. */
  initialMonth?: Date;
  /** External control of current month (controlled mode) */
  currentMonth?: Date;
  onMonthChange?: (month: Date) => void;
  /** Loading state — shows skeleton grid */
  isLoading?: boolean;
  /** Custom loading element. If omitted, shows default skeleton grid. */
  loadingElement?: ReactNode;
  /** Minimum cell height. Default: 100px */
  cellMinHeight?: string;
  /** Header right-side extra content (stats badges, etc.) */
  headerRight?: ReactNode;
  /** Title override. Default: "MMMM yyyy" */
  title?: string;
  /** Extra content between header and grid */
  headerExtra?: ReactNode;
  /** Render prop for each day cell */
  renderCell: (info: DayCellInfo) => ReactNode;
  /** Whether to wrap in a Card. Default: true */
  wrapInCard?: boolean;
  /** Extra class on the outer container */
  className?: string;
}

const WEEK_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthlyCalendar({
  initialMonth,
  currentMonth: controlledMonth,
  onMonthChange,
  isLoading = false,
  loadingElement,
  cellMinHeight = "100px",
  headerRight,
  title,
  headerExtra,
  renderCell,
  wrapInCard = true,
  className,
}: MonthlyCalendarProps) {
  const [internalMonth, setInternalMonth] = useState(() =>
    controlledMonth ?? initialMonth ?? startOfMonth(new Date())
  );

  const currentMonth = controlledMonth ?? internalMonth;

  const setMonth = (m: Date) => {
    setInternalMonth(m);
    onMonthChange?.(m);
  };

  const days = useMemo(() => {
    const ms = startOfMonth(currentMonth);
    const me = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: ms, end: me });
  }, [currentMonth]);

  const displayTitle = title ?? formatMonthYearBR(currentMonth);

  const emptyCellCount = days[0]?.getDay() ?? 0;

  // ── Navigation ──
  const navigation = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={() => setMonth(subMonths(currentMonth, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[160px] text-center font-medium capitalize">
        {displayTitle}
      </span>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setMonth(addMonths(currentMonth, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );

  // ── Grid ──
  const grid = isLoading ? (
    loadingElement ?? (
      <div className="grid grid-cols-7 gap-1">
        {WEEK_HEADERS.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="rounded-md" style={{ minHeight: cellMinHeight }} />
        ))}
      </div>
    )
  ) : (
    <TooltipProvider>
      <div className="grid grid-cols-7 gap-1">
        {WEEK_HEADERS.map((d) => (
          <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}

        {/* Empty cells before month start */}
        {Array.from({ length: emptyCellCount }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="bg-muted/30 rounded-md"
            style={{ minHeight: cellMinHeight }}
          />
        ))}

        {/* Day cells — delegated to consumer */}
        {days.map((date) => {
          const dateKey = format(date, "yyyy-MM-dd");
          const holiday = getHolidayForDate(date);
          const today = isTodayBR(date);

          return (
            <div key={dateKey} style={{ minHeight: cellMinHeight }}>
              {renderCell({ date, dateKey, isToday: today, holiday })}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );

  if (!wrapInCard) {
    return (
      <div className={className}>
        <div className="flex items-center justify-between mb-4">
          {headerRight ? (
            <>
              <div className="flex items-center gap-4">{headerRight}</div>
              {navigation}
            </>
          ) : (
            <>
              <div />
              {navigation}
            </>
          )}
        </div>
        {headerExtra}
        {grid}
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          {headerRight ? (
            <>
              <div className="flex items-center gap-4">{headerRight}</div>
              {navigation}
            </>
          ) : (
            <>
              <CardTitle className="text-lg capitalize">{displayTitle}</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {headerExtra}
        {grid}
      </CardContent>
    </Card>
  );
}

/**
 * Renders the standard day number + holiday emoji tooltip.
 * Re-usable inside any renderCell implementation.
 */
export function DayHeader({
  date,
  holiday,
  isToday: today,
  className: extraClass,
  children,
}: {
  date: Date;
  holiday: Holiday | null;
  isToday: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-xs font-medium p-1 flex items-center gap-1",
        today && "text-primary font-bold",
        extraClass
      )}
    >
      {format(date, "d")}
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
      {children}
    </div>
  );
}
