import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useAiContextHealth,
  fetchProductIntelligencePreview,
  type ProductPreviewItem,
} from "@/hooks/useAiContextHealth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Sparkles, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const PRIORITY_COLOR: Record<string, string> = {
  alta: "bg-destructive/10 text-destructive border-destructive/30",
  media: "bg-warning/10 text-warning border-warning/30",
  baixa: "bg-success/10 text-success border-success/30",
};

function scoreColor(score: number) {
  if (score >= 80) return "text-success";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

export function ContextHealthTab() {
  const { currentTenant } = useAuth();
  const { scores, gaps, isLoading, refetch } = useAiContextHealth();
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<ProductPreviewItem[]>([]);
  const [previewSegment, setPreviewSegment] = useState<string | null>(null);
  const [previewMeta, setPreviewMeta] = useState<{ total: number; ai_used: boolean } | null>(null);
  const [filter, setFilter] = useState<"all" | "no_semantics" | "low_confidence">("all");

  async function runPreview() {
    if (!currentTenant?.id) return;
    setPreviewLoading(true);
    try {
      const res = await fetchProductIntelligencePreview({
        tenant_id: currentTenant.id, limit: 10, filter,
      });
      if (!res.success) {
        toast.error(res.error || "Falha ao gerar prévia");
        return;
      }
      setPreviewItems(res.items);
      setPreviewSegment(res.segment);
      setPreviewMeta({ total: res.total, ai_used: res.ai_used });
      toast.success(`Prévia gerada (${res.items.length} produtos)`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar prévia");
    } finally {
      setPreviewLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!scores) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhum dado de contexto disponível para este tenant ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Saúde do Contexto da IA</h2>
          <p className="text-sm text-muted-foreground">
            Diagnóstico somente leitura. Os botões de ação serão ativados na Onda B.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
        </Button>
      </div>

      <Tabs defaultValue="health" className="w-full">
        <TabsList>
          <TabsTrigger value="health">Saúde</TabsTrigger>
          <TabsTrigger value="preview">Prévia de Inteligência Comercial</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-6 mt-4">
          {/* Score geral */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Score geral</CardTitle>
              <CardDescription>Média ponderada das 9 dimensões.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${scoreColor(scores.overall_score)}`}>
                  {scores.overall_score}
                </div>
                <div className="flex-1">
                  <Progress value={scores.overall_score} className="h-2" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {scores.products_with_semantics} de {scores.products_total_active} produtos com semântica comercial.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 9 cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {gaps.length === 0 && (
              <Card className="md:col-span-3">
                <CardContent className="py-6 text-center text-sm text-success">
                  <CheckCircle2 className="inline h-4 w-4 mr-1" />
                  Todas as dimensões estão saudáveis.
                </CardContent>
              </Card>
            )}
            {[
              "brand_context_score", "language_score", "objections_score",
              "knowledge_base_score", "products_semantics_score", "approved_insights_score",
              "snapshot_freshness_score", "channel_config_score", "general_ai_config_score",
            ].map((k) => {
              const score = (scores as any)[k] as number;
              const meta = gaps.find((g) => g.dimension === k);
              const label = meta?.label || k;
              return (
                <Card key={k}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${scoreColor(score)}`}>{score}</div>
                    <Progress value={score} className="h-1.5 mt-2" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Lacunas priorizadas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Lacunas priorizadas
              </CardTitle>
              <CardDescription>
                Ordenadas por prioridade. Ações ficarão ativas na Onda B.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gaps.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem lacunas relevantes.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dimensão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Impacto na IA</TableHead>
                      <TableHead>Próxima ação</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gaps.map((g) => (
                      <TableRow key={g.dimension}>
                        <TableCell className="font-medium">{g.label}<div className="text-xs text-muted-foreground">{g.origin}</div></TableCell>
                        <TableCell>{g.current_status}</TableCell>
                        <TableCell className="text-sm">{g.impact}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" disabled title="Disponível na Onda B">
                            {g.recommended_action}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PRIORITY_COLOR[g.priority]}>
                            {g.priority}
                          </Badge>
                        </TableCell>
                        <TableCell className={scoreColor(g.score)}>{g.score}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Prévia de Inteligência Comercial
              </CardTitle>
              <CardDescription>
                Sob demanda. Não escreve nada no cadastro de produtos. Não altera comportamento da IA em produção.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as any)}
                  className="rounded border bg-background px-3 py-2 text-sm"
                >
                  <option value="all">Todos os produtos</option>
                  <option value="no_semantics">Sem semântica comercial</option>
                  <option value="low_confidence">Confiança baixa (&lt;60)</option>
                </select>
                <Button onClick={runPreview} disabled={previewLoading}>
                  {previewLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Gerar prévia (até 10)
                </Button>
                {previewMeta && (
                  <span className="text-xs text-muted-foreground">
                    Segmento detectado: <strong>{previewSegment || "—"}</strong> · {previewMeta.total} produtos no filtro · IA: {previewMeta.ai_used ? "sim" : "não"}
                  </span>
                )}
              </div>

              {previewItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Clique em "Gerar prévia" para inferir papéis comerciais sob demanda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Papel sugerido</TableHead>
                      <TableHead>Pack?</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Necessidades</TableHead>
                      <TableHead>Confiança</TableHead>
                      <TableHead>Motivo / Lacuna</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewItems.map((it) => (
                      <TableRow key={it.product_id}>
                        <TableCell className="font-medium max-w-[220px]">{it.product_name}</TableCell>
                        <TableCell>{it.product_role || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{it.is_pack_or_bundle ? <Badge variant="secondary">pack</Badge> : "—"}</TableCell>
                        <TableCell className="text-sm">{it.base_product_name || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {it.customer_needs.slice(0, 3).join(", ") || "—"}
                        </TableCell>
                        <TableCell className={scoreColor(it.confidence_score)}>
                          {it.confidence_score}
                        </TableCell>
                        <TableCell className="text-xs max-w-[280px]">
                          {it.gap ? (
                            <span className="text-warning">{it.gap}</span>
                          ) : (
                            it.reasoning
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
