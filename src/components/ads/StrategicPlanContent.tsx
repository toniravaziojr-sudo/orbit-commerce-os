// =============================================
// STRATEGIC PLAN CONTENT — v6 (Structured + Legacy)
// Renders AI-generated strategic plans from structured action objects.
// Falls back to text parsing for legacy string[] format.
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
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============ TYPES ============

interface StructuredAction {
  action_type?: string;
  campaign_type?: string;
  product_name?: string;
  daily_budget_brl?: number;
  target_audience?: string;
  funnel_stage?: string;
  objective?: string;
  bid_strategy?: string;
  creatives_count?: number;
  copy_variations?: number;
  rationale?: string;
  expected_roas?: number;
  placements?: string;
}

interface BudgetAllocation {
  total_daily_brl?: number;
  tof_pct?: number;
  bof_pct?: number;
  test_pct?: number;
  tof_brl?: number;
  bof_brl?: number;
  test_brl?: number;
}

interface StrategicPlanContentProps {
  diagnosis?: string | null;
  plannedActions?: StructuredAction[] | string[] | string | null;
  expectedResults?: string | null;
  riskAssessment?: string | null;
  timeline?: string | null;
  reasoning?: string | null;
  budgetAllocation?: BudgetAllocation | null;
  className?: string;
}

// ============ SANITIZATION ============

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

// ============ TRANSLATIONS ============

const FUNNEL_LABELS: Record<string, string> = {
  tof: "Topo de Funil",
  bof: "Fundo de Funil",
  mof: "Meio de Funil",
  test: "Teste",
  cold: "Topo de Funil",
  warm: "Meio de Funil",
  hot: "Fundo de Funil",
};

const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  tof: "Topo de Funil",
  bof: "Fundo de Funil",
  mof: "Meio de Funil",
  remarketing: "Remarketing",
  teste: "Teste",
  test: "Teste",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  outcome_sales: "Vendas",
  outcome_traffic: "Tráfego",
  outcome_awareness: "Reconhecimento",
  outcome_engagement: "Engajamento",
  outcome_leads: "Leads",
  conversions: "Conversões",
  link_clicks: "Cliques no Link",
};

const BID_STRATEGY_LABELS: Record<string, string> = {
  lowest_cost_without_cap: "Menor Custo",
  lowest_cost: "Menor Custo",
  bid_cap: "Limite de Lance",
  cost_cap: "Limite de Custo",
  minimum_roas: "ROAS Mínimo",
};

function translateField(value: string, map: Record<string, string>): string {
  const key = value.toLowerCase().replace(/[\s_-]+/g, "_");
  return map[key] || value;
}

function getCampaignTypeLabel(campaignType: string, funnelStage?: string): string {
  const ct = (campaignType || "").toLowerCase();
  if (CAMPAIGN_TYPE_LABELS[ct]) return CAMPAIGN_TYPE_LABELS[ct];
  if (ct.includes("remarketing")) return "Remarketing";
  if (ct.includes("teste") || ct.includes("test")) return "Teste";
  if (ct.includes("tof") || ct.includes("frio") || ct.includes("cold")) return "Topo de Funil";
  if (ct.includes("bof") || ct.includes("quente") || ct.includes("hot")) return "Fundo de Funil";
  // Fallback to funnel stage
  if (funnelStage) {
    const fs = funnelStage.toLowerCase();
    if (FUNNEL_LABELS[fs]) return FUNNEL_LABELS[fs];
  }
  return campaignType || "Campanha";
}

// ============ ACTION TYPE CONFIG ============

