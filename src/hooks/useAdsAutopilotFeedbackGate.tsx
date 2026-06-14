// =====================================================================
// useAdsAutopilotFeedbackGate — Subfase A.2 (Etapa 7.mem)
//
// Intercepta os cliques de "Aprovar" e "Recusar" do Ads Autopilot
// abrindo um diálogo que exige motivo controlado (catálogo A.1).
// O feedback é gravado via edge function `ads-autopilot-feedback-record`
// ANTES de a decisão original (aprovação/recusa) seguir.
//
// Garantias:
// - não altera prompts, Policy Engine, Verdict Layer, Governance Layer;
// - não dispara autoexecução;
// - não chama a Meta;
// - se a gravação do feedback falhar, a decisão NÃO prossegue.
// =====================================================================

import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type DecisionMode = "approve" | "reject";

export interface FeedbackTargetAction {
  id: string;
  tenant_id?: string;
  channel?: string | null;
  action_type?: string | null;
  action_data?: Record<string, any> | null;
  reasoning?: string | null;
  expected_impact?: string | null;
}

interface OpenRequest {
  mode: DecisionMode;
  action: FeedbackTargetAction;
  onConfirmed: () => void;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  strategic_plan: "Plano estratégico",
  create_campaign: "Criar campanha",
  create_adset: "Criar conjunto de anúncios",
  generate_creative: "Gerar criativo",
  adjust_budget: "Ajustar orçamento",
  allocate_budget: "Realocar orçamento",
  pause_campaign: "Pausar campanha",
  activate_campaign: "Ativar campanha",
  duplicate_campaign: "Duplicar campanha",
  duplicate_adset: "Duplicar conjunto",
  duplicate_creative: "Duplicar criativo",
};

function translateActionType(code?: string | null): string | null {
  if (!code) return null;
  return ACTION_TYPE_LABELS[code] || code.replace(/_/g, " ");
}


function buildSummary(action: FeedbackTargetAction) {
  const ad = (action.action_data || {}) as Record<string, any>;
  const preview = (ad.preview || {}) as Record<string, any>;
  return {
    campaign_name:
      ad.campaign_name || preview.campaign_name || ad.parent_campaign_name || null,
    campaign_id: ad.campaign_id || preview.campaign_id || null,
    objective: ad.objective || preview.objective || null,
    ad_account_id: ad.ad_account_id || preview.ad_account_id || null,
    expected_impact: action.expected_impact || preview.expected_impact || null,
    action_type: action.action_type || null,
    metrics_snapshot: ad.metrics_snapshot || preview.metrics_snapshot || {},
    policy_check_result: ad.policy_check_result || preview.policy_check_result || null,
    functional_state: ad.functional_state || preview.functional_state || null,
    proposed_verdict: ad.proposed_verdict || preview.proposed_verdict || null,
    action_class: ad.action_class || preview.action_class || null,
    suggestion_group_id: ad.suggestion_group_id || preview.suggestion_group_id || null,
    recommendation_id: ad.recommendation_id || preview.recommendation_id || null,
    sales_platform: ad.sales_platform || preview.sales_platform || null,
  };
}

