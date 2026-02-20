// =============================================
// STRATEGIC PLAN CONTENT — Formatted renderer v3
// Parses raw diagnosis/plan text into structured, readable sections
// with campaign-level card separation
// =============================================

import { AlertTriangle, ListChecks, TrendingUp, Clock, Target, Lightbulb, BarChart3, ShieldAlert, ChevronRight, Layers } from "lucide-react";
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

/** 
 * Enhanced parser: splits text into logical blocks.
 */
function parseTextBlocks(text: string): { title: string | null; lines: string[] }[] {
  if (!text) return [];

  const sections: { title: string | null; lines: string[] }[] = [];
  let normalized = text.replace(/\\n/g, "\n");
  
  const headerRegex = /(?:^|\n)\s*(?:\(([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s/]+)\)|FASE\s+\d+[^\n]*|(?:Visão geral|Hipóteses|Gargalos|Metas|Resumo|Diagnóstico|Projeção|Ações|Cronograma|Resultados?|Riscos?|Público|Budget|Orçamento)[^\n]*)/gi;

  const hasBreaks = /\n\s*\n/.test(normalized) || headerRegex.test(normalized);
  
  if (!hasBreaks) {
    const smartSplit = splitBySentenceBoundaries(normalized);
    if (smartSplit.length > 1) {
      return smartSplit;
    }
    return [{ title: null, lines: splitIntoReadableChunks(normalized) }];
  }

  headerRegex.lastIndex = 0;

  const rawLines = normalized.split("\n");
  let current: { title: string | null; lines: string[] } = { title: null, lines: [] };

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) {
      if (current.lines.length > 0 || current.title) {
        sections.push(current);
        current = { title: null, lines: [] };
      }
      continue;
    }

    const isSectionHeader = 
      /^FASE\s+\d+/i.test(line) ||
      /^\([A-ZÁÉÍÓÚÀÂÊÔÃÕÇ][A-ZÁÉÍÓÚÀÂÊÔÃÕÇ\s/]+\)/i.test(line) ||
      /^(Visão geral|Hipóteses|Gargalos|Metas|Resumo|Diagnóstico|Projeção|Ações|Cronograma|Resultados?|Riscos?|Orçamento|Budget|Públicos?)\s*[:\-—]/i.test(line);

    if (isSectionHeader) {
      if (current.lines.length > 0 || current.title) {
        sections.push(current);
      }
      let title = line;
      const parenMatch = line.match(/^\(([^)]+)\)\s*(.*)/);
      if (parenMatch) {
        title = parenMatch[1];
        const rest = parenMatch[2]?.trim();
        current = { title, lines: rest ? [rest] : [] };
      } else {
        current = { title, lines: [] };
      }
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length > 0 || current.title) {
    sections.push(current);
  }

  if (sections.length === 1 && !sections[0].title && sections[0].lines.length <= 2) {
    const joined = sections[0].lines.join(" ");
    if (joined.length > 300) {
      return splitBySentenceBoundaries(joined);
    }
  }

  return sections;
}

