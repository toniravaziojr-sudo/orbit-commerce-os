// =============================================
// STRATEGIC PLAN CONTENT — Formatted renderer
// Parses raw diagnosis/plan text into structured sections
// =============================================

import { AlertTriangle, ListChecks, TrendingUp, Clock, Target, Lightbulb, BarChart3, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface StrategicPlanContentProps {
  diagnosis?: string | null;
  plannedActions?: string[] | string | null;
  expectedResults?: string | null;
  riskAssessment?: string | null;
  timeline?: string | null;
  reasoning?: string | null;
  className?: string;
}

/** Sanitize technical IDs from display text */
function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/\(id\s*\d{10,}\)/gi, "")
    .replace(/\bid\s*\d{10,}\b/gi, "")
    .replace(/act_\d+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Parse a text block into logical sub-sections by detecting patterns like "FASE X", "Hipóteses", "Metas", "Gargalos" etc */
function parseTextSections(text: string): { title: string | null; lines: string[] }[] {
  const rawLines = text.split("\n");
  const sections: { title: string | null; lines: string[] }[] = [];
  let current: { title: string | null; lines: string[] } = { title: null, lines: [] };

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    // Detect section headers: "FASE X —", "Visão geral", "Hipóteses", "Gargalos", "Metas"
    const isSectionHeader = 
      /^FASE\s+\d+/i.test(line) ||
      /^(Visão geral|Hipóteses|Gargalos|Metas|Resumo|Diagnóstico|Projeção|Ações|Cronograma)/i.test(line);

    if (isSectionHeader) {
      if (current.lines.length > 0 || current.title) {
        sections.push(current);
      }
      current = { title: line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0 || current.title) {
    sections.push(current);
  }

  return sections;
}

/** Render a single line, handling bullet points and numbered items */
function FormattedLine({ line }: { line: string }) {
  const cleaned = sanitize(line);
  
  // Sub-item (starts with spaces + dash/letter)
  const isSubItem = /^\s+[-–•a-z\d]\)?\s/i.test(line);
  // Main bullet (starts with - or •)
  const isBullet = /^[-–•]\s/.test(cleaned);
  // Numbered item
  const isNumbered = /^\d+[\)\.]\s/.test(cleaned);

  if (isSubItem) {
    const text = cleaned.replace(/^\s*[-–•a-z\d]\)?\s*/i, "");
    return (
      <li className="ml-4 text-[13px] text-muted-foreground leading-relaxed list-none flex gap-2">
        <span className="text-muted-foreground/50 mt-0.5 shrink-0">›</span>
        <span>{text}</span>
      </li>
    );
  }

  if (isBullet) {
    const text = cleaned.replace(/^[-–•]\s*/, "");
    return (
      <li className="text-[13px] text-foreground/80 leading-relaxed list-none flex gap-2">
        <span className="text-primary/60 mt-0.5 shrink-0">•</span>
        <span>{text}</span>
      </li>
    );
  }

  if (isNumbered) {
    const match = cleaned.match(/^(\d+[\)\.])?\s*(.*)/);
    const num = match?.[1] || "";
    const text = match?.[2] || cleaned;
    return (
      <li className="text-[13px] text-foreground/80 leading-relaxed list-none flex gap-2">
        <span className="text-primary font-semibold shrink-0 min-w-[20px]">{num}</span>
        <span>{text}</span>
      </li>
    );
  }

  return (
    <p className="text-[13px] text-foreground/80 leading-relaxed">{cleaned}</p>
  );
}

/** Detect icon for section based on title */
function getSectionIcon(title: string | null) {
  if (!title) return <BarChart3 className="h-3.5 w-3.5" />;
  const t = title.toLowerCase();
  if (t.includes("fase")) return <ListChecks className="h-3.5 w-3.5" />;
  if (t.includes("gargalo")) return <AlertTriangle className="h-3.5 w-3.5" />;
  if (t.includes("hipótese")) return <Lightbulb className="h-3.5 w-3.5" />;
  if (t.includes("meta") || t.includes("performance")) return <Target className="h-3.5 w-3.5" />;
  if (t.includes("projeção") || t.includes("resultado")) return <TrendingUp className="h-3.5 w-3.5" />;
  if (t.includes("risco")) return <ShieldAlert className="h-3.5 w-3.5" />;
  if (t.includes("cronograma") || t.includes("timeline")) return <Clock className="h-3.5 w-3.5" />;
  return <BarChart3 className="h-3.5 w-3.5" />;
}

