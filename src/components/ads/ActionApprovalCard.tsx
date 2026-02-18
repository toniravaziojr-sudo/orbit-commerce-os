// =============================================
// ACTION APPROVAL CARD
// Card showing a pending AI action for user review
// =============================================

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, MessageSquare, Target, DollarSign, Sparkles, Image as ImageIcon, Megaphone } from "lucide-react";
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

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: typeof Target; color: string }> = {
  create_campaign: { label: "Nova Campanha", icon: Megaphone, color: "text-blue-600 bg-blue-500/10" },
  generate_creative: { label: "Novo Criativo", icon: ImageIcon, color: "text-purple-600 bg-purple-500/10" },
  adjust_budget: { label: "Ajuste de Orçamento", icon: DollarSign, color: "text-green-600 bg-green-500/10" },
  pause_campaign: { label: "Pausar Campanha", icon: Target, color: "text-orange-600 bg-orange-500/10" },
  activate_campaign: { label: "Ativar Campanha", icon: Sparkles, color: "text-emerald-600 bg-emerald-500/10" },
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-green-500/10 text-green-700 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  low: "bg-red-500/10 text-red-700 border-red-500/20",
};

export function ActionApprovalCard({ action, onApprove, onReject, onAdjust, isApproving, isRejecting }: ActionApprovalCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [adjustSuggestion, setAdjustSuggestion] = useState("");

  const typeInfo = ACTION_TYPE_LABELS[action.action_type] || { label: action.action_type, icon: Target, color: "text-muted-foreground bg-muted" };
  const TypeIcon = typeInfo.icon;

  const data = action.action_data || {};
  const creativeUrl = data.asset_url || data.creative_url || data.image_url || null;

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
      <Card className="border-border/60 hover:border-primary/20 transition-colors">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", typeInfo.color)}>
                <TypeIcon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">{typeInfo.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(action.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            {action.confidence && (
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", CONFIDENCE_COLORS[action.confidence] || "")}>
                {action.confidence === "high" ? "Alta" : action.confidence === "medium" ? "Média" : "Baixa"} confiança
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 space-y-3">
          {/* Reasoning */}
          {action.reasoning && (
            <div className="text-xs text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-3">
              <span className="font-medium text-foreground">Por quê: </span>
              {action.reasoning}
            </div>
          )}

          {/* Action Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {data.campaign_name && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Campanha: </span>
                <span className="font-medium">{data.campaign_name}</span>
              </div>
            )}
            {data.product_name && (
              <div>
                <span className="text-muted-foreground">Produto: </span>
                <span className="font-medium">{data.product_name}</span>
              </div>
            )}
            {data.funnel_stage && (
              <div>
                <span className="text-muted-foreground">Funil: </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {data.funnel_stage === "tof" || data.funnel_stage === "cold" ? "Público Frio" : 
                   data.funnel_stage === "remarketing" || data.funnel_stage === "bof" ? "Remarketing" : 
                   data.funnel_stage}
                </Badge>
              </div>
            )}
            {data.daily_budget_cents && (
              <div>
                <span className="text-muted-foreground">Orçamento: </span>
                <span className="font-medium">R$ {(data.daily_budget_cents / 100).toFixed(2)}/dia</span>
              </div>
            )}
            {data.objective && (
              <div>
                <span className="text-muted-foreground">Objetivo: </span>
                <span className="font-medium">{data.objective}</span>
              </div>
            )}
          </div>

          {/* Copy preview */}
          {data.copy_text && (
            <div className="bg-muted/20 rounded-lg p-3 border border-border/40">
              <p className="text-[10px] text-muted-foreground font-medium mb-1">Copy do anúncio</p>
              <p className="text-xs leading-relaxed line-clamp-4">{data.copy_text}</p>
              {data.headline && (
                <p className="text-xs font-semibold mt-1.5">📌 {data.headline}</p>
              )}
            </div>
          )}

          {/* Creative preview */}
          {creativeUrl && (
            <div className="rounded-lg overflow-hidden border border-border/40">
              <img src={creativeUrl} alt="Criativo" className="w-full h-auto max-h-48 object-contain bg-muted/10" />
            </div>
          )}

          {/* Expected impact */}
          {action.expected_impact && (
            <p className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Impacto esperado: </span>
              {action.expected_impact}
            </p>
          )}
        </CardContent>

        <CardFooter className="px-4 pb-4 pt-0 gap-2">
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
    </>
  );
}