/** Split a long monolithic text into logical sections by detecting key sentence boundaries */
function splitBySentenceBoundaries(text: string): { title: string | null; lines: string[] }[] {
  const sections: { title: string | null; lines: string[] }[] = [];
  
  const markers = [
    { regex: /(?:Estado atual|Situação atual|Cenário atual)[^.]*\./i, title: "Cenário Atual" },
    { regex: /(?:No momento|Atualmente)[^.]*há\s+\d+\s+campanhas?[^.]*\./i, title: "Campanhas Ativas" },
    { regex: /(?:A campanha|As campanhas?)\s+(?:de melhores|com melhor|top)[^.]*\./i, title: "Performance" },
    { regex: /(?:campanhas?\s*\[AI\]|campanhas? (?:criadas|novas))[^.]*\./i, title: "Campanhas IA" },
    { regex: /(?:Cadência criativa|Criativos?)[^.]*\./i, title: "Criativos" },
    { regex: /(?:Públicos?|LALs?|Lookalikes?)[^.]*\./i, title: "Públicos" },
    { regex: /(?:Orçamento|Budget|spend|gasto)[^.]*\./i, title: "Orçamento" },
    { regex: /(?:O maior gargalo|gargalo|problema principal)[^.]*\./i, title: "Gargalos" },
    { regex: /(?:Além disso|Adicionalmente|Também)[^.]*\./i, title: "Observações" },
  ];

  let remaining = text;
  
  for (const marker of markers) {
    const match = remaining.match(marker.regex);
    if (match && match.index !== undefined) {
      const before = remaining.substring(0, match.index).trim();
      if (before && sections.length === 0) {
        sections.push({ title: null, lines: splitIntoReadableChunks(before) });
      }
      
      const afterMatch = remaining.substring(match.index);
      let endIdx = afterMatch.length;
      for (const nextMarker of markers) {
        if (nextMarker === marker) continue;
        const nextMatch = afterMatch.substring(match[0].length).match(nextMarker.regex);
        if (nextMatch && nextMatch.index !== undefined) {
          endIdx = Math.min(endIdx, match[0].length + nextMatch.index);
        }
      }
      
      const sectionText = afterMatch.substring(0, endIdx).trim();
      if (sectionText) {
        sections.push({ title: marker.title, lines: splitIntoReadableChunks(sectionText) });
      }
      remaining = afterMatch.substring(endIdx);
    }
  }

  if (sections.length <= 1) {
    return splitBySentences(text);
  }

  if (remaining.trim()) {
    sections.push({ title: null, lines: splitIntoReadableChunks(remaining.trim()) });
  }

  return sections;
}

/** Simple sentence split for fallback */
function splitBySentences(text: string): { title: string | null; lines: string[] }[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const sections: { title: string | null; lines: string[] }[] = [];
  
  const groupSize = 2;
  for (let i = 0; i < sentences.length; i += groupSize) {
    const group = sentences.slice(i, i + groupSize).map(s => s.trim()).filter(Boolean);
    if (group.length > 0) {
      sections.push({ title: null, lines: group });
    }
  }
  
  return sections;
}

