// =====================================================================
// ProposalStructuredEditor — Frente 4.3
//
// Drawer lateral (Sheet) que substitui o "Sugerir Ajuste" textual.
// - Edita campos da proposta sem chamar IA.
// - Salva rascunho em action_data.draft_patch (persistente em banco).
// - "Gerar proposta revisada" chama edge function única que aciona o
//   Strategist 1x e versiona (parent_action_id + superseded_by_action_id).
//
// REGRAS:
// - Abrir/editar/salvar rascunho: 0 chamadas IA.
// - Apenas "Gerar proposta revisada": 1 chamada IA.
// - Sem geração de criativo, sem consumo de crédito, sem publicação.
// - Bloqueia "Gerar proposta revisada" se Fit Gate local sinaliza bloqueio.
// =====================================================================

import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Sparkles, AlertTriangle, X, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { PendingAction } from "@/hooks/useAdsPendingActions";
import { useProductCommercialFit } from "@/hooks/useProductCommercialFit";
import { fitLevelLabel } from "../../../supabase/functions/_shared/ads-autopilot/productFunnelFitGate";

interface ProposalStructuredEditorProps {
  action: PendingAction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Foco inicial vindo do "Ajustar proposta" no modal de proposta.
   *  Quando informado, o editor rola até a seção correspondente. */
  initialFocus?: "campaign" | "ad_set" | "ad" | "creative" | "platform" | null;
}

const FUNNEL_OPTIONS = [
  { value: "cold", label: "Frio (Prospecção)" },
  { value: "warm", label: "Morno (Remarketing)" },
  { value: "hot", label: "Quente" },
  { value: "retention", label: "Retenção" },
];

const CTA_OPTIONS = [
  { value: "SHOP_NOW", label: "Comprar Agora" },
  { value: "BUY_NOW", label: "Comprar" },
  { value: "LEARN_MORE", label: "Saiba Mais" },
  { value: "SIGN_UP", label: "Cadastre-se" },
  { value: "SUBSCRIBE", label: "Assinar" },
  { value: "CONTACT_US", label: "Fale Conosco" },
  { value: "GET_OFFER", label: "Ver Oferta" },
];

const FORMAT_OPTIONS = [
  { value: "1:1", label: "Quadrado (1:1)" },
  { value: "4:5", label: "Vertical (4:5)" },
  { value: "9:16", label: "Stories/Reels (9:16)" },
  { value: "16:9", label: "Horizontal (16:9)" },
];

const TONE_OPTIONS = [
  { value: "direct", label: "Direto" },
  { value: "educational", label: "Educativo" },
  { value: "emotional", label: "Emocional" },
  { value: "technical", label: "Técnico" },
  { value: "friendly", label: "Amigável" },
];

const FEEDBACK_CHIPS = [
  { code: "product", label: "Produto" },
  { code: "audience", label: "Público" },
  { code: "budget", label: "Orçamento" },
  { code: "copy", label: "Copy" },
  { code: "creative", label: "Criativo" },
  { code: "offer", label: "Oferta" },
  { code: "strategy", label: "Estratégia" },
  { code: "other", label: "Outro" },
];

interface EditableFields {
  campaign_name: string;
  objective: string;
  daily_budget_brl: string; // R$ string for UX
  destination_url: string;
  cta: string;
  product_id: string;
  product_name: string;
  offer_note: string;
  funnel_stage: string;
  targeting_summary: string;
  exclusions_note: string;
  region: string;
  age_range: string;
  gender: string;
  creative_prompt: string;
  creative_format: string;
  primary_text: string;
  headline: string;
  description: string;
  tone: string;
}

function buildInitial(action: PendingAction | null): EditableFields {
  const d: any = action?.action_data || {};
  const p: any = d.preview || {};
  return {
    campaign_name: p.campaign_name || d.campaign_name || "",
    objective: p.objective || d.objective || d.campaign_type || "",
    daily_budget_brl: d.daily_budget_cents
      ? (Number(d.daily_budget_cents) / 100).toFixed(2)
      : p.daily_budget_brl || "",
    destination_url: p.destination_url || d.destination_url || d.website_url || "",
    cta: p.cta || p.cta_type || d.cta_type || "SHOP_NOW",
    product_id: d.product_id || p.product_id || "",
    product_name: p.product_name || d.product_name || "",
    offer_note: d.offer_note || "",
    funnel_stage: p.funnel_stage || d.funnel_stage || "cold",
    targeting_summary: p.targeting_summary || d.targeting_summary || "",
    exclusions_note: d.exclusions_note || "",
    region: d.region || p.region || "",
    age_range: p.age_range || d.age_range || "",
    gender: p.gender || d.gender || "",
    creative_prompt: d.creative_brief?.prompt || d.creative_prompt || "",
    creative_format: d.creative_brief?.format || d.creative_format_suggested || "1:1",
    primary_text: (p.primary_texts && p.primary_texts[0]) || p.copy_text || d.copy_text || "",
    headline: (p.headlines && p.headlines[0]) || p.headline || d.headline || "",
    description: (p.descriptions && p.descriptions[0]) || "",
    tone: d.creative_brief?.tone || "direct",
  };
}