function getActionTypeConfig(actionType: string) {
  const at = (actionType || "").toLowerCase();

  if (at.includes("pause")) return { icon: <Pause className="h-3.5 w-3.5" />, label: "Pausar Campanha", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" };
  if (at.includes("scale")) return { icon: <ArrowUpRight className="h-3.5 w-3.5" />, label: "Escalar Campanha", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30" };
  if (at.includes("adjust") || at.includes("optimize")) return { icon: <Settings className="h-3.5 w-3.5" />, label: "Ajustar Campanha", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" };
  if (at.includes("restructure")) return { icon: <Wrench className="h-3.5 w-3.5" />, label: "Reestruturar", color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30" };
  if (at.includes("create") || at.includes("new")) return { icon: <Rocket className="h-3.5 w-3.5" />, label: "Criar Campanha", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" };
  return { icon: <Lightbulb className="h-3.5 w-3.5" />, label: "Ação", color: "text-muted-foreground bg-muted/50" };
}

function getCampaignTypeBadgeColor(campaignType: string, funnelStage?: string): string {
  const label = getCampaignTypeLabel(campaignType, funnelStage);
  if (label === "Remarketing" || label === "Fundo de Funil") return "text-orange-600 bg-orange-50 dark:bg-orange-950/30";
  if (label === "Teste") return "text-violet-600 bg-violet-50 dark:bg-violet-950/30";
  if (label === "Topo de Funil") return "text-sky-600 bg-sky-50 dark:bg-sky-950/30";
  if (label === "Meio de Funil") return "text-amber-600 bg-amber-50 dark:bg-amber-950/30";
  return "text-muted-foreground bg-muted/40";
}

// ============ STRUCTURED ACTION CARD ============

function StructuredActionCard({ action, index }: { action: StructuredAction; index: number }) {
  const typeConfig = getActionTypeConfig(action.action_type || "");
  const campaignTypeLabel = getCampaignTypeLabel(action.campaign_type || "", action.funnel_stage);
  const campaignTypeBadgeColor = getCampaignTypeBadgeColor(action.campaign_type || "", action.funnel_stage);

  const details: { icon: string; label: string; value: string }[] = [];
  if (action.product_name) details.push({ icon: "📦", label: "Produto", value: action.product_name });
  if (action.daily_budget_brl) details.push({ icon: "💰", label: "Orçamento diário", value: `R$ ${action.daily_budget_brl.toFixed(2)}` });
  if (action.target_audience) details.push({ icon: "🎯", label: "Público", value: action.target_audience });
  if (action.objective) details.push({ icon: "🏁", label: "Objetivo", value: translateField(action.objective, OBJECTIVE_LABELS) });
  if (action.bid_strategy) details.push({ icon: "⚡", label: "Estratégia de lance", value: translateField(action.bid_strategy, BID_STRATEGY_LABELS) });
  if (action.creatives_count) details.push({ icon: "🎨", label: "Criativos", value: `${action.creatives_count} variações` });
  if (action.copy_variations) details.push({ icon: "✍️", label: "Textos", value: `${action.copy_variations} variações` });
  if (action.expected_roas) details.push({ icon: "📈", label: "ROAS esperado", value: `${action.expected_roas}x` });
  if (action.placements) details.push({ icon: "📱", label: "Posicionamentos", value: action.placements });

  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-3 hover:border-border/60 transition-colors">
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
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", campaignTypeBadgeColor)}>
              {campaignTypeLabel}
            </span>
          </div>
          <h4 className="text-sm font-semibold text-foreground leading-snug">
            {action.product_name || action.rationale?.substring(0, 80) || "Ação planejada"}
          </h4>
        </div>
      </div>

      {details.length > 0 && (
        <div className="ml-[38px] grid gap-1.5">
          {details.map((detail, i) => (
            <div key={i} className="flex items-start gap-2 text-[13px]">
              <span className="shrink-0">{detail.icon}</span>
              <span className="text-muted-foreground font-medium shrink-0">{detail.label}:</span>
              <span className="text-foreground/80">{highlightMetrics(detail.value)}</span>
            </div>
          ))}
        </div>
      )}

      {action.rationale && (
        <div className="ml-[38px]">
          <p className="text-[13px] text-foreground/70 leading-relaxed">
            {highlightMetrics(action.rationale)}
          </p>
        </div>
      )}
    </div>
  );
}

// ============ LEGACY PARSING (for string[] format) ============

interface LegacyParsedAction {
  title: string;
  type: "create" | "adjust" | "pause" | "test" | "scale" | "other";
  details: { icon: string; label: string; value: string }[];
  bodyLines: string[];
}

function detectLegacyType(title: string): LegacyParsedAction["type"] {
  const t = title.toLowerCase();
  if (t.includes("pausar") || t.includes("desativar")) return "pause";
  if (t.includes("ajustar") || t.includes("aumentar") || t.includes("reduzir")) return "adjust";
  if (t.includes("teste") || t.includes("testar")) return "test";
  if (t.includes("escalar")) return "scale";
  if (t.includes("criar") || t.includes("lançar") || t.includes("nova")) return "create";
  return "other";
}

function getLegacyTypeConfig(type: LegacyParsedAction["type"]) {
  switch (type) {
    case "create": return { icon: <Rocket className="h-3.5 w-3.5" />, label: "Nova Campanha", color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" };
    case "adjust": return { icon: <Settings className="h-3.5 w-3.5" />, label: "Ajuste", color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" };
    case "pause": return { icon: <Pause className="h-3.5 w-3.5" />, label: "Pausar", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30" };
    case "test": return { icon: <FlaskConical className="h-3.5 w-3.5" />, label: "Teste", color: "text-violet-600 bg-violet-50 dark:bg-violet-950/30" };
    case "scale": return { icon: <ArrowUpRight className="h-3.5 w-3.5" />, label: "Escalar", color: "text-cyan-600 bg-cyan-50 dark:bg-cyan-950/30" };
    default: return { icon: <Lightbulb className="h-3.5 w-3.5" />, label: "Ação", color: "text-muted-foreground bg-muted/50" };
  }
}

function parseLegacyActions(text: string): LegacyParsedAction[] {
  if (!text) return [];
  const normalized = text.replace(/\\n/g, "\n");
  let items: string[] = [];

  if (/[•]/.test(normalized)) {
    items = normalized.split(/\s*•\s*/).map(s => s.trim()).filter(s => s.length > 15);
  }
  if (items.length <= 1) {
    const lines = normalized.split("\n").map(s => s.trim()).filter(Boolean);
    if (lines.length > 1) {
      const markerLines = lines.filter(l => /^[-*]\s/.test(l) || /^\d+[.)]\s/.test(l));
      if (markerLines.length > 1) {
        items = markerLines.map(l => l.replace(/^[-*]\s*/, "").replace(/^\d+[.)]\s*/, "").trim());
      } else {
        items = lines.filter(l => l.length > 15);
      }
    }
  }
  if (items.length === 0) return [];

  return items.map((item) => {
    const cleanItem = sanitize(item);
    let title: string, body: string;
    const colonIdx = cleanItem.indexOf(":");
    if (colonIdx > 5 && colonIdx < 120) {
      title = cleanItem.substring(0, colonIdx).trim();
      body = cleanItem.substring(colonIdx + 1).trim();
    } else {
      title = cleanItem.length > 80 ? cleanItem.substring(0, 77) + "…" : cleanItem;
      body = "";
    }
    const type = detectLegacyType(title);
    const details: { icon: string; label: string; value: string }[] = [];
    const productMatch = body.match(/(?:para\s+o\s+(?:produto\s+)?|promovendo\s+)[""]?([^""",.(]{3,60})[""]?/i);
    if (productMatch) details.push({ icon: "📦", label: "Produto", value: productMatch[1].trim() });
    const budgetMatch = body.match(/(?:orçamento|budget)\s+(?:diário\s+)?(?:de\s+)?R\$\s*([\d.,]+)/i);
    if (budgetMatch) details.push({ icon: "💰", label: "Orçamento diário", value: `R$ ${budgetMatch[1]}` });
    const bodyLines = body ? [body.substring(0, 200)] : [];
    return { title, type, details, bodyLines };
  });
}

function LegacyActionCard({ action, index }: { action: LegacyParsedAction; index: number }) {
  const typeConfig = getLegacyTypeConfig(action.type);
  return (
    <div className="rounded-xl border border-border/40 bg-background/50 p-4 space-y-3 hover:border-border/60 transition-colors">
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
          <h4 className="text-sm font-semibold text-foreground leading-snug">{action.title}</h4>
        </div>
      </div>
      {action.details.length > 0 && (
        <div className="ml-[38px] grid gap-1.5">
          {action.details.map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-[13px]">
              <span className="shrink-0">{d.icon}</span>
              <span className="text-muted-foreground font-medium shrink-0">{d.label}:</span>
              <span className="text-foreground/80">{highlightMetrics(d.value)}</span>
            </div>
          ))}
        </div>
      )}
      {action.bodyLines.length > 0 && (
        <div className="ml-[38px] space-y-1">
          {action.bodyLines.map((line, i) => (
            <p key={i} className="text-[13px] text-foreground/70 leading-relaxed">{highlightMetrics(line)}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ BUDGET ALLOCATION ============

function BudgetAllocationSection({ budget }: { budget: BudgetAllocation }) {
  const segments = [
    { label: "Topo de Funil (Aquisição)", pct: budget.tof_pct || 0, brl: budget.tof_brl || 0, color: "bg-sky-500" },
    { label: "Fundo de Funil (Remarketing)", pct: budget.bof_pct || 0, brl: budget.bof_brl || 0, color: "bg-orange-500" },
    { label: "Testes", pct: budget.test_pct || 0, brl: budget.test_brl || 0, color: "bg-violet-500" },
  ].filter(s => s.pct > 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Total diário:</span>
        <span className="font-semibold text-foreground">R$ {(budget.total_daily_brl || 0).toFixed(2)}</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-muted/30">
        {segments.map((s, i) => (
          <div key={i} className={cn("h-full transition-all", s.color)} style={{ width: `${s.pct}%` }} />
        ))}
      </div>
      <div className="grid gap-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-2">
              <div className={cn("w-2.5 h-2.5 rounded-full", s.color)} />
              <span className="text-foreground/80">{s.label}</span>
            </div>
            <span className="font-medium text-foreground">
              R$ {s.brl.toFixed(2)} <span className="text-muted-foreground">({s.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ SHARED COMPONENTS ============

function FlowingText({ text, className }: { text: string; className?: string }) {
  const sanitized = sanitize(text);
  if (!sanitized) return null;
  const paragraphs = sanitized.replace(/\\n/g, "\n").split(/\n\s*\n/).map(p => p.replace(/\n/g, " ").trim()).filter(Boolean);
  return (
    <div className={cn("space-y-3", className)}>
      {paragraphs.map((para, i) => (
        <p key={i} className="text-[13px] text-foreground/80 leading-[1.8]">{highlightMetrics(para)}</p>
      ))}
    </div>
  );
}

function Section({ icon, label, color, children }: { icon: React.ReactNode; label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className={cn("flex items-center gap-2", color)}>
        {icon}
        <h3 className="text-sm font-bold tracking-tight">{label}</h3>
      </div>
      <div className="bg-muted/20 rounded-xl p-4 border border-border/30">{children}</div>
    </div>
  );
}

// ============ MAIN COMPONENT ============

/** Detect if actions are structured objects (v6) or legacy strings */
function isStructuredActions(actions: unknown): actions is StructuredAction[] {
  if (!Array.isArray(actions) || actions.length === 0) return false;
  const first = actions[0];
  return typeof first === "object" && first !== null && ("action_type" in first || "campaign_type" in first || "product_name" in first);
}

export function StrategicPlanContent({
  diagnosis,
  plannedActions,
  expectedResults,
  riskAssessment,
  timeline,
  reasoning,
  budgetAllocation,
  className,
}: StrategicPlanContentProps) {
  const diagnosisText = diagnosis || (reasoning && !plannedActions ? reasoning : null);

  // Determine action format
  const structured = isStructuredActions(plannedActions);
  const legacyText = !structured && plannedActions
    ? Array.isArray(plannedActions)
      ? (plannedActions as string[]).join("\n")
      : String(plannedActions)
    : "";
  const legacyCards = !structured ? parseLegacyActions(legacyText) : [];
  const hasActions = structured ? (plannedActions as StructuredAction[]).length > 0 : legacyCards.length > 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* 1. DIAGNÓSTICO */}
      {diagnosisText && (
        <Section icon={<AlertTriangle className="h-4 w-4" />} label="Diagnóstico" color="text-amber-500">
          <FlowingText text={diagnosisText} />
        </Section>
      )}

      {/* 2. AÇÕES PLANEJADAS */}
      {hasActions && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <ListChecks className="h-4 w-4" />
            <h3 className="text-sm font-bold tracking-tight">Ações Planejadas</h3>
            <span className="ml-1 text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              {structured ? (plannedActions as StructuredAction[]).length : legacyCards.length}{" "}
              {(structured ? (plannedActions as StructuredAction[]).length : legacyCards.length) === 1 ? "ação" : "ações"}
            </span>
          </div>
          <div className="space-y-3">
            {structured
              ? (plannedActions as StructuredAction[]).map((action, i) => (
                  <StructuredActionCard key={i} action={action} index={i} />
                ))
              : legacyCards.map((action, i) => (
                  <LegacyActionCard key={i} action={action} index={i} />
                ))}
          </div>
        </div>
      )}

      {/* 2b. Raw text fallback */}
      {legacyText && !hasActions && (
        <Section icon={<ListChecks className="h-4 w-4" />} label="Ações Planejadas" color="text-primary">
          <FlowingText text={legacyText} />
        </Section>
      )}

      {/* 3. ALOCAÇÃO DE ORÇAMENTO */}
      {budgetAllocation && budgetAllocation.total_daily_brl && (
        <Section icon={<PieChart className="h-4 w-4" />} label="Alocação de Orçamento" color="text-indigo-500">
          <BudgetAllocationSection budget={budgetAllocation} />
        </Section>
      )}

      {/* 4. RESULTADOS ESPERADOS */}
      {expectedResults && (
        <Section icon={<TrendingUp className="h-4 w-4" />} label="Resultados Esperados" color="text-emerald-500">
          <FlowingText text={String(expectedResults)} />
        </Section>
      )}

      {/* 5. RISCOS */}
      {riskAssessment && (
        <Section icon={<ShieldAlert className="h-4 w-4" />} label="Riscos" color="text-destructive">
          <FlowingText text={String(riskAssessment)} />
        </Section>
      )}

      {/* 6. CRONOGRAMA */}
      {timeline && (
        <Section icon={<Clock className="h-4 w-4" />} label="Cronograma" color="text-blue-500">
          <FlowingText text={String(timeline)} />
        </Section>
      )}

      {/* 7. REASONING fallback */}
      {reasoning && !diagnosis && !plannedActions && (
        <Section icon={<BarChart3 className="h-4 w-4" />} label="Análise da IA" color="text-muted-foreground">
          <FlowingText text={reasoning} />
        </Section>
      )}
    </div>
  );
}