/** Split long text into readable bullet-like chunks */
function splitIntoReadableChunks(text: string): string[] {
  if (!text) return [];
  
  if (/\(\d+\)/.test(text)) {
    const parts = text.split(/(?=\(\d+\))/).map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  
  if (text.includes(";") && text.split(";").length >= 3) {
    return text.split(";").map(s => s.trim()).filter(Boolean);
  }

  return [text];
}

/**
 * Smart parser for planned actions — detects action boundaries
 * Supports bullet points (•, -, *), numbered items, and keyword-based splitting.
 * Recognizes: Criar, Ajustar, Pausar, Escalar, Otimizar, Foco, Lançar, Testar, etc.
 */
function parsePlannedActionsIntoCampaigns(text: string): { title: string; lines: string[] }[] {
  if (!text) return [];

  const normalized = text.replace(/\\n/g, "\n");

  // Step 1: Split by bullet points (•, -, *) or numbered items at the start of lines
  const bulletRegex = /(?:^|\n)\s*(?:[•\-\*]|\d+[\.\)]\s)/;
  const hasBullets = bulletRegex.test(normalized);

  let rawItems: string[] = [];

  if (hasBullets) {
    // Split on bullet/number markers
    rawItems = normalized
      .split(/(?:^|\n)\s*(?:[•\-\*]|\d+[\.\)])\s*/)
      .map(s => s.trim())
      .filter(s => s.length > 15); // Filter out empty/tiny fragments
  }

  // Step 2: If no bullets, try splitting by action keywords
  if (rawItems.length <= 1) {
    const actionKeywordRegex = /(?=(?:Criar\s+(?:Nova\s+)?Campanha|Ajustar\s+orçamento|Pausar\s+campanha|Escalar\s+(?:campanha|orçamento)|Otimizar\s+|Lançar\s+|Testar\s+|Foco\s+n[ao]|Ativar\s+|Desativar\s+|Reduzir\s+|Aumentar\s+))/gi;
    const keywordSplit = normalized.split(actionKeywordRegex).map(s => s.trim()).filter(s => s.length > 15);
    if (keywordSplit.length > 1) {
      rawItems = keywordSplit;
    }
  }

  if (rawItems.length <= 1) return [];

  const campaigns: { title: string; lines: string[] }[] = [];

  for (const block of rawItems) {
    // Extract a concise title from the first sentence/clause
    const colonMatch = block.match(/^([^:]{10,80}):\s*(.*)/s);
    let title: string;
    let bodyText: string;

    if (colonMatch) {
      title = colonMatch[1].trim();
      bodyText = colonMatch[2].trim();
    } else {
      const firstSentence = block.match(/^([^.]{10,100})\.\s*(.*)/s);
      if (firstSentence) {
        title = firstSentence[1].trim();
        bodyText = firstSentence[2]?.trim() || "";
      } else {
        title = block.length > 80 ? block.substring(0, 77) + "…" : block;
        bodyText = "";
      }
    }

    // Extract structured details from body
    const details: string[] = [];

    const productMatch = bodyText.match(/(?:para\s+o\s+(?:produto\s+)?|promovendo\s+)"?([^"(,]{3,60})"?/i);
    if (productMatch) details.push(`📦 Produto: ${productMatch[1].trim()}`);

    const budgetMatch = bodyText.match(/orçamento\s+diário\s+(?:de\s+)?R\$\s*([\d.,]+)/i);
    if (budgetMatch) details.push(`💰 Orçamento diário: R$ ${budgetMatch[1]}`);

    const budgetFromTo = block.match(/de\s+R\$\s*([\d.,]+)\s+para\s+R\$\s*([\d.,]+)/i);
    if (budgetFromTo) details.push(`💰 R$ ${budgetFromTo[1]} → R$ ${budgetFromTo[2]}`);

    const audienceMatch = bodyText.match(/Público:\s*([^.]+)/i);
    if (audienceMatch) details.push(`🎯 Público: ${audienceMatch[1].trim()}`);

    const funnelMatch = block.match(/Funil:\s*(\S+)/i);
    if (funnelMatch) details.push(`🔀 Funil: ${funnelMatch[1]}`);

    // If no structured data extracted, use body sentences
    if (details.length === 0 && bodyText) {
      const sentences = bodyText.match(/[^.!?]+[.!?]+/g) || [bodyText];
      details.push(...sentences.slice(0, 3).map(s => s.trim()).filter(Boolean));
    }

    // Detect action type for icon/badge
    const actionType = detectActionType(title);
    if (actionType) details.unshift(actionType);

    campaigns.push({ title: sanitize(title), lines: details });
  }

  return campaigns;
}

/** Detect action type badge */
function detectActionType(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes("ajustar") || t.includes("aumentar") || t.includes("reduzir")) return "⚙️ Ajuste";
  if (t.includes("pausar") || t.includes("desativar")) return "⏸️ Pausar";
  if (t.includes("criar") || t.includes("lançar")) return "🚀 Nova";
  if (t.includes("escalar")) return "📈 Escalar";
  if (t.includes("testar") || t.includes("teste")) return "🧪 Teste";
  if (t.includes("foco") || t.includes("garantir")) return "🎯 Foco";
  if (t.includes("otimizar")) return "🔧 Otimizar";
  return null;
}

