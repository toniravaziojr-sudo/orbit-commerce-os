// =============================================================================
// FinalReviewModal — Onda H.4.2
// Modal de Revisão Final em 4 passos para publicar a Proposta de Campanha
// já aprovada (H.3) e com criativos prontos (H.4.1).
//
// Passos:
//   1. Resumo da estratégia aprovada (campanha, objetivo, orçamento, público)
//   2. Criativos gerados (preview)
//   3. Agendamento (próxima janela 00:01 BRT)
//   4. Confirmação final + botão Publicar
// =============================================================================

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UniversalImageUploader } from "@/components/ui/UniversalImageUploader";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, ImageIcon, Loader2, Rocket, Target, Wallet, Calendar,
  AlertTriangle, ChevronRight, ChevronLeft, Sparkles, Pencil, Save, X as XIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApprovedProposalRow } from "@/hooks/useApprovedProposalsAwaitingPublish";

const CTA_OPTIONS = ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "ORDER_NOW", "GET_OFFER", "BUY_NOW"];

interface Props {
  proposal: ApprovedProposalRow;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPublish: () => void;
  isPublishing?: boolean;
}

function formatBRL(cents?: number | null) {
  if (!cents && cents !== 0) return "—";
  return `R$ ${(cents / 100).toFixed(2)}`;
}

function nextPublishWindowBRT(): { label: string; iso: string } {
  const now = new Date();
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const brtMinute = now.getUTCMinutes();
  const inWindow = (brtHour === 0 && brtMinute >= 1) || (brtHour >= 1 && brtHour < 4);
  if (inWindow) return { label: "Imediato (estamos na janela 00:01–04:00 BRT)", iso: now.toISOString() };
  const next = new Date(now);
  if (brtHour >= 4) next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(3, 1, 0, 0);
  const dateStr = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(next);
  return { label: `${dateStr} (horário de Brasília)`, iso: next.toISOString() };
}

