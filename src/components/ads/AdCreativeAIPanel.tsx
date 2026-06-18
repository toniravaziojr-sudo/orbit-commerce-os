// =============================================================================
// AdCreativeAIPanel — Onda H.4.11
//
// UI unificada. Todos os controles do "Criativo do anúncio" ficam no header
// do próprio card (mesma linha do título), nada espalhado pela tela.
//
// Exporta:
//   - CopyHeaderActions: bloco com [Editar manualmente] + [Gerar copys] (ou
//     [Regenerar copys] quando já existe texto). Vai no slot `actions` do
//     header do card.
//   - PerFieldRegenButton: botão minúsculo ao lado de cada campo de copy
//     (Título / Texto principal / Descrição). Só aparece quando o campo
//     já tem conteúdo. Abre o popup com o campo pré-selecionado e travado.
//   - AdImageAIControls: botão único Gerar/Regenerar criativo (imagem),
//     vai na coluna da miniatura.
// =============================================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles, Loader2, RefreshCw, Brain, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ---------------- shared ----------------

const SESSION_KEY = "ads-ai-inline-confirmed";
function isConfirmed(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}
function markConfirmed() {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }
}

export type CopyField = "all" | "headline" | "primary_text" | "description";

const FIELD_LABEL_PT: Record<CopyField, string> = {
  all: "Tudo (título + texto + descrição)",
  headline: "Título",
  primary_text: "Texto principal",
  description: "Descrição",
};

interface BaseCtx {
  tenantId: string;
  actionId: string;
  adIndex: number;
  productNameHint?: string;
  onChanged: () => void;
}

async function callInline(ctx: BaseCtx, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("ads-creative-inline-generate", {
    body: {
      tenant_id: ctx.tenantId,
      action_id: ctx.actionId,
      ad_index: ctx.adIndex,
      product_name_hint: ctx.productNameHint || undefined,
      ...body,
    },
  });
  if (error) throw new Error(error.message || "Falha na chamada.");
  if (!(data as { success?: boolean })?.success) {
    throw new Error((data as { error_pt?: string })?.error_pt || "Não foi possível concluir.");
  }
  return data as Record<string, unknown>;
}

// ---------------- Popup unificado de regeneração ----------------

