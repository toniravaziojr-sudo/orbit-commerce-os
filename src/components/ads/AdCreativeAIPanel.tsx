// =============================================================================
// AdCreativeAIPanel — Onda H.4.5
//
// Painel inline de geração de criativo (imagem + textos) com IA, embutido
// dentro da etapa "Anúncios" do StructuredProposalModal.
//
// Mudanças vs H.4.4:
//   - Campo de feedback SEMPRE VISÍVEL em cada campo de copy e na imagem,
//     com aviso de que vira aprendizado da IA daquela loja.
//   - Botão "Regenerar com este feedback" desabilitado até 5 caracteres.
//   - Feedback é mandatório no regen (já era no backend) e fica claro na UX.
// =============================================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles, Loader2, RefreshCw, Brain } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  tenantId: string;
  actionId: string;
  adIndex: number;
  currentHeadline: string;
  currentPrimary: string;
  currentDescription: string;
  onChanged: () => void;
}

const SESSION_KEY = "ads-ai-inline-confirmed";

function isConfirmed(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}
function markConfirmed() {
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }
}

type CopyField = "headline" | "primary_text" | "description";

export function AdCreativeAIPanel({
  tenantId, actionId, adIndex,
  currentHeadline, currentPrimary, currentDescription,
  onChanged,
}: Props) {
  const [pendingAction, setPendingAction] = useState<
    null
    | { kind: "copy_all" }
    | { kind: "regen_field"; field: CopyField; feedback: string }
  >(null);
  const [busy, setBusy] = useState<null | "copy_all" | CopyField>(null);
  const [feedbacks, setFeedbacks] = useState<Record<CopyField, string>>({
    headline: "", primary_text: "", description: "",
  });

  async function callFn(body: Record<string, any>) {
    const { data, error } = await supabase.functions.invoke("ads-creative-inline-generate", {
      body: { tenant_id: tenantId, action_id: actionId, ad_index: adIndex, ...body },
    });
    if (error) throw new Error(error.message || "Falha na chamada.");
    if (!(data as any)?.success) throw new Error((data as any)?.error_pt || "Não foi possível concluir.");
    return data as any;
  }

  function startGenerateAll() {
    if (!isConfirmed()) { setPendingAction({ kind: "copy_all" }); return; }
    runGenerateAll();
  }
  async function runGenerateAll() {
    setBusy("copy_all");
    try {
      await callFn({ action: "generate_copy" });
      toast.success("Textos gerados com IA.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar os textos.");
    } finally {
      setBusy(null);
    }
  }

  function startRegenField(field: CopyField) {
    const fb = (feedbacks[field] || "").trim();
    if (fb.length < 5) {
      toast.error("Conte rapidamente como você quer este texto diferente (mínimo 5 caracteres).");
      return;
    }
    if (!isConfirmed()) { setPendingAction({ kind: "regen_field", field, feedback: fb }); return; }
    runRegenField(field, fb);
  }
  async function runRegenField(field: CopyField, feedback: string) {
    setBusy(field);
    try {
      await callFn({ action: "regen_copy_field", field, feedback });
      toast.success("Texto regenerado com seu feedback. A IA aprendeu com isso.");
      setFeedbacks((f) => ({ ...f, [field]: "" }));
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível regenerar.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmAndProceed() {
    if (!pendingAction) return;
    markConfirmed();
    const p = pendingAction;
    setPendingAction(null);
    if (p.kind === "copy_all") await runGenerateAll();
    else await runRegenField(p.field, p.feedback);
  }

  const hasAnyCopy = !!(currentHeadline || currentPrimary || currentDescription);

  return (
    <>
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">Textos do anúncio com IA</h4>
          </div>
          <Button
            size="sm"
            variant={hasAnyCopy ? "outline" : "default"}
            onClick={startGenerateAll}
            disabled={busy !== null}
            className="h-7 text-xs"
          >
            {busy === "copy_all" ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1.5" />}
            {hasAnyCopy ? "Gerar tudo novamente" : "Gerar título + texto + descrição"}
          </Button>
        </div>

        {!hasAnyCopy && (
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            A IA gera título, texto principal e descrição com base no produto, no público do conjunto vinculado e na voz da sua marca. Depois você pode editar à mão ou regenerar cada campo com o seu feedback.
          </p>
        )}

        {hasAnyCopy && (
          <div className="space-y-2">
            {(["headline", "primary_text", "description"] as const).map((field) => {
              const label = field === "headline" ? "Título" : field === "primary_text" ? "Texto principal" : "Descrição";
              const value = field === "headline" ? currentHeadline : field === "primary_text" ? currentPrimary : currentDescription;
              const fb = feedbacks[field] || "";
              const canRegen = fb.trim().length >= 5 && busy === null;
              const placeholder = field === "headline"
                ? "Ex.: mais direto, foco no problema, sem promessa de desconto…"
                : field === "primary_text"
                ? "Ex.: abrir com uma dor real, falar do benefício X, sem 'compre agora'…"
                : "Ex.: encurtar e citar o benefício principal…";
              return (
                <div key={field} className="rounded border border-border/40 bg-background p-2.5 space-y-2">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground/70">{label} atual</span>
                    <p className="text-xs leading-relaxed">{value || <em className="text-muted-foreground/60">vazio</em>}</p>
                  </div>
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    <Label className="text-[11px] flex items-center gap-1">
                      <Brain className="h-3 w-3 text-primary" />
                      O que você quer diferente neste {label.toLowerCase()}?
                    </Label>
                    <Textarea
                      value={fb}
                      onChange={(e) => setFeedbacks((f) => ({ ...f, [field]: e.target.value }))}
                      placeholder={placeholder}
                      rows={2}
                      maxLength={300}
                      className="text-xs"
                      disabled={busy === field}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-muted-foreground/70">
                        Seu feedback vira aprendizado da IA desta loja.
                      </span>
                      <Button
                        size="sm"
                        onClick={() => startRegenField(field)}
                        disabled={!canRegen}
                        className="h-7 text-xs"
                      >
                        {busy === field ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Regenerar com este feedback
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={pendingAction !== null} onOpenChange={(v) => { if (!v) setPendingAction(null); }}>
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
            <AlertDialogAction onClick={confirmAndProceed} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Gerar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// =============================================================================
// AdImageAIControls — feedback de imagem sempre visível quando hasImage.
// =============================================================================
interface ImageProps {
  tenantId: string;
  actionId: string;
  adIndex: number;
  hasImage: boolean;
  onChanged: () => void;
}

export function AdImageAIControls({ tenantId, actionId, adIndex, hasImage, onChanged }: ImageProps) {
  const [pending, setPending] = useState<null | { kind: "generate" } | { kind: "regen"; feedback: string }>(null);
  const [busy, setBusy] = useState<null | "generate" | "regen">(null);
  const [feedback, setFeedback] = useState("");

  async function callFn(body: Record<string, any>) {
    const { data, error } = await supabase.functions.invoke("ads-creative-inline-generate", {
      body: { tenant_id: tenantId, action_id: actionId, ad_index: adIndex, ...body },
    });
    if (error) throw new Error(error.message || "Falha na chamada.");
    if (!(data as any)?.success) throw new Error((data as any)?.error_pt || "Não foi possível concluir.");
    return data as any;
  }

  function startGenerate() {
    if (!isConfirmed()) { setPending({ kind: "generate" }); return; }
    runGenerate();
  }
  async function runGenerate() {
    setBusy("generate");
    try {
      await callFn({ action: "generate_image" });
      toast.success("Imagem gerada com IA.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar a imagem.");
    } finally {
      setBusy(null);
    }
  }

  function startRegen() {
    const fb = feedback.trim();
    if (fb.length < 5) {
      toast.error("Conte rapidamente o que você quer diferente na imagem (mínimo 5 caracteres).");
      return;
    }
    if (!isConfirmed()) { setPending({ kind: "regen", feedback: fb }); return; }
    runRegen(fb);
  }
  async function runRegen(fb: string) {
    setBusy("regen");
    try {
      await callFn({ action: "regen_image", feedback: fb });
      toast.success("Nova imagem gerada com seu feedback. A IA aprendeu com isso.");
      setFeedback("");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível regenerar a imagem.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmAndProceed() {
    if (!pending) return;
    markConfirmed();
    const p = pending;
    setPending(null);
    if (p.kind === "generate") await runGenerate();
    else await runRegen(p.feedback);
  }

  return (
    <>
      {!hasImage ? (
        <Button
          variant="default"
          size="sm"
          onClick={startGenerate}
          disabled={busy !== null}
        >
          {busy === "generate" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
          Gerar imagem com IA
        </Button>
      ) : (
        <div className="w-full mt-2 rounded-md border border-primary/30 bg-primary/5 p-2.5 space-y-2">
          <Label className="text-[11px] flex items-center gap-1">
            <Brain className="h-3 w-3 text-primary" />
            O que você quer diferente na imagem?
          </Label>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Ex.: cenário mais limpo, foco no produto, sem pessoas, paleta mais quente…"
            rows={2}
            maxLength={400}
            className="text-xs"
            disabled={busy === "regen"}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] text-muted-foreground/70">
              Seu feedback vira aprendizado da IA desta loja.
            </span>
            <Button
              size="sm"
              onClick={startRegen}
              disabled={busy !== null || feedback.trim().length < 5}
              className="h-7 text-xs"
            >
              {busy === "regen" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Regenerar imagem com este feedback
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(v) => { if (!v) setPending(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Gerar imagem com IA?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed space-y-2">
              <span className="block">Isso vai consumir créditos de IA da sua conta.</span>
              <span className="block text-muted-foreground">Nada será enviado à Meta agora — você ainda revisa e publica no final do fluxo.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndProceed} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Gerar agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
