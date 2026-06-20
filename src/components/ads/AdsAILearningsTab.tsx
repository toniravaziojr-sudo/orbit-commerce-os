// =============================================================================
// AdsAILearningsTab — Onda H.4.6
// Aprendizados da IA do Gestor de Tráfego, organizados em abas por TEMA:
// Copys · Criativos · Estratégias · Públicos · Configurações
// Filtro secundário por status dentro de cada aba.
// =============================================================================

import { useMemo, useState } from "react";
import { Plus, Sparkles, Pause, Play, Archive, Trash2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  useAdsAILearnings,
  LEARNING_CATEGORY_LABELS,
  LEARNING_STATUS_LABELS,
  type AdsAILearning,
  type LearningCategory,
  type LearningStatus,
} from "@/hooks/useAdsAILearnings";

const STATUS_VARIANT: Record<LearningStatus, "default" | "secondary" | "outline" | "destructive"> = {
  active: "default",
  suggested: "secondary",
  paused: "outline",
  archived: "outline",
};

type ThemeKey = "copys" | "criativos" | "estrategias" | "publicos" | "configuracoes";

const THEMES: Array<{
  key: ThemeKey;
  label: string;
  categories: LearningCategory[];
  defaultCategory: LearningCategory;
  description: string;
}> = [
  {
    key: "copys",
    label: "Copys",
    categories: ["copy"],
    defaultCategory: "copy",
    description: "Tom, ângulos, palavras evitadas e direções de texto de anúncio.",
  },
  {
    key: "criativos",
    label: "Criativos",
    categories: ["criativo", "produto"],
    defaultCategory: "criativo",
    description: "Estilo de imagem, composição, uso do produto e referências visuais.",
  },
  {
    key: "estrategias",
    label: "Estratégias",
    categories: ["funil", "oferta", "performance"],
    defaultCategory: "funil",
    description: "Funil, ofertas, leitura de performance e decisões de campanha.",
  },
  {
    key: "publicos",
    label: "Públicos",
    categories: ["publico"],
    defaultCategory: "publico",
    description: "Quem incluir, quem excluir, lookalikes e segmentações que funcionam.",
  },
  {
    key: "configuracoes",
    label: "Configurações",
    categories: ["orcamento", "tracking", "restricao", "outro"],
    defaultCategory: "outro",
    description: "Orçamento, tracking, restrições e regras gerais da conta.",
  },
];

type StatusFilter = "all" | LearningStatus;

