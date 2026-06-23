// =============================================
// MeliAttributesPanel — Painel "Atributos para o anúncio" (Etapa 5B)
// Mostra 3 blocos (preenchido / revisar / faltando) e expõe se a publicação pode prosseguir.
//
// v1.5.0 — Fila global de concorrência (máx 3 simultâneas) para impedir bombardeio
// quando o usuário abre o dialog em lote (21 produtos = 21 chamadas paralelas).
// Erro amigável por produto, com botão "Tentar de novo" isolado.
// =============================================

import { useEffect, useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, Sparkles, RefreshCw, Pencil, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export interface ResolvedAttr {
  id: string;
  name: string;
  value_name?: string;
  value_id?: string;
  /** Múltiplos valores para atributos multi-seleção do ML (Tipos de cabelo, Formatos etc.). */
  values?: Array<{ id?: string; name: string }>;
  status: "filled" | "review" | "missing";
  source: "product" | "derivation" | "dictionary" | "ai" | "manual" | "none";
  required: boolean;
  message?: string;
}

export interface MeliAttributesPanelValue {
  attributes: ResolvedAttr[];
  canPublish: boolean;
}

interface Props {
  tenantId: string;
  listingId?: string;
  productId: string | null;
  categoryId: string;
  onChange: (value: MeliAttributesPanelValue) => void;
  /** Incrementa para forçar recálculo via IA (botão "Recalcular todos"). */
  recalcToken?: number;
  /** Quando muda, substitui os atributos atuais pelos fornecidos (botão "Aplicar a todos"). */
  seedToken?: number;
  seedAttributes?: ResolvedAttr[];
}

const SOURCE_LABEL: Record<ResolvedAttr["source"], string> = {
  product: "Do cadastro do produto",
  derivation: "Do cadastro do produto",
  dictionary: "Do cadastro do produto",
  ai: "Sugerido pela IA",
  manual: "Editado manualmente",
  none: "",
};

const SOURCE_TONE: Record<ResolvedAttr["source"], string> = {
  product: "text-green-700 dark:text-green-400",
  derivation: "text-green-700 dark:text-green-400",
  dictionary: "text-green-700 dark:text-green-400",
  ai: "text-sky-700 dark:text-sky-400",
  manual: "text-violet-700 dark:text-violet-400",
  none: "text-muted-foreground",
};

// ----- Fila global: no máximo 3 resoluções rodando em paralelo no app inteiro.
// Isto protege o motor de IA contra 21 painéis disparando ao mesmo tempo
// quando o usuário abre o dialog de configuração em lote.
const MAX_CONCURRENT = 3;
let running = 0;
const queue: Array<() => void> = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  running++;
  try {
    return await fn();
  } finally {
    running--;
    const next = queue.shift();
    if (next) next();
  }
}

