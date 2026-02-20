// =============================================
// STRATEGIC PLAN CONTENT — v5 (Robust renderer)
// Renders AI-generated strategic plans with proper structure.
// NEVER splits sentences mid-way. Data is already structured in fields.
// =============================================

import React from "react";
import {
  AlertTriangle,
  ListChecks,
  TrendingUp,
  Clock,
  ShieldAlert,
  BarChart3,
  Layers,
  Target,
  Lightbulb,
  Pause,
  Settings,
  Rocket,
  FlaskConical,
  ArrowUpRight,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StrategicPlanContentProps {
  diagnosis?: string | null;
  plannedActions?: string[] | string | null;
  expectedResults?: string | null;
  riskAssessment?: string | null;
  timeline?: string | null;
  reasoning?: string | null;
  className?: string;
}

// ============ SANITIZATION ============

/** Remove technical IDs from display text */
function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/\(ID:\s*\d{10,}\)/gi, "")
    .replace(/\(id\s*\d{10,}\)/gi, "")
    .replace(/\bid\s*\d{10,}\b/gi, "")
    .replace(/act_\d+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ============ METRIC HIGHLIGHTING ============

/** Highlight key metrics like ROAS, CPA, R$ values, percentages */
function highlightMetrics(text: string): React.ReactNode {
  const parts = text.split(
    /(ROAS\s*(?:\d+[dD])?\s*(?:de\s+)?[\d,.]+x?|CPA\s*[≈~]?\s*R?\$?\s*[\d,.]+|R\$\s*[\d.,]+(?:\/d(?:ia)?)?|\b\d+[.,]?\d*%|\b\d+[.,]?\d*x\b)/gi
  );

  if (parts.length <= 1) return text;

  return parts.map((part, i) => {
    if (/^(ROAS|CPA|R\$|\d+[.,]?\d*%|\d+[.,]?\d*x)/i.test(part)) {
      return (
        <span key={i} className="font-semibold text-foreground bg-primary/5 px-1 rounded">
          {part}
        </span>
      );
    }
    return part;
  });
}

// ============ ACTION PARSING ============

interface ParsedAction {
  title: string;
  type: "create" | "adjust" | "pause" | "test" | "scale" | "focus" | "optimize" | "other";
  details: { icon: string; label: string; value: string }[];
  bodyLines: string[];
}

/** Detect action type from title */
function detectActionType(title: string): ParsedAction["type"] {
  const t = title.toLowerCase();
  if (t.includes("pausar") || t.includes("desativar")) return "pause";
  if (t.includes("ajustar") || t.includes("aumentar") || t.includes("reduzir")) return "adjust";
  if (t.includes("teste") || t.includes("testar")) return "test";
  if (t.includes("escalar")) return "scale";
  if (t.includes("foco") || t.includes("garantir") || t.includes("priorizar")) return "focus";
  if (t.includes("otimizar")) return "optimize";
  if (t.includes("criar") || t.includes("lançar") || t.includes("nova")) return "create";
  return "other";
}

/** Get icon/color for action type */
function getActionTypeConfig(type: ParsedAction["type"]) {
  switch (type) {
    case "create":
      return { icon: <Rocket className="h-3.5 w-3.5" />, label: "Nova Campanha", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" };
    case "adjust":
      return { icon: <Settings className="h-3.5 w-3.5" />, label: "Ajuste", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" };
    case "pause":
      return { icon: <Pause className="h-3.5 w-3.5" />, label: "Pausar", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" };
    case "test":
      return { icon: <FlaskConical className="h-3.5 w-3.5" />, label: "Teste", color: "text-violet-600 bg-violet-50 dark:bg-violet-950/30" };
    case "scale":
      return { icon: <ArrowUpRight className="h-3.5 w-3.5" />, label: "Escalar", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30" };
    case "focus":
      return { icon: <Target className="h-3.5 w-3.5" />, label: "Foco", color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30" };
    case "optimize":
      return { icon: <Wrench className="h-3.5 w-3.5" />, label: "Otimizar", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" };
    default:
      return { icon: <Lightbulb className="h-3.5 w-3.5" />, label: "Ação", color: "text-muted-foreground bg-muted/50" };
  }
}

/**
 * Parse planned actions text into structured action cards.
 * Splits on bullet markers (•, -, *) or numbered items, then extracts metadata.
 */
function parsePlannedActions(text: string): ParsedAction[] {
  if (!text) return [];

  const normalized = text.replace(/\\n/g, "\n");

  // Split by bullet markers: •, -, *, or numbered (1., 2), etc.)
  // Only split when the marker is at the start of a line or after a newline
  let items: string[] = [];

  // Try bullet split first (most common from AI)
  if (/[•]/.test(normalized)) {
    items = normalized.split(/\s*•\s*/).map(s => s.trim()).filter(s => s.length > 15);
  }

  // Try newline + dash/asterisk
  if (items.length <= 1) {
    const lines = normalized.split("\n").map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      // Check if lines start with markers
      const markerLines = lines.filter(l => /^[-\*]\s/.test(l) || /^\d+[\.\)]\s/.test(l));
      if (markerLines.length > 1) {
        items = markerLines.map(l => l.replace(/^[-\*]\s*/, "").replace(/^\d+[\.\)]\s*/, "").trim());
      } else {
        items = lines.filter(l => l.length > 15);
      }
    }
  }

  // Try splitting by action keywords as sentence boundaries
  if (items.length <= 1) {
    const actionRegex = /(?:^|(?<=\.\s))(?=(?:Criar\s|Ajustar\s|Pausar\s|Escalar\s|Otimizar\s|Lançar\s|Testar\s|Foco\s|Ativar\s|Desativar\s|Reduzir\s|Aumentar\s|Garantir\s))/gi;
    const splits = normalized.split(actionRegex).map(s => s.trim()).filter(s => s.length > 15);
    if (splits.length > 1) {
      items = splits;
    }
  }

  if (items.length === 0) return [];

  return items.map((item) => {
    const cleanItem = sanitize(item);

    // Extract title (before first colon or first sentence)
    let title: string;
    let body: string;

    const colonIdx = cleanItem.indexOf(":");
    if (colonIdx > 5 && colonIdx < 120) {
      title = cleanItem.substring(0, colonIdx).trim();
      body = cleanItem.substring(colonIdx + 1).trim();
    } else {
      const dotIdx = cleanItem.indexOf(".");
      if (dotIdx > 10 && dotIdx < 120) {
        title = cleanItem.substring(0, dotIdx).trim();
        body = cleanItem.substring(dotIdx + 1).trim();
      } else {
        title = cleanItem.length > 80 ? cleanItem.substring(0, 77) + "…" : cleanItem;
        body = "";
      }
    }

    const type = detectActionType(title);
    const details: { icon: string; label: string; value: string }[] = [];

    // Extract structured metadata from body
    const productMatch = body.match(/(?:para\s+o\s+(?:produto\s+)?|promovendo\s+)["""]?([^""",.(]{3,60})["""]?/i);
    if (productMatch) details.push({ icon: "📦", label: "Produto", value: productMatch[1].trim() });

    const budgetFromTo = item.match(/de\s+R\$\s*([\d.,]+)\s+para\s+R\$\s*([\d.,]+)/i);
    if (budgetFromTo) {
      details.push({ icon: "💰", label: "Orçamento", value: `R$ ${budgetFromTo[1]} → R$ ${budgetFromTo[2]}` });
    } else {
      const budgetMatch = body.match(/orçamento\s+diário\s+(?:de\s+)?R\$\s*([\d.,]+)/i);
      if (budgetMatch) details.push({ icon: "💰", label: "Orçamento diário", value: `R$ ${budgetMatch[1]}` });
    }

    const audienceMatch = body.match(/Público:\s*([^.]+?)(?:\.\s|$)/i);
    if (audienceMatch) details.push({ icon: "🎯", label: "Público", value: audienceMatch[1].trim() });

    const funnelMatch = body.match(/Funil:\s*(\S+)/i);
    if (funnelMatch) details.push({ icon: "🔀", label: "Funil", value: funnelMatch[1] });

    // Remaining body text (remove already extracted parts)
    let remainingBody = body
      .replace(/Público:\s*[^.]+\./i, "")
      .replace(/Funil:\s*\S+\.?/i, "")
      .replace(/orçamento\s+diário\s+(?:de\s+)?R\$\s*[\d.,]+\.?/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    // Split remaining into readable lines
    const bodyLines: string[] = [];
    if (remainingBody && remainingBody.length > 10) {
      // Don't duplicate info already in details
      const sentences = remainingBody.match(/[^.!?]+[.!?]+/g) || [remainingBody];
      bodyLines.push(...sentences.map(s => s.trim()).filter(s => s.length > 10).slice(0, 3));
    }

    return { title, type, details, bodyLines };
  });
}

// ============ COMPONENTS ============

/** Render a single action card */
function ActionCard({ action, index }: { action: ParsedAction; index: number }) {
  const typeConfig = getActionTypeConfig(action.type);

  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-3 hover:border-border/60 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary font-bold text-xs min-w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", typeConfig.color)}>
              {typeConfig.icon}
              {typeConfig.label}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-foreground leading-snug">
            {action.title}
          </h4>
        </div>
      </div>

      {/* Structured details */}
      {action.details.length > 0 && (
        <div className="ml-[38px] grid gap-1.5">
          {action.details.map((detail, i) => (
            <div key={i} className="flex items-start gap-2 text-[13px]">
              <span className="shrink-0">{detail.icon}</span>
              <span className="text-muted-foreground font-medium shrink-0">{detail.label}:</span>
              <span className="text-foreground/80">{highlightMetrics(detail.value)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Body lines */}
      {action.bodyLines.length > 0 && (
        <div className="ml-[38px] space-y-1">
          {action.bodyLines.map((line, i) => (
            <p key={i} className="text-[13px] text-foreground/70 leading-relaxed">
              {highlightMetrics(line)}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Render a text section with metric highlighting — NO splitting on keywords */
function FlowingText({ text, className }: { text: string; className?: string }) {
  const sanitized = sanitize(text);
  if (!sanitized) return null;

  // Split into paragraphs by double newlines only
  const paragraphs = sanitized
    .replace(/\\n/g, "\n")
    .split(/\n\s*\n/)
    .map(p => p.replace(/\n/g, " ").trim())
    .filter(Boolean);

  return (
    <div className={cn("space-y-3", className)}>
      {paragraphs.map((para, i) => (
        <p key={i} className="text-[13px] text-foreground/80 leading-[1.8]">
          {highlightMetrics(para)}
        </p>
      ))}
    </div>
  );
}

/** Section wrapper with icon and label */
function Section({
  icon,
  label,
  color,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-2", color)}>
        {icon}
        <h3 className="text-sm font-bold tracking-tight">{label}</h3>
      </div>
      <div className="bg-muted/20 rounded-xl p-4 border border-border/30">
        {children}
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

/** Main component for rendering strategic plan content */
export function StrategicPlanContent({
  diagnosis,
  plannedActions,
  expectedResults,
  riskAssessment,
  timeline,
  reasoning,
  className,
}: StrategicPlanContentProps) {
  const plannedText = plannedActions
    ? Array.isArray(plannedActions)
      ? plannedActions.join("\n")
      : String(plannedActions)
    : "";

  const actionCards = parsePlannedActions(plannedText);
  const hasActionCards = actionCards.length > 0;

  // Use reasoning as fallback diagnosis
  const diagnosisText = diagnosis || (reasoning && !plannedActions ? reasoning : null);

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. DIAGNÓSTICO */}
      {diagnosisText && (
        <Section
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Diagnóstico"
          color="text-amber-500"
        >
          <FlowingText text={diagnosisText} />
        </Section>
      )}

      {/* 2. AÇÕES PLANEJADAS (structured cards) */}
      {hasActionCards && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <ListChecks className="h-4 w-4" />
            <h3 className="text-sm font-bold tracking-tight">Ações Planejadas</h3>
            <span className="ml-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {actionCards.length} {actionCards.length === 1 ? "ação" : "ações"}
            </span>
          </div>
          <div className="space-y-3">
            {actionCards.map((action, i) => (
              <ActionCard key={i} action={action} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* 2b. AÇÕES PLANEJADAS (fallback — raw text if no cards parsed) */}
      {plannedText && !hasActionCards && (
        <Section
          icon={<ListChecks className="h-4 w-4" />}
          label="Ações Planejadas"
          color="text-primary"
        >
          <FlowingText text={plannedText} />
        </Section>
      )}

      {/* 3. RESULTADOS ESPERADOS */}
      {expectedResults && (
        <Section
          icon={<TrendingUp className="h-4 w-4" />}
          label="Resultados Esperados"
          color="text-emerald-500"
        >
          <FlowingText text={String(expectedResults)} />
        </Section>
      )}

      {/* 4. RISCOS */}
      {riskAssessment && (
        <Section
          icon={<ShieldAlert className="h-4 w-4" />}
          label="Riscos"
          color="text-destructive"
        >
          <FlowingText text={String(riskAssessment)} />
        </Section>
      )}

      {/* 5. CRONOGRAMA */}
      {timeline && (
        <Section
          icon={<Clock className="h-4 w-4" />}
          label="Cronograma"
          color="text-blue-500"
        >
          <FlowingText text={String(timeline)} />
        </Section>
      )}

      {/* 6. REASONING fallback (only if no diagnosis and no planned actions) */}
      {reasoning && !diagnosis && !plannedActions && (
        <Section
          icon={<BarChart3 className="h-4 w-4" />}
          label="Análise da IA"
          color="text-muted-foreground"
        >
          <FlowingText text={reasoning} />
        </Section>
      )}
    </div>
  );
}