export function useAdsAutopilotFeedbackGate(tenantId?: string | null) {
  const [request, setRequest] = useState<OpenRequest | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [wouldDoManually, setWouldDoManually] = useState(false);
  const [shouldBecomePreference, setShouldBecomePreference] = useState(false);
  const [ignoredContext, setIgnoredContext] = useState(false);
  const [ignoredContextText, setIgnoredContextText] = useState("");
  const [saving, setSaving] = useState(false);


  const resetForm = useCallback(() => {
    setReasonText("");
    setWouldDoManually(false);
    setShouldBecomePreference(false);
    setIgnoredContext(false);
    setIgnoredContextText("");
  }, []);


  const requestApproval = useCallback(
    (action: FeedbackTargetAction, onConfirmed: () => void) => {
      resetForm();
      setRequest({ mode: "approve", action, onConfirmed });
    },
    [resetForm],
  );

  const requestRejection = useCallback(
    (action: FeedbackTargetAction, onConfirmed: () => void) => {
      resetForm();
      setRequest({ mode: "reject", action, onConfirmed });
    },
    [resetForm],
  );

  const close = useCallback(() => {
    if (saving) return;
    setRequest(null);
    resetForm();
  }, [saving, resetForm]);

  const toggleReason = useCallback((code: string) => {
    setSelectedReasons((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!request) return;
    if (selectedReasons.length === 0) {
      toast.error("Selecione ao menos um motivo");
      return;
    }
    if (reasonText.trim().length < 100) {
      toast.error(
        "Explique sua decisão com pelo menos 100 caracteres — esse texto vira instrução para a IA.",
      );
      return;
    }
    const effectiveTenant = tenantId || request.action.tenant_id;
    if (!effectiveTenant) {
      toast.error("Não foi possível identificar o tenant");
      return;
    }

    const summary = buildSummary(request.action);
    const decision = request.mode === "approve" ? "approved" : "rejected";
    const adsPlatform = (request.action.channel || "meta").toString();

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        tenant_id: effectiveTenant,
        action_id: request.action.id,
        recommendation_id: summary.recommendation_id || null,
        suggestion_group_id: summary.suggestion_group_id || null,
        sales_platform: summary.sales_platform || null,
        ads_platform: adsPlatform,
        ad_account_id: summary.ad_account_id || null,
        campaign_id: summary.campaign_id || null,
        campaign_name: summary.campaign_name || null,
        objective: summary.objective || null,
        functional_state: summary.functional_state || null,
        proposed_verdict: summary.proposed_verdict || null,
        action_type: summary.action_type || null,
        action_class: summary.action_class || null,
        metrics_snapshot: summary.metrics_snapshot || {},
        policy_check_result: summary.policy_check_result || null,
        observation: request.action.reasoning || null,
        decision,
        reason_codes: selectedReasons,
        reason_text: reasonText.trim() || null,
        should_become_preference: shouldBecomePreference || null,
      };

      if (request.mode === "approve") {
        payload.would_do_manually = wouldDoManually || null;
      } else {
        payload.ignored_context = ignoredContext || null;
        payload.ignored_context_text =
          ignoredContext && ignoredContextText.trim()
            ? ignoredContextText.trim()
            : null;
      }

      const { data, error } = await supabase.functions.invoke(
        "ads-autopilot-feedback-record",
        { body: payload },
      );

      if (error) throw new Error(error.message || "Falha ao registrar feedback");
      if (!data?.success) {
        throw new Error(
          data?.error
            ? `Não foi possível registrar o feedback (${data.error})`
            : "Não foi possível registrar o feedback",
        );
      }

      const onConfirmed = request.onConfirmed;
      setRequest(null);
      resetForm();
      onConfirmed();
    } catch (err: any) {
      toast.error(
        err?.message || "Erro ao salvar feedback. Tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    request,
    selectedReasons,
    reasonText,
    wouldDoManually,
    shouldBecomePreference,
    ignoredContext,
    ignoredContextText,
    tenantId,
    resetForm,
  ]);

  const reasons = useMemo(
    () => (request?.mode === "approve" ? APPROVAL_REASONS : REJECTION_REASONS),
    [request?.mode],
  );

  const summary = request ? buildSummary(request.action) : null;
  const isApprove = request?.mode === "approve";
  const MIN_COMMENT_CHARS = 100;
  const commentLength = reasonText.trim().length;
  const commentValid = commentLength >= MIN_COMMENT_CHARS;
  const canConfirm =
    selectedReasons.length > 0 && commentValid && !saving;

  const FeedbackDialog = (
    <Dialog
      open={!!request}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isApprove
              ? "Por que você está aprovando esta sugestão?"
              : "Por que você está recusando esta sugestão?"}
          </DialogTitle>
          <DialogDescription>
            O que você explicar aqui vira <strong>instrução direta</strong> para
            a IA de tráfego desta conta. Ela usa esse contexto para calibrar as
            próximas propostas — quanto mais específico, melhores as sugestões
            futuras. Esse registro <strong>não altera</strong> a sugestão atual.
          </DialogDescription>
        </DialogHeader>

        {summary && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            {summary.campaign_name && (
              <div>
                <span className="text-muted-foreground">Campanha: </span>
                <span className="font-medium">{summary.campaign_name}</span>
              </div>
            )}
            {summary.action_type && (
              <div>
                <span className="text-muted-foreground">Tipo de ação: </span>
                <span className="font-medium">{summary.action_type}</span>
              </div>
            )}
            {summary.objective && (
              <div>
                <span className="text-muted-foreground">Objetivo: </span>
                <span className="font-medium">{summary.objective}</span>
              </div>
            )}
            {summary.expected_impact && (
              <div>
                <span className="text-muted-foreground">Impacto esperado: </span>
                <span className="font-medium">{summary.expected_impact}</span>
              </div>
            )}
          </div>
        )}

        <ScrollArea className="max-h-72 pr-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Motivos {isApprove ? "de aprovação" : "de recusa"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {reasons.map((r) => {
                const checked = selectedReasons.includes(r.code);
                return (
                  <label
                    key={r.code}
                    className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleReason(r.code)}
                      disabled={saving}
                      aria-label={r.label}
                    />
                    <span className="text-xs leading-tight">{r.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </ScrollArea>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="reason-text" className="text-xs">
              Explique sua decisão <span className="text-destructive">*</span>
            </Label>
            <span
              className={`text-[11px] ${
                commentValid ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {commentLength}/{MIN_COMMENT_CHARS} caracteres mínimos
            </span>
          </div>
          <Textarea
            id="reason-text"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={
              isApprove
                ? "Ex: aprovei porque o produto está em lançamento, quero priorizar prospecção fria mesmo sem histórico de conversão, e o orçamento sugerido cabe no caixa desta semana."
                : "Ex: recusei porque a IA propôs escalar uma campanha que ainda está em aprendizado há menos de 7 dias, e o público sugerido conflita com a estratégia de remarketing que já está rodando."
            }
            rows={4}
            disabled={saving}
            className={!commentValid && commentLength > 0 ? "border-destructive" : ""}
          />
          <p className="text-[11px] text-muted-foreground leading-snug">
            Quanto mais específico (produto, momento do negócio, restrição de
            caixa, estratégia paralela, histórico que a IA não enxergou),
            melhor a IA aprende seu critério e menos retrabalho você terá nas
            próximas análises.
          </p>
        </div>

        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <p className="text-xs font-medium">Sinais extras para a memória da IA</p>
          {isApprove ? (
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={wouldDoManually}
                onCheckedChange={(v) => setWouldDoManually(!!v)}
                disabled={saving}
                className="mt-0.5"
              />
              <span className="leading-snug">
                <strong>Eu faria isso manualmente</strong>
                <span className="block text-muted-foreground text-[11px]">
                  Marque se, mesmo sem a IA, você tomaria exatamente essa
                  decisão. Reforça confiança nesse padrão e a IA passa a
                  sugerir com mais segurança em casos parecidos.
                </span>
              </span>
            </label>
          ) : (
            <>
              <label className="flex items-start gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={ignoredContext}
                  onCheckedChange={(v) => setIgnoredContext(!!v)}
                  disabled={saving}
                  className="mt-0.5"
                />
                <span className="leading-snug">
                  <strong>A IA ignorou algum contexto importante</strong>
                  <span className="block text-muted-foreground text-[11px]">
                    Marque se faltou informação de negócio, sazonalidade,
                    estoque, caixa ou estratégia que mudaria a recomendação.
                  </span>
                </span>
              </label>
              {ignoredContext && (
                <Input
                  value={ignoredContextText}
                  onChange={(e) => setIgnoredContextText(e.target.value)}
                  placeholder="Qual contexto foi ignorado?"
                  disabled={saving}
                />
              )}
            </>
          )}
          <label className="flex items-start gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={shouldBecomePreference}
              onCheckedChange={(v) => setShouldBecomePreference(!!v)}
              disabled={saving}
              className="mt-0.5"
            />
            <span className="leading-snug">
              <strong>Usar como preferência futura desta conta</strong>
              <span className="block text-muted-foreground text-[11px]">
                Promove o motivo acima a <strong>regra permanente</strong> da
                conta. A IA vai aplicar esse critério automaticamente em todas
                as próximas propostas, sem precisar repetir essa decisão.
                Use apenas quando for um padrão que vale sempre — não para
                casos pontuais.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {saving
              ? "Salvando..."
              : isApprove
                ? "Confirmar aprovação"
                : "Confirmar recusa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { requestApproval, requestRejection, FeedbackDialog, isSaving: saving };
}

// Exposed for tests / docs
export const ADS_AUTOPILOT_APPROVAL_REASONS = APPROVAL_REASONS;
export const ADS_AUTOPILOT_REJECTION_REASONS = REJECTION_REASONS;
