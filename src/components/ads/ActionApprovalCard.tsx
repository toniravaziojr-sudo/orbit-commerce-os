// =============================================
// ACTION APPROVAL CARD — v5.12.9
// Compact preview + "Ver completo" dialog
// =============================================

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, X, MessageSquare, ChevronDown, Megaphone, ImageIcon, DollarSign, Target, Sparkles, ZoomIn, Bot, AlertTriangle, TrendingUp, ListChecks, Clock, Eye } from "lucide-react";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { cn } from "@/lib/utils";
import { StrategicPlanContent } from "./StrategicPlanContent";

interface ActionApprovalCardProps {
  action: PendingAction;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string, reason: string) => void;
  onAdjust: (actionId: string, suggestion: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

const FUNNEL_LABELS: Record<string, { label: string; color: string }> = {
  tof: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  cold: { label: "Público Frio", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  bof: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  remarketing: { label: "Remarketing", color: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
  mof: { label: "Público Morno", color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20" },
  test: { label: "Teste", color: "bg-purple-500/10 text-purple-700 border-purple-500/20" },
  leads: { label: "Captação", color: "bg-green-500/10 text-green-700 border-green-500/20" },
};

const ACTION_TYPE_ICONS: Record<string, typeof Target> = {
  create_campaign: Megaphone,
  generate_creative: ImageIcon,
  adjust_budget: DollarSign,
  pause_campaign: Target,
  activate_campaign: Sparkles,
  strategic_plan: Bot,
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  create_campaign: "Nova Campanha",
  generate_creative: "Criativo Gerado",
  adjust_budget: "Ajuste de Orçamento",
  pause_campaign: "Pausar Campanha",
  activate_campaign: "Ativar Campanha",
  strategic_plan: "Plano Estratégico",
};

function formatCents(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

/** Remove technical IDs (UUIDs, long numbers, act_ prefixes) and clean up text for display */
function sanitizeDisplayText(text: string): string {
  if (!text) return text;
  return text
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\bact_\d{10,}\b/g, "")
    .replace(/\b(asset ready|asset pending)\s+[0-9a-f-]{20,}/gi, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Truncate text to N chars, adding ellipsis */
function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

function BudgetBar({ snapshot }: { snapshot: any }) {
  if (!snapshot || !snapshot.limit_cents) return null;
  const limit = snapshot.limit_cents;
  const active = snapshot.active_cents || 0;
  const reserved = snapshot.pending_reserved_cents || 0;
  const activePct = Math.min((active / limit) * 100, 100);
  const reservedPct = Math.min((reserved / limit) * 100, 100 - activePct);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>Orçamento da conta</span>
        <span className="font-medium">{formatCents(limit)}/dia</span>
      </div>
      <div className="h-2 rounded-full bg-muted/40 overflow-hidden flex">
        {activePct > 0 && (
          <div className="h-full bg-emerald-500 rounded-l-full" style={{ width: `${activePct}%` }} />
        )}
        {reservedPct > 0 && (
          <div className="h-full bg-amber-400" style={{ width: `${reservedPct}%` }} />
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          Ativo {formatCents(active)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
          Reservado {formatCents(reserved)}
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted inline-block" />
          Restante {formatCents(Math.max(0, limit - active - reserved))}
        </span>
      </div>
    </div>
  );
}

const CTA_LABELS: Record<string, string> = {
  SHOP_NOW: "Comprar Agora",
  BUY_NOW: "Comprar",
  LEARN_MORE: "Saiba Mais",
  SIGN_UP: "Cadastre-se",
  SUBSCRIBE: "Assinar",
  CONTACT_US: "Fale Conosco",
  GET_OFFER: "Ver Oferta",
};

/* ========================================
   FULL CONTENT DIALOG
   Shows all fields in a well-formatted view
   ======================================== */
function FullContentDialog({ action, open, onOpenChange }: { action: PendingAction; open: boolean; onOpenChange: (o: boolean) => void }) {
  const data = action.action_data || {};
  const preview = data.preview || {};
  const isStrategicPlan = action.action_type === "strategic_plan";

  const creativeUrl = preview.creative_url || data.asset_url || data.creative_url || null;
  const headline = preview.headline || data.headline || null;
  const copyText = preview.copy_text || data.copy_text || null;
  const ctaType = preview.cta_type || data.cta_type || null;
  const productName = preview.product_name || data.product_name || null;
  const productPrice = preview.product_price_display || (preview.product_price ? formatCents(preview.product_price) : null);
  const targeting = preview.targeting_summary || null;
  const ageRange = preview.age_range || null;
  const budgetDisplay = preview.daily_budget_display || (data.daily_budget_cents ? `R$ ${(data.daily_budget_cents / 100).toFixed(2)}/dia` : null);
  const budgetSnapshot = preview.budget_snapshot || null;

  const diagnosis = data.diagnosis || preview.copy_text || null;
  const plannedActions = data.planned_actions || null;
  const expectedResults = data.expected_results || null;
  const riskAssessment = data.risk_assessment || null;
  const timeline = data.timeline || null;

  const label = ACTION_TYPE_LABELS[action.action_type] || action.action_type;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/30">
          <DialogTitle className="flex items-center gap-2 text-base">
            {isStrategicPlan ? <Bot className="h-4 w-4 text-primary" /> : <Megaphone className="h-4 w-4 text-primary" />}
            {label}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {new Date(action.created_at).toLocaleString("pt-BR")}
            {action.confidence && (
              <> · Confiança: {action.confidence === "high" ? "Alta" : action.confidence === "medium" ? "Média" : "Baixa"}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-4 px-5 py-4">
            {/* Creative image */}
            {creativeUrl && (
              <div className="rounded-lg overflow-hidden border border-border/40 bg-muted/10">
                <img src={creativeUrl} alt="Criativo" className="w-full max-h-[300px] object-contain" />
              </div>
            )}

            {/* Headline & Copy (non-strategic) */}
            {headline && !isStrategicPlan && (
              <div>
                <SectionLabel icon={<Sparkles className="h-3.5 w-3.5 text-primary" />} label="Headline" />
                <p className="text-sm font-semibold mt-1">{headline}</p>
              </div>
            )}
            {copyText && !isStrategicPlan && (
              <div>
                <SectionLabel icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />} label="Copy" />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1 leading-relaxed">{copyText}</p>
              </div>
            )}
            {ctaType && !isStrategicPlan && (
              <Badge variant="secondary" className="text-xs">{CTA_LABELS[ctaType] || ctaType}</Badge>
            )}

            {/* Product & Budget */}
            {(productName || budgetDisplay || targeting) && !isStrategicPlan && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                {productName && (
                  <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30">
                    <span className="text-muted-foreground">Produto</span>
                    <p className="font-medium mt-0.5">{productName}{productPrice && ` — ${productPrice}`}</p>
                  </div>
                )}
                {budgetDisplay && (
                  <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30">
                    <span className="text-muted-foreground">Orçamento</span>
                    <p className="font-semibold mt-0.5">{budgetDisplay}</p>
                  </div>
                )}
                {targeting && (
                  <div className="col-span-2 bg-muted/30 rounded-lg p-2.5 border border-border/30">
                    <span className="text-muted-foreground">Público</span>
                    <p className="font-medium mt-0.5">{sanitizeDisplayText(targeting)}{ageRange && ` (${ageRange} anos)`}</p>
                  </div>
                )}
              </div>
            )}

            {/* Strategic Plan — Formatted Content */}
            {isStrategicPlan && (
              <StrategicPlanContent
                diagnosis={diagnosis}
                plannedActions={plannedActions}
                expectedResults={expectedResults}
                riskAssessment={riskAssessment}
                timeline={timeline}
                reasoning={action.reasoning}
              />
            )}

            {/* Reasoning & Impact (for non-strategic types) */}
            {!isStrategicPlan && action.reasoning && (
              <div>
                <SectionLabel icon={<Bot className="h-3.5 w-3.5 text-muted-foreground" />} label="Raciocínio da IA" />
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 mt-1.5">
                  {sanitizeDisplayText(action.reasoning)}
                </div>
              </div>
            )}
            {action.expected_impact && (
              <div>
                <SectionLabel icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-500" />} label="Impacto Esperado" />
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30 mt-1.5">
                  {sanitizeDisplayText(action.expected_impact)}
                </div>
              </div>
            )}

            {/* Budget Bar */}
            {budgetSnapshot && <BudgetBar snapshot={budgetSnapshot} />}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
      {icon}
      {label}
    </div>
  );
}

/* ========================================
   MAIN CARD COMPONENT
   Shows compact preview + "Ver completo"
   ======================================== */
export function ActionApprovalCard({ action, onApprove, onReject, onAdjust, isApproving, isRejecting }: ActionApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [adjustSuggestion, setAdjustSuggestion] = useState("");

  const data = action.action_data || {};
  const preview = data.preview || {};
  const Icon = ACTION_TYPE_ICONS[action.action_type] || Target;
  const isStrategicPlan = action.action_type === "strategic_plan";

  const creativeUrl = preview.creative_url || data.asset_url || data.creative_url || null;
  const headline = preview.headline || data.headline || null;
  const copyText = preview.copy_text || data.copy_text || null;
  const funnel = preview.funnel_stage || data.funnel_stage || null;
  const funnelInfo = funnel ? FUNNEL_LABELS[funnel] || { label: funnel, color: "bg-muted text-muted-foreground" } : null;
  const budgetDisplay = preview.daily_budget_display || (data.daily_budget_cents ? `R$ ${(data.daily_budget_cents / 100).toFixed(2)}/dia` : null);
  const campaignName = preview.campaign_name || data.campaign_name || null;

  // For strategic plans, build a summary from diagnosis
  const diagnosis = data.diagnosis || null;
  const summaryText = isStrategicPlan
    ? sanitizeDisplayText(diagnosis || preview.copy_text || "")
    : sanitizeDisplayText(copyText || action.reasoning || "");

  const label = ACTION_TYPE_LABELS[action.action_type] || action.action_type;

  const handleRejectSubmit = () => {
    if (!rejectReason.trim()) return;
    onReject(action.id, rejectReason);
    setRejectOpen(false);
    setRejectReason("");
  };

  const handleAdjustSubmit = () => {
    if (!adjustSuggestion.trim()) return;
    onAdjust(action.id, adjustSuggestion);
    setAdjustOpen(false);
    setAdjustSuggestion("");
  };

  return (
    <>
      <Card className="border-border/60 hover:border-primary/20 transition-colors overflow-hidden min-w-0">
        <div className="flex gap-0">
          {/* Thumbnail (for standard actions with creatives) */}
          {!isStrategicPlan && (
            <div className="w-[100px] min-h-[100px] flex-shrink-0 bg-muted/20 border-r border-border/40 relative group cursor-pointer" onClick={() => creativeUrl && setZoomOpen(true)}>
              {creativeUrl ? (
                <>
                  <img src={creativeUrl} alt="Criativo" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-5 w-5 text-white" />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                </div>
              )}
            </div>
          )}

          {/* Main Info — Compact */}
          <div className="flex-1 p-3 space-y-1.5 min-w-0 overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn("p-1.5 rounded-md", isStrategicPlan ? "bg-primary/10" : "bg-muted/50")}>
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(action.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              {funnelInfo && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 ml-auto", funnelInfo.color)}>
                  {funnelInfo.label}
                </Badge>
              )}
            </div>

            {/* Headline */}
            {headline && !isStrategicPlan && (
              <p className="text-sm font-semibold leading-tight truncate">{headline}</p>
            )}

            {/* Compact summary — max 150 chars */}
            {summaryText && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {truncate(summaryText, 200)}
              </p>
            )}

            {/* Quick info chips */}
            <div className="flex items-center gap-2 flex-wrap">
              {budgetDisplay && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                  <DollarSign className="h-2.5 w-2.5" />
                  {budgetDisplay}
                </Badge>
              )}
              {campaignName && !isStrategicPlan && (
                <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{campaignName}</span>
              )}
            </div>

            {/* "Ver completo" button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullOpen(true)}
              className="h-7 text-xs gap-1 text-primary hover:text-primary px-2 -ml-2"
            >
              <Eye className="h-3 w-3" />
              Ver conteúdo completo
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        <CardFooter className="px-3 pb-3 pt-0 gap-2 border-t border-border/30">
          <Button
            size="sm"
            onClick={() => onApprove(action.id)}
            disabled={isApproving}
            className="flex-1 h-8 text-xs gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Aprovar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdjustOpen(true)}
            className="flex-1 h-8 text-xs gap-1.5"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Ajustar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRejectOpen(true)}
            disabled={isRejecting}
            className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
        </CardFooter>
      </Card>

      {/* Full Content Dialog */}
      <FullContentDialog action={action} open={fullOpen} onOpenChange={setFullOpen} />

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Ação</DialogTitle>
            <DialogDescription>
              Explique por que esta ação não deve ser executada. A IA usará seu feedback para melhorar futuras sugestões.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Ex: Não quero anunciar este produto agora, focar em outro..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRejectSubmit} disabled={!rejectReason.trim()}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sugerir Ajuste</DialogTitle>
            <DialogDescription>
              Descreva o que deve ser alterado. A IA fará o ajuste e gerará uma nova proposta para aprovação.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={adjustSuggestion}
            onChange={(e) => setAdjustSuggestion(e.target.value)}
            placeholder="Ex: Alterar a copy para focar mais no benefício X, mudar o orçamento para R$50/dia..."
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdjustSubmit} disabled={!adjustSuggestion.trim()}>
              Enviar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Zoom Dialog */}
      {creativeUrl && (
        <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
          <DialogContent className="sm:max-w-2xl p-2">
            <img
              src={creativeUrl}
              alt="Criativo ampliado"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
