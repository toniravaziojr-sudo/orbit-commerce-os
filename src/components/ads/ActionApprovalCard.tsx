// =============================================
// ACTION APPROVAL CARD — v5.12.8
// Preview-first card: creative, copy, audience, budget bar
// Technical details hidden in collapsible
// =============================================

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, MessageSquare, ChevronDown, Megaphone, ImageIcon, DollarSign, Target, Sparkles, ZoomIn } from "lucide-react";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { cn } from "@/lib/utils";

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

function BudgetBar({ snapshot, proposedCents }: { snapshot: any; proposedCents?: number }) {
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

export function ActionApprovalCard({ action, onApprove, onReject, onAdjust, isApproving, isRejecting }: ActionApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [adjustSuggestion, setAdjustSuggestion] = useState("");
  const [techOpen, setTechOpen] = useState(false);

  const data = action.action_data || {};
  const preview = data.preview || {};
  const Icon = ACTION_TYPE_ICONS[action.action_type] || Target;

  // Preview fields
  const creativeUrl = preview.creative_url || data.asset_url || data.creative_url || null;
  const headline = preview.headline || data.headline || null;
  const copyText = preview.copy_text || data.copy_text || null;
  const ctaType = preview.cta_type || data.cta_type || null;
  const productName = preview.product_name || data.product_name || null;
  const productPrice = preview.product_price_display || (preview.product_price ? formatCents(preview.product_price) : null);
  const funnel = preview.funnel_stage || data.funnel_stage || null;
  const funnelInfo = funnel ? FUNNEL_LABELS[funnel] || { label: funnel, color: "bg-muted text-muted-foreground" } : null;
  const targeting = preview.targeting_summary || null;
  const budgetDisplay = preview.daily_budget_display || (data.daily_budget_cents ? `R$ ${(data.daily_budget_cents / 100).toFixed(2)}/dia` : null);
  const budgetSnapshot = preview.budget_snapshot || null;
  const ageRange = preview.age_range || null;
  const campaignName = preview.campaign_name || data.campaign_name || null;

  const CTA_LABELS: Record<string, string> = {
    SHOP_NOW: "Comprar Agora",
    BUY_NOW: "Comprar",
    LEARN_MORE: "Saiba Mais",
    SIGN_UP: "Cadastre-se",
    SUBSCRIBE: "Assinar",
    CONTACT_US: "Fale Conosco",
    GET_OFFER: "Ver Oferta",
  };

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
        {/* Creative + Copy Section */}
        <div className="flex gap-0">
          {/* Thumbnail */}
          <div className="w-[120px] min-h-[120px] flex-shrink-0 bg-muted/20 border-r border-border/40 relative group cursor-pointer" onClick={() => creativeUrl && setZoomOpen(true)}>
            {creativeUrl ? (
              <>
                <img
                  src={creativeUrl}
                  alt="Criativo"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <ZoomIn className="h-5 w-5 text-white" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                <span className="sr-only">Criativo não disponível</span>
              </div>
            )}
          </div>

          {/* Main Info */}
          <div className="flex-1 p-3 space-y-2 min-w-0 overflow-hidden">
            {/* Header: Type + Date */}
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <span className="text-[11px] text-muted-foreground">
                {new Date(action.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </span>
              {funnelInfo && (
                <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 ml-auto", funnelInfo.color)}>
                  {funnelInfo.label}
                </Badge>
              )}
            </div>

            {/* Headline */}
            {headline && (
              <p className="text-sm font-semibold leading-tight line-clamp-2">{headline}</p>
            )}

            {/* Copy */}
            {copyText && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{copyText}</p>
            )}

            {/* CTA Badge */}
            {ctaType && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                {CTA_LABELS[ctaType] || ctaType}
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="px-3 pb-3 pt-0 space-y-2.5 border-t border-border/30">
          {/* Product + Budget Row */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2.5">
            {productName && (
              <div>
                <span className="text-muted-foreground">Produto: </span>
                <span className="font-medium">{productName}</span>
                {productPrice && <span className="text-muted-foreground"> — {productPrice}</span>}
              </div>
            )}
            {budgetDisplay && (
              <div>
                <span className="text-muted-foreground">Orçamento: </span>
                <span className="font-semibold text-foreground">{budgetDisplay}</span>
              </div>
            )}
            {targeting && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Público: </span>
                <span className="font-medium break-words break-all">{sanitizeDisplayText(targeting)}</span>
                {ageRange && <span className="text-muted-foreground"> ({ageRange} anos)</span>}
              </div>
            )}
          </div>

          {/* Budget Bar */}
          <BudgetBar snapshot={budgetSnapshot} proposedCents={data.daily_budget_cents} />

          {/* Technical Details — Collapsed */}
          <Collapsible open={techOpen} onOpenChange={setTechOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full">
              <ChevronDown className={cn("h-3 w-3 transition-transform", techOpen && "rotate-180")} />
              Detalhes técnicos
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/20 rounded-lg p-2.5 space-y-1.5 text-[10px] text-muted-foreground">
                {action.confidence && (
                  <div><span className="font-medium">Confiança:</span> {action.confidence === "high" ? "Alta" : action.confidence === "medium" ? "Média" : "Baixa"}</div>
                )}
                {action.reasoning && (
                  <div><span className="font-medium">Raciocínio:</span> {action.reasoning}</div>
                )}
                {action.expected_impact && (
                  <div><span className="font-medium">Impacto esperado:</span> {action.expected_impact}</div>
                )}
                {campaignName && (
                  <div><span className="font-medium">Campanha:</span> {campaignName}</div>
                )}
                <div><span className="font-medium">Session:</span> {action.session_id?.slice(0, 8)}...</div>
                <div><span className="font-medium">ID:</span> {action.id?.slice(0, 8)}...</div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>

        <CardFooter className="px-3 pb-3 pt-0 gap-2">
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
