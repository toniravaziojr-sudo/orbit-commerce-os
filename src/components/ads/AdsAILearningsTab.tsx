// =============================================================================
// AdsAILearningsTab — Onda F
// Área editável de Aprendizados da IA do Gestor de Tráfego.
// Vive dentro de Configurações Gerais do Gestor de Tráfego IA.
// =============================================================================

import { useState } from "react";
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

export function AdsAILearningsTab() {
  const { learnings, isLoading, create, update, setStatus, remove } = useAdsAILearnings();
  const [tab, setTab] = useState<"all" | LearningStatus>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdsAILearning | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; category: LearningCategory }>({
    title: "",
    description: "",
    category: "outro",
  });

  const filtered = tab === "all" ? learnings : learnings.filter((l) => l.status === tab);
  const counts = {
    all: learnings.length,
    suggested: learnings.filter((l) => l.status === "suggested").length,
    active: learnings.filter((l) => l.status === "active").length,
    paused: learnings.filter((l) => l.status === "paused").length,
    archived: learnings.filter((l) => l.status === "archived").length,
  };

  function openCreate() {
    setEditing(null);
    setForm({ title: "", description: "", category: "outro" });
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

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Aprendizados da IA
          </CardTitle>
          <CardDescription>
            Decisões e preferências aprendidas do Gestor de Tráfego. Só aprendizados <strong>ativos</strong> entram nas próximas análises.
            Aprendizados gerados a partir de feedbacks já entram <strong>ativos</strong> automaticamente — você pode pausar, editar ou remover quando quiser.
          </CardDescription>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" /> Novo aprendizado
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos ({counts.all})</TabsTrigger>
            <TabsTrigger value="suggested">Sugeridos ({counts.suggested})</TabsTrigger>
            <TabsTrigger value="active">Ativos ({counts.active})</TabsTrigger>
            <TabsTrigger value="paused">Pausados ({counts.paused})</TabsTrigger>
            <TabsTrigger value="archived">Arquivados ({counts.archived})</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4 space-y-2">
            {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
            {!isLoading && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum aprendizado nesta aba. Eles aparecem aqui conforme você aprova, recusa ou ajusta propostas.
              </p>
            )}
            {filtered.map((l) => (
              <div key={l.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant={STATUS_VARIANT[l.status]}>{LEARNING_STATUS_LABELS[l.status]}</Badge>
                    <Badge variant="outline">{LEARNING_CATEGORY_LABELS[l.category]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {l.evidence_count} evidência{l.evidence_count === 1 ? "" : "s"} · confiança {Math.round(l.confidence * 100)}%
                    </span>
                  </div>
                  <p className="font-medium text-sm">{l.title}</p>
                  {l.description && <p className="text-sm text-muted-foreground mt-1">{l.description}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Origem: {l.source_type === "manual" ? "criado manualmente" : l.source_type}
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
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar aprendizado" : "Novo aprendizado"}</DialogTitle>
            <DialogDescription>
              Frases curtas e diretas funcionam melhor. Ex.: “Evitar kits de quantidade em público frio.”
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
                  {(Object.keys(LEARNING_CATEGORY_LABELS) as LearningCategory[]).map((c) => (
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