/** Render a campaign card with structured details */
function CampaignCard({ title, lines, index }: { title: string; lines: string[]; index: number }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="bg-primary/10 text-primary font-bold text-xs min-w-[24px] h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">
          {index + 1}
        </span>
        <h4 className="text-sm font-semibold text-foreground leading-snug">{sanitize(title)}</h4>
      </div>
      <div className="ml-[34px] space-y-1.5">
        {lines.map((line, i) => {
          const cleaned = sanitize(line);
          if (!cleaned) return null;
          const highlighted = highlightMetrics(cleaned);
          return (
            <p key={i} className="text-[13px] text-foreground/80 leading-relaxed">
              {highlighted}
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** Render a single line, handling bullet points and numbered items */
function FormattedLine({ line }: { line: string }) {
  const cleaned = sanitize(line);
  if (!cleaned) return null;
  
  const parenNumMatch = cleaned.match(/^\((\d+)\)\s*(.*)/);
  if (parenNumMatch) {
    return (
      <li className="text-[13px] text-foreground/85 leading-relaxed list-none flex gap-2.5 items-start">
        <span className="bg-primary/10 text-primary font-bold text-[11px] min-w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5">
          {parenNumMatch[1]}
        </span>
        <span>{parenNumMatch[2]}</span>
      </li>
    );
  }

  const isSubItem = /^\s+[-–•a-z\d]\)?\s/i.test(line);
  const isBullet = /^[-–•—]\s/.test(cleaned);
  const isNumbered = /^\d+[\)\.]\s/.test(cleaned);

  if (isSubItem) {
    const text = cleaned.replace(/^\s*[-–•a-z\d]\)?\s*/i, "");
    return (
      <li className="ml-6 text-[13px] text-muted-foreground leading-relaxed list-none flex gap-2 items-start">
        <ChevronRight className="h-3 w-3 text-muted-foreground/40 mt-1 shrink-0" />
        <span>{text}</span>
      </li>
    );
  }

  if (isBullet) {
    const text = cleaned.replace(/^[-–•—]\s*/, "");
    return (
      <li className="text-[13px] text-foreground/85 leading-relaxed list-none flex gap-2.5 items-start">
        <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-[7px] shrink-0" />
        <span>{text}</span>
      </li>
    );
  }

  if (isNumbered) {
    const match = cleaned.match(/^(\d+[\)\.])?\s*(.*)/);
    const num = match?.[1] || "";
    const text = match?.[2] || cleaned;
    return (
      <li className="text-[13px] text-foreground/85 leading-relaxed list-none flex gap-2.5 items-start">
        <span className="bg-primary/10 text-primary font-bold text-[11px] min-w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 mt-0.5">
          {num.replace(/[).]/, "")}
        </span>
        <span>{text}</span>
      </li>
    );
  }

  const highlighted = highlightMetrics(cleaned);

  return (
    <p className="text-[13px] text-foreground/80 leading-[1.7]">{highlighted}</p>
  );
}

/** Highlight key metrics like ROAS, CPA, R$ values */
function highlightMetrics(text: string): React.ReactNode {
  const parts = text.split(/(ROAS\s*(?:\d+[dD])?\s*=?\s*[\d,.]+|CPA\s*[≈~]?\s*R?\$?\s*[\d,.]+|R\$\s*[\d,.]+(?:\/d(?:ia)?)?|\d+%|\d+\s*campanhas?)/gi);
  
  if (parts.length <= 1) return text;

  return parts.map((part, i) => {
    if (/^(ROAS|CPA|R\$|\d+%|\d+\s*campanhas?)/i.test(part)) {
      return (
        <span key={i} className="font-semibold text-foreground bg-primary/5 px-1 rounded">
          {part}
        </span>
      );
    }
    return part;
  });
}

/** Detect icon for section based on title */
function getSectionMeta(title: string | null): { icon: React.ReactNode; color: string } {
  if (!title) return { icon: <BarChart3 className="h-3.5 w-3.5" />, color: "text-primary" };
  const t = title.toLowerCase();
  if (t.includes("fase") || t.includes("planning") || t.includes("planejamento")) return { icon: <ListChecks className="h-3.5 w-3.5" />, color: "text-primary" };
  if (t.includes("gargalo") || t.includes("problema")) return { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "text-amber-500" };
  if (t.includes("hipótese") || t.includes("observa")) return { icon: <Lightbulb className="h-3.5 w-3.5" />, color: "text-blue-500" };
  if (t.includes("meta") || t.includes("performance") || t.includes("resultado") || t.includes("projeção")) return { icon: <TrendingUp className="h-3.5 w-3.5" />, color: "text-emerald-500" };
  if (t.includes("risco")) return { icon: <ShieldAlert className="h-3.5 w-3.5" />, color: "text-destructive" };
  if (t.includes("cronograma") || t.includes("timeline")) return { icon: <Clock className="h-3.5 w-3.5" />, color: "text-blue-500" };
  if (t.includes("criativo")) return { icon: <Layers className="h-3.5 w-3.5" />, color: "text-violet-500" };
  if (t.includes("público") || t.includes("audiência")) return { icon: <Target className="h-3.5 w-3.5" />, color: "text-orange-500" };
  if (t.includes("orçamento") || t.includes("budget")) return { icon: <BarChart3 className="h-3.5 w-3.5" />, color: "text-cyan-500" };
  if (t.includes("campanha") || t.includes("ativas")) return { icon: <Layers className="h-3.5 w-3.5" />, color: "text-indigo-500" };
  if (t.includes("cenário") || t.includes("estado") || t.includes("situação")) return { icon: <BarChart3 className="h-3.5 w-3.5" />, color: "text-muted-foreground" };
  if (t.includes("ia") || t.includes("montagem") || t.includes("ativação")) return { icon: <ListChecks className="h-3.5 w-3.5" />, color: "text-primary" };
  return { icon: <BarChart3 className="h-3.5 w-3.5" />, color: "text-primary" };
}