export function AdsAILearningsTab() {
  const { learnings, isLoading, create, update, setStatus, remove } = useAdsAILearnings();

  const [theme, setTheme] = useState<ThemeKey>("copys");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdsAILearning | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; category: LearningCategory }>({
    title: "",
    description: "",
    category: "copy",
  });

  // Conta itens por tema (independente do status filter).
  const countsByTheme = useMemo(() => {
    const map: Record<ThemeKey, number> = { copys: 0, criativos: 0, estrategias: 0, publicos: 0, configuracoes: 0 };
    for (const l of learnings) {
      if (l.status === "archived") continue; // não polui o contador principal
      for (const t of THEMES) {
        if (t.categories.includes(l.category)) {
          map[t.key]++;
          break;
        }
      }
    }
    return map;
  }, [learnings]);

  const currentTheme = THEMES.find((t) => t.key === theme)!;

  const filtered = useMemo(() => {
    return learnings.filter((l) => {
      if (!currentTheme.categories.includes(l.category)) return false;
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      return true;
    });
  }, [learnings, currentTheme, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ title: "", description: "", category: currentTheme.defaultCategory });
    setDialogOpen(true);
  }
  function openEdit(l: AdsAILearning) {
    setEditing(l);
    setForm({ title: l.title, description: l.description || "", category: l.category });
    setDialogOpen(true);
  }
  async function save() {
    if (!form.title.trim() || form.title.trim().length < 6) return;
    if (editing) {
      await update.mutateAsync({ id: editing.id, title: form.title, description: form.description, category: form.category });
    } else {
      await create.mutateAsync({ title: form.title, description: form.description, category: form.category, status: "active" });
    }
    setDialogOpen(false);
  }

  const allowedCategoriesForForm: LearningCategory[] = editing
    ? (Object.keys(LEARNING_CATEGORY_LABELS) as LearningCategory[])
    : currentTheme.categories;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Aprendizados da IA
          </CardTitle>
          <CardDescription>
            Decisões e preferências que a IA aplica ao planejar e gerar campanhas. Os feedbacks que você dá ao
            regenerar copy ou criativo entram aqui automaticamente como aprendizados <strong>ativos</strong>.
          </CardDescription>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Novo aprendizado
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={theme} onValueChange={(v) => setTheme(v as ThemeKey)}>
          <TabsList className="flex-wrap h-auto">
            {THEMES.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label} ({countsByTheme[t.key]})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={theme} className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{currentTheme.description}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="active">{LEARNING_STATUS_LABELS.active}</SelectItem>
                    <SelectItem value="suggested">{LEARNING_STATUS_LABELS.suggested}</SelectItem>
                    <SelectItem value="paused">{LEARNING_STATUS_LABELS.paused}</SelectItem>
                    <SelectItem value="archived">{LEARNING_STATUS_LABELS.archived}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum aprendizado nesta aba ainda. Eles aparecem aqui conforme você dá feedback nas regenerações
                ou aprova/recusa propostas.
              </p>
            )}

            {filtered.map((l) => {
              // Tarja humana para feedbacks de copy/imagem: "Feedback de Título — Produto".
              const meta = (l.metadata || {}) as Record<string, any>;
              const subtype = String(meta.subtype || "");
              const product = String(meta.product_name || "").trim();
              let feedbackTag: string | null = null;
              if (subtype === "creative_copy_feedback") {
                const labelMap: Record<string, string> = {
                  headline: "Título",
                  primary_text: "Texto",
                  description: "Descrição",
                  copy: "Copy",
                };
                const lbl = labelMap[String(meta.field || "")] || (meta.field_label_pt ? String(meta.field_label_pt) : "Copy");
                const pretty = lbl.charAt(0).toUpperCase() + lbl.slice(1);
                feedbackTag = `Feedback de ${pretty}${product ? ` — ${product}` : ""}`;
              } else if (subtype === "creative_image_feedback") {
                feedbackTag = `Feedback de Imagem${product ? ` — ${product}` : ""}`;
              }
              return (
              <div key={l.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    {feedbackTag && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {feedbackTag}
                      </Badge>
                    )}
                    <Badge variant={STATUS_VARIANT[l.status]}>{LEARNING_STATUS_LABELS[l.status]}</Badge>
                    <Badge variant="outline">{LEARNING_CATEGORY_LABELS[l.category] || l.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {l.evidence_count} evidência{l.evidence_count === 1 ? "" : "s"} · confiança {Math.round(l.confidence * 100)}%
                    </span>
                  </div>
                  <p className="font-medium text-sm">{l.title}</p>
                  {l.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{l.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Origem: {
                      l.source_type === "manual" ? "criado manualmente" :
                      l.source_type === "user_feedback" ? "feedback do lojista" :
                      l.source_type
                    }
                    {" · "}
                    {new Date(l.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {l.status !== "active" && l.status !== "archived" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "active" })}>
                      <Play className="h-3 w-3 mr-1" /> Ativar
                    </Button>
                  )}
                  {l.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: l.id, status: "paused" })}>
                      <Pause className="h-3 w-3 mr-1" /> Pausar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(l)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  {l.status !== "archived" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: l.id, status: "archived" })}>
                      <Archive className="h-3 w-3 mr-1" /> Arquivar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(l.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Remover
                  </Button>
                </div>
              </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar aprendizado" : "Novo aprendizado"}</DialogTitle>
            <DialogDescription>
              Frases curtas e diretas funcionam melhor. Ex.: "Evitar kits de quantidade em público frio."
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Aprendizado</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Sempre excluir clientes atuais em campanhas de prospecção." />
            </div>
            <div>
              <label className="text-sm font-medium">Detalhes (opcional)</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div>
              <label className="text-sm font-medium">Categoria</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as LearningCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allowedCategoriesForForm.map((c) => (
                    <SelectItem key={c} value={c}>{LEARNING_CATEGORY_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={form.title.trim().length < 6}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
