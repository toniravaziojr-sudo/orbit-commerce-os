// =============================================
// MeliAttributesPanel — Painel "Atributos para o anúncio" (Etapa 5B)
// Mostra 3 blocos (preenchido / revisar / faltando) e expõe se a publicação pode prosseguir.
// =============================================

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ResolvedAttr {
  id: string;
  name: string;
  value_name?: string;
  value_id?: string;
  status: "filled" | "review" | "missing";
  source: "product" | "derivation" | "dictionary" | "ai" | "none";
  required: boolean;
  message?: string;
}

export interface MeliAttributesPanelValue {
  attributes: ResolvedAttr[];
  canPublish: boolean;
}

interface Props {
  tenantId: string;
  productId: string | null;
  categoryId: string;
  onChange: (value: MeliAttributesPanelValue) => void;
}

const SOURCE_LABEL: Record<ResolvedAttr["source"], string> = {
  product: "do cadastro",
  derivation: "calculado",
  dictionary: "padrão do sistema",
  ai: "sugerido pela IA",
  none: "",
};

export function MeliAttributesPanel({ tenantId, productId, categoryId, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [attrs, setAttrs] = useState<ResolvedAttr[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchAttrs = async () => {
    if (!tenantId || !productId || !categoryId) return;
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("meli-resolve-attributes", {
        body: { tenantId, productId, categoryId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha ao resolver atributos");
      setAttrs(data.attributes ?? []);
    } catch (e: any) {
      setError(e.message || "Não foi possível carregar os atributos.");
      setAttrs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAttrs(); /* eslint-disable-next-line */ }, [tenantId, productId, categoryId]);

  // Propaga estado pro pai (validação de publicação)
  useEffect(() => {
    const canPublish = !loading && attrs.every(a => a.status !== "missing");
    onChange({ attributes: attrs, canPublish });
    // eslint-disable-next-line
  }, [attrs, loading]);

  const handleEdit = (id: string, value: string) => {
    setAttrs(prev => prev.map(a => a.id === id
      ? { ...a, value_name: value, value_id: undefined, status: value.trim() ? "filled" : "missing", source: "product" }
      : a));
  };

  const filled = attrs.filter(a => a.status === "filled");
  const review = attrs.filter(a => a.status === "review");
  const missing = attrs.filter(a => a.status === "missing");

  if (!categoryId) return null;

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Atributos para o anúncio</h4>
        </div>
        <Button size="sm" variant="ghost" onClick={fetchAttrs} disabled={loading} className="h-7 text-xs gap-1">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Recalcular
        </Button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          A IA está cruzando cadastro, categoria e dicionário do Mercado Livre...
        </p>
      )}

      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}

      {!loading && !error && attrs.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum atributo exigido por esta categoria.</p>
      )}

      {!loading && !error && attrs.length > 0 && (
        <>
          {/* Resumo */}
          <div className="flex gap-2 text-xs">
            <Badge variant="outline" className="border-green-500/40 text-green-700 dark:text-green-400">
              ✓ {filled.length} preenchido{filled.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">
              ⚠ {review.length} para revisar
            </Badge>
            <Badge variant="outline" className={missing.length > 0 ? "border-destructive/50 text-destructive" : "border-muted"}>
              ✗ {missing.length} faltando
            </Badge>
          </div>

          {/* Faltando — destaque */}
          {missing.length > 0 && (
            <Section title="Precisa preencher para publicar" tone="missing">
              {missing.map(a => (
                <AttrRow key={a.id} attr={a} onEdit={(v) => handleEdit(a.id, v)} />
              ))}
            </Section>
          )}

          {/* Revisar */}
          {review.length > 0 && (
            <Section title="Sugestões da IA — revise antes de publicar" tone="review">
              {review.map(a => (
                <AttrRow key={a.id} attr={a} onEdit={(v) => handleEdit(a.id, v)} />
              ))}
            </Section>
          )}

          {/* Preenchido — colapsado */}
          {filled.length > 0 && (
            <Section title={`Já preenchidos (${filled.length})`} tone="filled" collapsible>
              {filled.map(a => (
                <AttrRow key={a.id} attr={a} onEdit={(v) => handleEdit(a.id, v)} compact />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, tone, collapsible, children }: {
  title: string;
  tone: "filled" | "review" | "missing";
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  const toneClass = tone === "missing"
    ? "border-destructive/40 bg-destructive/5"
    : tone === "review"
    ? "border-amber-500/40 bg-amber-500/5"
    : "border-green-500/30 bg-green-500/5";
  return (
    <div className={`rounded-md border ${toneClass} p-2`}>
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className="w-full flex items-center justify-between text-xs font-medium"
      >
        <span>{title}</span>
        {collapsible && <span className="text-muted-foreground">{open ? "−" : "+"}</span>}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function AttrRow({ attr, onEdit, compact }: {
  attr: ResolvedAttr;
  onEdit: (v: string) => void;
  compact?: boolean;
}) {
  const icon = attr.status === "filled"
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
    : attr.status === "review"
    ? <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
    : <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {icon}
        <span className="font-medium">{attr.name}:</span>
        <span className="text-muted-foreground truncate">{attr.value_name || "—"}</span>
        {SOURCE_LABEL[attr.source] && (
          <span className="text-[10px] text-muted-foreground ml-auto">{SOURCE_LABEL[attr.source]}</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <Label className="text-xs flex-1">
          {attr.name}
          {attr.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {SOURCE_LABEL[attr.source] && (
          <span className="text-[10px] text-muted-foreground">{SOURCE_LABEL[attr.source]}</span>
        )}
      </div>
      <Input
        value={attr.value_name ?? ""}
        onChange={(e) => onEdit(e.target.value)}
        placeholder={attr.status === "missing" ? "Preencha este campo..." : ""}
        className="h-8 text-xs"
      />
      {attr.message && (
        <p className="text-[11px] text-muted-foreground">{attr.message}</p>
      )}
    </div>
  );
}