function TextSection({ title, lines, isLast }: { title: string | null; lines: string[]; isLast: boolean }) {
  const { icon, color } = getSectionMeta(title);

  return (
    <div className={cn("space-y-2", !isLast && "pb-4 border-b border-border/20")}>
      {title && (
        <div className={cn("flex items-center gap-2", color)}>
          {icon}
          <h4 className="text-xs font-bold uppercase tracking-wider">{sanitize(title)}</h4>
        </div>
      )}
      <ul className="space-y-2">
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
  const plannedText = plannedActions
    ? Array.isArray(plannedActions) ? plannedActions.join("\n") : String(plannedActions)
    : "";
  const campaignCards = parsePlannedActionsIntoCampaigns(plannedText);
  const hasCampaignCards = campaignCards.length > 0;

  const otherSections: { icon: React.ReactNode; color: string; label: string; content: string }[] = [];

  if (plannedText && !hasCampaignCards) {
    otherSections.push({ icon: <ListChecks className="h-4 w-4" />, color: "text-primary", label: "Ações Planejadas", content: plannedText });
  }
  if (expectedResults) {
    otherSections.push({ icon: <TrendingUp className="h-4 w-4" />, color: "text-emerald-500", label: "Resultados Esperados", content: String(expectedResults) });
  }
  if (riskAssessment) {
    otherSections.push({ icon: <ShieldAlert className="h-4 w-4" />, color: "text-destructive", label: "Riscos", content: String(riskAssessment) });
  }
  if (timeline) {
    otherSections.push({ icon: <Clock className="h-4 w-4" />, color: "text-blue-500", label: "Cronograma", content: String(timeline) });
  }

  const diagnosisSections = diagnosis ? parseTextBlocks(diagnosis) : [];
  const explicitParsed = otherSections.map(s => ({
    ...s,
    parsed: parseTextBlocks(s.content),
  }));

  return (
    <div className={cn("space-y-6", className)}>
      {/* Diagnosis */}
      {diagnosisSections.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <h3 className="text-sm font-bold tracking-tight">Diagnóstico</h3>
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

      {/* Campaign Cards — structured view */}
      {hasCampaignCards && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <ListChecks className="h-4 w-4" />
            <h3 className="text-sm font-bold tracking-tight">Ações Planejadas</h3>
            <span className="ml-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {campaignCards.length} {campaignCards.length === 1 ? "ação" : "ações"}
            </span>
          </div>
          <div className="space-y-3">
            {campaignCards.map((camp, i) => (
              <CampaignCard key={i} title={camp.title} lines={camp.lines} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Other explicit sections */}
      {explicitParsed.map((section, si) => (
        <div key={si} className="space-y-3">
          <div className={cn("flex items-center gap-2", section.color)}>
            {section.icon}
            <h3 className="text-sm font-bold tracking-tight">{section.label}</h3>
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
            <h3 className="text-sm font-bold tracking-tight">Análise da IA</h3>
          </div>
          <div className="space-y-4 bg-muted/20 rounded-xl p-4 border border-border/30">
            {parseTextBlocks(reasoning).map((sec, i, arr) => (
              <TextSection key={i} title={sec.title} lines={sec.lines} isLast={i === arr.length - 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