function diffFields(initial: EditableFields, current: EditableFields) {
  const changed: string[] = [];
  const previous_values: Record<string, unknown> = {};
  const new_values: Record<string, unknown> = {};
  (Object.keys(initial) as Array<keyof EditableFields>).forEach((k) => {
    if ((initial[k] || "") !== (current[k] || "")) {
      changed.push(String(k));
      previous_values[String(k)] = initial[k];
      new_values[String(k)] = current[k];
    }
  });
  return { changed, previous_values, new_values };
}

export function ProposalStructuredEditor({ action, open, onOpenChange, initialFocus }: ProposalStructuredEditorProps) {
  const queryClient = useQueryClient();
  const [initial, setInitial] = useState<EditableFields>(buildInitial(null));
  const [current, setCurrent] = useState<EditableFields>(buildInitial(null));
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [feedbackChips, setFeedbackChips] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Re-initialize when action changes
  useEffect(() => {
    if (!action) return;
    const init = buildInitial(action);
    setInitial(init);
    // Hydrate from existing draft_patch if any
    const draft: any = (action.action_data as any)?.draft_patch || null;
    setCurrent(draft?.fields ? { ...init, ...draft.fields } : init);
    setAdjustmentReason(draft?.adjustment_reason || "");
    setFeedbackNote(draft?.note || "");
    setFeedbackChips(Array.isArray(draft?.chips) ? draft.chips : []);
  }, [action?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Foco inicial vindo do gate: rola até a seção correta após abrir
  useEffect(() => {
    if (!open || !initialFocus) return;
    const map: Record<string, string> = {
      campaign: "campaign",
      ad_set: "ad_set",
      ad: "ad",
      creative: "ad", // criativo está dentro da seção "Anúncio"
      platform: "campaign",
    };
    const key = map[initialFocus];
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-editor-section="${key}"]`) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
  }, [open, initialFocus]);

  const { changed, previous_values, new_values } = useMemo(
    () => diffFields(initial, current),
    [initial, current],
  );

  // Fit Gate local — bloqueia "Gerar proposta revisada" se combinação inválida
  const fitQuery = useProductCommercialFit(
    current.product_id || null,
    (current.funnel_stage as any) || null,
    action?.tenant_id || null,
  );
  const fitData = fitQuery.data;
  const fitBlocked = fitData?.fit.soft_block === true;

  // Validações locais
  const errors: string[] = [];
  if (!current.campaign_name.trim()) errors.push("Nome da campanha é obrigatório.");
  if (!current.product_id.trim()) errors.push("Produto é obrigatório.");
  if (!current.funnel_stage) errors.push("Funil é obrigatório.");
  const budgetNum = Number(String(current.daily_budget_brl).replace(",", "."));
  if (!Number.isFinite(budgetNum) || budgetNum <= 0) errors.push("Orçamento diário precisa ser maior que zero.");
  if (current.destination_url && !/^https?:\/\//i.test(current.destination_url))
    errors.push("Link de destino precisa começar com http:// ou https://.");
  if (feedbackChips.includes("other") && !feedbackNote.trim())
    errors.push('Quando o motivo é "Outro", explique no campo de observação.');

  // Salvar rascunho (sem IA)
  const saveDraftMut = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error("Sem proposta");
      const data: any = action.action_data || {};
      const next = {
        ...data,
        draft_patch: {
          fields: current,
          changed_fields: changed,
          adjustment_reason: adjustmentReason || null,
          chips: feedbackChips,
          note: feedbackNote || null,
          saved_at: new Date().toISOString(),
        },
      };
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ action_data: next })
        .eq("id", action.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rascunho salvo");
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
    },
    onError: (e: any) => toast.error(`Não foi possível salvar o rascunho: ${e?.message || e}`),
  });

  const discardDraftMut = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error("Sem proposta");
      const data: any = action.action_data || {};
      const next = { ...data };
      delete next.draft_patch;
      const { error } = await supabase
        .from("ads_autopilot_actions" as any)
        .update({ action_data: next })
        .eq("id", action.id);
      if (error) throw error;
    },
    onSuccess: () => {
      const init = buildInitial(action);
      setCurrent(init);
      setAdjustmentReason("");
      setFeedbackNote("");
      setFeedbackChips([]);
      toast.success("Rascunho descartado");
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
    },
  });

  // Gerar proposta revisada (1 chamada IA)
  const reviseMut = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error("Sem proposta");
      const { data, error } = await supabase.functions.invoke(
        "ads-autopilot-revise-proposal",
        {
          body: {
            proposal_id: action.id,
            tenant_id: action.tenant_id,
            changed_fields: changed,
            previous_values,
            new_values,
            user_feedback: {
              adjustment_reason: adjustmentReason || null,
              note: feedbackNote || null,
              chips: feedbackChips,
            },
          },
        },
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao gerar proposta revisada");
      return data;
    },
    onSuccess: (resp) => {
      toast.success(
        resp?.new_proposal_id
          ? `Proposta revisada gerada (v${resp.new_version}). A versão anterior foi arquivada.`
          : "Revisão enviada à IA.",
      );
      setConfirmOpen(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["ads-pending-actions"] });
      queryClient.invalidateQueries({ queryKey: ["ads-pending-approval"] });
    },
    onError: (e: any) => toast.error(`Não foi possível gerar a revisão: ${e?.message || e}`),
  });

  if (!action) return null;
  const currentVersion = Number((action.action_data as any)?.version || 1);

  const upd = <K extends keyof EditableFields>(k: K, v: EditableFields[K]) =>
    setCurrent((s) => ({ ...s, [k]: v }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 overflow-hidden"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/30 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Ajustar proposta — v{currentVersion}
          </SheetTitle>
          <SheetDescription className="text-xs">
            Edite os campos abaixo. Salvar rascunho não chama a IA. Apenas "Gerar proposta revisada" pede uma nova versão ao motor.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
          {/* Fit Gate alert */}
          {fitBlocked && fitData && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-900 dark:text-rose-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Adequação produto × público: {fitLevelLabel(fitData.fit.fit_level).label}
              </div>
              <p className="text-rose-900/90 dark:text-rose-200/90 leading-relaxed">
                {fitData.fit.user_message}
              </p>
              <p className="italic">Ajuste produto, funil ou exclusões antes de gerar a revisão.</p>
            </div>
          )}

          {/* Diff summary */}
          <div className="rounded-md bg-muted/30 border border-border/40 px-3 py-2 text-xs flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {changed.length} {changed.length === 1 ? "campo alterado" : "campos alterados"}
            </Badge>
            <span className="text-muted-foreground">
              Apenas campos alterados são enviados à IA na revisão.
            </span>
          </div>

          {/* Nível 1 — Campanha */}
          <Section title="Campanha" sectionKey="campaign">
            <Field label="Nome da campanha">
              <Input value={current.campaign_name} onChange={(e) => upd("campaign_name", e.target.value)} />
            </Field>
            <Field label="Objetivo">
              <Input value={current.objective} onChange={(e) => upd("objective", e.target.value)} placeholder="Ex.: Vendas" />
            </Field>
            <Field label="Orçamento diário (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={current.daily_budget_brl}
                onChange={(e) => upd("daily_budget_brl", e.target.value)}
              />
            </Field>
            <Field label="Canal/Plataforma">
              <Input value={action.channel} disabled className="bg-muted/30" />
            </Field>
            <Field label="Link de destino">
              <Input
                type="url"
                value={current.destination_url}
                onChange={(e) => upd("destination_url", e.target.value)}
                placeholder="https://..."
              />
            </Field>
            <Field label="Botão (CTA)">
              <Select value={current.cta} onValueChange={(v) => upd("cta", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CTA_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Section>

          {/* Nível 2 — Conjunto de anúncios (público, segmentação, exclusões) */}
          <Section title="Conjunto de anúncios" sectionKey="ad_set">
            <Field label="Funil">
              <Select value={current.funnel_stage} onValueChange={(v) => upd("funnel_stage", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FUNNEL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Descrição do público">
              <Textarea
                rows={2}
                value={current.targeting_summary}
                onChange={(e) => upd("targeting_summary", e.target.value)}
                placeholder="Ex.: Homens 28-55 com interesse em estética masculina"
              />
            </Field>
            <Field label="Exclusões / observações de segmentação">
              <Textarea
                rows={2}
                value={current.exclusions_note}
                onChange={(e) => upd("exclusions_note", e.target.value)}
                placeholder="Ex.: excluir clientes atuais e compradores recentes"
              />
            </Field>
            <Field label="Região">
              <Input value={current.region} onChange={(e) => upd("region", e.target.value)} placeholder="Ex.: Brasil" />
            </Field>
            <Field label="Faixa etária">
              <Input value={current.age_range} onChange={(e) => upd("age_range", e.target.value)} placeholder="Ex.: 28-55" />
            </Field>
            <Field label="Gênero">
              <Input value={current.gender} onChange={(e) => upd("gender", e.target.value)} placeholder="Ex.: Masculino" />
            </Field>
          </Section>

          {/* Nível 3 — Anúncio (produto, copy, criativo) */}
          <Section title="Anúncio" sectionKey="ad">
            <Field label="Produto (ID)">
              <Input
                value={current.product_id}
                onChange={(e) => upd("product_id", e.target.value)}
                placeholder="UUID do produto"
              />
            </Field>
            <Field label="Nome do produto (referência)">
              <Input value={current.product_name} onChange={(e) => upd("product_name", e.target.value)} />
            </Field>
            <Field label="Observação sobre a oferta">
              <Textarea
                rows={2}
                value={current.offer_note}
                onChange={(e) => upd("offer_note", e.target.value)}
                placeholder="Ex.: usar como oferta de entrada, sem desconto agressivo"
              />
            </Field>
            <Field label="Prompt criativo">
              <Textarea
                rows={4}
                value={current.creative_prompt}
                onChange={(e) => upd("creative_prompt", e.target.value)}
              />
            </Field>
            <Field label="Formato">
              <Select value={current.creative_format} onValueChange={(v) => upd("creative_format", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Tom da comunicação">
              <Select value={current.tone} onValueChange={(v) => upd("tone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Headline">
              <Input value={current.headline} onChange={(e) => upd("headline", e.target.value)} />
            </Field>
            <Field label="Texto principal">
              <Textarea
                rows={3}
                value={current.primary_text}
                onChange={(e) => upd("primary_text", e.target.value)}
              />
            </Field>
            <Field label="Descrição">
              <Textarea
                rows={2}
                value={current.description}
                onChange={(e) => upd("description", e.target.value)}
              />
            </Field>
            <p className="text-[11px] text-muted-foreground italic">
              A referência visual do produto continua sendo a imagem oficial do catálogo. Nenhum criativo final será gerado aqui.
            </p>
          </Section>

          {/* Feedback */}
          <Section title="Feedback para a IA">
            <Field label="Motivo do ajuste">
              <Input
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Resuma em 1 frase por que está ajustando"
              />
            </Field>
            <Field label="Categorias">
              <div className="flex flex-wrap gap-1.5">
                {FEEDBACK_CHIPS.map((c) => {
                  const active = feedbackChips.includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() =>
                        setFeedbackChips((prev) =>
                          prev.includes(c.code) ? prev.filter((x) => x !== c.code) : [...prev, c.code],
                        )
                      }
                      className={cn(
                        "text-xs px-2 py-1 rounded-full border transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background hover:bg-muted border-border",
                      )}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Observação para a IA (opcional)">
              <Textarea
                rows={3}
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="O que a IA deve considerar nas próximas propostas?"
              />
            </Field>
          </Section>

          {errors.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                Antes de gerar a revisão, corrija:
              </div>
              <ul className="list-disc list-inside text-amber-900/90 dark:text-amber-200/90 space-y-0.5">
                {errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/30 px-5 py-3 flex flex-wrap items-center gap-2 shrink-0 bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => discardDraftMut.mutate()}
            disabled={discardDraftMut.isPending || saveDraftMut.isPending || reviseMut.isPending}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Descartar
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveDraftMut.mutate()}
            disabled={saveDraftMut.isPending || reviseMut.isPending}
          >
            {saveDraftMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar rascunho
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={
              reviseMut.isPending ||
              saveDraftMut.isPending ||
              errors.length > 0 ||
              fitBlocked ||
              changed.length === 0
            }
            title={
              fitBlocked
                ? "Ajuste a combinação produto × público antes."
                : changed.length === 0
                  ? "Faça pelo menos uma alteração para gerar revisão."
                  : ""
            }
          >
            {reviseMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Gerar proposta revisada
          </Button>
        </div>

        {/* Confirmação */}
        {confirmOpen && (
          <div className="absolute inset-0 z-50 bg-background/95 flex items-center justify-center p-6">
            <div className="max-w-sm w-full rounded-lg border bg-card p-5 space-y-3 shadow-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Confirmar revisão</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Isso vai arquivar a versão v{currentVersion} e pedir à IA uma nova proposta v{currentVersion + 1} considerando os {changed.length} campo(s) alterado(s) e o seu feedback.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Nenhum criativo final será gerado e nenhum crédito será consumido nesta etapa.
                  </p>
                </div>
                <button onClick={() => setConfirmOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={() => reviseMut.mutate()} disabled={reviseMut.isPending}>
                  {reviseMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Confirmar e gerar
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children, sectionKey }: { title: string; children: React.ReactNode; sectionKey?: string }) {
  return (
    <div data-editor-section={sectionKey}>
      <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span className="h-px flex-1 bg-border/40" />
        {title}
        <span className="h-px flex-1 bg-border/40" />
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