export function MeliAttributesPanel({ tenantId, listingId, productId, categoryId, onChange, recalcToken, seedToken, seedAttributes }: Props) {
  const [loading, setLoading] = useState(false);
  const [queued, setQueued] = useState(false);
  const [attrs, setAttrs] = useState<ResolvedAttr[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastKeyRef = useRef<string>("");
  const lastRecalcTokenRef = useRef<number | undefined>(recalcToken);
  const lastSeedTokenRef = useRef<number | undefined>(seedToken);

  // Persiste o resultado no anúncio para que reabrir o dialog não dispare IA de novo.
  const persistToListing = async (next: ResolvedAttr[]) => {
    if (!listingId) return;
    const payload = next
      .filter(a => a.status !== "missing" && (a.value_name || a.value_id))
      .map(a => ({
        id: a.id,
        name: a.name,
        ...(a.value_id ? { value_id: a.value_id } : {}),
        ...(a.value_name ? { value_name: a.value_name } : {}),
        source: a.source,
      }));
    try {
      await supabase.from("meli_listings").update({ attributes: payload as any }).eq("id", listingId);
    } catch {
      /* persistência silenciosa — não bloqueia UX */
    }
  };

  // Carrega características já salvas no anúncio. Só chama a IA/resolver
  // quando não houver nada salvo OU quando o usuário clicar em Recalcular.
  const loadSavedOrResolve = async (forceResolve = false) => {
    if (!tenantId || !productId || !categoryId) return;
    setError(null);
    try {
      if (!forceResolve && listingId) {
        const { data: saved } = await supabase
          .from("meli_listings")
          .select("attributes, category_id")
          .eq("id", listingId)
          .maybeSingle();
        const savedAttrs = Array.isArray(saved?.attributes) ? (saved!.attributes as any[]) : [];
        const sameCategory = saved?.category_id === categoryId;
        if (sameCategory && savedAttrs.length > 0) {
          // Reaproveita as características já resolvidas — sem custo de IA.
          const hydrated: ResolvedAttr[] = savedAttrs.map((a: any) => ({
            id: a.id,
            name: a.name || a.id,
            value_name: a.value_name,
            value_id: a.value_id,
            status: "filled",
            source: (a.source as ResolvedAttr["source"]) || "product",
            required: false,
          }));
          setAttrs(hydrated);
          return;
        }
      }
      // Passa pela fila: no máximo 3 simultâneas no app inteiro.
      setQueued(true);
      await withSlot(async () => {
        setQueued(false);
        setLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke("meli-resolve-attributes", {
            body: { tenantId, listingId, productId, categoryId },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Falha ao resolver atributos");
          const next = (data.attributes ?? []) as ResolvedAttr[];
          setAttrs(next);
          // Persiste imediatamente para que reabrir o dialog não dispare IA de novo.
          void persistToListing(next);
        } finally {
          setLoading(false);
        }
      });
    } catch (e: any) {
      setQueued(false);
      setLoading(false);
      setError(friendlyError(e));
      setAttrs([]);
    }
  };

  const fetchAttrs = () => loadSavedOrResolve(true);

  // Carrega uma única vez por combinação tenant+produto+categoria+anúncio.
  useEffect(() => {
    const key = `${tenantId}|${productId}|${categoryId}|${listingId ?? ""}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;
    loadSavedOrResolve(false);
    // eslint-disable-next-line
  }, [tenantId, productId, categoryId, listingId]);

  // Recalcular todos (acionado pelo pai).
  useEffect(() => {
    if (recalcToken === undefined) return;
    if (lastRecalcTokenRef.current === recalcToken) return;
    lastRecalcTokenRef.current = recalcToken;
    void loadSavedOrResolve(true);
    // eslint-disable-next-line
  }, [recalcToken]);

  // Aplicar a todos (acionado pelo pai) — substitui atributos atuais pelos do produto fonte.
  useEffect(() => {
    if (seedToken === undefined) return;
    if (lastSeedTokenRef.current === seedToken) return;
    lastSeedTokenRef.current = seedToken;
    if (Array.isArray(seedAttributes) && seedAttributes.length > 0) {
      setAttrs(seedAttributes);
      void persistToListing(seedAttributes);
    }
    // eslint-disable-next-line
  }, [seedToken]);

  // Propaga estado pro pai (validação de publicação)
  useEffect(() => {
    const canPublish = !loading && !queued && !error && attrs.every(a => a.status !== "missing");
    onChange({ attributes: attrs, canPublish });
    // eslint-disable-next-line
  }, [attrs, loading, queued, error]);

  const handleEdit = (id: string, value: string) => {
    setAttrs(prev => {
      const next = prev.map(a => a.id === id
        ? { ...a, value_name: value, value_id: undefined, status: (value.trim() ? "filled" : "missing") as ResolvedAttr["status"], source: "manual" as ResolvedAttr["source"] }
        : a);
      void persistToListing(next);
      return next;
    });
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
        <Button size="sm" variant="ghost" onClick={fetchAttrs} disabled={loading || queued} className="h-7 text-xs gap-1">
          {(loading || queued) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Recalcular
        </Button>
      </div>

      {queued && !loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Aguardando vez na fila (processamos no máximo 3 produtos ao mesmo tempo)...
        </p>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          A IA está cruzando cadastro, categoria e dicionário do Mercado Livre...
        </p>
      )}

      {error && (
        <div className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={fetchAttrs} disabled={loading || queued}>
            Tentar de novo
          </Button>
        </div>
      )}

      {!loading && !queued && !error && attrs.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum atributo exigido por esta categoria.</p>
      )}

      {!loading && !queued && !error && attrs.length > 0 && (
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

function friendlyError(e: any): string {
  const raw = String(e?.message || e || "");
  if (/non-2xx|status code|FunctionsHttpError/i.test(raw)) {
    return "Não conseguimos preparar as características deste produto agora. Tente de novo em alguns segundos.";
  }
  if (/timeout|aborted/i.test(raw)) {
    return "A IA demorou demais para responder. Tente novamente.";
  }
  if (/429|rate/i.test(raw)) {
    return "Estamos processando muitos produtos ao mesmo tempo. Aguarde e tente de novo.";
  }
  return "Não conseguimos carregar as características deste produto. Tente novamente.";
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(attr.value_name ?? "");

  useEffect(() => {
    if (!editing) setDraft(attr.value_name ?? "");
  }, [attr.value_name, editing]);

  const icon = attr.status === "filled"
    ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
    : attr.status === "review"
    ? <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
    : <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;

  const commit = () => {
    onEdit(draft);
    setEditing(false);
  };
  const cancel = () => {
    setDraft(attr.value_name ?? "");
    setEditing(false);
  };

  if (compact) {
    if (editing) {
      return (
        <div className="flex items-center gap-1.5 text-xs">
          {icon}
          <span className="font-medium shrink-0">{attr.name}:</span>
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") cancel();
            }}
            className="h-7 text-xs flex-1"
          />
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={commit} title="Salvar">
            <Check className="h-3.5 w-3.5 text-green-600" />
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancel} title="Cancelar">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }
    return (
      <div className="group flex items-center gap-2 text-xs">
        {icon}
        <span className="font-medium">{attr.name}:</span>
        <span className="text-muted-foreground truncate">{attr.value_name || "—"}</span>
        {SOURCE_LABEL[attr.source] && (
          <span className={`text-[10px] ml-auto font-medium ${SOURCE_TONE[attr.source]}`}>{SOURCE_LABEL[attr.source]}</span>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setEditing(true)}
          title="Editar manualmente"
        >
          <Pencil className="h-3 w-3" />
        </Button>
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
          <span className={`text-[10px] font-medium ${SOURCE_TONE[attr.source]}`}>{SOURCE_LABEL[attr.source]}</span>
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