export function FinalReviewModal({ proposal, open, onOpenChange, onPublish, isPublishing }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const data = proposal.action_data || {};
  const campaign = data.campaign || {};
  const identity = data.identity || {};
  const adset0 = (Array.isArray(data.adsets) ? data.adsets[0] : null) || {};
  const lifecycle = data.lifecycle || {};
  const creativeJobsMeta: Array<any> = Array.isArray(lifecycle.creative_jobs) ? lifecycle.creative_jobs : [];
  const plannedCreatives: Array<any> = Array.isArray(data.planned_creatives) ? data.planned_creatives : [];

  const jobIds = useMemo(() => creativeJobsMeta.map(j => j.job_id).filter(Boolean), [creativeJobsMeta]);
  const queryClient = useQueryClient();

  // Re-busca action_data fresh para enxergar overrides recém-salvos
  const { data: freshAction } = useQuery({
    queryKey: ["final-review-action-data", proposal.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ads_autopilot_actions")
        .select("action_data")
        .eq("id", proposal.id)
        .maybeSingle();
      return data?.action_data || {};
    },
    enabled: open,
    refetchOnWindowFocus: false,
  });

  const overrides: Record<string, any> = (freshAction as any)?.creative_overrides || (data as any).creative_overrides || {};

  const { data: jobs = [] } = useQuery({
    queryKey: ["final-review-creative-jobs", proposal.id, jobIds],
    queryFn: async () => {
      if (jobIds.length === 0) return [];
      const { data } = await supabase
        .from("creative_jobs")
        .select("id, status, output_urls, error_message, product_name")
        .in("id", jobIds);
      return data || [];
    },
    enabled: open && jobIds.length > 0,
  });

  const readyJobs = jobs.filter((j: any) => j.status === "succeeded" && Array.isArray(j.output_urls) && j.output_urls.length > 0);
  const failedJobs = jobs.filter((j: any) => j.status === "failed" || j.status === "cancelled");
  const stillRunning = jobs.filter((j: any) => j.status === "running" || j.status === "queued");

  // Mapeia cada job ready para um creative_index via lifecycle.creative_jobs
  const readyCards = useMemo(() => {
    return readyJobs.map((j: any) => {
      const meta = creativeJobsMeta.find((m: any) => (m.job_id || m.id) === j.id) || {};
      const idx = typeof meta.creative_index === "number"
        ? meta.creative_index
        : (typeof meta.planned_creative_index === "number" ? meta.planned_creative_index : 0);
      const planned = plannedCreatives[idx] || {};
      const ov = overrides[String(idx)] || {};
      return {
        job: j,
        creative_index: idx,
        planned,
        override: ov,
        effective: {
          image_url: ov.image_url || j.output_urls[0],
          headline: ov.headline || planned.headline || (campaign.name || "Confira"),
          copy: ov.copy || planned.copy || planned.primary_text || "",
          cta: ov.cta || planned.cta || identity.default_cta || "SHOP_NOW",
        },
      };
    });
  }, [readyJobs, creativeJobsMeta, plannedCreatives, overrides, campaign.name, identity.default_cta]);

  const refreshAfterChange = () => {
    queryClient.invalidateQueries({ queryKey: ["final-review-action-data", proposal.id] });
  };

  const publishWindow = nextPublishWindowBRT();
  const canPublish = readyCards.length > 0 && stillRunning.length === 0;
  const stepLabel = ["", "Estratégia", "Criativos", "Agendamento", "Confirmação"][step];




  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-4 w-4 text-primary" />
                Revisão Final — Publicar Campanha
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Passo {step} de 4 · {stepLabel} · {campaign.name || "Campanha"}
              </DialogDescription>
            </div>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className={`h-1.5 w-6 rounded-full transition ${n <= step ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          {step === 1 && (
            <div className="space-y-5">
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Campanha
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Nome">{campaign.name || "—"}</Field>
                  <Field label="Objetivo">{campaign.objective || "—"}</Field>
                  <Field label="Orçamento/dia"><strong>{formatBRL(campaign.daily_budget_cents)}</strong></Field>
                  <Field label="Funil">{campaign.funnel_stage || "—"}</Field>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5" /> Conjunto principal
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Nome">{adset0.name || "—"}</Field>
                  <Field label="Idade">{adset0.age_min || 18}–{adset0.age_max || 65}</Field>
                  <Field label="Gênero">{Array.isArray(adset0.genders) && adset0.genders.length > 0 ? adset0.genders.join(", ") : "Todos"}</Field>
                  <Field label="Localização">{adset0.geo_locations?.countries?.join(", ") || "BR"}</Field>
                  <Field label="Otimização">{adset0.optimization_goal || "OFFSITE_CONVERSIONS"}</Field>
                  <Field label="Evento de conversão">{adset0.conversion_event || identity.conversion_event || "PURCHASE"}</Field>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Identidade da conta</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Página Facebook">{identity.facebook_page_name || identity.facebook_page_id || "—"}</Field>
                  <Field label="Pixel">{identity.pixel_id ? "Conectado" : "—"}</Field>
                  <Field label="CTA padrão">{identity.default_cta || "SHOP_NOW"}</Field>
                  <Field label="UTM base">{identity.utm_base?.utm_source || "—"}</Field>
                </dl>
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ImageIcon className="h-4 w-4" /> Criativos gerados
                </h3>
                <div className="flex gap-2 text-xs">
                  <Badge variant="secondary">{readyJobs.length} prontos</Badge>
                  {stillRunning.length > 0 && <Badge variant="outline">{stillRunning.length} processando</Badge>}
                  {failedJobs.length > 0 && <Badge variant="destructive">{failedJobs.length} falharam</Badge>}
                </div>
              </div>
              {stillRunning.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 rounded-md bg-muted/40 border">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Aguardando {stillRunning.length} criativo(s) terminarem antes de poder publicar.
                </div>
              )}
              <div className="space-y-4">
                {readyCards.map((card, i) => (
                  <CreativeReviewCard
                    key={card.job.id}
                    index={i}
                    tenantId={proposal.tenant_id}
                    actionId={proposal.id}
                    creativeIndex={card.creative_index}
                    effective={card.effective}
                    onChanged={refreshAfterChange}
                  />
                ))}
                {readyCards.length === 0 && stillRunning.length === 0 && (
                  <div className="text-sm text-muted-foreground p-4 text-center border rounded-md">
                    Nenhum criativo pronto para publicar.
                  </div>
                )}
              </div>
              {failedJobs.length > 0 && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  {failedJobs.length} criativo(s) falharam e serão descartados na publicação.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <section className="rounded-lg border p-4 bg-muted/20">
                <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                  <Calendar className="h-4 w-4" /> Início da campanha
                </h3>
                <p className="text-2xl font-semibold mb-1">{publishWindow.label}</p>
                <p className="text-xs text-muted-foreground">
                  Campanhas só sobem para a Meta na janela <strong>00:01–04:00</strong> (horário de Brasília).
                  Fora dessa faixa, agendamos para o próximo 00:01 BRT — nunca pausada.
                </p>
              </section>

              <section className="rounded-lg border p-4">
                <h3 className="text-sm font-semibold mb-2">Resumo financeiro</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Orçamento diário"><strong className="text-base">{formatBRL(campaign.daily_budget_cents)}</strong></Field>
                  <Field label="Estimativa mensal"><strong className="text-base">{formatBRL((campaign.daily_budget_cents || 0) * 30)}</strong></Field>
                </dl>
              </section>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Atenção — esta ação é definitiva</p>
                    <p className="text-amber-800 dark:text-amber-300 text-xs">
                      Ao confirmar, a campanha será publicada na Meta em modo <strong>ATIVO</strong> com início agendado.
                      Você poderá pausar depois pelo painel, mas o gasto começa quando o anúncio rodar.
                    </p>
                  </div>
                </div>
              </div>

              <ul className="text-sm space-y-1.5">
                <Check label={`Campanha: ${campaign.name || "—"}`} />
                <Check label={`Orçamento: ${formatBRL(campaign.daily_budget_cents)} por dia`} />
                <Check label={`Início: ${publishWindow.label}`} />
                <Check label={`${readyCards.length} anúncio(s) serão criados`} />
                {failedJobs.length > 0 && <li className="flex gap-2 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> {failedJobs.length} criativo(s) falharam e não serão publicados.</li>}
              </ul>
            </div>
          )}
        </ScrollArea>

        <div className="border-t px-6 py-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" disabled={step === 1 || isPublishing} onClick={() => setStep((s) => (s - 1) as any)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isPublishing}>Fechar</Button>
            {step < 4 ? (
              <Button size="sm" onClick={() => setStep((s) => (s + 1) as any)} disabled={step === 2 && stillRunning.length > 0}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onPublish}
                disabled={!canPublish || isPublishing}
                className="bg-primary"
              >
                {isPublishing ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Publicando…</> : <><Rocket className="h-4 w-4 mr-1.5" /> Publicar agora</>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Check({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      {label}
    </li>
  );
}

// =============================================================================
// CreativeReviewCard — edição manual, upload/Drive e regeneração com feedback
// =============================================================================
interface CardProps {
  index: number;
  tenantId: string;
  actionId: string;
  creativeIndex: number;
  effective: { image_url: string; headline: string; copy: string; cta: string };
  onChanged: () => void;
}

function CreativeReviewCard({ index, tenantId, actionId, creativeIndex, effective, onChanged }: CardProps) {
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(effective.headline);
  const [copy, setCopy] = useState(effective.copy);
  const [cta, setCta] = useState(effective.cta);
  const [savingCopy, setSavingCopy] = useState(false);

  const [imgPanel, setImgPanel] = useState(false);
  const [copyPanel, setCopyPanel] = useState(false);
  const [imgFeedback, setImgFeedback] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [regenImg, setRegenImg] = useState(false);
  const [regenCopy, setRegenCopy] = useState(false);
  const [uploadUrl, setUploadUrl] = useState("");
  const [savingImg, setSavingImg] = useState(false);

  async function callRevise(payload: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("ads-creative-revise", {
      body: { tenant_id: tenantId, action_id: actionId, creative_index: creativeIndex, ...payload },
    });
    if (error) throw new Error(error.message || "Falha ao salvar.");
    if (!(data as any)?.success) throw new Error((data as any)?.error_pt || "Falha ao salvar.");
    return data;
  }

  async function handleSaveCopy() {
    setSavingCopy(true);
    try {
      await callRevise({ action: "apply_override", override: { headline, copy, cta } });
      toast.success("Texto do anúncio atualizado.");
      setEditing(false);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
    } finally {
      setSavingCopy(false);
    }
  }

  async function handleRegenImage() {
    if (imgFeedback.trim().length < 5) {
      toast.error("Conte rapidamente o que você quer diferente na imagem.");
      return;
    }
    setRegenImg(true);
    try {
      await callRevise({ action: "regenerate_image", feedback: imgFeedback.trim() });
      toast.success("Nova imagem gerada com seu feedback.");
      setImgPanel(false);
      setImgFeedback("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível regenerar a imagem.");
    } finally {
      setRegenImg(false);
    }
  }

  async function handleRegenCopy() {
    if (copyFeedback.trim().length < 5) {
      toast.error("Conte como você quer a copy diferente antes de regenerar.");
      return;
    }
    setRegenCopy(true);
    try {
      const res: any = await callRevise({ action: "regenerate_copy", feedback: copyFeedback.trim() });
      const ov = res?.override || {};
      if (ov.headline) setHeadline(ov.headline);
      if (ov.copy) setCopy(ov.copy);
      if (ov.cta) setCta(ov.cta);
      toast.success("Nova copy gerada com seu feedback.");
      setCopyPanel(false);
      setCopyFeedback("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível regenerar a copy.");
    } finally {
      setRegenCopy(false);
    }
  }

  async function handleApplyUpload() {
    if (!uploadUrl) {
      toast.error("Selecione uma imagem antes de aplicar.");
      return;
    }
    setSavingImg(true);
    try {
      await callRevise({ action: "apply_override", override: { image_url: uploadUrl, image_source: "manual" } });
      toast.success("Imagem do anúncio atualizada.");
      setImgPanel(false);
      setUploadUrl("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aplicar a imagem.");
    } finally {
      setSavingImg(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-0">
        <div className="relative bg-muted/30">
          <img src={effective.image_url} alt={`Anúncio ${index + 1}`} className="w-full sm:h-full aspect-square object-cover" />
          <Button size="sm" variant="secondary" className="absolute bottom-2 left-2 h-7 text-xs"
            onClick={() => { setImgPanel(v => !v); setCopyPanel(false); }}>
            <Pencil className="h-3 w-3 mr-1" /> Trocar imagem
          </Button>
        </div>

        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px]">Anúncio {index + 1}</Badge>
            {!editing ? (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCopyPanel(v => !v); setImgPanel(false); }}>
                  <Sparkles className="h-3 w-3 mr-1" /> Regenerar texto
                </Button>
              </div>
            ) : (
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                  setEditing(false); setHeadline(effective.headline); setCopy(effective.copy); setCta(effective.cta);
                }}>
                  <XIcon className="h-3 w-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveCopy} disabled={savingCopy}>
                  {savingCopy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                  Salvar
                </Button>
              </div>
            )}
          </div>

          {!editing ? (
            <div className="space-y-1 text-sm">
              <div><span className="text-[10px] uppercase text-muted-foreground">Título</span><div className="font-medium">{headline || "—"}</div></div>
              <div><span className="text-[10px] uppercase text-muted-foreground">Texto</span><div className="text-xs whitespace-pre-wrap">{copy || "—"}</div></div>
              <div><span className="text-[10px] uppercase text-muted-foreground">Botão</span> <Badge variant="secondary" className="text-[10px]">{cta}</Badge></div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <Label className="text-[10px] uppercase">Título</Label>
                <Input value={headline} onChange={e => setHeadline(e.target.value)} maxLength={60} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Texto principal</Label>
                <Textarea value={copy} onChange={e => setCopy(e.target.value)} maxLength={300} rows={3} className="text-sm" />
              </div>
              <div>
                <Label className="text-[10px] uppercase">Botão (CTA)</Label>
                <Select value={cta} onValueChange={setCta}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CTA_OPTIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {imgPanel && (
        <div className="border-t bg-muted/20 p-3 space-y-3">
          <div>
            <Label className="text-xs font-medium">Carregar do computador ou Meu Drive</Label>
            <UniversalImageUploader
              value={uploadUrl}
              onChange={setUploadUrl}
              source="ads_creative_override"
              subPath={`ads/${actionId}`}
              aspectRatio="square"
              accept="image"
              showUrlTab={false}
            />
            <div className="flex justify-end mt-2">
              <Button size="sm" onClick={handleApplyUpload} disabled={!uploadUrl || savingImg}>
                {savingImg ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                Aplicar imagem
              </Button>
            </div>
          </div>
          <Separator />
          <div>
            <Label className="text-xs font-medium">Ou regerar com IA — o que você quer diferente?</Label>
            <Textarea
              value={imgFeedback}
              onChange={e => setImgFeedback(e.target.value)}
              placeholder="Ex.: cenário mais limpo, foco no produto, sem pessoas, paleta mais quente…"
              rows={3}
              maxLength={400}
              className="text-sm mt-1"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Seu feedback é registrado e usado para a IA aprender o que você prefere.</p>
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="secondary" onClick={handleRegenImage} disabled={regenImg || imgFeedback.trim().length < 5}>
                {regenImg ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Regenerar imagem
              </Button>
            </div>
          </div>
        </div>
      )}

      {copyPanel && (
        <div className="border-t bg-muted/20 p-3 space-y-2">
          <Label className="text-xs font-medium">Como você quer a copy diferente?</Label>
          <Textarea
            value={copyFeedback}
            onChange={e => setCopyFeedback(e.target.value)}
            placeholder="Ex.: mais direta, foco no benefício, sem promessa de desconto, tom mais coloquial…"
            rows={3}
            maxLength={400}
            className="text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Seu feedback é registrado e usado para a IA aprender o que você prefere.</p>
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={handleRegenCopy} disabled={regenCopy || copyFeedback.trim().length < 5}>
              {regenCopy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Regenerar texto
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