function RegenCopyDialog({
  open, onOpenChange, ctx, initialField = "all", lockField = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: BaseCtx;
  initialField?: CopyField;
  lockField?: boolean;
}) {
  const [field, setField] = useState<CopyField>(initialField);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  // Sincroniza quando o popup reabre com outro campo.
  if (open && field !== initialField && lockField) {
    setField(initialField);
  }

  function reset() {
    setField(initialField);
    setFeedback("");
    setBusy(false);
  }

  function handleSubmit() {
    const fb = feedback.trim();
    if (fb.length < 5) {
      toast.error("Conte rapidamente o que você quer diferente (mínimo 5 caracteres).");
      return;
    }
    if (!isConfirmed()) {
      setPendingConfirm(true);
      return;
    }
    void run();
  }

  async function run() {
    setBusy(true);
    try {
      const fb = feedback.trim();
      if (field === "all") {
        await callInline(ctx, { action: "generate_copy", feedback: fb });
      } else {
        await callInline(ctx, { action: "regen_copy_field", field, feedback: fb });
      }
      toast.success("Texto regenerado. A IA aprendeu com o seu feedback.");
      ctx.onChanged();
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error((e as Error)?.message || "Não foi possível regenerar.");
    } finally {
      setBusy(false);
    }
  }

  const title = lockField
    ? `Regenerar ${FIELD_LABEL_PT[initialField].toLowerCase()}`
    : "Regenerar copy do anúncio";

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription>
              Descreva a direção desejada. Seu feedback vira aprendizado da IA desta loja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {!lockField && (
              <div className="space-y-1.5">
                <Label className="text-xs">O que regenerar</Label>
                <Select value={field} onValueChange={(v) => setField(v as CopyField)} disabled={busy}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{FIELD_LABEL_PT.all}</SelectItem>
                    <SelectItem value="headline">Apenas o título</SelectItem>
                    <SelectItem value="primary_text">Apenas o texto principal</SelectItem>
                    <SelectItem value="description">Apenas a descrição</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Brain className="h-3 w-3 text-primary" />
                O que você quer diferente?
              </Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ex.: mais direto, focar no problema, tom mais provocativo, sem promessa de desconto…"
                rows={4}
                maxLength={500}
                disabled={busy}
              />
              <p className="text-[11px] text-muted-foreground">
                A IA usa isso como direção criativa — não copia o texto literalmente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { onOpenChange(false); reset(); }} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={busy || feedback.trim().length < 5}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingConfirm} onOpenChange={(v) => { if (!v) setPendingConfirm(false); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar com IA?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-2">
              <span className="block">Isso vai consumir créditos de IA da sua conta.</span>
              <span className="block text-muted-foreground">Nada será enviado à Meta agora — você ainda revisa e publica no final do fluxo.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { markConfirmed(); setPendingConfirm(false); void run(); }} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Gerar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------- Header do card "Criativo do anúncio" ----------------

interface CopyHeaderActionsProps extends BaseCtx {
  hasAnyCopy: boolean;
  isEditing: boolean;
  onEditManual: () => void;
}

/**
 * Render do canto direito do header do card "Criativo do anúncio".
 * Mostra UM botão de copy (Gerar→Regenerar) e UM botão de Editar manualmente.
 * Nada mais. Nada espalhado.
 */
export function CopyHeaderActions({
  tenantId, actionId, adIndex, productNameHint, onChanged,
  hasAnyCopy, isEditing, onEditManual,
}: CopyHeaderActionsProps) {
  const ctx: BaseCtx = { tenantId, actionId, adIndex, productNameHint, onChanged };
  const [busy, setBusy] = useState(false);
  const [pendingGen, setPendingGen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  function startGenerate() {
    if (!isConfirmed()) { setPendingGen(true); return; }
    void runGenerate();
  }
  async function runGenerate() {
    setBusy(true);
    try {
      await callInline(ctx, { action: "generate_copy" });
      toast.success("Textos gerados com IA.");
      onChanged();
    } catch (e) {
      toast.error((e as Error)?.message || "Não foi possível gerar os textos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={onEditManual}
        disabled={busy || isEditing}
        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
        title="Editar título, texto e descrição manualmente"
      >
        <Pencil className="h-3 w-3 mr-1" />
        Editar manualmente
      </Button>

      {!hasAnyCopy ? (
        <Button
          size="sm"
          onClick={startGenerate}
          disabled={busy}
          className="h-7 text-[11px] px-2.5"
        >
          {busy ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
          Gerar copys
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={() => setRegenOpen(true)}
          disabled={busy}
          className="h-7 text-[11px] px-2.5"
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Regenerar copys
        </Button>
      )}

      <RegenCopyDialog open={regenOpen} onOpenChange={setRegenOpen} ctx={ctx} initialField="all" />

      <AlertDialog open={pendingGen} onOpenChange={(v) => { if (!v) setPendingGen(false); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar com IA?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-2">
              <span className="block">Isso vai consumir créditos de IA da sua conta.</span>
              <span className="block text-muted-foreground">Nada será enviado à Meta agora — você ainda revisa e publica no final do fluxo.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { markConfirmed(); setPendingGen(false); void runGenerate(); }} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Gerar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ---------------- Mini botão por campo (Título / Texto / Descrição) ----------------

export function PerFieldRegenButton({
  tenantId, actionId, adIndex, productNameHint, onChanged,
  field,
}: BaseCtx & { field: Exclude<CopyField, "all"> }) {
  const [open, setOpen] = useState(false);
  const ctx: BaseCtx = { tenantId, actionId, adIndex, productNameHint, onChanged };
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
        title={`Regenerar ${FIELD_LABEL_PT[field].toLowerCase()} com IA`}
      >
        <RefreshCw className="h-2.5 w-2.5" />
        Regenerar
      </button>
      <RegenCopyDialog open={open} onOpenChange={setOpen} ctx={ctx} initialField={field} lockField />
    </>
  );
}

// =============================================================================
// AdImageAIControls — botão único Gerar/Regenerar criativo (imagem).
// =============================================================================
interface ImageProps {
  tenantId: string;
  actionId: string;
  adIndex: number;
  hasImage: boolean;
  productNameHint?: string;
  onChanged: () => void;
}

export function AdImageAIControls({
  tenantId, actionId, adIndex, hasImage, productNameHint, onChanged,
}: ImageProps) {
  const [busy, setBusy] = useState(false);
  const [pendingGen, setPendingGen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function call(body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke("ads-creative-inline-generate", {
      body: {
        tenant_id: tenantId,
        action_id: actionId,
        ad_index: adIndex,
        product_name_hint: productNameHint || undefined,
        ...body,
      },
    });
    if (error) throw new Error(error.message || "Falha na chamada.");
    if (!(data as { success?: boolean })?.success) {
      throw new Error((data as { error_pt?: string })?.error_pt || "Não foi possível concluir.");
    }
    return data as Record<string, unknown>;
  }

  function startGenerate() {
    if (!isConfirmed()) { setPendingGen(true); return; }
    void runGenerate();
  }
  async function runGenerate() {
    setBusy(true);
    try {
      await call({ action: "generate_image" });
      toast.success("Criativo gerado com IA.");
      onChanged();
    } catch (e) {
      toast.error((e as Error)?.message || "Não foi possível gerar o criativo.");
    } finally {
      setBusy(false);
    }
  }

  async function runRegen() {
    const fb = feedback.trim();
    if (fb.length < 5) {
      toast.error("Conte rapidamente o que você quer diferente (mínimo 5 caracteres).");
      return;
    }
    setBusy(true);
    try {
      await call({ action: "regen_image", feedback: fb });
      toast.success("Novo criativo gerado. A IA aprendeu com seu feedback.");
      onChanged();
      setRegenOpen(false);
      setFeedback("");
    } catch (e) {
      toast.error((e as Error)?.message || "Não foi possível regenerar o criativo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!hasImage ? (
        <Button size="sm" onClick={startGenerate} disabled={busy} className="h-8 text-xs justify-start">
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          Gerar criativo
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setRegenOpen(true)} disabled={busy} className="h-8 text-xs justify-start">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Regenerar criativo
        </Button>
      )}

      <AlertDialog open={pendingGen} onOpenChange={(v) => { if (!v) setPendingGen(false); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar criativo com IA?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-2">
              <span className="block">Isso vai consumir créditos de IA da sua conta.</span>
              <span className="block text-muted-foreground">Nada será enviado à Meta agora.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { markConfirmed(); setPendingGen(false); void runGenerate(); }} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Gerar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={regenOpen} onOpenChange={(v) => { if (!busy) { setRegenOpen(v); if (!v) setFeedback(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Regenerar criativo
            </DialogTitle>
            <DialogDescription>
              Descreva o que quer diferente na imagem. Seu feedback vira aprendizado da IA desta loja.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              <Brain className="h-3 w-3 text-primary" />
              O que mudar na imagem?
            </Label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Ex.: cenário mais limpo, foco no produto, sem pessoas, paleta mais quente…"
              rows={4}
              maxLength={500}
              disabled={busy}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRegenOpen(false); setFeedback(""); }} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={runRegen} disabled={busy || feedback.trim().length < 5}>
              {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Regenerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
