import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, AlertTriangle, XCircle, FileText, Image, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { MediaCalendarItem } from "@/hooks/useMediaCampaigns";

interface SelectionDiagnosticsProps {
  selectedDays: Set<string>;
  planningItemsByDate: Map<string, MediaCalendarItem[]>;
  isBlog?: boolean;
}

interface DiagnosticResult {
  ready: MediaCalendarItem[];
  missingCopy: MediaCalendarItem[];
  missingCreative: MediaCalendarItem[];
  noStrategy: MediaCalendarItem[];
  totalSelected: number;
  readyDays: string[];
  missingCopyDays: string[];
  missingCreativeDays: string[];
  noStrategyDays: string[];
  emptyDays: string[];
  canGenerateCopys: boolean;
  canGenerateCreatives: boolean;
  copyBlockReason: string | null;
  creativeBlockReason: string | null;
}

function formatDayList(dateKeys: string[]): string {
  return dateKeys
    .map(dk => {
      try {
        return format(parseISO(dk), "d 'de' MMM", { locale: ptBR });
      } catch {
        return dk;
      }
    })
    .join(", ");
}

function getDiagnostics(
  selectedDays: Set<string>,
  planningItemsByDate: Map<string, MediaCalendarItem[]>,
  isBlog: boolean
): DiagnosticResult {
  const ready: MediaCalendarItem[] = [];
  const missingCopy: MediaCalendarItem[] = [];
  const missingCreative: MediaCalendarItem[] = [];
  const noStrategy: MediaCalendarItem[] = [];
  const readyDaysSet = new Set<string>();
  const missingCopyDaysSet = new Set<string>();
  const missingCreativeDaysSet = new Set<string>();
  const noStrategyDaysSet = new Set<string>();
  const emptyDays: string[] = [];

  selectedDays.forEach(dk => {
    const dayItems = planningItemsByDate.get(dk) || [];
    if (dayItems.length === 0) {
      emptyDays.push(dk);
      return;
    }

    dayItems.forEach(item => {
      const hasTitle = item.title && item.title.trim() !== "";
      const hasCopy = item.copy && item.copy.trim() !== "";
      const isTextOnly = item.content_type === "text";
      const hasCreative = !!item.asset_url || isTextOnly || isBlog;

      if (!hasTitle) {
        noStrategy.push(item);
        noStrategyDaysSet.add(dk);
      } else if (!hasCopy) {
        missingCopy.push(item);
        missingCopyDaysSet.add(dk);
      } else if (!hasCreative) {
        missingCreative.push(item);
        missingCreativeDaysSet.add(dk);
      } else {
        ready.push(item);
        readyDaysSet.add(dk);
      }
    });
  });

  const totalSelected = ready.length + missingCopy.length + missingCreative.length + noStrategy.length;

  // Can generate copys? Need at least 1 item with strategy (title)
  const itemsWithStrategy = totalSelected - noStrategy.length;
  const canGenerateCopys = itemsWithStrategy > 0;
  let copyBlockReason: string | null = null;
  if (!canGenerateCopys && totalSelected > 0) {
    copyBlockReason = "Nenhuma publicação tem estratégia. Gere a estratégia primeiro.";
  } else if (totalSelected === 0) {
    copyBlockReason = "Nenhuma publicação nos dias selecionados.";
  }

  // Can generate creatives? Need at least 1 item with copy (and not text-only)
  const eligibleForCreative = [...missingCreative, ...ready].filter(i => i.content_type !== "text");
  const canGenerateCreatives = isBlog ? false : eligibleForCreative.length > 0;
  let creativeBlockReason: string | null = null;
  if (!isBlog) {
    if (totalSelected === 0) {
      creativeBlockReason = "Nenhuma publicação nos dias selecionados.";
    } else if (!canGenerateCreatives) {
      const hasAnyCopy = [...missingCreative, ...ready].length > 0;
      if (!hasAnyCopy) {
        creativeBlockReason = "Nenhuma publicação tem copy. Gere as copys primeiro.";
      } else {
        creativeBlockReason = "Nenhuma publicação elegível para criativo.";
      }
    }
  }

  return {
    ready,
    missingCopy,
    missingCreative,
    noStrategy,
    totalSelected,
    readyDays: Array.from(readyDaysSet),
    missingCopyDays: Array.from(missingCopyDaysSet),
    missingCreativeDays: Array.from(missingCreativeDaysSet),
    noStrategyDays: Array.from(noStrategyDaysSet),
    emptyDays,
    canGenerateCopys,
    canGenerateCreatives,
    copyBlockReason,
    creativeBlockReason,
  };
}

export function SelectionDiagnostics({
  selectedDays,
  planningItemsByDate,
  isBlog = false,
}: SelectionDiagnosticsProps) {
  const diagnostics = useMemo(
    () => getDiagnostics(selectedDays, planningItemsByDate, isBlog),
    [selectedDays, planningItemsByDate, isBlog]
  );

  const { totalSelected, ready, missingCopy, missingCreative, noStrategy, emptyDays } = diagnostics;

  // Nothing to show if no items at all
  if (totalSelected === 0 && emptyDays.length === selectedDays.size) {
    return (
      <div className="mt-3 pt-3 border-t border-border/50">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          Dias selecionados estão vazios. Gere a estratégia primeiro (passo 2).
        </p>
      </div>
    );
  }

  if (totalSelected === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="flex flex-wrap items-center gap-2">
        {ready.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full px-2.5 py-1">
            <CheckCircle2 className="h-3 w-3" />
            {ready.length} pronto{ready.length !== 1 ? "s" : ""}
          </span>
        )}
        {missingCopy.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full px-2.5 py-1">
            <FileText className="h-3 w-3" />
            {missingCopy.length} sem copy
          </span>
        )}
        {!isBlog && missingCreative.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 rounded-full px-2.5 py-1">
            <Image className="h-3 w-3" />
            {missingCreative.length} sem criativo
          </span>
        )}
        {noStrategy.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-full px-2.5 py-1">
            <XCircle className="h-3 w-3" />
            {noStrategy.length} sem estratégia
          </span>
        )}
        {emptyDays.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-1">
            {emptyDays.length} dia{emptyDays.length !== 1 ? "s" : ""} vazio{emptyDays.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

export { getDiagnostics };
export type { DiagnosticResult };