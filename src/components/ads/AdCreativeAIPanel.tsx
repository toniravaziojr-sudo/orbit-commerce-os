// =============================================================================
// AdCreativeAIPanel — Onda H.4.10
//
// UI compacta. Sem textareas expostas. Toda regeneração acontece via popup
// (Dialog) onde o lojista escolhe o campo e digita o feedback que vira
// aprendizado da IA da loja.
//
// Exporta:
//   - AdCreativeAIPanel: barra fina ACIMA do card "Criativo do anúncio"
//     (Gerar tudo + Regenerar copy).
//   - RegenCopyButton: botão isolado "Regenerar copy" para colocar no header
//     do próprio card "Criativo do anúncio".
//   - AdImageAIControls: botão único Gerar/Regenerar imagem (também via popup).
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
import { Sparkles, Loader2, RefreshCw, Brain } from "lucide-react";
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

type CopyField = "all" | "headline" | "primary_text" | "description";

interface BaseCtx {
  tenantId: string;
  actionId: string;
  adIndex: number;
  productNameHint?: string;
  onChanged: () => void;
}

async function callInline(ctx: BaseCtx, body: Record<string, any>) {
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
  if (!(data as any)?.success) throw new Error((data as any)?.error_pt || "Não foi possível concluir.");
  return data as any;
}

// ---------------- Popup de regeneração de copy ----------------

function RegenCopyDialog({
  open, onOpenChange, ctx,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: BaseCtx;
}) {
  const [field, setField] = useState<CopyField>("all");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  function reset() {
    setField("all");
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
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível regenerar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) { onOpenChange(v); if (!v) reset(); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Regenerar copy do anúncio
            </DialogTitle>
            <DialogDescription>
              Escolha o que quer regenerar e descreva a direção desejada. Seu feedback vira aprendizado da IA desta loja.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">O que regenerar</Label>
              <Select value={field} onValueChange={(v) => setField(v as CopyField)} disabled={busy}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tudo (título + texto + descrição)</SelectItem>
                  <SelectItem value="headline">Apenas o título</SelectItem>
                  <SelectItem value="primary_text">Apenas o texto principal</SelectItem>
                  <SelectItem value="description">Apenas a descrição</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <Brain className="h-3 w-3 text-primary" />
                O que você quer diferente?
              </Label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Ex.: mais direto, focar no problema da queda, sem promessa de desconto, tom mais provocativo…"
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

// ---------------- Painel acima do card "Criativo do anúncio" ----------------

interface PanelProps extends BaseCtx {
  currentHeadline: string;
  currentPrimary: string;
  currentDescription: string;
}

export function AdCreativeAIPanel({
  tenantId, actionId, adIndex, productNameHint,
  currentHeadline, currentPrimary, currentDescription,
  onChanged,
}: PanelProps) {
  const ctx: BaseCtx = { tenantId, actionId, adIndex, productNameHint, onChanged };
  const [busy, setBusy] = useState(false);
  const [pendingGen, setPendingGen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);

  const hasAnyCopy = !!(currentHeadline || currentPrimary || currentDescription);

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
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar os textos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">
            Textos do anúncio com IA
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!hasAnyCopy ? (
            <Button size="sm" onClick={startGenerate} disabled={busy} className="h-8 text-xs">
              {busy ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
              Gerar copy
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={startGenerate} disabled={busy} className="h-8 text-xs">
                {busy ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
                Gerar tudo de novo
              </Button>
              <Button size="sm" onClick={() => setRegenOpen(true)} disabled={busy} className="h-8 text-xs">
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Regenerar copy
              </Button>
            </>
          )}
        </div>
      </div>

      <RegenCopyDialog open={regenOpen} onOpenChange={setRegenOpen} ctx={ctx} />

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

// ---------------- Botão isolado para o header do card ----------------

export function RegenCopyButton({
  tenantId, actionId, adIndex, productNameHint, onChanged,
}: BaseCtx) {
  const [open, setOpen] = useState(false);
  const ctx: BaseCtx = { tenantId, actionId, adIndex, productNameHint, onChanged };
  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Regenerar
      </Button>
      <RegenCopyDialog open={open} onOpenChange={setOpen} ctx={ctx} />
    </>
  );
}

// =============================================================================
// AdImageAIControls — botão compacto. Regen abre popup.
// =============================================================================
interface ImageProps {
  tenantId: string;
  actionId: string;
  adIndex: number;
  hasImage: boolean;
  onChanged: () => void;
}

export function AdImageAIControls({ tenantId, actionId, adIndex, hasImage, onChanged }: ImageProps) {
  const [busy, setBusy] = useState(false);
  const [pendingGen, setPendingGen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function call(body: Record<string, any>) {
    const { data, error } = await supabase.functions.invoke("ads-creative-inline-generate", {
      body: { tenant_id: tenantId, action_id: actionId, ad_index: adIndex, ...body },
    });
    if (error) throw new Error(error.message || "Falha na chamada.");
    if (!(data as any)?.success) throw new Error((data as any)?.error_pt || "Não foi possível concluir.");
    return data as any;
  }

  function startGenerate() {
    if (!isConfirmed()) { setPendingGen(true); return; }
    void runGenerate();
  }
  async function runGenerate() {
    setBusy(true);
    try {
      await call({ action: "generate_image" });
      toast.success("Imagem gerada com IA.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar a imagem.");
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
      toast.success("Nova imagem gerada. A IA aprendeu com seu feedback.");
      onChanged();
      setRegenOpen(false);
      setFeedback("");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível regenerar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  if (!hasImage) {
    return (
      <>
        <Button size="sm" onClick={startGenerate} disabled={busy} className="h-8 text-xs">
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          Gerar com IA
        </Button>
        <AlertDialog open={pendingGen} onOpenChange={(v) => { if (!v) setPendingGen(false); }}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Gerar imagem com IA?
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
      </>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setRegenOpen(true)} disabled={busy} className="h-8 text-xs">
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Regenerar imagem
      </Button>

      <Dialog open={regenOpen} onOpenChange={(v) => { if (!busy) { setRegenOpen(v); if (!v) setFeedback(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Regenerar imagem do anúncio
            </DialogTitle>
            <DialogDescription>
              Descreva o que quer diferente. Seu feedback vira aprendizado da IA desta loja.
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
