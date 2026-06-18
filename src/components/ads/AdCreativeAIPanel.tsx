// =============================================================================
// AdCreativeAIPanel — Onda H.4.4
//
// Painel inline de geração de criativo (imagem + textos) com IA, embutido
// dentro da etapa "Anúncios" do StructuredProposalModal. Substitui o fluxo
// separado de Revisão Final + creative_jobs em background.
//
// Governança:
//   - Cada clique de gerar/regerar é um gesto explícito do lojista.
//   - Primeira geração da sessão exige confirmação ("consome créditos de IA").
//   - Falha mostra mensagem em PT-BR + permite nova tentativa.
//   - Após sucesso, dispara onChanged() para o pai recarregar action_data.
// =============================================================================

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sparkles, Loader2, RefreshCw, AlertCircle } from "lucide-react";
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

export function AdCreativeAIPanel({
  tenantId, actionId, adIndex,
  currentHeadline, currentPrimary, currentDescription,
  onChanged,
}: Props) {
  const [pendingAction, setPendingAction] = useState<null | { kind: "copy_all" } | { kind: "regen_field"; field: "headline" | "primary_text" | "description"; feedback: string }>(null);
  const [busy, setBusy] = useState<null | "copy_all" | "headline" | "primary_text" | "description">(null);
  const [openField, setOpenField] = useState<null | "headline" | "primary_text" | "description">(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({ headline: "", primary_text: "", description: "" });

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

  function startRegenField(field: "headline" | "primary_text" | "description") {
    const fb = (feedbacks[field] || "").trim();
    if (fb.length < 5) {
      toast.error("Conte rapidamente como você quer este texto diferente (mínimo 5 caracteres).");
      return;
    }
    if (!isConfirmed()) { setPendingAction({ kind: "regen_field", field, feedback: fb }); return; }
    runRegenField(field, fb);
  }
  async function runRegenField(field: "headline" | "primary_text" | "description", feedback: string) {
    setBusy(field);
    try {
      await callFn({ action: "regen_copy_field", field, feedback });
      toast.success("Texto regenerado com seu feedback.");
      setFeedbacks((f) => ({ ...f, [field]: "" }));
      setOpenField(null);
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
            Em um clique a IA escreve título, texto principal e descrição com base na estratégia da campanha. Depois você pode editar cada campo à mão ou regenerar individualmente.
          </p>
        )}

        {hasAnyCopy && (
          <div className="space-y-1.5">
            {(["headline", "primary_text", "description"] as const).map((field) => {
              const label = field === "headline" ? "Título" : field === "primary_text" ? "Texto principal" : "Descrição";
              const value = field === "headline" ? currentHeadline : field === "primary_text" ? currentPrimary : currentDescription;
              const isOpen = openField === field;
              return (
                <div key={field} className="rounded border border-border/40 bg-background">
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] uppercase text-muted-foreground/70">{label}</span>
                      <p className="text-xs truncate">{value || <em className="text-muted-foreground/60">vazio</em>}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setOpenField(isOpen ? null : field)}
                      disabled={busy !== null}
                      className="h-6 text-[11px] px-2"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Regerar com IA
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="border-t border-border/40 p-2.5 space-y-2 bg-muted/20">
                      <Label className="text-[11px]">O que mudar neste {label.toLowerCase()}?</Label>
                      <Textarea
                        value={feedbacks[field] || ""}
                        onChange={(e) => setFeedbacks((f) => ({ ...f, [field]: e.target.value }))}
                        placeholder="Ex.: mais direto, foco no benefício, sem promessa de desconto…"
                        rows={2}
                        maxLength={300}
                        className="text-xs"
                      />
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setOpenField(null)} disabled={busy === field} className="h-7 text-xs">
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={() => startRegenField(field)} disabled={busy !== null || (feedbacks[field] || "").trim().length < 5} className="h-7 text-xs">
                          {busy === field ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                          Regenerar
                        </Button>
                      </div>
                    </div>
                  )}
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
// AdImageAIControls — botões de IA para a IMAGEM do anúncio.
// Usado dentro de AttachCreativeBlock como complemento ao upload manual.
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
  const [open, setOpen] = useState(false);
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
      toast.success("Nova imagem gerada com seu feedback.");
      setFeedback("");
      setOpen(false);
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
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          disabled={busy !== null}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Regerar com IA
        </Button>
      )}

      {open && hasImage && (
        <div className="w-full mt-2 rounded-md border border-border/40 bg-muted/20 p-2.5 space-y-2">
          <Label className="text-[11px]">O que você quer diferente na imagem?</Label>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Ex.: cenário mais limpo, foco no produto, sem pessoas, paleta mais quente…"
            rows={2}
            maxLength={400}
            className="text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy === "regen"} className="h-7 text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={startRegen} disabled={busy !== null || feedback.trim().length < 5} className="h-7 text-xs">
              {busy === "regen" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
              Regenerar imagem
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
