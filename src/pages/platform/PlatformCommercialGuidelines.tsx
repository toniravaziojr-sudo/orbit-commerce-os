import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCcw, ExternalLink, AlertTriangle, Pencil, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateTimeBR } from "@/lib/date-format";

interface Guideline {
  id: string;
  platform: string;
  inferred_category: string;
  allowed_claims: string | null;
  prohibited_claims: string | null;
  sensitive_notes: string | null;
  required_disclaimers: string | null;
  source_url: string | null;
  version: number;
  status: string;
  last_verified_at: string;
  last_change_at: string;
}

export default function PlatformCommercialGuidelines() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Guideline | null>(null);
  const [editForm, setEditForm] = useState<Partial<Guideline>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["platform-commercial-guidelines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_commercial_guidelines")
        .select("*")
        .order("platform")
        .order("inferred_category");
      if (error) throw error;
      return data as Guideline[];
    },
  });

  const runRefresh = async (mode: "seed" | "refresh") => {
    setRefreshing(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke(
        "platform-guidelines-refresh",
        { body: { mode } },
      );
      if (error) throw error;
      toast.success(
        mode === "seed"
          ? `Baseline carregada. ${resp?.seeded ?? 0} diretrizes.`
          : `Atualização concluída. ${resp?.processed ?? 0} verificadas.`,
      );
      qc.invalidateQueries({ queryKey: ["platform-commercial-guidelines"] });
    } catch (e: any) {
      toast.error("Falha ao executar: " + (e?.message || String(e)));
    } finally {
      setRefreshing(false);
    }
  };

  const openEdit = (g: Guideline) => {
    setEditing(g);
    setEditForm({ ...g });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("platform_commercial_guidelines")
      .update({
        allowed_claims: editForm.allowed_claims ?? null,
        prohibited_claims: editForm.prohibited_claims ?? null,
        sensitive_notes: editForm.sensitive_notes ?? null,
        required_disclaimers: editForm.required_disclaimers ?? null,
        source_url: editForm.source_url ?? null,
        status: "active",
        version: (editing.version ?? 1) + 1,
        last_change_at: new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", editing.id);
    if (error) {
      toast.error("Falha ao salvar: " + error.message);
      return;
    }
    toast.success("Diretriz aprovada e atualizada.");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["platform-commercial-guidelines"] });
  };

  const platforms = Array.from(new Set((data || []).map((g) => g.platform)));
  const reviewCount = (data || []).filter((g) => g.status === "review_needed").length;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diretrizes Comerciais das Plataformas</h1>
          <p className="text-muted-foreground mt-1">
            Base global usada pela IA para criar campanhas dentro das regras de Meta, Google e TikTok.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runRefresh("seed")} disabled={refreshing}>
            Carregar baseline
          </Button>
          <Button onClick={() => runRefresh("refresh")} disabled={refreshing}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Verificar agora
          </Button>
        </div>
      </div>

      {reviewCount > 0 && (
        <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>{reviewCount} diretriz(es) aguardando revisão</AlertTitle>
          <AlertDescription>
            A última verificação detectou possíveis mudanças. Geração de campanhas continua funcionando com a versão anterior até você aprovar.
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <p className="text-muted-foreground">Carregando…</p>}

      {!isLoading && data && data.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Nenhuma diretriz cadastrada ainda. Clique em <strong>Carregar baseline</strong> para inicializar com as regras atuais conhecidas.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && data && data.length > 0 && (
        <Tabs defaultValue={platforms[0]}>
          <TabsList>
            {platforms.map((p) => (
              <TabsTrigger key={p} value={p} className="capitalize">
                {p}
              </TabsTrigger>
            ))}
          </TabsList>
          {platforms.map((p) => (
            <TabsContent key={p} value={p} className="space-y-3 mt-4">
              {(data || []).filter((g) => g.platform === p).map((g) => (
                <Card key={g.id} className={g.status === "review_needed" ? "border-amber-300" : undefined}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="capitalize text-lg">{g.inferred_category}</CardTitle>
                        <CardDescription className="flex gap-2 items-center mt-1">
                          {g.status === "review_needed" ? (
                            <Badge variant="outline" className="border-amber-500 text-amber-700">Revisão pendente</Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500 text-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Ativa
                            </Badge>
                          )}
                          <span className="text-xs">v{g.version} • verificada {formatDateTimeBR(g.last_verified_at)}</span>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        {g.source_url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={g.source_url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => openEdit(g)}>
                          <Pencil className="h-4 w-4 mr-1" /> Editar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {g.allowed_claims && (
                      <div><strong className="text-green-700">Permitido:</strong> {g.allowed_claims}</div>
                    )}
                    {g.prohibited_claims && (
                      <div><strong className="text-red-700">Proibido:</strong> {g.prohibited_claims}</div>
                    )}
                    {g.required_disclaimers && (
                      <div><strong>Disclaimer obrigatório:</strong> {g.required_disclaimers}</div>
                    )}
                    {g.sensitive_notes && (
                      <div className="text-muted-foreground whitespace-pre-wrap"><strong>Notas:</strong> {g.sensitive_notes}</div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {editing?.platform} · {editing?.inferred_category}
            </DialogTitle>
            <DialogDescription>
              Edite e aprove. A versão será incrementada e o status volta para Ativa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Permitido</Label>
              <Textarea value={editForm.allowed_claims ?? ""} onChange={(e) => setEditForm({ ...editForm, allowed_claims: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Proibido</Label>
              <Textarea value={editForm.prohibited_claims ?? ""} onChange={(e) => setEditForm({ ...editForm, prohibited_claims: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Disclaimer obrigatório</Label>
              <Textarea value={editForm.required_disclaimers ?? ""} onChange={(e) => setEditForm({ ...editForm, required_disclaimers: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Notas / contexto</Label>
              <Textarea value={editForm.sensitive_notes ?? ""} onChange={(e) => setEditForm({ ...editForm, sensitive_notes: e.target.value })} rows={4} />
            </div>
            <div>
              <Label>URL oficial (fonte)</Label>
              <Textarea value={editForm.source_url ?? ""} onChange={(e) => setEditForm({ ...editForm, source_url: e.target.value })} rows={1} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Aprovar e salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