function getSectionColor(title: string | null) {
  if (!title) return "text-primary";
  const t = title.toLowerCase();
  if (t.includes("gargalo")) return "text-amber-500";
  if (t.includes("risco")) return "text-destructive";
  if (t.includes("meta") || t.includes("resultado") || t.includes("projeção")) return "text-emerald-500";
  if (t.includes("hipótese")) return "text-blue-500";
  if (t.includes("fase")) return "text-primary";
  return "text-primary";
}

function TextSection({ title, lines, isLast }: { title: string | null; lines: string[]; isLast: boolean }) {
  const icon = getSectionIcon(title);
  const color = getSectionColor(title);

  return (
    <div className={cn("space-y-2", !isLast && "pb-4 border-b border-border/30")}>
      {title && (
        <div className={cn("flex items-center gap-2", color)}>
          {icon}
          <h4 className="text-xs font-bold uppercase tracking-wide">{sanitize(title)}</h4>
        </div>
      )}
      <ul className="space-y-1.5">
        {lines.map((line, i) => (
          <FormattedLine key={i} line={line} />
        ))}
      </ul>
    </div>
  );
}

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
  const allSections: { icon: typeof AlertTriangle; color: string; label: string; content: string }[] = [];

  // Build explicit sections from structured fields
  if (plannedActions) {
    const text = Array.isArray(plannedActions) ? plannedActions.join("\n") : String(plannedActions);
    allSections.push({ icon: ListChecks, color: "text-primary", label: "Ações Planejadas", content: text });
  }
  if (expectedResults) {
    allSections.push({ icon: TrendingUp, color: "text-emerald-500", label: "Resultados Esperados", content: String(expectedResults) });
  }
  if (riskAssessment) {
    allSections.push({ icon: ShieldAlert, color: "text-destructive", label: "Riscos", content: String(riskAssessment) });
  }
  if (timeline) {
    allSections.push({ icon: Clock, color: "text-blue-500", label: "Cronograma", content: String(timeline) });
  }

  // Parse diagnosis into sub-sections
  const diagnosisSections = diagnosis ? parseTextSections(diagnosis) : [];

  // Parse each explicit section into sub-sections too
  const explicitParsed = allSections.map(s => ({
    ...s,
    parsed: parseTextSections(s.content),
  }));

  return (
    <div className={cn("space-y-5", className)}>
      {/* Diagnosis sections */}
      {diagnosisSections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-bold">Diagnóstico</h3>
          </div>
          <div className="space-y-4 bg-muted/20 rounded-xl p-4 border border-border/30">
            {diagnosisSections.map((sec, i) => (
              <TextSection
                key={i}
                title={sec.title}
                lines={sec.lines}
                isLast={i === diagnosisSections.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Explicit sections */}
      {explicitParsed.map((section, si) => (
        <div key={si} className="space-y-3">
          <div className={cn("flex items-center gap-2", section.color)}>
            <section.icon className="h-4 w-4" />
            <h3 className="text-sm font-bold">{section.label}</h3>
          </div>
          <div className="space-y-4 bg-muted/20 rounded-xl p-4 border border-border/30">
            {section.parsed.map((sub, i) => (
              <TextSection
                key={i}
                title={sub.title}
                lines={sub.lines}
                isLast={i === section.parsed.length - 1}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Reasoning fallback */}
      {reasoning && !diagnosis && !plannedActions && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <h3 className="text-sm font-bold">Análise da IA</h3>
          </div>
          <div className="space-y-3 bg-muted/20 rounded-xl p-4 border border-border/30">
            {parseTextSections(reasoning).map((sec, i, arr) => (
              <TextSection key={i} title={sec.title} lines={sec.lines} isLast={i === arr.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
